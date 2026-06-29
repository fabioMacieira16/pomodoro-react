from datetime import datetime, timezone, date, timedelta
from sqlalchemy.orm import Session
from app.domain.models import Achievement, UserAchievement, UserStats
from app.achievements.seed import ACHIEVEMENTS_SEED


def ensure_tables() -> None:
    """Create achievement tables if they don't exist (run once at startup)."""
    from app.data.database import engine
    Achievement.__table__.create(engine, checkfirst=True)
    UserAchievement.__table__.create(engine, checkfirst=True)
    UserStats.__table__.create(engine, checkfirst=True)


def seed_achievements(db: Session) -> None:
    """Insert missing achievements from seed (idempotent)."""
    existing_codes = {code for (code,) in db.query(Achievement.code).all()}
    for item in ACHIEVEMENTS_SEED:
        if item["code"] not in existing_codes:
            db.add(Achievement(
                code=item["code"],
                category=item["category"],
                title=item["title"],
                icon=item.get("icon"),
                reward_type="star",
                threshold=item.get("threshold"),
                event_type=item.get("event_type"),
            ))
    db.commit()


class AchievementService:
    def __init__(self, db: Session):
        self.db = db

    # ── Stats ────────────────────────────────────────────────────────────────

    def get_or_create_stats(self, user_id: int) -> UserStats:
        stats = self.db.query(UserStats).filter_by(user_id=user_id).first()
        if not stats:
            stats = UserStats(user_id=user_id)
            self.db.add(stats)
            self.db.commit()
            self.db.refresh(stats)
        return stats

    # ── Event registration ───────────────────────────────────────────────────

    def register_event(self, user_id: int, event_type: str, value: int = 1) -> None:
        """Update counters and evaluate achievement unlocks."""
        stats = self.get_or_create_stats(user_id)

        if event_type == "POMODORO_COMPLETED":
            self._update_streak(stats)
            stats.pomodoros_completed += 1
            stats.total_study_minutes += max(value, 0)
            stats.last_study_date = datetime.now(timezone.utc)
        elif event_type == "QUIZ_CORRECT":
            stats.quizzes_correct += 1
            stats.quizzes_answered += 1
        elif event_type == "QUIZ_WRONG":
            stats.quizzes_answered += 1
        elif event_type == "FLASHCARD_CREATED":
            stats.flashcards_created += max(value, 1)
        elif event_type == "FLASHCARD_REVIEWED":
            stats.flashcards_reviewed += 1

        self.db.commit()
        self._evaluate_achievements(user_id, stats)

    def _update_streak(self, stats: UserStats) -> None:
        today = date.today()
        last = stats.last_study_date.date() if stats.last_study_date else None

        if last is None or last < today - timedelta(days=1):
            stats.current_streak_days = 1
        elif last == today - timedelta(days=1):
            stats.current_streak_days = (stats.current_streak_days or 0) + 1
        # last == today: session within same day, keep streak as-is

        if (stats.current_streak_days or 0) > (stats.longest_streak_days or 0):
            stats.longest_streak_days = stats.current_streak_days

    # ── Achievement evaluation ───────────────────────────────────────────────

    def _evaluate_achievements(self, user_id: int, stats: UserStats) -> None:
        achievements = self.db.query(Achievement).all()
        unlocked_ids = {
            ua.achievement_id
            for ua in self.db.query(UserAchievement)
            .filter_by(user_id=user_id)
            .filter(UserAchievement.unlocked_at.isnot(None))
            .all()
        }

        newly_unlocked_count = 0
        for ach in achievements:
            if ach.id in unlocked_ids:
                continue
            if not ach.threshold or not ach.event_type:
                continue

            current = getattr(stats, ach.event_type, None) or 0
            if current < ach.threshold:
                continue

            # Unlock
            ua = self.db.query(UserAchievement).filter_by(
                user_id=user_id, achievement_id=ach.id
            ).first()
            now = datetime.now(timezone.utc)
            if ua:
                ua.unlocked_at = now
                ua.progress = current
            else:
                self.db.add(UserAchievement(
                    user_id=user_id,
                    achievement_id=ach.id,
                    unlocked_at=now,
                    progress=current,
                ))
            newly_unlocked_count += 1

        if newly_unlocked_count:
            self.db.commit()
            stats = self.get_or_create_stats(user_id)
            stats.total_stars += newly_unlocked_count
            self._recalculate_rewards(stats)
            self.db.commit()

    def _recalculate_rewards(self, stats: UserStats) -> None:
        s = stats.total_stars or 0
        stats.total_medals   = s // 10
        stats.total_trophies = s // 100
        stats.total_diamonds = s // 1000
        stats.total_legends  = s // 10000

    # ── Read endpoints ───────────────────────────────────────────────────────

    def get_summary(self, user_id: int) -> dict:
        stats = self.get_or_create_stats(user_id)
        stars = stats.total_stars or 0

        stars_in_tier = stars % 10
        next_milestone = ((stars // 10) + 1) * 10

        if stars < 100:
            next_reward_label = "🥇 Medalha"
        elif stars < 1000:
            next_reward_label = "🏆 Troféu"
        elif stars < 10000:
            next_reward_label = "💎 Diamante"
        else:
            next_reward_label = "👑 Lenda"

        return {
            "total_stars":    stars,
            "total_medals":   stats.total_medals or 0,
            "total_trophies": stats.total_trophies or 0,
            "total_diamonds": stats.total_diamonds or 0,
            "total_legends":  stats.total_legends or 0,
            "next_reward":    next_reward_label,
            "stars_in_tier":  stars_in_tier,
            "next_milestone": next_milestone,
            "progress_pct":   round(stars_in_tier / 10 * 100, 1),
        }

    def get_recent_unlocks(self, user_id: int, limit: int = 5) -> list:
        rows = (
            self.db.query(UserAchievement, Achievement)
            .join(Achievement, UserAchievement.achievement_id == Achievement.id)
            .filter(
                UserAchievement.user_id == user_id,
                UserAchievement.unlocked_at.isnot(None),
            )
            .order_by(UserAchievement.unlocked_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "code":        ach.code,
                "title":       ach.title,
                "icon":        ach.icon,
                "category":    ach.category,
                "unlocked_at": ua.unlocked_at.isoformat(),
            }
            for ua, ach in rows
        ]

    def get_all_achievements(self, user_id: int) -> list:
        all_achievements = (
            self.db.query(Achievement)
            .order_by(Achievement.category, Achievement.threshold)
            .all()
        )
        ua_map = {
            ua.achievement_id: ua
            for ua in self.db.query(UserAchievement).filter_by(user_id=user_id).all()
        }
        stats = self.get_or_create_stats(user_id)

        result = []
        for ach in all_achievements:
            ua = ua_map.get(ach.id)
            current = getattr(stats, ach.event_type, 0) if ach.event_type else 0
            result.append({
                "code":        ach.code,
                "category":    ach.category,
                "title":       ach.title,
                "icon":        ach.icon,
                "threshold":   ach.threshold,
                "progress":    current or 0,
                "unlocked":    ua is not None and ua.unlocked_at is not None,
                "unlocked_at": ua.unlocked_at.isoformat() if ua and ua.unlocked_at else None,
            })
        return result

    def get_user_stats(self, user_id: int) -> dict:
        stats = self.get_or_create_stats(user_id)
        return {
            "pomodoros_completed": stats.pomodoros_completed or 0,
            "quizzes_answered":    stats.quizzes_answered or 0,
            "quizzes_correct":     stats.quizzes_correct or 0,
            "flashcards_created":  stats.flashcards_created or 0,
            "flashcards_reviewed": stats.flashcards_reviewed or 0,
            "total_study_minutes": stats.total_study_minutes or 0,
            "total_study_hours":   round((stats.total_study_minutes or 0) / 60, 1),
            "current_streak_days": stats.current_streak_days or 0,
            "longest_streak_days": stats.longest_streak_days or 0,
            "accuracy_pct": (
                round(stats.quizzes_correct / stats.quizzes_answered * 100, 1)
                if stats.quizzes_answered
                else 0
            ),
        }

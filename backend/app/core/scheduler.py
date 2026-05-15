"""
Smart Scheduler — plan generation algorithm.

Pure function: receives exam + topics ORM objects, returns a list of dict records
shaped like StudyPlanItem (minus exam_id, which is added by bulk_create_plan).
"""
import json
from datetime import date, timedelta, datetime, timezone

REVIEW_INTERVALS = [1, 3, 7, 14, 30]   # days after first-study
REVIEW_MINUTES   = 20                   # fixed duration per review


def generate_plan(exam, topics: list) -> list[dict]:
    """
    Build a complete study plan for *exam* covering *topics*.

    Args:
        exam:   Exam ORM instance — must have .exam_date, .daily_hours, .available_days
        topics: list[ExamTopic] ORM instances — must have .id, .priority, .estimated_hours

    Returns:
        List of dicts ready for StudyPlanItem(**item) insertion.
        Each dict has keys: exam_topic_id, scheduled_date, duration_minutes,
        session_type, review_interval.
    """
    exam_date  = exam.exam_date.date()
    today      = date.today()
    budget_min = int(exam.daily_hours * 60)
    avail_days = set(json.loads(exam.available_days))

    # 1. Build ordered list of available dates [today, exam_date)
    all_dates: list[date] = []
    cursor = today
    while cursor < exam_date:
        if cursor.weekday() in avail_days:
            all_dates.append(cursor)
        cursor += timedelta(days=1)

    if not all_dates:
        return []

    # 2. Per-day budget tracker
    day_budget: dict[date, int] = {d: budget_min for d in all_dates}

    plan_items: list[dict] = []
    first_study_dates: dict[int, date] = {}

    # 3. Sort: priority ASC (1=High first), then estimated_hours DESC
    sorted_topics = sorted(topics, key=lambda t: (t.priority, -t.estimated_hours))

    # 4. First-study pass
    for topic in sorted_topics:
        needed = int(topic.estimated_hours * 60)

        chosen = next((d for d in all_dates if day_budget[d] >= needed), None)

        if chosen is None:
            # Fallback: pick the least-loaded day
            chosen = max(all_dates, key=lambda d: day_budget[d])

        day_budget[chosen] = max(0, day_budget[chosen] - needed)
        first_study_dates[topic.id] = chosen

        plan_items.append({
            "exam_topic_id":    topic.id,
            "scheduled_date":   datetime(chosen.year, chosen.month, chosen.day, tzinfo=timezone.utc),
            "duration_minutes": needed,
            "session_type":     "first_study",
            "review_interval":  None,
        })

    # 5. Spaced repetition review pass
    for topic in sorted_topics:
        first_date = first_study_dates.get(topic.id)
        if first_date is None:
            continue

        for interval in REVIEW_INTERVALS:
            target = first_date + timedelta(days=interval)

            if target >= exam_date:
                break

            actual = next((d for d in all_dates if d >= target), None)
            if actual is None:
                continue

            if day_budget.get(actual, 0) >= REVIEW_MINUTES:
                day_budget[actual] -= REVIEW_MINUTES
                plan_items.append({
                    "exam_topic_id":    topic.id,
                    "scheduled_date":   datetime(actual.year, actual.month, actual.day, tzinfo=timezone.utc),
                    "duration_minutes": REVIEW_MINUTES,
                    "session_type":     "review",
                    "review_interval":  interval,
                })

    return plan_items

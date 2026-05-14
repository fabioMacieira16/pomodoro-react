# Dashboard Page - Research

**Researched:** 2026-05-14
**Domain:** FastAPI aggregate queries + React/Recharts dashboard UI
**Confidence:** HIGH (backend patterns verified from codebase; Recharts version verified from npm registry)

---

## Summary

The app has a solid, consistent full-stack pattern: FastAPI router → SQLAlchemy repository → Pydantic DTO → Axios API client → Zustand store → React component. The Dashboard page follows this exact chain with no deviations.

**Key discovery:** `react-router-dom` is installed (`^6.22.3`) but currently unused — `index.tsx` renders `<Pomodoro />` directly. The dashboard must introduce routing or use a tab toggle. React Router is the right call since the dependency is already paid for.

**Key correction:** The `PomodoroSession` model field is `start_time` (not `started_at` as stated in the task description). All SQLAlchemy filter expressions must reference `self.model.start_time`.

**Recharts is not installed** — must be added (`npm install recharts`). Latest verified version: **3.8.1** [VERIFIED: npm registry].

**Primary recommendation:** One combined `GET /api/dashboard/stats` endpoint returning `{ stats, heatmap, weekly_evolution }`. Heatmap built as a custom CSS grid (no extra dependency). Routing via React Router wrapping `index.tsx`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Aggregate stats computation | API / Backend | — | SQL aggregations belong in the DB layer via SQLAlchemy, not in the frontend |
| Streak calculation | API / Backend | — | Requires sorted date arithmetic over all sessions; do not send raw sessions to frontend |
| Heatmap grid rendering | Frontend | — | Pure presentation; backend sends `[{date, count}]`, frontend maps to visual cells |
| Weekly BarChart rendering | Frontend | — | Recharts consumes `[{day_label, pomodoros, focus_minutes}]` directly |
| Progress bar (Tempo focado) | Frontend | — | Simple `Math.min(weekly / goal * 100, 100)` — no backend needed if goal is in stats |
| Auth guard | API / Backend | Frontend (redirect) | Token validated in FastAPI; frontend redirects if 401 |

---

## Standard Stack

### Core (verified)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| recharts | 3.8.1 | BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis | **Not installed — add** |
| zustand | 4.5.2 | dashboardStore state | Already installed |
| axios | 1.6.8 | `api.get('/dashboard/stats')` | Already installed |
| react-router-dom | 6.22.3 | `/dashboard` route | Already installed, **not yet wired** |

**Version verification:** `npm view recharts version` → `3.8.1` [VERIFIED: npm registry]

### Installation
```bash
cd frontend
npm install recharts
```

No type definitions needed — recharts ships its own types in v3.

### Heatmap: Custom CSS Grid (no extra package)
`react-calendar-heatmap` (latest: 1.10.0 [VERIFIED: npm registry]) is an option but brings an external stylesheet that conflicts with the app's CSS variable theming. A custom CSS grid is the right choice here:
- 84 cells (12 cols × 7 rows), each `div` colored by count
- Color scale: 4 levels mapped to CSS custom properties (or hardcoded rgba with opacity)
- Tooltip on hover via `title` attribute or a CSS `::after` pseudo-element
- Zero extra dependencies

---

## Backend: New Endpoint

### Single combined endpoint (recommended)

```
GET /api/dashboard/stats
```

Returns all data in one round-trip. The frontend calls this once on mount.

### Response shape

```python
# dtos.py additions

class HeatmapEntry(BaseModel):
    date: str   # "YYYY-MM-DD"
    count: int

class WeeklyEvolutionEntry(BaseModel):
    day: str        # "YYYY-MM-DD"
    day_label: str  # "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"
    pomodoros: int
    focus_minutes: int

class DashboardStatsResponse(BaseModel):
    hours_studied_today: float
    hours_studied_week: float
    hours_studied_all: float
    current_streak: int
    consistency_pct: float        # 0–100
    efficiency_pct: float         # avg_rating / 5 * 100, 0–100
    weekly_focus_minutes: int
    weekly_goal_minutes: int      # hardcoded default: 1500 (25h)
    most_studied_subject: Optional[str]
    most_studied_subject_minutes: Optional[int]

class DashboardResponse(BaseModel):
    stats: DashboardStatsResponse
    heatmap: list[HeatmapEntry]
    weekly_evolution: list[WeeklyEvolutionEntry]
```

---

## Backend: SQL Query Patterns

All new methods go directly in `PomodoroSessionRepository` in `repositories.py` — following the existing convention (no separate repository class).

### get_dashboard_data(db, user_id) → dict

```python
def get_dashboard_data(self, db: Session, user_id: int) -> dict:
    from datetime import date, timedelta
    from sqlalchemy import func, cast, Date

    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday of current week
    cutoff_heatmap = today - timedelta(days=83)           # 84 days inclusive
    cutoff_30 = today - timedelta(days=29)                # 30 days inclusive

    # ── Hours studied: today ────────────────────────────────────────────────
    today_minutes = (
        db.query(func.sum(self.model.duration_minutes))
        .filter(
            self.model.user_id == user_id,
            self.model.session_type == "Pomodoro",
            self.model.completed == True,
            cast(self.model.start_time, Date) == today,
        )
        .scalar()
    ) or 0

    # ── Hours studied: this week ────────────────────────────────────────────
    week_minutes = (
        db.query(func.sum(self.model.duration_minutes))
        .filter(
            self.model.user_id == user_id,
            self.model.session_type == "Pomodoro",
            self.model.completed == True,
            cast(self.model.start_time, Date) >= week_start,
        )
        .scalar()
    ) or 0

    # ── Hours studied: all time ─────────────────────────────────────────────
    all_minutes = (
        db.query(func.sum(self.model.duration_minutes))
        .filter(
            self.model.user_id == user_id,
            self.model.session_type == "Pomodoro",
            self.model.completed == True,
        )
        .scalar()
    ) or 0

    # ── Heatmap: pomodoros per day, last 84 days ────────────────────────────
    heatmap_rows = (
        db.query(
            cast(self.model.start_time, Date).label("day"),
            func.count(self.model.id).label("count"),
        )
        .filter(
            self.model.user_id == user_id,
            self.model.session_type == "Pomodoro",
            self.model.completed == True,
            cast(self.model.start_time, Date) >= cutoff_heatmap,
        )
        .group_by(cast(self.model.start_time, Date))
        .order_by(cast(self.model.start_time, Date))
        .all()
    )
    heatmap = [{"date": str(row.day), "count": row.count} for row in heatmap_rows]

    # ── Weekly evolution: pomodoros + minutes per day, last 7 days ──────────
    day_labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
    weekly_rows = (
        db.query(
            cast(self.model.start_time, Date).label("day"),
            func.count(self.model.id).label("pomodoros"),
            func.sum(self.model.duration_minutes).label("focus_minutes"),
        )
        .filter(
            self.model.user_id == user_id,
            self.model.session_type == "Pomodoro",
            self.model.completed == True,
            cast(self.model.start_time, Date) >= today - timedelta(days=6),
        )
        .group_by(cast(self.model.start_time, Date))
        .order_by(cast(self.model.start_time, Date))
        .all()
    )
    # Fill missing days with zeros
    weekly_map = {str(row.day): row for row in weekly_rows}
    weekly_evolution = []
    for i in range(7):
        d = today - timedelta(days=6 - i)
        key = str(d)
        row = weekly_map.get(key)
        weekly_evolution.append({
            "day": key,
            "day_label": day_labels[d.weekday()],
            "pomodoros": row.pomodoros if row else 0,
            "focus_minutes": row.focus_minutes if row else 0,
        })

    # ── Streak: consecutive days with ≥1 pomodoro ───────────────────────────
    all_days = (
        db.query(cast(self.model.start_time, Date).label("day"))
        .filter(
            self.model.user_id == user_id,
            self.model.session_type == "Pomodoro",
            self.model.completed == True,
        )
        .group_by(cast(self.model.start_time, Date))
        .order_by(cast(self.model.start_time, Date).desc())
        .all()
    )
    streak = 0
    if all_days:
        cursor = today
        for row in all_days:
            if row.day == cursor or row.day == cursor - timedelta(days=1):
                streak += 1
                cursor = row.day - timedelta(days=1)
            elif row.day < cursor:
                break

    # ── Consistency: % of last 30 days with ≥1 pomodoro ────────────────────
    distinct_days_30 = (
        db.query(func.count(func.distinct(cast(self.model.start_time, Date))))
        .filter(
            self.model.user_id == user_id,
            self.model.session_type == "Pomodoro",
            self.model.completed == True,
            cast(self.model.start_time, Date) >= cutoff_30,
        )
        .scalar()
    ) or 0
    consistency_pct = round((distinct_days_30 / 30) * 100, 1)

    # ── Efficiency: avg productivity_rating / 5 * 100 ───────────────────────
    avg_rating = (
        db.query(func.avg(self.model.productivity_rating))
        .filter(
            self.model.user_id == user_id,
            self.model.productivity_rating.isnot(None),
        )
        .scalar()
    )
    efficiency_pct = round((float(avg_rating) / 5 * 100), 1) if avg_rating else 0.0

    # ── Most studied subject ────────────────────────────────────────────────
    from app.domain.models import Subject
    subject_row = (
        db.query(
            Subject.name,
            func.sum(self.model.duration_minutes).label("total_minutes"),
        )
        .join(Subject, self.model.subject_id == Subject.id)
        .filter(
            self.model.user_id == user_id,
            self.model.session_type == "Pomodoro",
            self.model.completed == True,
            self.model.subject_id.isnot(None),
        )
        .group_by(Subject.id, Subject.name)
        .order_by(func.sum(self.model.duration_minutes).desc())
        .first()
    )

    return {
        "stats": {
            "hours_studied_today": round(today_minutes / 60, 2),
            "hours_studied_week": round(week_minutes / 60, 2),
            "hours_studied_all": round(all_minutes / 60, 2),
            "current_streak": streak,
            "consistency_pct": consistency_pct,
            "efficiency_pct": efficiency_pct,
            "weekly_focus_minutes": week_minutes,
            "weekly_goal_minutes": 1500,
            "most_studied_subject": subject_row.name if subject_row else None,
            "most_studied_subject_minutes": subject_row.total_minutes if subject_row else None,
        },
        "heatmap": heatmap,
        "weekly_evolution": weekly_evolution,
    }
```

> **Note on streak logic:** The streak walk starts at `today`. If no session exists today, the streak is still counted if yesterday had a session — common convention (streak not broken mid-day). Adjust start to `today - 1` if strict "must have session today" behavior is wanted.

---

## Backend: Router

```python
# backend/app/api/routers/dashboard.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import pomodoro_repo
from app.api.dependencies import get_current_user
from app.domain.models import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=dtos.DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return pomodoro_repo.get_dashboard_data(db, current_user.id)
```

```python
# backend/app/main.py — add dashboard import and include_router
from app.api.routers import auth, tasks, pomodoro_sessions, settings, dashboard

app.include_router(dashboard.router, prefix="/api")
```

---

## Frontend: Routing Strategy

**Current state:** `index.tsx` renders `<Pomodoro />` directly. `react-router-dom` is installed but not used.

**Recommended:** Introduce React Router in `index.tsx`. Minimal change — no new `App.tsx` wrapper needed:

```tsx
// index.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Pomodoro from './containers/Pomodoro';
import Dashboard from './containers/Dashboard';

root.render(
  <React.StrictMode>
    <DndProvider backend={HTML5Backend}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Pomodoro />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </DndProvider>
  </React.StrictMode>
);
```

Add a Dashboard button to the header in `Pomodoro.tsx` using `useNavigate()` from react-router-dom, navigating to `/dashboard`. Mirror with a Back button in `Dashboard.tsx`.

**Alternative — simple tab state:** Add `const [view, setView] = useState<'pomodoro' | 'dashboard'>('pomodoro')` in `index.tsx` and conditionally render. Simpler but no shareable URL. **Not recommended** because the dep is already installed and URLs are cleaner.

---

## Frontend: Recharts Components Per Widget

| Widget | Recharts Component(s) | Notes |
|--------|----------------------|-------|
| Evolução semanal (BarChart) | `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer` | `dataKey="pomodoros"`, `XAxis dataKey="day_label"` |
| Heatmap | **Custom CSS grid** (no Recharts) | 84 `div` cells, CSS `grid-template-columns: repeat(12, 1fr)` |
| Tempo focado (progress bar) | No Recharts — plain HTML `<progress>` or CSS bar | Simple `width: ${pct}%` div |
| All other stat cards | No Recharts — plain HTML | Number + label layout |

### WeeklyChart pattern (Recharts v3)

```tsx
// Source: recharts.org/guide/getting-started
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

<ResponsiveContainer width="100%" height={200}>
  <BarChart data={weeklyEvolution} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
    <XAxis dataKey="day_label" tick={{ fontSize: 11 }} />
    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
    <Tooltip />
    <Bar dataKey="pomodoros" fill="var(--pomo-accent, #e03e3e)" radius={[3, 3, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

### Heatmap CSS Grid pattern

```tsx
// 84 cells: build a map from date string → count for O(1) lookup
const cellMap = Object.fromEntries(heatmap.map(e => [e.date, e.count]));

// Generate 84 days from 83 days ago to today
const days = Array.from({ length: 84 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - 83 + i);
  return d.toISOString().slice(0, 10);
});

const getLevel = (count: number) =>
  count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3;

return (
  <div className="heatmap-grid">
    {days.map(date => (
      <div
        key={date}
        className={`heatmap-cell level-${getLevel(cellMap[date] ?? 0)}`}
        title={`${date}: ${cellMap[date] ?? 0} pomodoros`}
      />
    ))}
  </div>
);

/* CSS:
.heatmap-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; }
.heatmap-cell { aspect-ratio: 1; border-radius: 2px; }
.heatmap-cell.level-0 { background: var(--pomo-surface-alt, rgba(0,0,0,0.06)); }
.heatmap-cell.level-1 { background: rgba(224, 62, 62, 0.25); }
.heatmap-cell.level-2 { background: rgba(224, 62, 62, 0.55); }
.heatmap-cell.level-3 { background: rgba(224, 62, 62, 0.90); }
*/
```

> **Layout note:** `grid-template-columns: repeat(12, 1fr)` renders 12 columns (weeks). The 84 cells flow left-to-right, top-to-bottom — this is NOT a GitHub-style Mon-Sun vertical layout. For a true GitHub-style grid (day-of-week on Y axis, week on X axis), use `grid-template-rows: repeat(7, 1fr)` with `grid-auto-flow: column` and 12 explicit columns. Both are valid — the simpler row-flow version is easier to implement first.

---

## Frontend: Zustand Store

```typescript
// store/dashboardStore.ts
import { create } from 'zustand';
import api from '../api/client';
import type { DashboardData } from '../types';

interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  fetchDashboard: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  isLoading: false,

  fetchDashboard: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/dashboard/stats');
      set({ data: res.data });
    } catch (e) {
      console.error('Dashboard fetch failed', e);
    } finally {
      set({ isLoading: false });
    }
  },
}));
```

---

## Frontend: TypeScript Types

New types to add to `frontend/src/types/index.ts`:

```typescript
export interface HeatmapEntry {
  date: string;   // "YYYY-MM-DD"
  count: number;
}

export interface WeeklyEvolutionEntry {
  day: string;         // "YYYY-MM-DD"
  day_label: string;   // "Seg" | "Ter" | etc.
  pomodoros: number;
  focus_minutes: number;
}

export interface DashboardStats {
  hours_studied_today: number;
  hours_studied_week: number;
  hours_studied_all: number;
  current_streak: number;
  consistency_pct: number;
  efficiency_pct: number;
  weekly_focus_minutes: number;
  weekly_goal_minutes: number;
  most_studied_subject?: string;
  most_studied_subject_minutes?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  heatmap: HeatmapEntry[];
  weekly_evolution: WeeklyEvolutionEntry[];
}
```

---

## Frontend: Component File Structure

```
frontend/src/
├── containers/
│   └── Dashboard.tsx           ← page container, calls useDashboardStore
├── store/
│   └── dashboardStore.ts
├── components/
│   └── Dashboard/
│       ├── StatsWidgets/
│       │   ├── index.tsx       ← stat cards (streak, consistency, efficiency, hours)
│       │   └── styles.css
│       ├── Heatmap/
│       │   ├── index.tsx       ← CSS grid heatmap
│       │   └── styles.css
│       └── WeeklyChart/
│           ├── index.tsx       ← Recharts BarChart
│           └── styles.css
└── types/index.ts              ← add DashboardData, HeatmapEntry, etc.
```

---

## Common Pitfalls

### Pitfall 1: `started_at` vs `start_time`
**What goes wrong:** Filtering on `self.model.started_at` raises `AttributeError`.
**Root cause:** The `PomodoroSession` model defines the field as `start_time`, not `started_at`.
**How to avoid:** Always use `self.model.start_time` in all repository queries.

### Pitfall 2: Missing days in weekly_evolution
**What goes wrong:** Days with zero Pomodoros are omitted from the SQL result, so the BarChart shows gaps.
**How to avoid:** Fill missing days server-side (shown in query above) OR client-side by generating the 7-day range and merging with the response array.

### Pitfall 3: Recharts width: "100%" requires a sized parent
**What goes wrong:** `ResponsiveContainer` renders at 0px width if the parent has no explicit width/height.
**How to avoid:** Ensure the parent container has `width: 100%` and a fixed or min-height. Use `height={200}` on `ResponsiveContainer`, not percentage.

### Pitfall 4: Streak off-by-one
**What goes wrong:** Streak counts 0 if user has sessions today but the walk starts at `today - 1`.
**How to avoid:** The streak walk shown above handles this — it accepts `row.day == today` OR `row.day == today - 1` on the first iteration.

### Pitfall 5: `func.distinct` inside `func.count` (SQLite vs PostgreSQL)
**What goes wrong:** `func.count(func.distinct(...))` may not work on all SQLAlchemy dialects.
**How to avoid:** Use `func.count(func.distinct(cast(self.model.start_time, Date)))` — this is valid SQLAlchemy for both SQLite and PostgreSQL.

### Pitfall 6: Router not registered
**What goes wrong:** `GET /api/dashboard/stats` returns 404.
**How to avoid:** Add `from app.api.routers import ... dashboard` and `app.include_router(dashboard.router, prefix="/api")` in `main.py`.

---

## Data Model Correction Note

The user request described the field as `started_at`. The actual `PomodoroSession` model (verified in `backend/app/domain/models.py`) has:
- `start_time` — DateTime, server_default=func.now()
- `end_time` — DateTime, nullable

No `started_at` field exists. All backend queries must use `start_time`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Weekly goal default of 1500 minutes (25h) is reasonable | DashboardStatsResponse | User may want configurable goal — keep as hardcoded constant initially, add Setting field later |
| A2 | Streak: session on today OR yesterday counts as "streak active" (not broken mid-day) | Streak query | User may want strict "must have session today" — easy to change by starting cursor at `today - 1` |
| A3 | Heatmap renders as simple row-flow grid (not GitHub-style day-of-week columns) | Heatmap pattern | User may expect GitHub-style vertical day layout — document the two grid approaches |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `backend/app/domain/models.py` — field names, types, relationships
- Codebase: `backend/app/data/repositories.py` — existing query patterns
- Codebase: `backend/app/api/dtos.py` — DTO conventions
- Codebase: `frontend/src/containers/Pomodoro.tsx` — component/routing patterns
- Codebase: `frontend/package.json` — installed dependencies
- npm registry: `recharts` → 3.8.1 [VERIFIED]
- npm registry: `react-calendar-heatmap` → 1.10.0 [VERIFIED]
- Codebase: `.planning/intel/PATTERNS.md` — pre-analyzed architectural patterns

### Secondary (MEDIUM confidence)
- Recharts documentation (recharts.org): BarChart, ResponsiveContainer API [ASSUMED from training — consult recharts.org for v3 API changes]

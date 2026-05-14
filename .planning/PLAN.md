# Dashboard Phase — Execution Plan

**Phase Goal:** Build a `/dashboard` page showing productivity analytics (heatmap, streak, consistency, efficiency, weekly chart, focused time, most studied subject, hours studied) using Recharts.

**Research source:** `.planning/RESEARCH.md` | **Pattern source:** `.planning/intel/PATTERNS.md` | **Architecture source:** `.planning/intel/ARCH.md`

---

## Dependency Map

```
[B-01] DTOs ──────────────────────────┐
[B-02] Repo method ───────────────────┼──► [B-03] Router ──► [B-04] main.py
                                      │
[F-00] npm install recharts           │
[F-01] Types ─────────────────────────┤
       │                              │
       ├──► [F-02] Store ────────────►│
       ├──► [F-03] StatCard           │
       ├──► [F-04] Heatmap            │
       ├──► [F-05] ConsistencyBar     │
       └──► [F-06] WeeklyChart ◄──────┘
                    (needs recharts)
[F-02][F-03][F-04][F-05][F-06] ──► [F-07] Dashboard container
[F-07] ──► [F-08] index.tsx routing
[F-08] ──► [F-09] Pomodoro.tsx nav button
```

---

## GROUP 1 — Backend

---

### B-01 · Add Dashboard DTOs to dtos.py

**file_path:** `backend/app/api/dtos.py`

**depends_on:** none

**what_to_do:**

Append four new Pydantic models at the **end** of the existing file. Do not modify any existing DTOs.

```python
# ── Dashboard DTOs ──────────────────────────────────────────────────────────

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
    efficiency_pct: float         # 0–100
    weekly_focus_minutes: int
    weekly_goal_minutes: int      # default 1500 (25 h)
    most_studied_subject: Optional[str]
    most_studied_subject_minutes: Optional[int]

class DashboardResponse(BaseModel):
    stats: DashboardStatsResponse
    heatmap: list[HeatmapEntry]
    weekly_evolution: list[WeeklyEvolutionEntry]
```

`Optional` is already imported at the top of `dtos.py` — do not re-import.  
No `class Config: from_attributes = True` needed — the router returns a plain `dict`, not an ORM object.

**acceptance_criteria:**
- `from app.api.dtos import DashboardResponse, DashboardStatsResponse, HeatmapEntry, WeeklyEvolutionEntry` executes without error in a Python REPL inside the venv.
- `DashboardResponse(stats={...}, heatmap=[], weekly_evolution=[])` does not raise a validation error when all required `stats` fields are provided.

---

### B-02 · Add get_dashboard_data method to PomodoroSessionRepository

**file_path:** `backend/app/data/repositories.py`

**depends_on:** none

**what_to_do:**

Add the following method directly inside the `PomodoroSessionRepository` class, after the existing `get_stats` method. Do not create a new class or a new file.

```python
def get_dashboard_data(self, db: Session, user_id: int) -> dict:
    from datetime import date, timedelta
    from sqlalchemy import func, cast, Date

    today = date.today()
    week_start = today - timedelta(days=today.weekday())   # Monday of current week
    cutoff_heatmap = today - timedelta(days=83)            # 84 days inclusive
    cutoff_30 = today - timedelta(days=29)                 # 30 days inclusive

    # ── Hours studied: today ───────────────────────────────────────────────
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

    # ── Hours studied: this week ───────────────────────────────────────────
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

    # ── Hours studied: all time ────────────────────────────────────────────
    all_minutes = (
        db.query(func.sum(self.model.duration_minutes))
        .filter(
            self.model.user_id == user_id,
            self.model.session_type == "Pomodoro",
            self.model.completed == True,
        )
        .scalar()
    ) or 0

    # ── Heatmap: completed pomodoros per day, last 84 days ─────────────────
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

    # ── Weekly evolution: last 7 days, fill missing days with zeros ─────────
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
            "focus_minutes": int(row.focus_minutes) if row else 0,
        })

    # ── Streak: consecutive days with ≥1 completed pomodoro ────────────────
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

    # ── Consistency: % of last 30 days with ≥1 pomodoro ───────────────────
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

    # ── Efficiency: avg productivity_rating / 5 * 100 ─────────────────────
    avg_rating = (
        db.query(func.avg(self.model.productivity_rating))
        .filter(
            self.model.user_id == user_id,
            self.model.productivity_rating.isnot(None),
        )
        .scalar()
    )
    efficiency_pct = round((float(avg_rating) / 5 * 100), 1) if avg_rating else 0.0

    # ── Most studied subject ───────────────────────────────────────────────
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
            "most_studied_subject_minutes": int(subject_row.total_minutes) if subject_row else None,
        },
        "heatmap": heatmap,
        "weekly_evolution": weekly_evolution,
    }
```

**Critical:** Use `self.model.start_time` everywhere — the ORM field is `start_time`, not `started_at`.

**acceptance_criteria:**
- `pomodoro_repo.get_dashboard_data(db, 1)` returns a dict with keys `stats`, `heatmap`, `weekly_evolution` when called against the dev database.
- `stats` dict contains all 10 keys: `hours_studied_today`, `hours_studied_week`, `hours_studied_all`, `current_streak`, `consistency_pct`, `efficiency_pct`, `weekly_focus_minutes`, `weekly_goal_minutes`, `most_studied_subject`, `most_studied_subject_minutes`.
- `weekly_evolution` always has exactly 7 entries, even if the user has no sessions.

---

### B-03 · Create dashboard.py router

**file_path:** `backend/app/api/routers/dashboard.py`

**depends_on:** B-01 (dtos.DashboardResponse), B-02 (pomodoro_repo.get_dashboard_data)

**what_to_do:**

Create a new file with exactly this content:

```python
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

No other endpoints. No ownership check needed — `get_dashboard_data` already scopes queries to `user_id`.

**acceptance_criteria:**
- File exists at `backend/app/api/routers/dashboard.py`.
- `from app.api.routers.dashboard import router` executes without error.
- `router.routes` contains one route: `GET /dashboard/stats`.

---

### B-04 · Register dashboard router in main.py

**file_path:** `backend/app/main.py`

**depends_on:** B-03

**what_to_do:**

Two edits to the existing file:

1. **Line 3** — extend the existing import to add `dashboard`:
   ```python
   # Before:
   from app.api.routers import auth, tasks, pomodoro_sessions, settings
   # After:
   from app.api.routers import auth, tasks, pomodoro_sessions, settings, dashboard
   ```

2. **After the last `app.include_router(...)` call** — add one line:
   ```python
   app.include_router(dashboard.router, prefix="/api")
   ```

No other changes to `main.py`.

**acceptance_criteria:**
- `GET /api/dashboard/stats` returns `200` with a valid Bearer token.
- `GET /api/dashboard/stats` returns `401` without a token.
- Backend server starts without import errors (`uvicorn app.main:app --reload`).

---

## GROUP 2 — Frontend Store

---

### F-00 · Install recharts

**file_path:** `frontend/package.json` (modified by npm)

**depends_on:** none

**what_to_do:**

Run in the `frontend/` directory:

```bash
npm install recharts
```

This installs recharts 3.8.1 (latest as of research date). No `@types/recharts` needed — recharts ships its own TypeScript declarations in v3.

**acceptance_criteria:**
- `"recharts"` appears in `frontend/package.json` `dependencies`.
- `import { BarChart } from 'recharts'` resolves without TypeScript errors inside `frontend/src/`.

---

### F-01 · Add Dashboard type interfaces to types/index.ts

**file_path:** `frontend/src/types/index.ts`

**depends_on:** none

**what_to_do:**

Append the following four interfaces at the **end** of the existing file. Do not modify any existing interfaces.

```typescript
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

export interface HeatmapEntry {
  date: string;   // "YYYY-MM-DD"
  count: number;
}

export interface WeeklyEvolutionEntry {
  day: string;        // "YYYY-MM-DD"
  day_label: string;  // "Seg", "Ter" …
  pomodoros: number;
  focus_minutes: number;
}

export interface DashboardData {
  stats: DashboardStats;
  heatmap: HeatmapEntry[];
  weekly_evolution: WeeklyEvolutionEntry[];
}
```

**acceptance_criteria:**
- `import type { DashboardData, DashboardStats, HeatmapEntry, WeeklyEvolutionEntry } from '../types'` compiles without error.
- No existing interface is modified or removed.

---

### F-02 · Create dashboardStore.ts

**file_path:** `frontend/src/store/dashboardStore.ts`

**depends_on:** F-01

**what_to_do:**

Create a new file with exactly this content:

```typescript
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
      set({ data: res.data, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
      set({ isLoading: false });
    }
  },
}));
```

Rules followed:
- Auth handled by the axios interceptor in `api/client.ts` — no manual token logic here.
- `console.error` in the catch block (taskStore convention, easier to debug).
- No `zustand/persist` — dashboard data does not need to survive tab refresh.
- `set({ isLoading: true })` before the request so the Dashboard container can show a spinner.

**acceptance_criteria:**
- `import { useDashboardStore } from '../store/dashboardStore'` compiles without error.
- `useDashboardStore.getState().data` is `null` on init.
- `useDashboardStore.getState().isLoading` is `false` on init.

---

## GROUP 3 — Frontend Components

---

### F-03 · Create StatCard component

**file_path:** `frontend/src/components/Dashboard/StatCard/index.tsx` and `frontend/src/components/Dashboard/StatCard/styles.css`

**depends_on:** none (no store, no types needed — pure props)

**what_to_do:**

**`index.tsx`:**
```tsx
import React, { memo } from 'react';
import './styles.css';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, sub }) => (
  <div className="stat-card">
    <span className="stat-card__label">{label}</span>
    <div className="stat-card__value-row">
      <span className="stat-card__value">{value}</span>
      {unit && <span className="stat-card__unit">{unit}</span>}
    </div>
    {sub && <span className="stat-card__sub">{sub}</span>}
  </div>
);

export default memo(StatCard);
```

**`styles.css`:**
```css
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: 12px;
  background: var(--pomo-surface-alt, rgba(0, 0, 0, 0.05));
  border: 1px solid var(--pomo-border, rgba(0, 0, 0, 0.12));
}

.stat-card__label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.5;
  color: var(--pomo-text, #1a1a2e);
}

.stat-card__value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-card__value {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--pomo-text, #1a1a2e);
}

.stat-card__unit {
  font-size: 0.75rem;
  opacity: 0.6;
  color: var(--pomo-text, #1a1a2e);
}

.stat-card__sub {
  font-size: 0.7rem;
  opacity: 0.5;
  color: var(--pomo-text, #1a1a2e);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**acceptance_criteria:**
- `<StatCard label="Streak" value={5} unit="dias" />` renders without error.
- `<StatCard label="Matéria" value="Matemática" sub="12 min" />` renders `sub` text.
- CSS uses only `var(--pomo-*)` custom properties for colors — no hardcoded hex values for theming.

---

### F-04 · Create Heatmap component

**file_path:** `frontend/src/components/Dashboard/Heatmap/index.tsx` and `frontend/src/components/Dashboard/Heatmap/styles.css`

**depends_on:** F-01 (HeatmapEntry type)

**what_to_do:**

**`index.tsx`:**
```tsx
import React, { memo } from 'react';
import type { HeatmapEntry } from '../../../types';
import './styles.css';

interface HeatmapProps {
  data: HeatmapEntry[];  // up to 84 entries, sparse (missing dates = 0)
}

function countToLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function buildCells(data: HeatmapEntry[]): { date: string; count: number }[] {
  const map = new Map(data.map((e) => [e.date, e.count]));
  const today = new Date();
  const cells: { date: string; count: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, count: map.get(key) ?? 0 });
  }
  return cells;
}

const Heatmap: React.FC<HeatmapProps> = ({ data }) => {
  const cells = buildCells(data);

  return (
    <div className="heatmap">
      <p className="heatmap__title">Atividade (últimos 84 dias)</p>
      <div className="heatmap__grid">
        {cells.map((cell) => (
          <div
            key={cell.date}
            className={`heatmap__cell heatmap__cell--l${countToLevel(cell.count)}`}
            title={`${cell.date}: ${cell.count} pomodoro${cell.count !== 1 ? 's' : ''}`}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(Heatmap);
```

**`styles.css`:**
```css
.heatmap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.heatmap__title {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.5;
  margin: 0;
  color: var(--pomo-text, #1a1a2e);
}

.heatmap__grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 3px;
}

.heatmap__cell {
  aspect-ratio: 1;
  border-radius: 2px;
}

.heatmap__cell--l0 { background: var(--pomo-border, rgba(0, 0, 0, 0.10)); }
.heatmap__cell--l1 { background: rgba(99, 102, 241, 0.25); }
.heatmap__cell--l2 { background: rgba(99, 102, 241, 0.50); }
.heatmap__cell--l3 { background: rgba(99, 102, 241, 0.75); }
.heatmap__cell--l4 { background: rgba(99, 102, 241, 1.00); }
```

**acceptance_criteria:**
- `<Heatmap data={[]} />` renders exactly 84 cells in the grid (all level-0).
- `<Heatmap data={[{ date: '2026-05-14', count: 6 }]} />` renders the matching cell with class `heatmap__cell--l4` and `title` containing `"2026-05-14: 6 pomodoros"`.
- Grid is 12 columns × 7 rows (CSS `grid-template-columns: repeat(12, 1fr)`).

---

### F-05 · Create ConsistencyBar component

**file_path:** `frontend/src/components/Dashboard/ConsistencyBar/index.tsx` and `frontend/src/components/Dashboard/ConsistencyBar/styles.css`

**depends_on:** none (pure props)

**what_to_do:**

**`index.tsx`:**
```tsx
import React, { memo } from 'react';
import './styles.css';

interface ConsistencyBarProps {
  label: string;
  value: number;   // current value (e.g. 72.5 for 72.5%)
  max: number;     // 100 for percentage bars
  unit?: string;   // e.g. "%" or "min"
  color?: string;  // CSS color string; defaults to var(--pomo-accent)
}

const ConsistencyBar: React.FC<ConsistencyBarProps> = ({
  label,
  value,
  max,
  unit = '%',
  color,
}) => {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <div className="consistency-bar">
      <div className="consistency-bar__header">
        <span className="consistency-bar__label">{label}</span>
        <span className="consistency-bar__value">
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="consistency-bar__track">
        <div
          className="consistency-bar__fill"
          style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }}
        />
      </div>
    </div>
  );
};

export default memo(ConsistencyBar);
```

**`styles.css`:**
```css
.consistency-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.consistency-bar__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.consistency-bar__label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.5;
  color: var(--pomo-text, #1a1a2e);
}

.consistency-bar__value {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--pomo-text, #1a1a2e);
}

.consistency-bar__track {
  height: 8px;
  border-radius: 4px;
  background: var(--pomo-border, rgba(0, 0, 0, 0.12));
  overflow: hidden;
}

.consistency-bar__fill {
  height: 100%;
  border-radius: 4px;
  background: var(--pomo-accent, #6366f1);
  transition: width 0.4s ease;
}
```

**acceptance_criteria:**
- `<ConsistencyBar label="Consistência" value={72.5} max={100} />` renders a fill div with `width: 72.5%`.
- `<ConsistencyBar label="X" value={150} max={100} />` clamps fill width to `100%` (does not overflow).
- `<ConsistencyBar label="X" value={0} max={100} />` renders fill div with `width: 0%`.

---

### F-06 · Create WeeklyChart component

**file_path:** `frontend/src/components/Dashboard/WeeklyChart/index.tsx` and `frontend/src/components/Dashboard/WeeklyChart/styles.css`

**depends_on:** F-00 (recharts installed), F-01 (WeeklyEvolutionEntry type)

**what_to_do:**

**`index.tsx`:**
```tsx
import React, { memo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { WeeklyEvolutionEntry } from '../../../types';
import './styles.css';

interface WeeklyChartProps {
  data: WeeklyEvolutionEntry[];
}

const WeeklyChart: React.FC<WeeklyChartProps> = ({ data }) => (
  <div className="weekly-chart">
    <p className="weekly-chart__title">Evolução semanal</p>
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="day_label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="pomodoros" name="Pomodoros" fill="rgba(99, 102, 241, 0.85)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="focus_minutes" name="Minutos focados" fill="rgba(99, 102, 241, 0.35)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default memo(WeeklyChart);
```

**`styles.css`:**
```css
.weekly-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.weekly-chart__title {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.5;
  margin: 0;
  color: var(--pomo-text, #1a1a2e);
}
```

**acceptance_criteria:**
- `<WeeklyChart data={[{ day: '2026-05-14', day_label: 'Qua', pomodoros: 3, focus_minutes: 75 }]} />` renders without error.
- The Recharts `BarChart` renders two `Bar` elements (`pomodoros` and `focus_minutes`).
- No TypeScript errors (recharts types are bundled in v3 — no `@types/recharts` needed).

---

### F-07 · Create Dashboard container

**file_path:** `frontend/src/containers/Dashboard.tsx` and `frontend/src/containers/Dashboard.css`

**depends_on:** F-02 (useDashboardStore), F-03 (StatCard), F-04 (Heatmap), F-05 (ConsistencyBar), F-06 (WeeklyChart)

**what_to_do:**

**`Dashboard.tsx`:**
```tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import StatCard from '../components/Dashboard/StatCard';
import Heatmap from '../components/Dashboard/Heatmap';
import ConsistencyBar from '../components/Dashboard/ConsistencyBar';
import WeeklyChart from '../components/Dashboard/WeeklyChart';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, fetchDashboard } = useDashboardStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading || !data) {
    return (
      <div className="dashboard dashboard--loading">
        <p>Carregando...</p>
      </div>
    );
  }

  const { stats, heatmap, weekly_evolution } = data;
  const weeklyProgressMin = stats.weekly_focus_minutes;
  const weeklyGoalMin = stats.weekly_goal_minutes;

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <button
          className="dashboard__back-btn"
          onClick={() => navigate('/')}
          title="Voltar ao Pomodoro"
        >
          ← Pomodoro
        </button>
        <h1 className="dashboard__title">Dashboard</h1>
      </header>

      <section className="dashboard__stats-grid">
        <StatCard
          label="Horas hoje"
          value={stats.hours_studied_today.toFixed(1)}
          unit="h"
        />
        <StatCard
          label="Horas esta semana"
          value={stats.hours_studied_week.toFixed(1)}
          unit="h"
        />
        <StatCard
          label="Horas no total"
          value={stats.hours_studied_all.toFixed(1)}
          unit="h"
        />
        <StatCard
          label="Sequência"
          value={stats.current_streak}
          unit="dias"
        />
        <StatCard
          label="Matéria mais estudada"
          value={stats.most_studied_subject ?? '—'}
          sub={
            stats.most_studied_subject_minutes != null
              ? `${stats.most_studied_subject_minutes} min`
              : undefined
          }
        />
      </section>

      <section className="dashboard__section">
        <ConsistencyBar
          label="Consistência (últimos 30 dias)"
          value={stats.consistency_pct}
          max={100}
          unit="%"
        />
        <ConsistencyBar
          label="Eficiência"
          value={stats.efficiency_pct}
          max={100}
          unit="%"
          color="rgba(16, 185, 129, 0.85)"
        />
        <ConsistencyBar
          label={`Tempo focado esta semana (meta: ${Math.round(weeklyGoalMin / 60)}h)`}
          value={weeklyProgressMin}
          max={weeklyGoalMin}
          unit=" min"
        />
      </section>

      <section className="dashboard__section">
        <WeeklyChart data={weekly_evolution} />
      </section>

      <section className="dashboard__section">
        <Heatmap data={heatmap} />
      </section>
    </div>
  );
};

export default Dashboard;
```

**`Dashboard.css`:**
```css
.dashboard {
  min-height: 100vh;
  padding: 24px 32px;
  background: var(--pomo-bg, #f8f8fc);
  color: var(--pomo-text, #1a1a2e);
  box-sizing: border-box;
}

.dashboard--loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dashboard__header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.dashboard__back-btn {
  background: none;
  border: 1px solid var(--pomo-border, rgba(0, 0, 0, 0.12));
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--pomo-text, #1a1a2e);
}

.dashboard__back-btn:hover {
  background: var(--pomo-surface-alt, rgba(0, 0, 0, 0.05));
}

.dashboard__title {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
}

.dashboard__stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.dashboard__section {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

**acceptance_criteria:**
- Navigating to `/dashboard` (after routing is wired in F-08) renders the page without crashing.
- While `isLoading` is `true` / `data` is `null`, shows `"Carregando..."`.
- After data loads: renders 5 StatCard widgets, 3 ConsistencyBar elements, 1 WeeklyChart, 1 Heatmap.
- Clicking "← Pomodoro" navigates back to `/`.

---

## GROUP 4 — Frontend Routing

---

### F-08 · Wire React Router in index.tsx

**file_path:** `frontend/src/index.tsx`

**depends_on:** F-07 (Dashboard container exists and can be imported)

**what_to_do:**

Replace the entire content of `index.tsx` with:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Pomodoro from './containers/Pomodoro';
import Dashboard from './containers/Dashboard';
import './style.css';

const container = document.getElementById('root');
const root = createRoot(container!);

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

`BrowserRouter` wraps `DndProvider` is also valid — but placing `BrowserRouter` inside `DndProvider` (as above) keeps DnD at root level, consistent with the original structure.

**acceptance_criteria:**
- `http://localhost:5173/` renders the Pomodoro page (unchanged behavior).
- `http://localhost:5173/dashboard` renders the Dashboard page.
- No TypeScript errors in `index.tsx` after the change.
- DnD still works on the Pomodoro task list (DndProvider is still present).

---

### F-09 · Add Dashboard navigation button to Pomodoro.tsx

**file_path:** `frontend/src/containers/Pomodoro.tsx`

**depends_on:** F-08 (BrowserRouter must be in the tree before `useNavigate` is called)

**what_to_do:**

Two edits to `Pomodoro.tsx`:

**Edit 1 — Add import** at the top of the file, after the existing React Router import (or after the last import block):
```tsx
import { useNavigate } from 'react-router-dom';
```

**Edit 2 — Add `useNavigate` hook** inside the component function, near the top with the other hooks:
```tsx
const navigate = useNavigate();
```

**Edit 3 — Add button** inside the `<div className="header-actions">` div, as the **first** child (before the focus-mode button), to place it on the left side of the actions group:
```tsx
<button
  className="icon-btn"
  onClick={() => navigate('/dashboard')}
  title="Dashboard"
>
  📊
</button>
```

**acceptance_criteria:**
- A 📊 button appears in the `app-header` on the Pomodoro page.
- Clicking it navigates to `/dashboard` without a full page reload (client-side navigation).
- No TypeScript errors introduced.
- All existing header buttons (🎯, ⚙️, fullscreen) remain present and functional.

---

## Execution Order Summary

| Step | Task ID | Title | Blocking? |
|------|---------|-------|-----------|
| 1 | B-01 | Add Dashboard DTOs to dtos.py | No (parallel with B-02, F-00, F-01) |
| 1 | B-02 | Add get_dashboard_data method | No (parallel with B-01, F-00, F-01) |
| 1 | F-00 | Install recharts | No (parallel with B-01, B-02, F-01) |
| 1 | F-01 | Add Dashboard types to types/index.ts | No (parallel with B-01, B-02, F-00) |
| 2 | B-03 | Create dashboard.py router | Needs B-01, B-02 |
| 2 | F-02 | Create dashboardStore.ts | Needs F-01 |
| 2 | F-03 | Create StatCard component | Needs nothing (pure props) |
| 2 | F-04 | Create Heatmap component | Needs F-01 |
| 2 | F-05 | Create ConsistencyBar component | Needs nothing (pure props) |
| 2 | F-06 | Create WeeklyChart component | Needs F-00, F-01 |
| 3 | B-04 | Register router in main.py | Needs B-03 |
| 3 | F-07 | Create Dashboard container | Needs F-02, F-03, F-04, F-05, F-06 |
| 4 | F-08 | Wire React Router in index.tsx | Needs F-07 |
| 5 | F-09 | Add nav button to Pomodoro.tsx | Needs F-08 |

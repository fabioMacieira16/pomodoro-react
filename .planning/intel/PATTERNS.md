# PATTERNS.md — Dashboard Feature Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** ~12 new/modified files (Dashboard page, stats router, heatmap repo method, dashboard store, chart components, DTOs, types)
**Analogs found:** 6 / 6 core roles covered

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/api/routers/dashboard.py` | router | request-response | `routers/pomodoro_sessions.py` | exact |
| `backend/app/data/repositories.py` (new methods) | repository | CRUD / aggregate | `repositories.py` `PomodoroSessionRepository.get_stats` | exact |
| `backend/app/api/dtos.py` (new DTOs) | DTO | request-response | `dtos.py` `PomodoroStatsResponse` | exact |
| `backend/app/domain/models.py` (reference only) | model | — | `models.py` `PomodoroSession` / `Subject` | reference |
| `frontend/src/store/dashboardStore.ts` | store | request-response | `store/pomodoroStore.ts` | exact |
| `frontend/src/types/index.ts` (new interfaces) | types | — | `types/index.ts` `PomodoroStats` | exact |
| `frontend/src/api/client.ts` (no changes needed) | api client | request-response | `api/client.ts` | exact |
| `frontend/src/containers/Dashboard.tsx` | container/page | request-response | `containers/Pomodoro.tsx` | role-match |
| `frontend/src/components/Dashboard/StatsWidgets/index.tsx` | component | request-response | `components/PomodoroStats/index.tsx` | exact |
| `frontend/src/components/Dashboard/StatsWidgets/styles.css` | styles | — | `components/PomodoroStats/styles.css` | exact |
| `frontend/src/components/Dashboard/Heatmap/index.tsx` | component | transform | `components/PomodoroDots/index.tsx` | role-match |
| `frontend/src/components/Dashboard/WeeklyChart/index.tsx` | component | transform | `components/PomodoroStats/index.tsx` | role-match |

---

## Pattern Assignments

### 1. Router Pattern

**Analog:** `backend/app/api/routers/pomodoro_sessions.py`

**Imports (lines 1–7):**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dtos
from app.data.database import get_db
from app.data.repositories import pomodoro_repo   # swap for dashboard_repo / pomodoro_repo
from app.api.dependencies import get_current_user
from app.domain.models import User
```

**Router declaration (line 9):**
```python
router = APIRouter(prefix="/dashboard", tags=["dashboard"])
```

**Auth-guarded GET endpoint (lines 23–29):**
```python
@router.get("/stats", response_model=dtos.PomodoroStatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return pomodoro_repo.get_stats(db, current_user.id)
```

**Key rules:**
- Every route uses `Depends(get_current_user)` — never expose data without auth.
- Resource ownership checked with `if not obj or obj.user_id != current_user.id`.
- Path params typed inline (`session_id: int`).
- Registration in `main.py`: `app.include_router(dashboard.router, prefix="/api")`.

---

### 2. Repository Pattern

**Analog:** `backend/app/data/repositories.py` — `PomodoroSessionRepository`

**Class declaration (lines 53–55):**
```python
class PomodoroSessionRepository(BaseRepository[PomodoroSession]):
    def __init__(self):
        super().__init__(PomodoroSession)
```

**Aggregate query method (lines 63–95):**
```python
def get_stats(self, db: Session, user_id: int) -> dict:
    from datetime import date
    from sqlalchemy import func, cast, Date

    today = date.today()
    today_count = (
        db.query(func.count(self.model.id))
        .filter(
            self.model.user_id == user_id,
            self.model.session_type == "Pomodoro",
            self.model.completed == True,
            cast(self.model.start_time, Date) == today,
        )
        .scalar()
    ) or 0
    ...
    return {
        "today_pomodoros": today_count,
        "total_focus_minutes": total_minutes,
        "total_sessions": total_sessions,
    }
```

**Key rules:**
- Add new query methods directly to the existing `PomodoroSessionRepository` class — do not create a separate repository for dashboard.
- Import `date`, `func`, `cast` locally inside the method (not at module top) — existing convention.
- New heatmap method should return `list[dict]` with `{"date": str, "count": int}` — mirrors `get_stats` return shape.
- Singleton instance at the bottom of the file: `pomodoro_repo = PomodoroSessionRepository()`.

---

### 3. DTO Pattern

**Analog:** `backend/app/api/dtos.py`

**Response DTO (lines 91–103):**
```python
class PomodoroStatsResponse(BaseModel):
    today_pomodoros: int
    total_focus_minutes: int
    total_sessions: int
```

**Response DTO with ORM mapping (lines 72–88):**
```python
class PomodoroSessionResponse(BaseModel):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    duration_minutes: int
    session_type: str
    completed: bool
    interruptions: int
    productivity_rating: Optional[int]
    user_id: int
    subject_id: Optional[int]

    class Config:
        from_attributes = True
```

**Key rules:**
- Pure aggregate responses (no ORM object returned) do **not** need `class Config: from_attributes = True`.
- ORM-mapped responses always include `class Config: from_attributes = True`.
- `Optional[X]` for nullable fields; bare types for required fields.
- All new DTOs go in the same `dtos.py` file — no separate files per domain.

**New DTOs needed for Dashboard:**
```python
class HeatmapEntry(BaseModel):
    date: str          # "YYYY-MM-DD"
    count: int

class WeeklyEvolutionEntry(BaseModel):
    week_label: str    # e.g. "Sem 1"
    focus_minutes: int
    pomodoros: int

class DashboardStatsResponse(BaseModel):
    hours_studied: float
    current_streak: int
    consistency_pct: float
    efficiency_pct: float
    total_focus_minutes: int
    most_studied_subject: Optional[str]
    most_studied_subject_minutes: Optional[int]

class DashboardResponse(BaseModel):
    stats: DashboardStatsResponse
    heatmap: list[HeatmapEntry]
    weekly_evolution: list[WeeklyEvolutionEntry]
```

---

### 4. Store Pattern (Zustand)

**Analog:** `frontend/src/store/pomodoroStore.ts`

**Full structure (lines 1–70):**
```typescript
import { create } from 'zustand';
import api from '../api/client';
import type { PomodoroSession, PomodoroStats } from '../types';

interface SomePayload { ... }

interface SomeState {
  data: SomeType;
  isLoading: boolean;           // add for dashboard — explicit loading state
  fetchData: () => Promise<void>;
}

export const useSomeStore = create<SomeState>((set) => ({
  data: defaultValue,
  isLoading: false,

  fetchData: async () => {
    try {
      const res = await api.get('/endpoint/');
      set({ data: res.data });
    } catch {
      // Silently skip (pomodoroStore pattern) or console.error (taskStore pattern)
    }
  },
}));
```

**Key rules:**
- `create<StateInterface>((set, get) => ({ ... }))` — use `get` only when reading current state inside an action.
- Auth token is handled by the axios interceptor in `api/client.ts` — stores never touch `localStorage` for auth.
- Silent catch (`catch { }`) is the pattern in `pomodoroStore`; `console.error` in `taskStore` — use `console.error` for dashboard (easier debugging).
- Optimistic local updates before await for mutations; no optimistic update needed for read-only dashboard fetches.
- Export as named `useDashboardStore`.

---

### 5. Component Pattern

**Analog:** `frontend/src/components/PomodoroStats/index.tsx` + `styles.css`

**Folder structure:**
```
src/components/
  PomodoroStats/
    index.tsx       ← default export, memo-wrapped React.FC
    styles.css      ← BEM-style, CSS custom properties (var(--pomo-*))
```

**Component file (lines 1–31):**
```typescript
import React, { memo, useEffect } from 'react';
import { usePomodoroStore } from '../../store/pomodoroStore';
import './styles.css';

const PomodoroStats: React.FC = () => {
  const { stats, fetchStats } = usePomodoroStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="pomo-stats">
      ...
    </div>
  );
};

export default memo(PomodoroStats);
```

**CSS conventions (`styles.css`):**
```css
/* BEM-style class names, prefixed with component abbreviation */
.pomo-stats { ... }
.pomo-stat  { ... }
.pomo-stat-value { font-weight: 700; }
.pomo-stat-label { font-size: 0.62rem; text-transform: uppercase; opacity: 0.5; }

/* Always use CSS custom properties for theming */
color: var(--pomo-text, #1a1a2e);
background: var(--pomo-surface-alt, rgba(0,0,0,0.05));
border: 1px solid var(--pomo-border, rgba(0,0,0,0.12));
```

**Key rules:**
- All multi-file components live in a named folder: `ComponentName/index.tsx` + `ComponentName/styles.css`.
- Single-file simple components live flat: `ComponentName.tsx` + `ComponentName.css`.
- Always `export default memo(ComponentName)` for presentational components.
- `useEffect` with the fetch action as the only dependency — call the store action directly inside.
- Dashboard components should be nested under `components/Dashboard/`:
  ```
  components/Dashboard/
    StatsWidgets/index.tsx + styles.css
    Heatmap/index.tsx + styles.css
    WeeklyChart/index.tsx + styles.css
    MostStudiedSubject/index.tsx + styles.css
  ```

---

### 6. API Client Pattern

**Analog:** `frontend/src/api/client.ts` (lines 1–18)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

**Key rules:**
- Import `api` as a default import: `import api from '../api/client'`.
- All paths are relative to `/api` base — use `api.get('/dashboard/stats')` not `api.get('/api/dashboard/stats')`.
- No changes to `client.ts` are needed for Dashboard — the interceptor already handles auth.
- Response data is always at `res.data` (Axios convention).

---

## Shared Patterns

### Authentication (applies to all backend routes)
**Source:** `backend/app/api/routers/pomodoro_sessions.py` lines 13–17
```python
current_user: User = Depends(get_current_user)
# ownership check:
if not obj or obj.user_id != current_user.id:
    raise HTTPException(status_code=404, detail="... not found")
```

### Type Declarations (applies to all frontend stores/components)
**Source:** `frontend/src/types/index.ts`
- All shared interfaces live in `types/index.ts` — no per-feature type files.
- Dates come from backend as ISO strings (`string`), not `Date` objects.
- New types for Dashboard:
```typescript
export interface DashboardStats {
  hours_studied: number;
  current_streak: number;
  consistency_pct: number;
  efficiency_pct: number;
  total_focus_minutes: number;
  most_studied_subject?: string;
  most_studied_subject_minutes?: number;
}

export interface HeatmapEntry {
  date: string;   // "YYYY-MM-DD"
  count: number;
}

export interface WeeklyEvolutionEntry {
  week_label: string;
  focus_minutes: number;
  pomodoros: number;
}

export interface DashboardData {
  stats: DashboardStats;
  heatmap: HeatmapEntry[];
  weekly_evolution: WeeklyEvolutionEntry[];
}
```

### Router Registration (applies to all new backend routers)
**Source:** `backend/app/main.py` lines 16–19
```python
from app.api.routers import auth, tasks, pomodoro_sessions, settings, dashboard  # add dashboard

app.include_router(dashboard.router, prefix="/api")
```

### CSS Theming Variables (applies to all new component CSS)
**Source:** `frontend/src/components/PomodoroStats/styles.css`
```css
/* Always fall back to hardcoded value */
color: var(--pomo-text, #1a1a2e);
background: var(--pomo-surface-alt, rgba(0,0,0,0.05));
border-color: var(--pomo-border, rgba(0,0,0,0.12));
```

---

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `components/Dashboard/Heatmap/index.tsx` | component | No calendar/heatmap component exists — use Recharts `ResponsiveContainer` + custom `Cell` grid or a simple CSS grid approach |
| `components/Dashboard/WeeklyChart/index.tsx` | component | No Recharts usage exists yet — follow Recharts docs for `BarChart`/`LineChart` with `ResponsiveContainer` |

---

## Metadata

**Analog search scope:** `backend/app/api/routers/`, `backend/app/data/`, `backend/app/api/dtos.py`, `backend/app/domain/models.py`, `frontend/src/store/`, `frontend/src/components/`, `frontend/src/api/`, `frontend/src/types/`
**Files read:** 13
**Pattern extraction date:** 2026-05-14

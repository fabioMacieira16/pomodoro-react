# Architecture

**Analysis Date:** 2026-05-14

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                           │
│                 frontend/src/containers/Pomodoro.tsx             │
├─────────────────┬────────────────────┬───────────────────────────┤
│  usePomodoroEngine  │  Zustand Stores  │  React Components        │
│  (hooks/)           │  (store/)        │  (components/)           │
│  Timer state machine│  Auth, Tasks,    │  Controls, TimeDisplay,  │
│  refs + intervals   │  Sessions,       │  Tasks/*, SettingsPanel, │
│  localStorage cache │  Settings,       │  ProductivityModal,      │
│                     │  Subjects        │  PomodoroStats, Dots     │
└─────────┬───────────┴────────┬─────────┴───────────────────────┘
          │  axios (api/client.ts)         (localhost:8000/api)
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                                │
│              backend/app/main.py  (CORS: allow_origins=["*"])    │
├──────────────────┬───────────────────┬───────────────────────────┤
│  Routers (api/)  │  Dependencies     │  DTOs (api/dtos.py)       │
│  auth.py         │  dependencies.py  │  Pydantic v2 models       │
│  tasks.py        │  get_current_user │  Base/Create/Update/      │
│  pomodoro_sessions│  (JWT decode)    │  Response pattern         │
│  settings.py     │                   │                            │
└─────────┬────────┴───────────────────┴───────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Data Layer (data/)                                              │
│  repositories.py — BaseRepository[T] + 4 concrete repos         │
│  database.py — SQLAlchemy engine, SessionLocal, get_db()        │
└─────────┬────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Domain Layer (domain/)                                          │
│  models.py — SQLAlchemy ORM models                               │
│  SQLite → database/pomodoro.db                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Backend

| Component | Responsibility | File |
|-----------|----------------|------|
| `main.py` | App factory, middleware, router registration | `backend/app/main.py` |
| `auth.py` | Register + login endpoints, token issuance | `backend/app/api/routers/auth.py` |
| `tasks.py` | CRUD for tasks, user-scoped | `backend/app/api/routers/tasks.py` |
| `pomodoro_sessions.py` | Session create/list/update/stats | `backend/app/api/routers/pomodoro_sessions.py` |
| `settings.py` | Get/upsert per-user settings | `backend/app/api/routers/settings.py` |
| `dependencies.py` | `get_current_user` JWT guard | `backend/app/api/dependencies.py` |
| `dtos.py` | All Pydantic request/response schemas | `backend/app/api/dtos.py` |
| `models.py` | SQLAlchemy ORM (11 tables) | `backend/app/domain/models.py` |
| `repositories.py` | Generic `BaseRepository` + 4 concrete repos | `backend/app/data/repositories.py` |
| `database.py` | Engine, session factory, `get_db()` dependency | `backend/app/data/database.py` |
| `security.py` | Password hash/verify, JWT encode | `backend/app/core/security.py` |
| `config.py` | `Settings` via pydantic-settings, `.env` loading | `backend/app/core/config.py` |

### Frontend

| Component | Responsibility | File |
|-----------|----------------|------|
| `Pomodoro.tsx` | Root container; keyboard shortcuts, dark mode, fullscreen, layout orchestration | `frontend/src/containers/Pomodoro.tsx` |
| `usePomodoroEngine` | Core timer state machine (idle/running/paused/finished), auto-start, sound, notifications, session save | `frontend/src/hooks/usePomodoroEngine.ts` |
| `authStore` | JWT token lifecycle, user profile, localStorage persistence | `frontend/src/store/authStore.ts` |
| `pomodoroSettingsStore` | Timer config, sound, dark mode, backend sync, `zustand/persist` | `frontend/src/store/pomodoroSettingsStore.ts` |
| `pomodoroStore` | Session save/rate/list, stats fetch | `frontend/src/store/pomodoroStore.ts` |
| `taskStore` | Task CRUD, optimistic reorder via DnD | `frontend/src/store/taskStore.ts` |
| `subjectStore` | Subject + category fetch | `frontend/src/store/subjectStore.ts` |
| `api/client.ts` | Axios instance, Authorization header interceptor | `frontend/src/api/client.ts` |
| `Controls.tsx` | Start/Pause/Reset buttons | `frontend/src/components/Controls.tsx` |
| `TimeDisplay.tsx` | MM:SS countdown display | `frontend/src/components/TimeDisplay.tsx` |
| `TypeSelect.tsx` | Phase tab selector (Pomodoro / Short / Long break) | `frontend/src/components/TypeSelect.tsx` |
| `ToggleSound.tsx` | Sound on/off toggle | `frontend/src/components/ToggleSound.tsx` |
| `Shortcuts.tsx` | Keyboard shortcut legend | `frontend/src/components/Shortcuts.tsx` |
| `TaskList/` | DnD task list; uses `TaskList/context.tsx` for drag context | `frontend/src/components/Tasks/TaskList/` |
| `Task/` | Individual task row (check, edit, delete) | `frontend/src/components/Tasks/Task/` |
| `ProductivityModal/` | Post-session 1–5 star rating modal | `frontend/src/components/ProductivityModal/` |
| `SettingsPanel/` | Timer duration + sound + dark mode settings form | `frontend/src/components/SettingsPanel/` |
| `PomodoroStats/` | Today's count + total minutes display | `frontend/src/components/PomodoroStats/` |
| `PomodoroDots/` | Visual progress dots for the long-break interval | `frontend/src/components/PomodoroDots/` |

## Architecture Patterns

**Overall:** Layered monorepo — decoupled REST backend + React SPA frontend. Backend follows a lightweight Clean Architecture with Domain → Data → API layers.

**Backend Key Characteristics:**
- Each layer imports only downward: routers → repositories → models
- All business logic in routers (no service layer); `BaseRepository` handles generic DB ops
- Module-level singleton repo instances exported from `repositories.py` (`user_repo`, `task_repo`, etc.)
- Dependency injection via FastAPI `Depends()`

**Frontend Key Characteristics:**
- Single `Pomodoro.tsx` container consumes `usePomodoroEngine` and mounts all UI components
- Engine hook uses `useRef` extensively to avoid stale closure issues inside `setInterval`
- Zustand stores own all remote data (fetch/mutate/cache); components don't call `api` directly
- Settings store dual-persists: `localStorage` (Zustand persist) + backend DB; reads local first, syncs backend on mount
- Timer state (`phase`, `timeRemaining`, `pomodoroCount`) also persisted to `localStorage` (`pomo-timer-v2`) for tab-refresh survival

## Layers (Backend)

**API Layer:**
- Purpose: HTTP routing, request validation, response serialization
- Location: `backend/app/api/`
- Contains: Routers, DTOs, auth dependency
- Depends on: Data layer (repos), Domain models, Core (security, config)
- Used by: FastAPI app in `main.py`

**Data Layer:**
- Purpose: Database access abstraction
- Location: `backend/app/data/`
- Contains: `BaseRepository`, concrete repos, `get_db()` session factory
- Depends on: Domain models, Core config (DB URI)
- Used by: API routers via `Depends(get_db)` + singleton repo instances

**Domain Layer:**
- Purpose: Data model definitions
- Location: `backend/app/domain/models.py`
- Contains: 11 SQLAlchemy ORM classes (User, Task, PomodoroSession, Setting, Subject, Category, StudyType, Schedule, StudyMetric, AnkiDeck, Flashcard)
- Depends on: `Base` from `database.py` only
- Used by: Data layer repos, API routers

**Core Layer:**
- Purpose: Cross-cutting infrastructure
- Location: `backend/app/core/`
- Contains: `config.py` (settings), `security.py` (JWT + hashing)
- Depends on: External packages only
- Used by: All layers

## Data Flow

### Authenticated API Request

1. HTTP request arrives at FastAPI (`backend/app/main.py`)
2. Middleware adds CORS headers
3. Router function receives request body validated as Pydantic DTO (`backend/app/api/dtos.py`)
4. `get_current_user` dependency decodes JWT, queries `user_repo`, returns `User` model (`backend/app/api/dependencies.py`)
5. Router calls concrete repo method with `db: Session` (`backend/app/data/repositories.py`)
6. Repo executes SQLAlchemy query against SQLite (`database/pomodoro.db`)
7. ORM model returned, serialized by Pydantic response model back to JSON

### Pomodoro Session Completion Flow (Frontend)

1. `setInterval` tick in `usePomodoroEngine` reaches zero (`frontend/src/hooks/usePomodoroEngine.ts`)
2. `handleCompletion()` called: updates status to `finished`, plays sound, sends browser notification
3. `saveSession()` called on `pomodoroStore` → POST `/api/pomodoro-sessions/` with duration + type
4. `ProductivityModal` rendered; user rates 1–5 or skips
5. `submitProductivityRating()` → PATCH `/api/pomodoro-sessions/{id}` with rating
6. `fetchStats()` called → GET `/api/pomodoro-sessions/stats` → updates `PomodoroStats` component

### Settings Sync Flow

1. On container mount: `settings.syncFromBackend()` → GET `/api/settings/` → merges server values into Zustand store (`frontend/src/store/pomodoroSettingsStore.ts`)
2. User edits settings in `SettingsPanel` → `s.update()` mutates local Zustand state immediately
3. Save button → `s.syncToBackend()` → PUT `/api/settings/` → persists to `settings` table

## Entry Points

**Backend:**
- `backend/app/main.py` — FastAPI `app` instance; uvicorn target `app.main:app`
- API prefix: `/api` for all routers

**Frontend:**
- `frontend/src/main.tsx` (not read; inferred) — React `createRoot` mount
- Root component: `Pomodoro.tsx` container

## Architectural Constraints

- **Threading:** SQLite `check_same_thread=False` set; safe for FastAPI's single-worker uvicorn dev mode but not multi-worker production
- **Global state:** Four Zustand stores are module-level singletons (`authStore`, `pomodoroStore`, `pomodoroSettingsStore`, `taskStore`); timer engine also uses module-level `usePomodoroStore.getState()` call at init
- **No service layer:** Business logic lives directly in routers — acceptable at current scale; grows coupling as features are added
- **Hardcoded API URL:** `http://localhost:8000/api` in `frontend/src/api/client.ts` — must be changed for any non-local deployment

## Anti-Patterns

### `allow_origins=["*"]` CORS

**What happens:** `backend/app/main.py` allows all origins with credentials
**Why it's wrong:** Combined with `allow_credentials=True`, this is rejected by browsers per CORS spec and exposes the API to any origin in production
**Do this instead:** Set `allow_origins` to explicit frontend origin(s) via config

### Hardcoded `SECRET_KEY`

**What happens:** `backend/app/core/config.py` ships a default `SECRET_KEY` in source
**Why it's wrong:** Anyone with the source code can forge JWTs for any user
**Do this instead:** Remove the default; require `SECRET_KEY` env var to be set; raise `ValueError` at startup if missing

### Ghost Models (Domain/DB vs. API mismatch)

**What happens:** `AnkiDeck`, `Flashcard`, `Exercise`, `ExerciseAttempt`, `StudyMetric`, `Schedule`, `StudyType`, `Category`, `Subject` exist in `backend/app/domain/models.py` and DB migrations but have **no routers, no repos, no DTOs**
**Why it's wrong:** `subjectStore.ts` calls `/subjects/` and `/categories/` which return 404; relationships on `User` reference missing classes
**Do this instead:** Either add the missing routers or remove the dead models to prevent confusion

### Duplicated `Task` Type

**What happens:** `Task` interface defined both in `frontend/src/store/taskStore.ts` and `frontend/src/types/index.ts`
**Why it's wrong:** The two definitions can drift; `taskStore.ts` omits `user_id`, `subject_id`, `due_date` fields present in `types/index.ts`
**Do this instead:** Remove the inline definition in `taskStore.ts`; import from `types/index.ts`

## Error Handling

**Backend Strategy:** HTTP exceptions raised directly in router functions (`HTTPException`); no global error handler
**Patterns:**
- 401 raised in `get_current_user` for invalid/expired tokens
- 404 raised in task/session routers when record not found or `user_id` doesn't match
- No 422 customisation; Pydantic validation errors return default FastAPI format

**Frontend Strategy:** All API calls wrapped in `try/catch` inside Zustand actions; errors are swallowed silently (offline-tolerant design)
**Patterns:**
- `pomodoroStore` / `pomodoroSettingsStore` — silent skip on error (intentional offline mode)
- `taskStore` / `authStore` — `console.error` only; no user-facing error state
- No global error boundary detected

## Cross-Cutting Concerns

**Logging:** None — backend uses no structured logger; frontend uses `console.error` in some store actions
**Validation:** Backend — Pydantic DTOs on all request bodies; no extra domain validation. Frontend — no client-side form validation beyond HTML `min`/`max` on number inputs
**Authentication:** JWT Bearer tokens; 8-day expiry (`ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 8`); stored in `localStorage`; injected via Axios interceptor

---

*Architecture analysis: 2026-05-14*

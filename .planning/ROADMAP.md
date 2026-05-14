# Pomodoro React — Project Roadmap

**Created:** 2026-05-14
**Type:** Retrospective + Forward Planning
**Status:** Phase 5 complete — Phase 6 next

---

## Phases

- [x] **Phase 1: Auth Foundation** — JWT login/register, protected routes, token lifecycle
- [x] **Phase 2: Task Management** — CRUD tasks, drag-and-drop reorder, status toggle
- [x] **Phase 3: Core Pomodoro Timer** — Timer engine, phase selector, controls, sound toggle
- [x] **Phase 4: Advanced Pomodoro Features** — Dark mode, focus/fullscreen, persistence, notifications, sessions, settings
- [x] **Phase 5: Stats & Settings Sync** — Stats widget, session stats API, settings sync to backend
- [ ] **Phase 6: Security Hardening** — Fix SECRET_KEY, CORS, hardcoded API URL
- [ ] **Phase 7: Database Integrity** — Alembic migration for settings table, resolve ghost models
- [ ] **Phase 8: Study Features** — Subjects, categories, Anki decks, flashcards (activate ghost models)
- [ ] **Phase 9: Testing** — Unit, integration, and e2e test coverage
- [ ] **Phase 10: PWA & Production Readiness** — Mobile optimization, PWA, production Docker config

---

## Phase Details

### Phase 1: Auth Foundation
**Status:** COMPLETED
**Goal:** Users can securely create accounts and access the app with persistent sessions
**Key Deliverables:**
- `POST /api/auth/register` and `POST /api/auth/login` endpoints
- JWT token issuance and validation (`security.py`)
- `authStore` (Zustand + localStorage persist) — token lifecycle, user profile
- `get_current_user` FastAPI dependency protecting all authenticated routes
**Success Criteria:**
1. User can register with email + password and receive a JWT
2. User can log in and stay authenticated across page refreshes
3. Unauthenticated requests to protected endpoints return 401
4. Logging out clears the token from localStorage
**Plans:** TBD

---

### Phase 2: Task Management
**Status:** COMPLETED
**Goal:** Users can manage a personal task list with full CRUD and intuitive drag-and-drop reordering
**Key Deliverables:**
- `tasks.py` router: create, read, update, delete (user-scoped)
- `TaskRepository` with `BaseRepository` generic pattern
- `TaskList/` component with `react-dnd` drag context
- `Task/` component: inline edit, status check toggle, delete
- `taskStore` (Zustand): optimistic reorder, CRUD mutations
**Success Criteria:**
1. User can create, edit, and delete tasks
2. User can reorder tasks via drag-and-drop; order persists on reload
3. User can toggle a task between active and complete
4. Tasks are scoped to the authenticated user — other users cannot see them
**Plans:** TBD

---

### Phase 3: Core Pomodoro Timer
**Status:** COMPLETED
**Goal:** Users can run a functional Pomodoro timer that cycles through work and break phases
**Key Deliverables:**
- `usePomodoroEngine` hook — state machine (idle/running/paused/finished), `setInterval` with `useRef`
- `TypeSelect.tsx` — Pomodoro / Short Break / Long Break phase tabs
- `Controls.tsx` — Start / Pause / Reset buttons
- `TimeDisplay.tsx` — MM:SS countdown display
- `ToggleSound.tsx` — sound on/off toggle
- `PomodoroDots.tsx` — visual long-break interval progress
**Success Criteria:**
1. User can start, pause, and reset the timer
2. Timer counts down accurately and transitions phase on completion
3. User can switch between Pomodoro, Short Break, and Long Break tabs
4. Sound plays when a session ends (when enabled)
**Plans:** TBD

---

### Phase 4: Advanced Pomodoro Features
**Status:** COMPLETED
**Goal:** Users have a fully-featured, distraction-free Pomodoro experience with persistence and personalization
**Key Deliverables:**
- Dark mode (auto / light / dark) via `Pomodoro.tsx` + `pomodoroSettingsStore`
- Focus mode and fullscreen toggle
- Timer state persisted to `localStorage` (`pomo-timer-v2`) — survives tab refresh
- Auto-start breaks and auto-start next Pomodoro settings
- Configurable long break interval
- Sound selection: bell / beep / digital
- Browser notifications on session completion
- `ProductivityModal/` — 1–5 star rating after each Pomodoro
- `SettingsPanel/` — full settings form (durations, sound, dark mode)
- Session save: POST to `/api/pomodoro-sessions/` on completion
**Success Criteria:**
1. Timer state (phase, time remaining, count) survives a hard page refresh
2. User can configure all timer durations and sound preferences in SettingsPanel
3. Dark/light/auto theme applies immediately and persists across sessions
4. A productivity rating modal appears after each completed Pomodoro
5. Browser sends a desktop notification when a session ends (with permission)
**Plans:** TBD

---

### Phase 5: Stats & Settings Sync
**Status:** COMPLETED
**Goal:** Users can see productivity statistics and have settings synchronized to the backend
**Key Deliverables:**
- `GET /api/pomodoro-sessions/stats` endpoint — today's count + total minutes
- `PomodoroStats/` component — renders today's Pomodoros and total minutes
- `settings.py` router: GET + PUT per-user settings
- `pomodoroSettingsStore` dual-persist: `localStorage` (instant) + backend (on mount/save)
- Settings sync flow: backend → local on mount, local → backend on explicit save
**Success Criteria:**
1. User can see today's Pomodoro count and total focus minutes
2. Settings configured on one device/session are restored from the backend on next login
3. Stats update after each completed Pomodoro without page reload
**Plans:** TBD

---

### Phase 6: Security Hardening
**Status:** PLANNED
**Goal:** The application is safe to deploy beyond localhost
**Key Deliverables:**
- Remove hardcoded `SECRET_KEY` default from `config.py`; raise `ValueError` at startup if not set via env
- Create `backend/.env.example` with required env vars documented
- Replace `allow_origins=["*"]` with explicit origin list from config (`ALLOWED_ORIGINS` env var)
- Move frontend API base URL (`http://localhost:8000/api`) to `VITE_API_BASE_URL` env var
- Create `frontend/.env.example`
**Success Criteria:**
1. Backend refuses to start if `SECRET_KEY` is not set in environment — no silent insecure default
2. CORS rejects requests from unlisted origins in production config
3. Frontend API URL is configurable via `.env` without code changes
4. `.env.example` files document all required variables
**Plans:** TBD

---

### Phase 7: Database Integrity
**Status:** PLANNED
**Goal:** The database schema is fully managed by migrations and the codebase has no dead/broken references
**Key Deliverables:**
- Alembic migration for the `settings` table (currently added directly to `models.py` post-initial migration)
- Decision + execution on ghost models: `Subject`, `Category`, `StudyType`, `Schedule`, `StudyMetric`, `AnkiDeck`, `Flashcard`, `ExerciseAttempt` — either stub routers or remove from `models.py` + migration
- Fix or stub `subjectStore.ts` so it no longer causes 404 errors on load
- Verify `alembic upgrade head` produces a clean schema from scratch
**Success Criteria:**
1. `alembic upgrade head` on a fresh database produces the same schema as the current `pomodoro.db`
2. No 404 errors appear in the browser console on initial app load
3. All ORM models referenced in the codebase have corresponding DB tables managed by migrations
**Plans:** TBD

---

### Phase 8: Study Features
**Status:** PLANNED
**Goal:** Users can organize study material with subjects, categories, flashcard decks, and exercises
**Key Deliverables:**
- `subjects.py` router: CRUD for Subject + Category (activate `SubjectRepository`)
- `anki.py` router: CRUD for AnkiDeck + Flashcard
- `exercises.py` router: CRUD for Exercise + ExerciseAttempt
- DTOs for all new entities in `dtos.py`
- Frontend: activate `subjectStore` — subjects/categories fetch and display
- Connect tasks to subjects/categories (task tagging)
**Success Criteria:**
1. User can create, edit, and delete subjects and nested categories
2. User can create Anki decks and add flashcards to them
3. Tasks can be tagged with a subject/category
4. Study resources are scoped to the authenticated user
**Plans:** TBD
**UI hint**: yes

---

### Phase 9: Testing
**Status:** PLANNED
**Goal:** Critical paths are covered by automated tests, preventing regressions
**Key Deliverables:**
- Backend: `pytest` suite — unit tests for `security.py`, `repositories.py`; integration tests for all router endpoints (auth, tasks, sessions, settings)
- Frontend: `vitest` + React Testing Library — unit tests for `usePomodoroEngine` (timer state transitions), `authStore`, `taskStore`
- E2E: `Playwright` — login flow, create task, run Pomodoro, view stats
- CI configuration (GitHub Actions or similar) running all tests on push
**Success Criteria:**
1. `pytest` passes with ≥80% backend coverage on router and repository layers
2. `vitest` passes for all store mutations and the timer state machine
3. Playwright e2e suite covers login → task creation → timer completion flow
4. Test suite runs in CI on every push to main
**Plans:** TBD

---

### Phase 10: PWA & Production Readiness
**Status:** PLANNED
**Goal:** The app is deployable to production and installable as a PWA on mobile devices
**Key Deliverables:**
- Vite PWA plugin (`vite-plugin-pwa`): manifest, service worker, offline support
- Mobile-responsive layout audit and fixes (touch targets, viewport meta, overflow)
- Production Docker images: multi-stage build for frontend (nginx), optimized backend image
- `docker-compose.prod.yml` override with proper env var injection (no `--reload`, static frontend)
- SQLite WAL mode enabled or migration guide to PostgreSQL for multi-worker deployments
- Frontend `VITE_API_BASE_URL` wired through Docker build args
**Success Criteria:**
1. App can be installed as a PWA on iOS and Android via browser prompt
2. Core timer UI is usable on a 375px mobile screen without horizontal scroll
3. `docker compose -f docker-compose.prod.yml up` produces a production-ready deployment
4. Production deployment has no hardcoded localhost references
**Plans:** TBD
**UI hint**: yes

---

## Progress Table

| Phase | Goal | Status | Completed |
|-------|------|--------|-----------|
| 1. Auth Foundation | Secure account access | ✅ Completed | 2025 |
| 2. Task Management | Personal task CRUD + DnD | ✅ Completed | 2025 |
| 3. Core Pomodoro Timer | Functional timer engine | ✅ Completed | 2025 |
| 4. Advanced Pomodoro Features | Full-featured timer experience | ✅ Completed | 2025–2026 |
| 5. Stats & Settings Sync | Productivity stats + backend settings | ✅ Completed | 2026 |
| 6. Security Hardening | Safe for non-localhost deployment | 🔲 Planned | - |
| 7. Database Integrity | Clean migrations, no dead models | 🔲 Planned | - |
| 8. Study Features | Subjects, decks, flashcards | 🔲 Planned | - |
| 9. Testing | Automated test coverage | 🔲 Planned | - |
| 10. PWA & Production Readiness | Deployable + installable | 🔲 Planned | - |

---

## Coverage Notes

### Ghost Models (Phase 7 + 8 scope)
The following ORM models exist in `models.py` and the DB schema but have **no routers, repos, or DTOs**:
`Subject`, `Category`, `StudyType`, `Schedule`, `StudyMetric`, `AnkiDeck`, `Flashcard`, `ExerciseAttempt`

- Phase 7 resolves the **broken state** (404s, missing migration)
- Phase 8 activates them as a **full feature**

### Settings Table Migration Gap
The `settings` table was added directly to `models.py` after the initial Alembic migration `61a8b75e1a78`. Running `alembic upgrade head` on a fresh DB will be missing this table until Phase 7 creates the migration.

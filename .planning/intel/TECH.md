# Technology Stack

**Analysis Date:** 2026-05-14

## Languages

**Primary:**
- Python 3.x — Backend (`backend/`)
- TypeScript 5.2.2 — Frontend (`frontend/src/`)

**Secondary:**
- CSS (plain + Tailwind utility classes) — Component styles (`frontend/src/components/**/*.css`)

## Runtime

**Backend:**
- Python (managed via `.venv`)
- ASGI server: `uvicorn[standard]` 0.29.0

**Frontend:**
- Node.js (v18+ implied by Vite 5)
- Module type: ESM (`"type": "module"` in `package.json`)

**Package Managers:**
- Backend: `pip` with `requirements.txt` (`backend/requirements.txt`)
- Frontend: `npm` with `package-lock.json`

## Frameworks

**Backend:**
- FastAPI 0.111.0 — REST API framework (`backend/app/main.py`)
- SQLAlchemy 2.0.36 — ORM (`backend/app/data/database.py`, `backend/app/domain/models.py`)
- Alembic 1.13.1 — DB migrations (`backend/migrations/`)
- Pydantic v2 (via FastAPI) + pydantic-settings 2.2.1 — config & DTOs (`backend/app/core/config.py`, `backend/app/api/dtos.py`)

**Frontend:**
- React 18.2.0 — UI library (`frontend/src/`)
- Vite 5.2.0 — build tool & dev server (`frontend/vite.config.ts`)
- Tailwind CSS 3.4.3 — utility-first styling (configured via `postcss`/`autoprefixer`)

## Key Dependencies

**Backend — Critical:**
- `python-jose[cryptography]` 3.3.0 — JWT token creation/validation (`backend/app/core/security.py`)
- `passlib[bcrypt]` 1.7.4 — password hashing (installed as bcrypt but runtime uses `sha256_crypt` scheme — see CONCERNS)
- `python-multipart` 0.0.9 — required for OAuth2 form body parsing

**Frontend — Critical:**
- `zustand` 4.5.2 — global state management with `persist` middleware (`frontend/src/store/`)
- `axios` 1.6.8 — HTTP client, single configured instance (`frontend/src/api/client.ts`)
- `react-router-dom` 6.22.3 — routing (minimal use; app is effectively single-page)
- `react-dnd` 16.0.1 + `react-dnd-html5-backend` 16.0.1 — drag-and-drop task reordering (`frontend/src/components/Tasks/TaskList/`)
- `immer` 10.0.4 — immutable state helpers (imported but verify actual usage)
- `lucide-react` 0.368.0 — icon library

## Configuration

**Backend:**
- Config class via `pydantic-settings` at `backend/app/core/config.py`
- Reads from `.env` file in `backend/` directory (optional; defaults hardcoded)
- Key settings: `SECRET_KEY`, `SQLALCHEMY_DATABASE_URI`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- `SECRET_KEY` has a hardcoded default in source — MUST be overridden via `.env` in any non-local deployment

**Frontend:**
- API base URL hardcoded to `http://localhost:8000/api` in `frontend/src/api/client.ts`
- No `.env` / Vite env variable used for the API URL — requires code change for non-local environments
- Timer state persisted to `localStorage` key `pomo-timer-v2`
- Settings persisted to `localStorage` key `pomodoro-settings-v1` via Zustand `persist` middleware

**Build:**
- Frontend: `tsc && vite build` (TypeScript strict-checks before bundle)
- Backend: no build step; run directly via `uvicorn`

## Database

- **Engine:** SQLite
- **File location:** `database/pomodoro.db` (relative to project root, shared via Docker volume `./database:/database`)
- **Connection string:** `sqlite:///../database/pomodoro.db` (relative to `backend/` CWD)
- **Migrations:** Alembic, one migration version: `backend/migrations/versions/61a8b75e1a78_initial_schema_v2.py`

## Containerisation

**Docker Compose (`docker-compose.yml`):**
- `pomodoro-backend` — binds to host port 8000, mounts `./backend` and `./database`
- `pomodoro-frontend` — binds to host port 3000, mounts `./frontend`
- Both run in hot-reload mode (`--reload` / `npm run dev`)
- No production image configuration detected

## Platform Requirements

**Development:**
- Python 3.11+ recommended (union type syntax `X | Y` used throughout)
- Node.js 18+
- Docker + Docker Compose (optional; can run both services locally)

**Production:**
- No production Docker images or compose override files present
- SQLite unsuitable for multi-process production deployments — single file, no WAL configured via app

---

*Stack analysis: 2026-05-14*

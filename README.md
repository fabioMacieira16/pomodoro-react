# 🍅 Pomodoro Pro — Estudo de Alta Performance

> **Muito além de um timer.** Um sistema completo que combina foco, revisão espaçada e inteligência artificial para transformar qualquer conteúdo em memória de longo prazo.

---

## 🏛️ Os 4 Pilares

| Pilar | O que faz | Por que importa |
|-------|-----------|-----------------|
| 🍅 **Pomodoro** | Timer com sessões, pausas e métricas | Base do foco e da consistência |
| 📅 **Agenda Inteligente** | Plano de estudos adaptado à data da prova | Prioriza o que importa, quando importa |
| 📊 **Dashboard de Performance** | Heatmap, evolução semanal, streak | Transforma esforço invisível em dados visíveis |
| 🧠 **Sistema Anki + IA** | Revisão espaçada gerada a partir de PDFs, vídeos, erros e questões | **O diferencial absurdo** — memória de longo prazo automática |

---

## 🗂️ Arquitetura Final

```
pomodoro-react/
├── frontend/                  # SPA React + TypeScript
├── backend/                   # API Python / FastAPI
├── database/                  # SQLite + Alembic migrations
├── docker-compose.yml         # Base (prod)
├── docker-compose.override.yml# Dev (hot-reload)
├── docker-compose.prod.yml    # Produção (sem bind mounts)
├── docker-compose.ai.yml      # Stack AI + Ollama local
└── .env.example
```

---

## 🎨 Frontend

```
frontend/
├── src/
│   ├── components/            # UI atômicos reutilizáveis
│   ├── pages/                 # Rotas: Timer, Anki, Dashboard, Agenda, Settings
│   ├── store/                 # Zustand — estado global por domínio
│   │   ├── useTimerStore.ts
│   │   ├── useAnkiStore.ts
│   │   ├── useDashboardStore.ts
│   │   └── useSettingsStore.ts
│   ├── hooks/                 # Custom hooks (usePomodoro, useSM2, useAI…)
│   ├── services/              # Camada HTTP (axios/fetch) por recurso
│   └── types/                 # Interfaces TypeScript compartilhadas
```

**Stack:** React 18 · TypeScript · Zustand · Recharts · Tailwind CSS · Vite

---

## ⚙️ Backend

```
backend/app/
├── api/
│   └── routers/               # Endpoints FastAPI por domínio
│       ├── auth.py            # JWT login / register
│       ├── tasks.py           # Tarefas Kanban
│       ├── pomodoro_sessions.py
│       ├── dashboard.py       # Stats, heatmap, evolução semanal
│       ├── scheduler.py       # Agenda inteligente (provas + tópicos)
│       ├── settings.py        # Proxy → app/settings/router.py
│       ├── anki_*.py          # Decks, flashcards, revisão, stats
│       └── ai_module.py       # /api/ai/* — todos os endpoints IA
│
├── settings/                  # Módulo de preferências por categoria
│   ├── schemas.py             # Pydantic: Pomodoro / Display / AI / Notifications
│   ├── service.py             # Lógica de leitura/escrita
│   └── router.py             # GET+PUT por grupo
│
├── ai/                        # Módulo IA — arquitetura escalável
│   ├── providers/             # Abstração de LLM
│   │   ├── base.py            # AIProvider (ABC)
│   │   ├── openai.py          # OpenAI API
│   │   ├── ollama.py          # Ollama local
│   │   └── mock.py            # Dev sem API key
│   ├── transcription/
│   │   ├── base.py            # Transcriber (ABC)
│   │   └── whisper.py         # OpenAI Whisper (lazy import)
│   ├── chains/                # LangChain-compatible (stubs LCEL prontos)
│   │   ├── summarize.py
│   │   ├── extract_topics.py
│   │   └── generate.py        # Exercícios / flashcards / mapa mental
│   ├── services/              # Lógica de negócio IA
│   │   ├── pdf_service.py
│   │   ├── exercise_service.py
│   │   ├── flashcard_service.py
│   │   ├── mindmap_service.py
│   │   └── media_service.py   # Áudio + vídeo → Whisper → LLM
│   ├── factory.py             # Instancia provider via .env
│   └── dtos.py                # Schemas Pydantic do módulo IA
│
├── core/
│   ├── config.py              # Settings (pydantic-settings + .env)
│   ├── security.py            # JWT / bcrypt
│   └── sm2.py                 # Algoritmo SuperMemo-2 (Anki engine)
│
├── data/
│   ├── database.py            # SQLAlchemy engine / session
│   └── repositories.py        # CRUD por model
│
└── domain/
    └── models.py              # Todos os models SQLAlchemy
```

**Stack:** Python 3.12 · FastAPI · SQLAlchemy 2 · Alembic · JWT · Pydantic v2

---

## 🧠 Sistema Anki — O Diferencial

O motor de revisão espaçada usa o algoritmo **SuperMemo-2 (SM-2)** nativo (`core/sm2.py`).

### Fluxo de geração automática

```
Fonte (PDF / Áudio / Vídeo / Texto)
        │
        ▼
  AI Module (provider: OpenAI | Ollama | Mock)
        │
        ├─► SummarizeChain     → Resumo estruturado
        ├─► ExtractTopicsChain → Tópicos + keywords
        └─► GenerateChain ─────┬─► Flashcards (qa / cloze / múltipla escolha / V/F)
                               ├─► Exercícios com gabarito + explicação
                               └─► Mapa Mental (JSON hierárquico)
        │
        ▼
  AnkiDeck → Flashcard (SM-2 fields)
        │
        ▼
  Revisão agendada → next_review calculado automaticamente
```

### Tipos de card suportados

| Tipo | Descrição |
|------|-----------|
| `qa` | Pergunta / Resposta |
| `multiple_choice` | 4 opções, 1 correta |
| `cloze` | Preenchimento de lacuna |
| `true_false` | Verdadeiro ou Falso |

---

## 🗄️ Banco de Dados

```
database/
├── pomodoro.db          # SQLite (dev/prod)
└── migrations/
    └── versions/
        ├── 61a8b75e1a78_initial_schema_v2.py
        ├── a3f9c2e8b471_anki_system_v2.py
        └── c7d4e5f8a910_extend_settings.py
```

### Principais tabelas

| Tabela | Pilar |
|--------|-------|
| `users` | Auth |
| `tasks` | Pomodoro |
| `pomodoro_sessions` | Pomodoro |
| `settings` | Configurações |
| `subjects` / `categories` / `study_types` | Agenda |
| `exams` / `exam_topics` / `study_plan_items` | Agenda Inteligente |
| `anki_decks` / `flashcards` / `flashcard_options` / `flashcard_reviews` | Anki |
| `exercises` / `exercise_attempts` | Exercícios |
| `study_metrics` | Dashboard |
| `ai_history` | IA |

---

## 🤖 API de IA

Todos os endpoints funcionam **sem nenhuma API key** (provider `mock` por padrão).

| Endpoint | Funcionalidade |
|----------|---------------|
| `GET  /api/ai/health` | Provider ativo + features disponíveis |
| `POST /api/ai/pdf/summarize` | Resumo de PDF (texto ou upload) |
| `POST /api/ai/pdf/topics` | Extração de tópicos |
| `POST /api/ai/exercises/generate` | Geração de exercícios |
| `POST /api/ai/flashcards/generate` | Geração de flashcards |
| `POST /api/ai/mindmap/generate` | Mapa mental estruturado |
| `POST /api/ai/audio/summarize` | Upload de áudio → Whisper → resumo |
| `POST /api/ai/video/summarize` | Upload de vídeo → Whisper → resumo |

### Trocar de provider (zero código)

```env
# .env
AI_PROVIDER=openai          # openai | ollama | mock
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Ou Ollama local:
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

---

## ⚙️ Settings por Categoria

```
GET/PUT /api/settings/pomodoro      # durações work/break, auto-start
GET/PUT /api/settings/display       # tema, dark mode, idioma, meta semanal
GET/PUT /api/settings/ai            # provider preference por usuário
GET/PUT /api/settings/notifications # som, push, desktop
GET/PUT /api/settings/              # agregado completo (backward-compat)
```

---

## 🐳 Docker

```bash
# Desenvolvimento (hot-reload)
docker compose up

# Produção
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Stack IA com Ollama local
docker compose -f docker-compose.yml -f docker-compose.ai.yml up -d
docker exec pomodoro-ollama ollama pull llama3.2
```

---

## 🚀 Início Rápido (local sem Docker)

```bash
# 1) Backend (Windows / PowerShell, Python 3.11)
cd backend
py -3.11 -m venv .venv311
.\.venv311\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item ..\.env.example .env -Force

# Ajuste o banco local em backend/.env para usar o arquivo isolado de dev:
# SQLALCHEMY_DATABASE_URI="sqlite:///../database/pomodoro-local.db"

alembic upgrade head
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir .

# API em http://127.0.0.1:8000
# Swagger em http://127.0.0.1:8000/docs

# 2) Frontend
cd ..\frontend
npm install
npm run dev

# App em http://localhost:3000
```

### Execução rápida em dois terminais

Terminal 1:

```powershell
cd backend
.\.venv311\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir .
```

Terminal 2:

```powershell
cd frontend
npm run dev
```

### Observações para ambiente local

- O backend local foi validado com `Python 3.11`. Com `Python 3.13`, o projeto pode falhar por incompatibilidade com a stack atual.
- O `.env` usado para execução local fica em `backend/.env`.
- O banco local recomendado para desenvolvimento é `database/pomodoro-local.db`, separado do banco principal.
- Em ambiente local, o frontend consome a API em `http://localhost:8000/api`.

---

## 🗺️ Roadmap

- [ ] Importação de PDF via drag-and-drop → flashcards automáticos
- [ ] Transcrição de vídeo-aula → resumo + deck Anki
- [ ] Dashboard de erros frequentes → reforço automático
- [ ] Gamificação (XP, níveis, conquistas)
- [ ] Exportação de decks (formato Anki `.apkg`)
- [ ] App mobile (React Native)
- [ ] PostgreSQL para deploy em nuvem

---

## 📄 Licença

MIT

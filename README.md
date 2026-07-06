# 🍅 Pomodoro Pro — Estudo de Alta Performance

> **Muito além de um timer.** Um sistema completo que combina foco, revisão espaçada e inteligência artificial para transformar qualquer conteúdo em memória de longo prazo.

---

## 🧭 Navegação Simplificada

O app tem **4 páginas principais**, cada uma com propósito único:

```
┌─────────────────────────────────────────────────────────────┐
│   🍅 Pomodoro   📊 Dashboard   🧠 Anki   📚 Estudos   ⛶    │
└─────────────────────────────────────────────────────────────┘
      FOCO         PROGRESSO      REVISÃO    PLANEJAMENTO
     (agora)       (passado)    (repetição)   (futuro)
```

| Página | Função Principal |
|--------|------------------|
| 🍅 **Pomodoro** | Timer de foco com técnica Pomodoro |
| 📊 **Dashboard** | Métricas, heatmap, conquistas, evolução |
| 🧠 **Anki** | Sistema de revisão espaçada (Spaced Repetition) |
| 📚 **Estudos** | Hub completo: editais, planos, Kanban, mapas mentais, quizzes |

> 📖 **Detalhes completos:** Veja [ESTRUTURA_NAVEGACAO.md](./docs/ESTRUTURA_NAVEGACAO.md)

---

## 🏛️ Os 5 Pilares

| Pilar | O que faz | Por que importa |
|-------|-----------|-----------------|
| 🍅 **Pomodoro** | Timer com sessões, pausas e métricas | Base do foco e da consistência |
| 📅 **Agenda Inteligente** | Plano de estudos adaptado à data da prova | Prioriza o que importa, quando importa |
| 📊 **Central de Desempenho** | Heatmap, conquistas, streak, ranking pessoal | Transforma esforço invisível em dados visíveis — e recompensa |
| 🧠 **Sistema Anki + IA** | Revisão espaçada gerada a partir de PDFs, vídeos, erros e questões | **O diferencial absurdo** — memória de longo prazo automática |
| 🏆 **Sistema de Conquistas** | Gamificação integrada ao Dashboard — sem telas extras | Mantém a motivação com progressão real e recompensas visíveis |

---

## ✨ Features Destacadas

### 🗺️ Mapas Mentais com IA

Gere mapas mentais hierárquicos para qualquer disciplina com um clique!

**Como usar:**
1. Acesse **Estudos** → seção **Disciplinas**
2. Clique em **"🗺 Mapa Mental"** em qualquer disciplina
3. A IA gera automaticamente a estrutura hierárquica de tópicos
4. Navegue expandindo/colapsando branches

**Recursos:**
- ✅ Profundidade de até 4 níveis
- ✅ Colorização automática por nível
- ✅ Indicadores de importância (tópicos mais cobrados)
- ✅ Expansão/colapso interativo
- ✅ Modal responsivo

### 📋 Kanban de Dias de Estudos

Visualize sua semana de estudos em formato Kanban - cada dia é uma coluna com suas tarefas!

**Como usar:**
1. Acesse **Estudos** → importe um edital PDF
2. Gere um plano de estudos com IA
3. Na seção **"📅 Semana de Estudos"**, visualize o Kanban
4. Toggle entre **Kanban** (colunas por dia) e **Calendar** (grade)

**Recursos:**
- ✅ 7 colunas (segunda a domingo)
- ✅ Badge "HOJE" destacando o dia atual
- ✅ Cards com tipo (📚 estudo, 🔄 revisão, ❓ quiz)
- ✅ Prioridade visual (dot colorido)
- ✅ Pomodoros estimados vs concluídos
- ✅ Click para selecionar no timer
- ✅ Checkbox para marcar como concluído

> 📖 **Guia completo:** Veja [FEATURES_IMPLEMENTADAS.md](./FEATURES_IMPLEMENTADAS.md) para detalhes técnicos e troubleshooting.

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
│   │   ├── FixedMenu.tsx      # Menu de navegação (4 páginas)
│   │   ├── MindMap/           # Componente de mapas mentais
│   │   └── ...
│   ├── containers/            # Páginas principais
│   │   ├── Pomodoro.tsx       # 🍅 Timer de foco
│   │   ├── Dashboard.tsx      # 📊 Métricas e conquistas
│   │   ├── AnkiPage.tsx       # 🧠 Revisão espaçada
│   │   └── EstudosPage.tsx    # 📚 Hub de estudos (editais, planos, mapas)
│   ├── store/                 # Zustand — estado global por domínio
│   │   ├── useTimerStore.ts
│   │   ├── useAnkiStore.ts
│   │   ├── useDashboardStore.ts
│   │   ├── planTaskStore.ts   # Estado do Kanban semanal
│   │   └── useSettingsStore.ts
│   ├── hooks/                 # Custom hooks (usePomodoro, useSM2, useAI…)
│   ├── services/              # Camada HTTP (axios/fetch) por recurso
│   └── types/                 # Interfaces TypeScript compartilhadas
```

**Stack:** React 18 · TypeScript · Zustand · Recharts · Tailwind CSS · Vite

**Navegação:** 4 páginas principais (🍅 Pomodoro, 📊 Dashboard, 🧠 Anki, 📚 Estudos)

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

## 🏆 Sistema de Conquistas — Central de Desempenho

O Dashboard é a **Central de Desempenho** do usuário. As conquistas aparecem integradas, sem telas extras.

### Progressão de Recompensas

```
⭐ Estrela  →(×10)→  🥇 Medalha  →(×10)→  🏆 Troféu  →(×10)→  💎 Diamante  →(×10)→  👑 Lenda
```

Toda conquista desbloqueada concede **1 Estrela**. O sistema converte automaticamente para os níveis superiores.

### Categorias de Conquistas

| Categoria | Exemplos |
|-----------|---------|
| ⏱ **Pomodoro** | 10 / 25 / 50 / 100 / 500 pomodoros |
| 📝 **Questões** | Respondidas: 10, 100, 500, 1.000 · Acertos: 10, 50, 100, 500, 1.000 |
| 📖 **Flashcards** | Criados: 10–500 · Revisados: 10–1.000 |
| 🤖 **IA** | 1º plano, 1º quiz, 1º mapa mental, 1º resumo |
| 📄 **Documentos** | 1º edital, 1º PDF, 1º vídeo importado |
| 🏛 **Concursos** | Edital concluído, cronograma seguido 30 dias, todas as disciplinas concluídas |
| 🔥 **Consistência** | Streak de 3, 7, 15, 30, 60, 90, 180, 365 dias |
| ⏰ **Horas** | 10h, 25h, 50h, 100h, 250h, 500h, 1.000h |

### Card de Conquistas no Dashboard

```
┌──────────────────────────────────────────────┐
│  🏅 Conquistas                               │
│                                              │
│  ⭐ 34   🥇 3   🏆 0   💎 0   👑 0          │
│                                              │
│  ████████████████░░░░  34/40 (85%)          │
│  Próxima: 🥇 Medalha Bronze                  │
│                                              │
│  Últimas conquistas:                         │
│  🏆 Mestre do Pomodoro                       │
│  ⭐ Primeira Semana Completa                  │
│  🥇 100 Questões Respondidas                 │
└──────────────────────────────────────────────┘
```

### Arquitetura

```
AchievementService
├── registerEvent(event)       ← chamado por todos os roteadores
├── evaluateAll(userId)        ← avalia regras data-driven
├── unlockAchievement(...)     ← persiste desbloqueio
└── grantReward(...)           ← ⭐ → 🥇 → 🏆 → 💎 → 👑
```

**Extensibilidade:** adicionar nova conquista = inserir 1 linha no banco. Zero alteração de código.

### Endpoints

```
GET /api/achievements/            → catálogo completo
GET /api/achievements/me          → conquistas + progresso do usuário
GET /api/achievements/me/summary  → contadores de recompensas + próxima
GET /api/achievements/me/recent   → últimas conquistas desbloqueadas
GET /api/achievements/me/stats    → 10 métricas de desempenho
```

---

## 📥 Importação de Conteúdo

O sistema aceita importação de questões e flashcards em múltiplos formatos. Use esses modelos para gerar o arquivo direto no ChatGPT e importar em segundos.

---

### Formato 1 — Questões de Múltipla Escolha (CSV)

**Endpoint:** `POST /api/quiz/import-csv`

#### Colunas

| Coluna | Obrigatório | Descrição |
|--------|-------------|-----------|
| `disciplina` | Não | Nome da matéria (cria automaticamente se não existir) |
| `enunciado` | **Sim** | Texto completo da questão |
| `a` | **Sim** | Texto da alternativa A |
| `b` | **Sim** | Texto da alternativa B |
| `c` | **Sim** | Texto da alternativa C |
| `d` | **Sim** | Texto da alternativa D |
| `e` | Não | Alternativa E (para bancas com 5 opções, ex: CESPE) |
| `gabarito` | **Sim** | Letra correta: `A`, `B`, `C`, `D` ou `E` |
| `explicacao` | Não | Explicação da resposta correta |
| `dificuldade` | Não | `Easy`, `Medium` ou `Hard` (padrão: `Medium`) |
| `banca` | Não | Banca examinadora (apenas metadado, sem efeito no sistema) |
| `ano` | Não | Ano da prova (apenas metadado) |

#### Exemplo de arquivo

```csv
disciplina,enunciado,a,b,c,d,gabarito,explicacao,dificuldade
Direito Constitucional,O Brasil adota qual forma de governo?,Monarquia,República,Teocracia,Anarquia,B,A CF/88 art. 1º define o Brasil como República Federativa.,Easy
Direito Constitucional,Qual é o prazo para o STF julgar habeas corpus?,10 dias,20 dias,Prazo razoável,48 horas,C,Não existe prazo fixo; aplica-se o princípio da razoável duração.,Medium
Direito Administrativo,O princípio da legalidade exige que o administrador,Faça o que a lei proíbe,Faça apenas o que a lei permite,Interprete a lei livremente,Ignore normas infraconstitucionais,B,Diferente do particular que pode fazer tudo o que a lei não proíbe.,Easy
```

#### Prompt para gerar no ChatGPT

Copie e cole no ChatGPT, substituindo `{DISCIPLINA}` e `{QUANTIDADE}`:

```
Gere {QUANTIDADE} questões de múltipla escolha sobre {DISCIPLINA} para concursos públicos.

Retorne APENAS um CSV com o cabeçalho abaixo (sem texto extra, sem markdown):
disciplina,enunciado,a,b,c,d,gabarito,explicacao,dificuldade

Regras:
- Cada linha = 1 questão
- Gabarito = apenas a letra (A, B, C ou D)
- Não coloque "(correta)" ou "(X)" nas alternativas
- dificuldade = Easy, Medium ou Hard
- Use vírgulas como separador; se o texto tiver vírgula, envolva em aspas duplas
```

---

### Formato 2 — Flashcards Simples (CSV)

**Endpoint:** `POST /api/anki/flashcards/import-csv`

Formato mínimo: duas colunas **sem cabeçalho**, `frente,verso`.

```csv
O que é habeas corpus?,Remédio constitucional que protege a liberdade de locomoção
Quem pode propor ADI?,Legitimados do art. 103 da CF/88
Prazo da prisão temporária nos crimes hediondos?,30 dias prorrogáveis por mais 30
```

**Parâmetros do form-data:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `deck_id` | int | ID do deck de destino |
| `file` | arquivo | Arquivo `.csv` |
| `assunto` | string | Tag opcional (ex: `"Direito Penal"`) |

#### Prompt para gerar no ChatGPT

```
Gere {QUANTIDADE} flashcards sobre {TEMA} no formato CSV puro (sem cabeçalho, sem markdown).
Cada linha: frente da pergunta,resposta objetiva
Regras: respostas curtas (máx 2 linhas), se tiver vírgula no texto use aspas duplas.
```

---

### Formato 3 — Questões via PDF

**Endpoint:** `POST /api/quiz/generate-from-pdf`

Envie qualquer PDF (apostila, prova anterior, edital) como `multipart/form-data`.  
A IA extrai o texto e gera questões automaticamente.

| Campo | Tipo | Default |
|-------|------|---------|
| `file` | arquivo PDF | — |
| `num_questions` | int | `10` |
| `subject_id` | int | opcional |

> **Atenção:** PDFs escaneados (imagem sem texto selecionável) precisam passar por OCR antes da importação.

---

### Formato 4 — Flashcards via PDF

**Endpoint:** `POST /api/anki/ai/generate-from-pdf`

Mesmo conceito do formato 3, mas gera flashcards em vez de questões.

| Campo | Tipo | Default |
|-------|------|---------|
| `file` | arquivo PDF | — |
| `deck_id` | int | opcional (detecta/cria automaticamente) |
| `card_count` | int | `10` |
| `card_types` | string | `"qa"` (`qa`, `multiple_choice`, `cloze`, `true_false`) |
| `language` | string | `"pt"` |

---

### Resumo dos endpoints de importação

| Formato | Endpoint | Gera |
|---------|----------|------|
| CSV múltipla escolha | `POST /api/quiz/import-csv` | Exercícios para o quiz |
| CSV flashcard simples | `POST /api/anki/flashcards/import-csv` | Flashcards qa |
| PDF → questões | `POST /api/quiz/generate-from-pdf` | Exercícios via IA |
| PDF → flashcards | `POST /api/anki/ai/generate-from-pdf` | Flashcards via IA |

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

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload   

ou

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000


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

### Fases planejadas

| Fase | Objetivo | Status |
|------|----------|--------|
| ✅ 1–5 | Auth, Tasks, Pomodoro, Anki+IA, Stats | Concluído |
| 🔲 6 | Security Hardening (SECRET_KEY, CORS, env vars) | Planejado |
| 🔲 7 | Database Integrity (Alembic clean, ghost models) | Planejado |
| 🔲 8 | Study Features (Subjects, Categories, Editais) | Planejado |
| 🔲 9 | Testing (pytest, vitest, Playwright) | Planejado |
| 🔲 10 | PWA & Production (mobile, Docker prod) | Planejado |
| 🔲 11 | **Achievements & Performance Hub** | Planejado |

### Backlog adicional

- [ ] Importação de PDF via drag-and-drop → flashcards automáticos
- [ ] Transcrição de vídeo-aula → resumo + deck Anki
- [ ] Dashboard de erros frequentes → reforço automático
- [ ] Exportação de decks (formato Anki `.apkg`)
- [ ] App mobile (React Native)
- [ ] PostgreSQL para deploy em nuvem

---

## 📄 Licença

MIT

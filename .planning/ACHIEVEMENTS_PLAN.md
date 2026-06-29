# Sistema de Conquistas — Central de Desempenho

**Criado:** 2026-06-29
**Tipo:** Feature Planning
**Status:** Planejado
**Escopo:** Gamificar os estudos sem criar novas telas

---

## Visão Geral

O Dashboard deixa de ser apenas um painel de estatísticas e se torna a **Central de Desempenho** do usuário. As conquistas aparecem naturalmente dentro do Dashboard existente, gamificando os estudos sem poluir a navegação.

Princípio central: **nenhuma tela nova**. Tudo acontece dentro do Dashboard.

---

## Arquitetura

### AchievementService

Serviço central que desacopla o sistema de conquistas de toda a lógica de negócio da aplicação.

```
AchievementService
├── registerEvent(event: AchievementEvent)   → dispara avaliação
├── evaluateAll(userId)                      → verifica todas as regras
├── unlockAchievement(userId, achievementId) → persiste desbloqueio
├── getProgress(userId)                      → retorna progresso por categoria
└── grantReward(userId, reward)              → concede estrelas/medalhas/troféus
```

Toda ação da aplicação emite um evento. O AchievementService reage a esses eventos e atualiza o progresso automaticamente.

### Fluxo

```
Ação do usuário (ex: completar pomodoro)
        │
        ▼
  Roteador / Serviço emite AchievementEvent
        │
        ▼
  AchievementService.registerEvent()
        │
        ▼
  Avalia regras aplicáveis ao evento
        │
        ├─► Atualiza contadores
        ├─► Verifica thresholds
        └─► Se threshold atingido → unlock + grant reward
                        │
                        ▼
                  Persiste no banco
                        │
                        ▼
                  Frontend polling / SSE
                        │
                        ▼
                  Dashboard atualiza card de conquistas
```

---

## Eventos

Todos os eventos devem ser emitidos pelos respectivos serviços/roteadores:

```python
class AchievementEvent(str, Enum):
    # Tarefas
    TASK_CREATED         = "TASK_CREATED"
    TASK_COMPLETED       = "TASK_COMPLETED"

    # Pomodoro
    POMODORO_COMPLETED   = "POMODORO_COMPLETED"
    POMODORO_INTERRUPTED = "POMODORO_INTERRUPTED"

    # Quiz
    QUIZ_COMPLETED       = "QUIZ_COMPLETED"
    QUIZ_CORRECT         = "QUIZ_CORRECT"
    QUIZ_WRONG           = "QUIZ_WRONG"

    # Flashcards
    FLASHCARD_CREATED    = "FLASHCARD_CREATED"
    FLASHCARD_REVIEWED   = "FLASHCARD_REVIEWED"

    # IA
    PDF_IMPORTED         = "PDF_IMPORTED"
    NOTICE_IMPORTED      = "NOTICE_IMPORTED"
    STUDY_PLAN_CREATED   = "STUDY_PLAN_CREATED"
    MINDMAP_CREATED      = "MINDMAP_CREATED"
    SUMMARY_CREATED      = "SUMMARY_CREATED"

    # Consistência (calculado por job noturno)
    STUDY_DAY_COMPLETED  = "STUDY_DAY_COMPLETED"
```

---

## Sistema de Progressão (Recompensas)

```
⭐ Estrela       (unidade base)
     │  10 estrelas
     ▼
🥇 Medalha
     │  10 medalhas (= 100 estrelas)
     ▼
🏆 Troféu
     │  10 troféus (= 1.000 estrelas)
     ▼
💎 Diamante
     │  10 diamantes (= 10.000 estrelas)
     ▼
👑 Lenda
```

Toda conquista desbloqueada concede **1 Estrela**. O sistema calcula automaticamente se o usuário acumula Medalhas, Troféus, etc.

---

## Categorias e Conquistas

### 📚 Estudos

| ID | Conquista | Gatilho | Recompensa |
|----|-----------|---------|------------|
| S01 | Primeira Disciplina | 1ª disciplina criada | ⭐ |
| S02 | Semana Completa | 7 dias consecutivos de estudo | ⭐ |
| S03 | Mês Dedicado | 30 dias de estudo no mês | ⭐ |
| S04 | Plano Concluído | finalizar 1 plano de estudos | ⭐ |
| S05 | Edital Finalizado | finalizar 1 edital | ⭐ |

---

### ⏱ Pomodoro

| ID | Conquista | Meta | Recompensa |
|----|-----------|------|------------|
| P01 | Primeiros Passos | 10 pomodoros | ⭐ |
| P02 | Em Ritmo | 25 pomodoros | ⭐ |
| P03 | Focado | 50 pomodoros | ⭐ |
| P04 | Mestre do Foco | 100 pomodoros | ⭐ |
| P05 | Lenda do Pomodoro | 500 pomodoros | ⭐ |

---

### 📝 Questões

#### Respondidas

| ID | Conquista | Meta | Recompensa |
|----|-----------|------|------------|
| Q01 | Primeiro Quiz | 10 respondidas | ⭐ |
| Q02 | Estudioso | 100 respondidas | ⭐ |
| Q03 | Veterano | 500 respondidas | ⭐ |
| Q04 | Expert | 1.000 respondidas | ⭐ |

#### Acertos

| ID | Conquista | Meta | Recompensa |
|----|-----------|------|------------|
| Q05 | Primeiros Acertos | 10 acertos | ⭐ |
| Q06 | Boa Pontaria | 50 acertos | ⭐ |
| Q07 | Preciso | 100 acertos | ⭐ |
| Q08 | Atirador de Elite | 500 acertos | ⭐ |
| Q09 | Infalível | 1.000 acertos | ⭐ |

---

### 📖 Flashcards

#### Criados

| ID | Conquista | Meta | Recompensa |
|----|-----------|------|------------|
| F01 | Primeiro Deck | 10 criados | ⭐ |
| F02 | Colecionador | 50 criados | ⭐ |
| F03 | Arquivista | 100 criados | ⭐ |
| F04 | Bibliófilo | 500 criados | ⭐ |

#### Revisados

| ID | Conquista | Meta | Recompensa |
|----|-----------|------|------------|
| F05 | Revisão Inicial | 10 revisados | ⭐ |
| F06 | Repetição Espaçada | 100 revisados | ⭐ |
| F07 | Memória de Aço | 500 revisados | ⭐ |
| F08 | Mestre Anki | 1.000 revisados | ⭐ |

---

### 🤖 IA

| ID | Conquista | Gatilho | Recompensa |
|----|-----------|---------|------------|
| A01 | Primeiro Plano IA | 1 plano de estudos gerado | ⭐ |
| A02 | Primeiro Quiz IA | 1 quiz gerado | ⭐ |
| A03 | Primeiro Mapa Mental | 1 mapa mental gerado | ⭐ |
| A04 | Primeiro Resumo | 1 resumo gerado | ⭐ |

---

### 📄 Documentos

| ID | Conquista | Gatilho | Recompensa |
|----|-----------|---------|------------|
| D01 | Primeiro Edital | 1 edital importado | ⭐ |
| D02 | Primeiro Plano | 1 plano importado | ⭐ |
| D03 | Primeiro PDF | 1 PDF importado | ⭐ |
| D04 | Primeiro Vídeo | 1 vídeo importado | ⭐ |

---

### 🏛 Concursos

| ID | Conquista | Gatilho | Recompensa |
|----|-----------|---------|------------|
| C01 | Primeiro Edital | 1º edital importado | ⭐ |
| C02 | Primeiro Plano | 1º plano de estudos criado | ⭐ |
| C03 | Primeira Disciplina | 1ª disciplina concluída | ⭐ |
| C04 | Primeiro Simulado | 1º simulado realizado | ⭐ |
| C05 | Primeiro Edital Concluído | 1 edital 100% concluído | ⭐ |
| C06 | Comparativo | comparou 2 editais | ⭐ |
| C07 | Cronograma Fiel | cronograma seguido 30 dias | ⭐ |
| C08 | Edital Dominado | todas as disciplinas do edital concluídas | ⭐ |

---

### 🔥 Consistência (Dias Consecutivos)

| ID | Conquista | Meta | Recompensa |
|----|-----------|------|------------|
| K01 | Começo | 3 dias | ⭐ |
| K02 | Semana | 7 dias | ⭐ |
| K03 | Quinzena | 15 dias | ⭐ |
| K04 | Mês | 30 dias | ⭐ |
| K05 | Dois Meses | 60 dias | ⭐ |
| K06 | Trimestre | 90 dias | ⭐ |
| K07 | Semestre | 180 dias | ⭐ |
| K08 | Um Ano | 365 dias | ⭐ |

---

### ⏰ Horas de Estudo

| ID | Conquista | Meta | Recompensa |
|----|-----------|------|------------|
| H01 | Primeiras Horas | 10h | ⭐ |
| H02 | Dedicado | 25h | ⭐ |
| H03 | Comprometido | 50h | ⭐ |
| H04 | Centenário | 100h | ⭐ |
| H05 | Especialista | 250h | ⭐ |
| H06 | Profissional | 500h | ⭐ |
| H07 | Lenda | 1.000h | ⭐ |

---

## Sistema de Progressão de XP (Conquistas Cumulativas)

Uso de progressão em duas fases para manter desafio a longo prazo:

### Fase 1 — Progressão Aritmética (primeiros níveis)
```
10 → 20 → 30 → 40 → 50 → 75 → 100 estrelas
```

### Fase 2 — Progressão Geométrica (níveis avançados)
```
150 → 300 → 600 → 1.200 → 2.400 → 4.800 estrelas
```

---

## Dashboard — Card de Conquistas

### Layout

```
┌─────────────────────────────────────────┐
│  🏅 Conquistas                          │
│                                         │
│  ⭐ 34    🥇 3    🏆 0    💎 0    👑 0  │
│                                         │
│  Progresso para próxima recompensa:     │
│  ████████████████░░░░░░  34/40 (85%)   │
│  Próxima: 🥇 Medalha Bronze             │
│                                         │
│  Últimas conquistas:                    │
│  🏆 Mestre do Pomodoro                  │
│  ⭐ Primeira Semana Completa             │
│  🥇 100 Questões Respondidas            │
└─────────────────────────────────────────┘
```

### Campos exibidos

- Contadores: ⭐ Estrelas / 🥇 Medalhas / 🏆 Troféus / 💎 Diamantes / 👑 Lendas
- Barra de progresso para próxima recompensa
- Percentual atual
- Nome da próxima recompensa
- Lista das últimas 3–5 conquistas desbloqueadas (com ícone + nome)

---

## Dashboard — Card de Estatísticas

Adicionar ao Dashboard:

| Métrica | Descrição |
|---------|-----------|
| Disciplina mais estudada | Subject com maior soma de minutos |
| Disciplina menos estudada | Subject com menor soma de minutos (excluindo zero) |
| Horas estudadas | Total acumulado |
| Dias consecutivos | Streak atual |
| Pomodoros concluídos | Total histórico |
| Questões respondidas | Total histórico |
| Taxa de acerto | % de respostas corretas |
| Flashcards criados | Total histórico |
| Revisões realizadas | Total histórico de flashcard_reviews |
| Tempo médio por sessão | Média de duração dos pomodoros |

---

## Dashboard — Ranking Pessoal

```
┌─────────────────────────────────────────┐
│  📊 Ranking Pessoal                     │
│                                         │
│  🔥 Melhor disciplina: Direito Const.   │
│  📉 Precisa melhorar: Matemática        │
│  🏆 Maior evolução: Língua Portuguesa   │
│  📚 Mais estudada: Direito Const.       │
└─────────────────────────────────────────┘
```

---

## Banco de Dados — Schema

### Tabelas novas

```sql
-- Catálogo de conquistas (seed fixo)
CREATE TABLE achievements (
    id          INTEGER PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,      -- ex: "P04"
    category    TEXT NOT NULL,             -- "pomodoro", "quiz", etc.
    title       TEXT NOT NULL,
    description TEXT,
    icon        TEXT,                      -- emoji ou nome de ícone
    reward_type TEXT NOT NULL,             -- "star", "medal", "trophy", "diamond", "legend"
    threshold   INTEGER,                   -- valor numérico do gatilho (quando aplicável)
    event_type  TEXT                       -- AchievementEvent que dispara avaliação
);

-- Progresso e desbloqueios por usuário
CREATE TABLE user_achievements (
    id             INTEGER PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    achievement_id INTEGER NOT NULL REFERENCES achievements(id),
    unlocked_at    TIMESTAMP,
    progress       INTEGER DEFAULT 0,      -- progresso atual
    UNIQUE(user_id, achievement_id)
);

-- Contadores globais por usuário (desnormalizados para performance)
CREATE TABLE user_stats (
    user_id             INTEGER PRIMARY KEY REFERENCES users(id),
    total_stars         INTEGER DEFAULT 0,
    total_medals        INTEGER DEFAULT 0,
    total_trophies      INTEGER DEFAULT 0,
    total_diamonds      INTEGER DEFAULT 0,
    total_legends       INTEGER DEFAULT 0,
    pomodoros_completed INTEGER DEFAULT 0,
    quizzes_answered    INTEGER DEFAULT 0,
    quizzes_correct     INTEGER DEFAULT 0,
    flashcards_created  INTEGER DEFAULT 0,
    flashcards_reviewed INTEGER DEFAULT 0,
    total_study_minutes INTEGER DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    last_study_date     DATE,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Endpoints Backend

```
GET  /api/achievements/                    → catálogo completo
GET  /api/achievements/me                  → conquistas do usuário (desbloqueadas + progresso)
GET  /api/achievements/me/summary          → resumo: estrelas, medalhas, próxima recompensa
GET  /api/achievements/me/recent           → últimas N conquistas desbloqueadas
GET  /api/achievements/me/stats            → user_stats do usuário (para card de estatísticas)
POST /api/achievements/events              → endpoint interno (emitido por outros serviços)
```

---

## Extensibilidade

Para adicionar uma nova conquista basta:

1. Inserir uma linha na tabela `achievements` (seed SQL ou migration)
2. Garantir que o evento correspondente seja emitido no serviço de domínio
3. Nenhuma alteração na lógica do AchievementService é necessária

O serviço avalia regras **data-driven**: lê os thresholds do banco e compara com os contadores de `user_stats`.

---

## Fases de Implementação

### Fase A — Backend Core
1. Criar tabelas `achievements`, `user_achievements`, `user_stats` + migration Alembic
2. Seed das conquistas no banco (todas as categorias acima)
3. Implementar `AchievementService` com `registerEvent`, `evaluateAll`, `unlockAchievement`
4. Implementar endpoints `/api/achievements/*`
5. Emitir eventos nos roteadores existentes (`pomodoro_sessions.py`, `exercises.py`, `anki.py`, etc.)

### Fase B — Dashboard Frontend
1. Criar `achievementStore` (Zustand) com fetch dos endpoints
2. Adicionar card "Conquistas" no Dashboard (progresso + últimas conquistas)
3. Adicionar card "Estatísticas" expandido no Dashboard
4. Adicionar card "Ranking Pessoal" no Dashboard

### Fase C — Feedback em Tempo Real
1. Toast/notificação quando uma conquista é desbloqueada
2. Animação de celebração (confetti leve) no desbloqueio
3. Badge de notificação no ícone do Dashboard quando há conquistas novas

---

## Critérios de Sucesso

1. Completar um pomodoro → evento `POMODORO_COMPLETED` emitido → contador atualizado → se threshold atingido, conquista desbloqueada automaticamente
2. Dashboard exibe contadores de recompensas, barra de progresso e próxima conquista sem carregar página separada
3. Adicionar nova conquista requer apenas inserir linha no banco — zero alteração de lógica
4. Todas as estatísticas do card de desempenho são calculadas a partir de dados reais do banco
5. Sistema de progressão (estrela → medalha → troféu → diamante → lenda) é calculado automaticamente

---

## Relacionamento com Roadmap Existente

Esta feature se encaixa como **Phase 11** no roadmap atual, dependendo de:
- Phase 5 ✅ (Stats API existente — reusar padrão)
- Phase 8 (Study Features — fornece eventos de disciplinas/editais)

Pode ser iniciada em paralelo com Phase 8, pois o core do AchievementService é independente das study features.

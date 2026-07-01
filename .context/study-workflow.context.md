# Study Workflow Context — Regra de Negócio Central

> **Leia este arquivo antes de modificar qualquer tela.**
> Ele descreve o fluxo obrigatório do produto. Toda implementação deve respeitar esta ordem.

---

## Princípio fundamental

O **edital** é a origem de toda a estrutura de estudos da plataforma.
Nada deve ser criado manualmente pelo usuário após importar o edital.

---

## Fluxo obrigatório (12 passos)

```
Importar Edital
    ↓
IA interpreta automaticamente
    ↓
Selecionar Cargo (se múltiplos)
    ↓
Gerar Plano (IA)
    ↓
Gerar Template semanal (IA)
    ↓
Gerar Tasks automaticamente
    ↓
Kanban / Calendário
    ↓
Pomodoro (usa Task selecionada)
    ↓
Dashboard (agenda + métricas)
    ↓
Revisões automáticas
    ↓
Flashcards
```

---

## Passo 1 — Importar Edital

- O usuário importa um PDF (ex: `ALECE.pdf`, `SEFAZ-CE.pdf`)
- Rota: `/estudos`
- Endpoint: `POST /docs/upload` com `doc_type='edital'`
- O backend extrai automaticamente: concurso, banca, cargos, disciplinas, assuntos, pesos
- **Nunca perguntar ao usuário** informações que já constam no edital

---

## Passo 2 — IA Analisa o Edital

O backend popula `/study-context` com:
- `concurso`, `banca`, `cargo`, `available_cargos`
- `subjects[]` (disciplinas)
- `subject_weights` (pesos)
- `exam_date`

Após upload → sempre chamar `fetchContext()` para sincronizar.

---

## Passo 3 — Selecionar Cargo (se múltiplos)

- Condição: `context.available_cargos.length > 1 && !context.cargo`
- Mostrar lista de cargos → usuário escolhe um
- `PUT /study-context { cargo }` → `fetchContext()`
- Após selecionar → acionar automaticamente geração do plano

---

## Passo 4 — Gerar Plano de Estudos (IA)

- Endpoint: `POST /planner/quick-plan`
- Payload: `{ concurso, cargo, banca, exam_date }`
- Resposta: `{ topics[], weekly_schedule: {day: [subjects]}, days_until_exam, total_study_hours }`
- Salvar resultado em `studyContextStore` (context.weekly_schedule já é atualizado via fetchContext)

---

## Passo 5 — Gerar Template Semanal

O template é derivado do `weekly_schedule`:
```
Segunda → [Banco de Dados, Auditoria, Engenharia de Software]
Terça   → [Redes, Português, Estatística]
Quarta  → [Segurança, Banco de Dados, Questões]
```

Este template é a base de todas as tasks.

---

## Passo 6 — Gerar Tasks Automaticamente

- Store responsável: `planTaskStore`
- Acionado automaticamente após `POST /planner/quick-plan`
- Cada disciplina por dia → uma `PlanTask`
- IDs estáveis: `day_of_week * 100 + position` (range 0-699, nunca conflita com tasks manuais)
- Campos obrigatórios por task:
  - `title` (disciplina)
  - `subject` (disciplina)
  - `day_of_week` (0=Segunda...6=Domingo)
  - `day_name` (Segunda, Terça...)
  - `assigned_date` (ISO date da semana atual)
  - `position` (ordem no dia)
  - `estimated_minutes` (calculado de study_hours/qtd_disciplinas)
  - `pomodoros_est` (estimado)
  - `pomodoros_done` (realizado)
  - `completed` (boolean)
  - `type`: 'study' | 'review' | 'quiz'
  - `priority` (da performance da disciplina)

---

## Passo 7 — Kanban + Calendário

- Rota: `/plano`
- Toggle: [Kanban] [Calendário]
- **Kanban**: colunas por dia da semana, cards de tasks
- **Calendário**: grade temporal (08:00–20:00), blocos de tasks com duração
- Hoje = coluna destacada
- Click na task → seleciona para Pomodoro
- Checkbox → marca como concluída

---

## Passo 8 — Pomodoro usa Task Selecionada

- A task selecionada no Kanban/Calendário deve ser passada para `useSelectedTask`
- Ao completar um Pomodoro → `planTaskStore.incrementPomodoro(id)`
- Dashboard e Kanban refletem o progresso em tempo real
- **Nunca** iniciar Pomodoro sem task selecionada (pode ser optional para modo pausa)

---

## Passo 9 — Pomodoro com Questões

- Só gerar questões se houver PDF da disciplina indexado
- Condição: `subject_id` da task tem documentos em `/docs/` com `doc_type='conteudo'`
- Se não houver material:
  ```
  Não existe material suficiente para gerar questões desta disciplina.
  Importe um PDF desta matéria para habilitar o Pomodoro com Questões.
  ```
- **Nunca** gerar perguntas genéricas (sem material associado)

---

## Passo 10 — Dashboard como Agenda

O Dashboard deve funcionar como agenda + métricas:

**Topo (agenda):**
```
Hoje — Terça-feira, 01/07
✓ Banco de Dados      [2/2 🍅]
○ Redes               [0/2 🍅]
○ Português           [0/1 🍅]
Progresso: ▓▓░░ 1/3 (33%)
```

**Próximos dias:**
```
Quarta
  Segurança, Banco de Dados, Questões
```

**Métricas (abaixo):**
- Horas estudadas (hoje/semana/total)
- Taxa de acerto
- Pomodoros realizados
- Disciplinas mais/menos estudadas
- Flashcards e revisões

---

## Passo 11 — Revisões Automáticas

- Quando uma disciplina tem erros recorrentes → `addReview(subject, topic)`
- A revisão cria automaticamente uma `PlanTask` do tipo `'review'` em data futura
- No dia agendado, a task aparece no Kanban/Calendário como revisão
- Endpoint: `POST /study-context/review`

---

## Passo 12 — Arquitetura de Dados

### Stores e responsabilidades:

| Store | Responsabilidade | Persiste |
|-------|-----------------|---------|
| `planTaskStore` | Tasks geradas do plano | ✅ localStorage |
| `studyContextStore` | Contexto do edital + performances | ❌ backend |
| `pomodoroStore` | Sessões e stats do timer | ❌ backend |
| `ankiStore` | Flashcards e revisões SM2 | ❌ backend |
| `selectedTaskStore` | Task ativa no Pomodoro | ❌ memória |

### Regra de IDs:
- **Plan tasks**: `day_of_week * 100 + position` (0–699)
- **Manual tasks (TaskList)**: `Date.now()` (>1700000000000)
- **Backend tasks (taskStore)**: sequencial do banco

### Conexão Edital → Tasks:
```
context.weekly_schedule[]
    ↓ planTaskStore.generateFromSchedule()
PlanTask[] (persiste no localStorage 'study-plan-tasks-v1')
    ↓ PlanoPage (/plano)
Kanban + Calendar
    ↓ useSelectedTask.select()
Pomodoro timer
    ↓ planTaskStore.incrementPomodoro()
Dashboard agenda
```

---

## O que NÃO fazer

- ❌ Não criar tasks manualmente para o plano gerado
- ❌ Não perguntar informações que já estão no edital
- ❌ Não mostrar quiz sem material PDF da disciplina
- ❌ Não mostrar Dashboard como apenas métricas (deve ser agenda primeiro)
- ❌ Não usar `taskStore.ts` para plan tasks (está desconectado do backend)
- ❌ Não duplicar lógica de quiz entre `quizStore.ts` e `PomodoroQuiz.tsx`

---

## Arquivos críticos

| Arquivo | Papel |
|---------|-------|
| `store/planTaskStore.ts` | Novo — tasks do plano |
| `store/studyContextStore.ts` | Contexto do edital |
| `containers/EstudosPage.tsx` | Fluxo de import + geração |
| `containers/PlanoPage.tsx` | Novo — Kanban + Calendário |
| `containers/Dashboard.tsx` | Agenda + métricas |
| `containers/Pomodoro.tsx` | Timer central |
| `components/PomodoroQuiz/PomodoroQuiz.tsx` | Quiz com material |

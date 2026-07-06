# 🎯 Features Implementadas - Mapas Mentais e Kanban

## ✅ Status: TODAS AS FEATURES ESTÃO IMPLEMENTADAS

**Atualização:** Quiz adicionado ao menu de navegação! ✅

---

## 🗺️ 1. Mapas Mentais (Mind Maps)

### Backend

**Arquivo:** `backend/app/documents/mindmap_router.py`

**Endpoint:** `POST /api/mindmap/generate`

**Funcionalidade:**
- Gera mapas mentais hierárquicos usando IA
- Suporta geração por:
  - Nome da disciplina (ex: "Direito Administrativo")
  - ID de documento indexado
- Profundidade configurável (padrão: 3 níveis)
- Colorização automática por nível
- Importância dos tópicos (1-3)

**Registro:** Já está registrado no `backend/app/main.py` (linha 10 e 53)

### Frontend

**Componente:** `frontend/src/components/MindMap/MindMap.tsx`

**Estilo:** `frontend/src/components/MindMap/MindMap.css`

**Integração:** `frontend/src/containers/EstudosPage.tsx`

**Como usar:**
1. Navegue até a página **Estudos** (`/estudos`)
2. Na seção **Disciplinas**, cada disciplina tem um botão **"🗺 Mapa Mental"**
3. Clique no botão para gerar o mapa mental com IA
4. O mapa aparece em um modal expansível
5. Clique nos nós para expandir/colapsar sub-tópicos

**Recursos:**
- ✅ Visualização hierárquica em árvore
- ✅ Cores por nível de profundidade
- ✅ Indicadores de importância (●, ◆, ★)
- ✅ Expansão/colapso de branches
- ✅ Modal overlay com fundo desfocado
- ✅ Contador de nós total
- ✅ Botão de fechar

---

## 📋 2. Kanban de Dias de Estudos

### Frontend

**Componente Principal:** `frontend/src/containers/EstudosPage.tsx`
- Componente `KanbanView` (linha 104)
- Componente `KanbanCard` (linha 57)

**Também disponível em:** `frontend/src/containers/PlanoPage.tsx`

**Como usar:**
1. Navegue até a página **Estudos** (`/estudos`)
2. Importe um edital PDF
3. Gere um plano de estudos com IA (botão na seção do concurso)
4. Na seção **"📅 Semana de Estudos"**, você verá o Kanban
5. Use o toggle no topo para alternar entre:
   - **Kanban** (view padrão - colunas por dia da semana)
   - **Calendar** (view alternativa)

**Recursos:**
- ✅ Colunas por dia da semana (seg-dom)
- ✅ Badge "HOJE" destacando o dia atual
- ✅ Cards de tarefas com:
  - Tipo (📚 estudo, 🔄 revisão, ❓ quiz)
  - Título e duração
  - Prioridade (dot colorido)
  - Pomodoros estimados vs concluídos
  - Checkbox para marcar como concluído
- ✅ Destaque visual para tarefa selecionada no timer
- ✅ Click no card para selecionar no Pomodoro
- ✅ Dias passados ficam com opacidade reduzida
- ✅ Responsivo e scroll horizontal se necessário

**Estrutura do Kanban:**

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  Segunda │   Terça  │  Quarta  │  Quinta  │   Sexta  │  Sábado  │ Domingo  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Card 1   │ Card 1   │ Card 1   │ Card 1   │ Card 1   │ Card 1   │ Card 1   │
│ Card 2   │ Card 2   │          │ Card 2   │          │ Card 2   │          │
│          │          │          │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

---

---

## ❓ 3. Quiz Inteligente

### Frontend

**Página:** `frontend/src/containers/QuizPage.tsx`

**Acesso:** Menu superior → **❓ Quiz**

**Como usar:**
1. Selecione uma matéria no Pomodoro (página inicial)
2. Clique no botão **❓ Quiz** no menu superior
3. A IA gera automaticamente questões adaptativas
4. Responda e receba feedback instantâneo
5. Ao errar, flashcards são criados automaticamente para revisão

**Recursos:**
- ✅ Questões geradas por IA adaptadas ao seu nível
- ✅ Múltipla escolha com 4 alternativas
- ✅ Botão "Eliminar" para remover 2 alternativas erradas
- ✅ Dica opcional (💡 Ver dica)
- ✅ Feedback imediato (correto/incorreto)
- ✅ Explicação detalhada após cada resposta
- ✅ Criação automática de flashcards para erros
- ✅ Barra de progresso visual
- ✅ Estatísticas finais (% de acertos)
- ✅ Integração com sistema Anki

**Fluxo:**
```
Seleciona matéria → Quiz → Responde questões → Erros viram flashcards → Revisa no Anki
```

---

## 🔧 Configuração Necessária

Para usar essas features, você precisa:

### 1. Backend rodando
```bash
cd backend
python -m uvicorn app.main:app --reload
```

### 2. Provedor de IA configurado

Edite o arquivo `.env` no backend:

```env
# OpenAI (recomendado)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...

# OU Ollama (local, grátis)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

### 3. Frontend rodando
```bash
cd frontend
npm run dev
```

---

## 📸 Localização Visual

### Estrutura de Navegação

O app tem **4 páginas principais** no menu:

```
🍅 Pomodoro    → Timer de foco (página inicial)
📊 Dashboard   → Métricas, heatmap, conquistas
🧠 Anki        → Sistema de revisão espaçada
📚 Estudos     → Central completa de estudos
```

### Página Estudos - Tudo em Um Lugar

A página **Estudos** é o hub central que integra:
- 📄 Importação de editais
- 📖 Upload de conteúdos (PDFs)
- 📅 Plano de estudos semanal (Kanban)
- 🗺️ Mapas mentais por disciplina
- ❓ Quizzes e exercícios
- 📚 Gerenciamento de disciplinas

### Mapas Mentais
```
Página Estudos
  └─ Seção "📚 Disciplinas"
      └─ Para cada disciplina:
          └─ Botão "🗺 Mapa Mental"
              └─ [CLICK] → Modal com árvore hierárquica
```

### Kanban
```
Página Estudos
  └─ Seção "📅 Semana de Estudos"
      └─ Toggle [Kanban | Calendar]
          └─ [Kanban] → 7 colunas (seg-dom)
              └─ Cards de tarefas por dia
```

---

## 🐛 Troubleshooting

### Mapa Mental não gera
- ✅ Verifique se o backend está rodando
- ✅ Verifique se há um provedor de IA configurado
- ✅ Abra o console do navegador (F12) para ver erros
- ✅ Verifique os logs do backend

### Kanban não aparece
- ✅ Importe um edital primeiro
- ✅ Gere um plano de estudos (botão "Gerar Plano de Estudos com IA")
- ✅ Aguarde o processamento (aparece um loading)
- ✅ Role a página até a seção "📅 Semana de Estudos"

---

## 🎨 Personalização

### Cores do Mapa Mental
Arquivo: `backend/app/documents/mindmap_router.py` (linha 48-54)

```python
LEVEL_COLORS = {
    0: "#667eea",   # root - purple
    1: "#764ba2",   # level 1 - dark purple
    2: "#10b981",   # level 2 - green
    3: "#f59e0b",   # level 3 - amber
    4: "#ef4444",   # level 4 - red
}
✅ **Quiz Inteligente**: Totalmente implementado e **AGORA ACESSÍVEL NO MENU** ❓

Todas as features estão **prontas para uso**. Basta configurar o provedor de IA e importar um edital!

---

## 🔄 Mudanças Recentes

### ✅ Correções Aplicadas

1. **Quiz adicionado ao menu** - Agora você pode acessar o Quiz Inteligente clicando no botão **❓** no menu superior
2. **Documentação completa** - Guias e checklists criados para facilitar o uso

### 📍 Como Acessar Cada Feature

| Feature | Acesso | Ícone no Menu |
|---------|--------|---------------|
| **Timer Pomodoro** | Menu → 🍅 | 🍅 Pomodoro |
| **Dashboard** | Menu → 📊 | 📊 Dashboard |
| **Sistema Anki** | Menu → 🧠 | 🧠 Revisões |
| **Estudos (Kanban + Mapas)** | Menu → 📚 | 📚 Estudos |
| **Quiz Inteligente** | Menu → ❓ | ❓ Quiz |
### Cores de Prioridade do Kanban
Arquivo: `frontend/src/containers/EstudosPage.tsx` (linha 40-46)

```typescript
const PRIORITY_COLOR: Record<number, string> = {
  5: '#ef4444',  // vermelho (urgente)
  4: '#f97316',  // laranja
  3: '#eab308',  // amarelo
  2: '#84cc16',  // lima
  1: '#10b981',  // verde (baixa prioridade)
};
```

---

## 📝 Notas Adicionais

### Integração
- O Kanban é gerado automaticamente quando você cria um plano com IA
- Os mapas mentais são gerados sob demanda por disciplina
- Ambos usam o mesmo provedor de IA configurado

### Dados
- Tarefas do Kanban são salvas no store local (`planTaskStore`)
- Mapas mentais não são salvos (gerados sob demanda)

### Performance
- Mapas mentais limitados a 7 filhos por nó (para não sobrecarregar)
- Profundidade máxima de 3 níveis (configurável)

---

## ✨ Resumo

✅ **Mapas Mentais**: Totalmente implementados e funcionais  
✅ **Kanban de Estudos**: Totalmente implementado e funcional  

Ambas as features estão **prontas para uso**. Basta configurar o provedor de IA e importar um edital!

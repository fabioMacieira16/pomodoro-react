ACHIEVEMENTS_SEED = [
    # ── Pomodoro ─────────────────────────────────────────────────────────────
    {"code": "P01", "category": "pomodoro", "title": "Primeiros Passos",   "icon": "⏱", "threshold": 10,   "event_type": "pomodoros_completed"},
    {"code": "P02", "category": "pomodoro", "title": "Em Ritmo",           "icon": "⏱", "threshold": 25,   "event_type": "pomodoros_completed"},
    {"code": "P03", "category": "pomodoro", "title": "Focado",             "icon": "⏱", "threshold": 50,   "event_type": "pomodoros_completed"},
    {"code": "P04", "category": "pomodoro", "title": "Mestre do Foco",     "icon": "🏆", "threshold": 100,  "event_type": "pomodoros_completed"},
    {"code": "P05", "category": "pomodoro", "title": "Lenda do Pomodoro",  "icon": "👑", "threshold": 500,  "event_type": "pomodoros_completed"},
    # ── Quiz — respondidas ───────────────────────────────────────────────────
    {"code": "Q01", "category": "quiz", "title": "Primeiro Quiz",          "icon": "📝", "threshold": 10,   "event_type": "quizzes_answered"},
    {"code": "Q02", "category": "quiz", "title": "Estudioso",              "icon": "📝", "threshold": 100,  "event_type": "quizzes_answered"},
    {"code": "Q03", "category": "quiz", "title": "Veterano",               "icon": "📝", "threshold": 500,  "event_type": "quizzes_answered"},
    {"code": "Q04", "category": "quiz", "title": "Expert",                 "icon": "📝", "threshold": 1000, "event_type": "quizzes_answered"},
    # ── Quiz — acertos ───────────────────────────────────────────────────────
    {"code": "Q05", "category": "quiz", "title": "Primeiros Acertos",      "icon": "✅", "threshold": 10,   "event_type": "quizzes_correct"},
    {"code": "Q06", "category": "quiz", "title": "Boa Pontaria",           "icon": "✅", "threshold": 50,   "event_type": "quizzes_correct"},
    {"code": "Q07", "category": "quiz", "title": "Preciso",                "icon": "✅", "threshold": 100,  "event_type": "quizzes_correct"},
    {"code": "Q08", "category": "quiz", "title": "Atirador de Elite",      "icon": "✅", "threshold": 500,  "event_type": "quizzes_correct"},
    {"code": "Q09", "category": "quiz", "title": "Infalível",              "icon": "✅", "threshold": 1000, "event_type": "quizzes_correct"},
    # ── Flashcards criados ───────────────────────────────────────────────────
    {"code": "F01", "category": "flashcards", "title": "Primeiro Deck",    "icon": "📖", "threshold": 10,   "event_type": "flashcards_created"},
    {"code": "F02", "category": "flashcards", "title": "Colecionador",     "icon": "📖", "threshold": 50,   "event_type": "flashcards_created"},
    {"code": "F03", "category": "flashcards", "title": "Arquivista",       "icon": "📖", "threshold": 100,  "event_type": "flashcards_created"},
    {"code": "F04", "category": "flashcards", "title": "Bibliófilo",       "icon": "📖", "threshold": 500,  "event_type": "flashcards_created"},
    # ── Flashcards revisados ─────────────────────────────────────────────────
    {"code": "F05", "category": "flashcards", "title": "Revisão Inicial",  "icon": "🔁", "threshold": 10,   "event_type": "flashcards_reviewed"},
    {"code": "F06", "category": "flashcards", "title": "Repetição Espaçada","icon": "🔁", "threshold": 100,  "event_type": "flashcards_reviewed"},
    {"code": "F07", "category": "flashcards", "title": "Memória de Aço",   "icon": "🔁", "threshold": 500,  "event_type": "flashcards_reviewed"},
    {"code": "F08", "category": "flashcards", "title": "Mestre Anki",      "icon": "🧠", "threshold": 1000, "event_type": "flashcards_reviewed"},
    # ── Horas de estudo (em minutos) ─────────────────────────────────────────
    {"code": "H01", "category": "horas", "title": "Primeiras Horas",       "icon": "⏰", "threshold": 600,   "event_type": "total_study_minutes"},
    {"code": "H02", "category": "horas", "title": "Dedicado",              "icon": "⏰", "threshold": 1500,  "event_type": "total_study_minutes"},
    {"code": "H03", "category": "horas", "title": "Comprometido",          "icon": "⏰", "threshold": 3000,  "event_type": "total_study_minutes"},
    {"code": "H04", "category": "horas", "title": "Centenário",            "icon": "⏰", "threshold": 6000,  "event_type": "total_study_minutes"},
    {"code": "H05", "category": "horas", "title": "Especialista",          "icon": "⏰", "threshold": 15000, "event_type": "total_study_minutes"},
    {"code": "H06", "category": "horas", "title": "Profissional",          "icon": "⏰", "threshold": 30000, "event_type": "total_study_minutes"},
    {"code": "H07", "category": "horas", "title": "Lenda dos Estudos",     "icon": "👑", "threshold": 60000, "event_type": "total_study_minutes"},
    # ── Consistência (dias consecutivos) ─────────────────────────────────────
    {"code": "K01", "category": "consistencia", "title": "Começo",         "icon": "🔥", "threshold": 3,   "event_type": "current_streak_days"},
    {"code": "K02", "category": "consistencia", "title": "Semana",         "icon": "🔥", "threshold": 7,   "event_type": "current_streak_days"},
    {"code": "K03", "category": "consistencia", "title": "Quinzena",       "icon": "🔥", "threshold": 15,  "event_type": "current_streak_days"},
    {"code": "K04", "category": "consistencia", "title": "Mês Dedicado",   "icon": "🔥", "threshold": 30,  "event_type": "current_streak_days"},
    {"code": "K05", "category": "consistencia", "title": "Dois Meses",     "icon": "🔥", "threshold": 60,  "event_type": "current_streak_days"},
    {"code": "K06", "category": "consistencia", "title": "Trimestre",      "icon": "🔥", "threshold": 90,  "event_type": "current_streak_days"},
    {"code": "K07", "category": "consistencia", "title": "Semestre",       "icon": "🔥", "threshold": 180, "event_type": "current_streak_days"},
    {"code": "K08", "category": "consistencia", "title": "Um Ano de Foco", "icon": "👑", "threshold": 365, "event_type": "current_streak_days"},
]

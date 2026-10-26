# FocoPlus · Macieira System — Checklist de publicação

Passo a passo para publicar o app: **frontend no Vercel**, **backend FastAPI** em uma hospedagem
com Docker e **banco Postgres + login no Supabase** (um projeto para homologação e outro para produção).

Marque `[x]` conforme cada passo for concluído. Quando todos estiverem marcados, a publicação está pronta.

> **Segurança:** nunca cole senhas, `SECRET_KEY` ou a *Secret key* do Supabase em chats, prints ou commits.
> Os arquivos `.env` já estão no `.gitignore`.

---

## Como as peças se conectam

```
Navegador ──► Vercel (frontend React)
   │              │  VITE_API_URL
   │              ▼
   │         Backend FastAPI (Docker) ──► Supabase Postgres (SQLALCHEMY_DATABASE_URI)
   │              ▲  valida o token com SUPABASE_URL
   └──► Supabase Auth (Google / e-mail)  ◄── VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
```

| Ambiente | Branch | Frontend (Vercel) | Backend | Supabase |
|---|---|---|---|---|
| Local | qualquer | `npm run dev` (porta 3000) | `uvicorn` local | SQLite (sem login) ou o de homologação |
| Homologação | `development` | *Preview* | serviço de homologação | projeto `stg` |
| Produção | `master` | *Production* | serviço de produção | projeto `prod` |

---

## 0. Já feito

- [x] Marca **FocoPlus** e rótulo **Macieira System · v1.0** (`frontend/src/appInfo.ts`)
- [x] Backend preparado para Postgres, CORS configurável e `$PORT` no Dockerfile (commit `fa7bdac`)
- [x] Projeto Supabase de homologação criado e conexão testada (Session pooler, porta 5432)
- [x] Migrações aplicadas no banco de homologação até `c3d5e7f9a0b2`
- [x] Login com Supabase Auth no código: Google, e-mail com verificação, recuperação de senha (commit `13ec775`)
- [x] Pomodoro livre; Dashboard, Revisões e Estudos exigem login; botão **Entrar / Sair** no cabeçalho
- [x] RLS automático no código (migração `b8d2e4f6a1c3` + rotina no startup do backend)

---

## 1. Fechar o código local

- [ ] **1.1** Commitar as mudanças pendentes (botão Entrar/Sair, rotas protegidas, migração de RLS).
- [ ] **1.2** Aplicar as migrações novas no SQLite local (`a7c1d9e3b5f4` já foi aplicada; falta `b8d2e4f6a1c3`, que não faz nada no SQLite):

  ```powershell
  cd backend
  .\.venv311\Scripts\python.exe -m alembic upgrade head
  ```

- [ ] **1.3** Rodar os testes manuais locais (seção 7) com o login **desligado** (sem `VITE_SUPABASE_*`): o app deve abrir como antes.

---

## 2. Supabase de homologação (`stg`)

### 2.1 Segurança do banco
- [ ] **Resetar a senha do banco** (a atual apareceu em capturas de tela): *Connect → Reset database password*.
  Use só letras e números, 20+ caracteres, para não precisar codificar a URL.
- [ ] Aplicar as migrações novas (cria `users.auth_uid` e liga o RLS). Na pasta `backend`, na mesma janela do PowerShell:

  ```powershell
  $env:SQLALCHEMY_DATABASE_URI = "postgresql://postgres.SEUREF:SENHA@HOST.pooler.supabase.com:5432/postgres"
  ```

  ```powershell
  .\.venv311\Scripts\python.exe -m alembic upgrade head
  ```

  Esperado: `Running upgrade c3d5e7f9a0b2 -> a7c1d9e3b5f4` e `a7c1d9e3b5f4 -> b8d2e4f6a1c3`.
  (A variável só vale naquela janela. Não imprima a URL: ela contém a senha.)
- [ ] Conferir o schema (esperado: faltam só `achievements`, `user_achievements`, `user_stats`, que o backend cria ao subir):

  ```powershell
  @'
  from sqlalchemy import inspect
  from app.data.database import engine
  from app.domain.models import Base
  db = set(inspect(engine).get_table_names()); meta = set(Base.metadata.tables)
  print("faltando no banco:", sorted(meta - db)); print("so no banco:", sorted(db - meta))
  '@ | .\.venv311\Scripts\python.exe -
  ```

- [ ] Conferir o **RLS** no painel: *Table Editor* → as tabelas não devem mostrar o aviso "RLS disabled".
  Se aparecer, rode no *SQL Editor* o conteúdo de `backend/app/data/rls.py` (constante `ENABLE_RLS_SQL`).
- [ ] (Recomendado) Desativar a **Data API** do projeto, já que o app só usa o backend.
  Procure a opção em *Project Settings → API / Data API*; o nome pode variar no painel.

### 2.2 Autenticação
- [ ] *Authentication → Sign In / Providers → Email*: **Confirm email** ativo.
- [ ] *Authentication → Sign In / Providers → Google*: habilitar com o Client ID e o Secret (passo 2.3).
- [ ] *Authentication → URL Configuration*:
  - **Site URL** = URL do frontend de homologação no Vercel.
  - **Redirect URLs** = `http://localhost:3000`, `http://localhost:5173` e os previews do Vercel (`https://SEUAPP-*.vercel.app/**`).
- [ ] *Project Settings → JWT Keys* (ou *API*): ver se o projeto usa chaves **assimétricas** (ES256/RS256) ou o segredo **HS256 legado**.
  Se for HS256, copie o segredo para `SUPABASE_JWT_SECRET` no backend. Se for assimétrica, não precisa.
- [ ] **SMTP próprio** (*Authentication → Emails → SMTP Settings*, p.ex. Resend). O envio padrão tem limite muito baixo e serve só para teste.

### 2.3 Google Cloud (OAuth)
- [ ] Google Cloud Console → *APIs e serviços → Credenciais → Criar ID do cliente OAuth* → tipo **Aplicativo da Web**.
- [ ] **URI de redirecionamento autorizado:** `https://SEUREF.supabase.co/auth/v1/callback`
- [ ] Configurar a **tela de consentimento** (nome do app, e-mail de suporte). Para usuários fora da sua conta, publique o app (sair do modo "Teste").
- [ ] Colar o **Client ID** e o **Client Secret** em *Supabase → Authentication → Providers → Google*.

### 2.4 Chaves do projeto
- [ ] *Project Settings → API Keys*: copiar a **Publishable key** (`sb_publishable_...`). Ela vai em `VITE_SUPABASE_ANON_KEY`.
- [ ] **Nunca** usar a *Secret key* nem a `service_role` no frontend.

---

## 3. Backend (hospedagem com Docker)

Opções: **Render** (simples, GitHub + Dockerfile), **Google Cloud Run** ou **Railway** (se estável). O Dockerfile já respeita `$PORT`.

- [ ] **3.1** Escolher a hospedagem: ______________________
- [ ] **3.2** Criar o serviço a partir do repositório: **contexto/pasta `backend`**, Dockerfile, **target `production`**.
- [ ] **3.3** Cadastrar as variáveis de ambiente:

  | Variável | Valor |
  |---|---|
  | `SQLALCHEMY_DATABASE_URI` | URL do **Session pooler** do Supabase (com a senha nova) |
  | `SECRET_KEY` | novo: `python -c "import secrets; print(secrets.token_hex(32))"` |
  | `ALLOW_DEV_AUTH_BYPASS` | `false` |
  | `SUPABASE_URL` | `https://SEUREF.supabase.co` (**mesmo projeto** do frontend) |
  | `SUPABASE_JWT_SECRET` | só se o projeto usar HS256 (passo 2.2) |
  | `CORS_ORIGINS` | URL do frontend no Vercel (ex.: `https://seuapp.vercel.app`) |
  | `CORS_ORIGIN_REGEX` | opcional, previews do Vercel: `https://seuapp-.*\.vercel\.app` |
  | `AI_PROVIDER` / `OPENAI_API_KEY` | só se usar IA (`mock` por padrão) |

- [ ] **3.4** Deploy concluído e abrindo `https://SEU-BACKEND/` com `{"message": "Pomodoro API ..."}`.
- [ ] **3.5** `https://SEU-BACKEND/docs` abre; chamar uma rota protegida **sem token** retorna **401**.
- [ ] **3.6** Nos logs do primeiro start não há erro de RLS nem de criação de tabelas (as tabelas de conquistas são criadas aqui).

> O `Dockerfile` roda como usuário sem privilégios e **não** roda migrações sozinho.
> Sempre aplique `alembic upgrade head` (passo 2.1) antes de publicar uma versão que muda o banco.

---

## 4. Frontend (Vercel)

- [ ] **4.1** *Settings → Environment Variables* (marque o escopo certo):

  | Variável | Production | Preview |
  |---|---|---|
  | `VITE_API_URL` | `https://BACKEND-PROD/api` | `https://BACKEND-STG/api` |
  | `VITE_SUPABASE_URL` | URL do projeto `prod` | URL do projeto `stg` |
  | `VITE_SUPABASE_ANON_KEY` | publishable key `prod` | publishable key `stg` |

- [ ] **4.2** Refazer o deploy (variáveis `VITE_*` só entram no **build**).
- [ ] **4.3** Abrir a URL de preview: o botão **Entrar** aparece no cabeçalho do Pomodoro.

---

## 5. Desenvolvimento local com login (opcional)

- [ ] `frontend/.env`: adicionar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (publishable key) e **reiniciar** o `npm run dev`.
- [ ] `backend/.env`: adicionar `SUPABASE_URL` do mesmo projeto (senão o backend recusa o token com 401) e, se for o caso, `SUPABASE_JWT_SECRET`.
- [ ] Para voltar ao modo local sem login, apague essas linhas e reinicie os dois servidores.

---

## 6. Produção (`prod`) — repetir para o projeto de produção

- [ ] Criar o projeto Supabase de produção (senha forte, só letras e números).
- [ ] `alembic upgrade head` apontando para o banco de produção.
- [ ] Conferir RLS / desativar Data API.
- [ ] Configurar Email (Confirm email), Google (novo redirect do projeto `prod`), URL Configuration (Site URL = domínio de produção) e SMTP.
- [ ] Criar o serviço do backend de produção com `SECRET_KEY` **diferente** da homologação e `ALLOW_DEV_AUTH_BYPASS=false`.
- [ ] Variáveis *Production* no Vercel apontando para o backend e o Supabase de produção; novo deploy.
- [ ] Domínio próprio (opcional): atualizar Site URL, Redirect URLs e `CORS_ORIGINS`.

---

## 7. Testes de aceitação (homologação e depois produção)

- [ ] **Pomodoro sem login:** `/` abre, o timer funciona, o botão **Entrar** aparece.
- [ ] **Telas protegidas:** `/dashboard`, `/anki`, `/estudos` mostram a tela de login para visitante.
- [ ] **Cadastro por e-mail:** criar conta → chega o e-mail → clicar no link → volta logado.
- [ ] **E-mail não confirmado:** tentar entrar antes de confirmar mostra "Confirme seu e-mail...".
- [ ] **Login com Google:** entra e volta para a tela em que estava.
- [ ] **Esqueci a senha:** chega o e-mail → abre a tela "Definir nova senha" → salva e entra.
- [ ] **Sair:** o botão **Sair** volta a mostrar **Entrar**; as telas protegidas pedem login de novo.
- [ ] **Dados por conta:** uma sessão de Pomodoro concluída logado aparece no Dashboard; outra conta não vê esses dados.
- [ ] **Backend:** `/auth/login` e `/auth/register` respondem 404; rota protegida sem token responde 401.
- [ ] **RLS:** uma chamada direta à Data API com a publishable key (`https://SEUREF.supabase.co/rest/v1/users`) **não** devolve dados.
- [ ] **CORS:** nenhum erro de CORS no console do navegador no domínio do Vercel.

---

## 8. Pendências para depois (não bloqueiam a publicação)

- [ ] **Dados em `localStorage` por conta:** tarefas, editais e plano ainda ficam no navegador; quem troca de conta no mesmo navegador vê os dados da anterior. Levar esses dados para o banco (por usuário).
- [ ] **Decisão sobre Firestore:** o plano atual usa Postgres. Reavaliar só se surgir necessidade de sincronização offline/tempo real.
- [ ] **Remover o `SECRET_KEY` padrão** de `backend/app/core/config.py` e exigir a variável em produção.
- [ ] **Hash de senha legado:** o login próprio local usa `sha256_crypt`; trocar por bcrypt/argon2 se esse modo continuar existindo.
- [ ] **Rótulo "Macieira System · v1.0"** aparece só no menu das outras telas e na tela de login; decidir se entra também no cabeçalho do Pomodoro.
- [ ] **Testes automatizados:** o projeto não tem pasta de testes; transformar o roteiro de validação do login em testes do backend.
- [ ] **Backups** do banco de produção e alertas de uso (limites do plano gratuito do Supabase).

---

## ✅ Conclusão

- [ ] Todos os passos das seções 1 a 7 estão marcados.
- [ ] Homologação validada pelos testes da seção 7.
- [ ] Produção publicada e validada.

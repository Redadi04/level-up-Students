# Level-Up Interview — Backend (Flask API)

A pure JSON API. Companies and students each have accounts; companies host
Q&A sessions (post questions + a skill profile), students take sessions and
build a resume/skill guide targeted at whichever company they pick. Grading
runs through a LangChain + LangGraph pipeline.

**Storage:** Postgres, hosted on Supabase (free tier) — not CSV files. This
means accounts, questions, and results all survive Render restarts, redeploys,
and free-tier spin-downs, since the database is a separate service unaffected
by what happens to the backend's own filesystem.

## Routes

**Auth**
- `POST /api/auth/signup` — `{role: "company"|"student", name, email, password, company_name?, recommended_skills?}`
- `POST /api/auth/login` — `{email, password}` → `{token, user}`
- `GET  /api/me` — current user (needs `Authorization: Bearer <token>`)

**Companies**
- `GET  /api/companies` — public list of companies + their skill profiles
- `PUT  /api/companies/me` — company only — update `recommended_skills`

**Questions (a company's hosted session)**
- `GET  /api/questions?company_id=...` — that company's *active* question ladder (public)
- `GET  /api/questions/mine` — company only — every question you've added, active or not
- `POST /api/questions` — company only — add a question to your own bank
- `PATCH /api/questions/<id>` — company only — `{active: true/false}`, toggles a question without deleting it

**Interview + results**
- `POST /api/evaluate` — student only — grade an answer, logs the attempt.
  Enforces sequential unlocking server-side: a level can't be attempted until
  every earlier level for that company has a logged pass.
- `GET  /api/results` — company only — every attempt against your questions
- `GET  /api/my-results?company_id=...` — student only — your own attempt
  history with one company (used to resume at the right level)

**Growth (company-aware)**
- `POST /api/skill-guide` — student only — `{company_id}` → study guide
  comparing your attempts against that company's wanted skills
- `POST /api/resume` — student only — `{company_id, education, experience,
  projects, extra_skills}` → resume draft targeted at that company

Auth uses signed tokens (`itsdangerous`), not cookies — sent as
`Authorization: Bearer <token>`. This avoids cross-site cookie issues between
a Vercel frontend and a Render backend.

## One-time setup: create the Supabase database

1. Go to https://supabase.com → sign up (free, no card needed) → **New project**.
2. Pick a name/region/password (save the password somewhere — you'll need it
   in the connection string).
3. Once it's created, go to **Project Settings → Database → Connection string**.
4. Select the **"Transaction pooler"** tab (port `6543`) — this pooled
   connection is what works reliably from Render's free tier.
5. Copy that URI — it looks like:
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with the real password you set in step 2.

That full string is your `DATABASE_URL`. The app creates its own tables
automatically the first time it starts up — nothing to run manually in
Supabase's SQL editor.

## Local development

```bash
pip install -r requirements.txt
cp .env.example .env       # then paste in your real Groq key AND your Supabase DATABASE_URL
python app.py
```

Runs at `http://localhost:5000`. On first run, check the terminal for any
database connection errors — a wrong password or connection string is the
most common issue here.

## Deploying to Render

1. Push this `backend/` folder to a GitHub repo.
2. Go to https://render.com → **New** → **Web Service** → connect the repo.
3. If backend and frontend are in the same repo, set **Root Directory** to
   `backend`.
4. Render should auto-detect Python. Confirm/set:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app`
5. Add environment variables (Render dashboard → Environment tab):
   - `GROQ_API_KEY` = your real key (free from https://console.groq.com/keys)
   - `GROQ_MODEL` = `llama-3.3-70b-versatile` (optional, this is the default)
   - `PASS_THRESHOLD` = `70` (optional, this is the default)
   - `DATABASE_URL` = your Supabase connection string from the setup above
   - `FRONTEND_URL` = your Vercel URL once you have it (can add this after
     the first deploy)
6. Click **Create Web Service**. Render gives you a URL like
   `https://level-up-interview-api.onrender.com` — that's what goes into the
   frontend's `VITE_API_URL`.

There's also a `render.yaml` in this folder if you'd rather use Render's
"Blueprint" import instead of clicking through the UI manually.

## Why this fixes the earlier data-loss problem

Render's free-tier filesystem is ephemeral — any changes to your web
service's filesystem are lost every time the service redeploys, restarts, or
spins down, and free instances spin down after 15 minutes of inactivity.
That's why CSV files stored on Render's own disk kept disappearing. Supabase's
database lives on entirely separate infrastructure, so it's untouched by
Render restarting, redeploying, or spinning down — your accounts, questions,
and results now persist indefinitely.


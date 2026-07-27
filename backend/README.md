# Level-Up Interview — Backend (Flask API)

A pure JSON API. Companies and students each have accounts; companies host
Q&A sessions (post questions + a skill profile), students take sessions and
build a resume/skill guide targeted at whichever company they pick. Grading
runs through a LangChain + LangGraph pipeline.

## Routes

**Auth**
- `POST /api/auth/signup` — `{role: "company"|"student", name, email, password, company_name?, recommended_skills?}`
- `POST /api/auth/login` — `{email, password}` → `{token, user}`
- `GET  /api/me` — current user (needs `Authorization: Bearer <token>`)

**Companies**
- `GET  /api/companies` — public list of companies + their skill profiles
- `PUT  /api/companies/me` — company only — update `recommended_skills`

**Questions (a company's hosted session)**
- `GET  /api/questions?company_id=...` — that company's question ladder
- `POST /api/questions` — company only — add a question to your own bank

**Interview + results**
- `POST /api/evaluate` — student only — grade an answer, logs the attempt
- `GET  /api/results` — company only — every attempt against your questions

**Growth (company-aware)**
- `POST /api/skill-guide` — student only — `{company_id}` → study guide
  comparing your attempts against that company's wanted skills
- `POST /api/resume` — student only — `{company_id, education, experience,
  projects, extra_skills}` → resume draft targeted at that company

Auth uses signed tokens (`itsdangerous`), not cookies — sent as
`Authorization: Bearer <token>`. This avoids cross-site cookie issues between
a Vercel frontend and a Render backend.

## Local development

```bash
pip install -r requirements.txt
cp .env.example .env       # then paste in your real Groq key
python app.py
```

Runs at `http://localhost:5000`.

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
   - `FRONTEND_URL` = your Vercel URL once you have it (can add this after
     the first deploy)
6. Click **Create Web Service**. Render gives you a URL like
   `https://level-up-interview-api.onrender.com` — that's what goes into the
   frontend's `VITE_API_URL`.

There's also a `render.yaml` in this folder if you'd rather use Render's
"Blueprint" import instead of clicking through the UI manually.

## Important: storage caveat on Render's free tier

`questions.csv`, `results.csv`, and `users.csv` (accounts + password hashes)
live on local disk in the `data/` folder. **On Render's free tier, this disk
is wiped on every redeploy and on periodic restarts** — meaning accounts
would disappear too. This is fine for testing, but for a real deployment
you'll want either:
- A Render **persistent disk** (paid, keeps `data/` between deploys), or
- Swapping the CSV storage for a proper database (Render's free Postgres
  tier is a natural next step)

Happy to help wire up either one when you're ready to make it permanent.

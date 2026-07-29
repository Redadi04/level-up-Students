# Level-Up Interview

A hiring-prep platform with two kinds of accounts:

- **Companies** sign up, set a skill profile ("what we're looking for"), and
  host Q&A sessions (post questions with expected answers).
- **Students** sign up and, most of the time, use the **Build Resume** tab —
  pick a target company, get a skill guide comparing their progress against
  that company's wanted skills, and generate a resume aimed at them. The
  **Take Interview** tab is for when a company has an active Q&A session to
  attempt; answers are graded by a LangChain + LangGraph pipeline (backed by
  Groq) that judges meaning, not exact wording.

## Quick start (recommended)

Two scripts handle everything — no need to run backend/frontend commands separately.

**Windows:**
```
setup.bat     (run once)
start.bat     (run any time you want to launch the app)
```

**Mac/Linux:**
```
chmod +x setup.sh start.sh   (run once, makes them runnable)
./setup.sh                   (run once)
./start.sh                   (run any time you want to launch the app)
```

`setup.bat`/`setup.sh` creates the backend's virtual environment, installs
both the Python and npm packages, and creates `.env` files from the examples.
**After running it, open `backend/.env` and fill in two things it can't do
for you:**
1. Your real Groq API key (free from https://console.groq.com/keys)
2. Your Supabase database connection string — see "Database setup" in
   `backend/README.md` for the 5-minute walkthrough (free, no card needed)

`start.bat`/`start.sh` launches both servers and opens the app in your
browser at `http://localhost:5173`. To stop it: close the two windows it
opened (Windows), or press `Ctrl+C` (Mac/Linux).

## First time using it

1. Run the app (see Quick start above).
2. Sign up as a **Company** first — give it a name and list the skills you
   want (e.g. "Python, transformer architectures, prompt engineering").
3. Still as that company, add a few questions with expected answers — this
   is your hosted Q&A session.
4. Log out, sign up as a **Student**.
5. You'll land on **Build Resume** — pick the company you just created,
   generate a skill guide, fill in your background, and build a resume.
6. Switch to **Take Interview** to actually attempt that company's
   questions — passing them feeds richer detail into the skill guide and
   resume ("demonstrated real understanding of X").

## Structure

```
level-up-deploy/
├── backend/     Flask JSON API + LangChain/LangGraph grading → deploy to Render
└── frontend/    React + Vite UI → deploy to Vercel
```

The two are fully separate deployable apps that talk over HTTP. See the
README inside each folder for setup and deployment steps.

## Recommended order

0. **Easiest:** just run `setup.bat`/`setup.sh` once, then `start.bat`/`start.sh`
   any time — see "Quick start" above. Skip steps 1-2 below if you do this.
1. Get the **backend** running locally first (`backend/README.md`) and
   confirm `http://localhost:5000/api/questions` responds.
2. Get the **frontend** running locally against it (`frontend/README.md`),
   pointed at `http://localhost:5000` via `VITE_API_URL`.
3. Once both work locally, deploy the backend to Render first (so you have
   its live URL), then deploy the frontend to Vercel with `VITE_API_URL`
   pointed at that Render URL.
4. Go back to Render and set `FRONTEND_URL` to your new Vercel URL so CORS
   allows the live frontend to talk to it.

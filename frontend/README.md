# Level-Up Interview — Frontend (React + Vite)

Talks to the Flask API (in `../backend`) over HTTP. No server-side rendering —
this is a plain static site once built, which is why Vercel is a great fit.

## Local development

```bash
npm install
cp .env.example .env       # then edit VITE_API_URL if needed
npm run dev
```

Opens at `http://localhost:5173`. Make sure the backend is running locally
too (see `../backend/README.md`) at the URL in `.env`.

## Deploying to Vercel

1. Push this `frontend/` folder to a GitHub repo (can be the same repo as the
   backend, or a separate one — either works).
2. Go to https://vercel.com → **Add New Project** → import that repo.
3. If backend and frontend are in the same repo, set **Root Directory** to
   `frontend` in the import settings.
4. Vercel auto-detects Vite; the defaults are already correct:
   - Build command: `npm run build`
   - Output directory: `dist`
5. Before deploying, add an environment variable:
   - `VITE_API_URL` = your Render backend URL, e.g.
     `https://level-up-interview-api.onrender.com`
6. Click **Deploy**.

Every push to your main branch will auto-redeploy from then on.

## After both are deployed

Go back to your Render backend's environment variables and set:
```
FRONTEND_URL=https://your-project.vercel.app
```
and redeploy the backend — this lets the backend's CORS settings allow
requests from your live frontend (it only allows `localhost:5173` and
whatever `FRONTEND_URL` is set to).

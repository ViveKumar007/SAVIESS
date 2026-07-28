# What's in this zip and why

Extract this into your `SAVIESS` repo root (overwrite when prompted). These are the
minimum code changes needed before the app will actually work once deployed —
without them, hosting will succeed but the live site will fail to reach your API.

## 1. `frontend/src/api.js` (new file)
Centralizes the backend URL into one place, read from `VITE_API_URL` at build time.

## 2. `frontend/src/pages/{Login,AdminDashboard,FODashboard,RHPDashboard}.jsx` (edited)
Replaced all 15 hardcoded `http://localhost:5000` calls (axios + Socket.io) with the
`API` / `SOCKET_URL` constants from `api.js`. Build-tested — `npm run build` succeeds.
This was the main blocker: as pushed, the deployed frontend would always try to reach
your own machine, no matter where the backend is actually hosted.

## 3. `frontend/vercel.json` (new file)
SPA rewrite rule. Without it, refreshing on any route other than `/` (e.g.
`/admin-dashboard`) 404s on Vercel, because this is a plain Vite + React Router app,
not Next.js.

## 4. `frontend/.env.example` (new file)
Was referenced in your README but didn't exist. Documents `VITE_API_URL`.

## 5. `backend/src/config/db.js` (edited)
Added optional SSL support to the MySQL pool, gated behind `DB_SSL=true`. Required to
connect to TiDB Cloud or almost any managed MySQL host — the version in the repo had
no SSL option at all, so it could only ever talk to a local, unencrypted MySQL.
Nothing changes for local dev (`DB_SSL` unset/false behaves exactly as before).

## 6. `backend/.env.example` (edited)
Added the `DB_SSL` line to match the db.js change.

## 7. `.gitignore` (new, repo root)
Your repo currently has no `.gitignore`. Two things are committed that shouldn't be:
- `backend/node_modules/` (13,900+ files) — includes a compiled `bcrypt` binary,
  which is platform-specific. If it was built on Windows, it will not load on the
  Linux containers that Render/Railway/most hosts use.
- `backend/.env` — currently holds only the same mock/placeholder values as
  `.env.example`, not real secrets, so this isn't an active leak. But the tracking
  needs to stop now, before someone drops a real Cloudinary key or JWT secret in
  there and pushes it to a public repo.

See the deployment guide for the exact `git rm --cached` commands to apply this
retroactively.

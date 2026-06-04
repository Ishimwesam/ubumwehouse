# Deployment Files

Use this list when copying the system to a server.

## Required Source Files

- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/`
- `backend/config/`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/index.html`
- `frontend/public/`
- `frontend/src/`
- `frontend/vite.config.js`
- `package.json`

## Required Runtime Files

- `backend/.env` created from `backend/.env.production.example`
- `frontend/.env.production` created from `frontend/.env.production.example`
- `backend/rental_management.db` if migrating existing data
- `backend/src/uploads/` if migrating uploaded files

## Build Output

- `frontend/dist/`

The backend serves `frontend/dist` automatically when `NODE_ENV=production`, so a single backend process can host both API and frontend.

## Server Commands

Install dependencies:

```bash
npm --prefix backend install
npm --prefix frontend install
```

Build frontend:

```bash
npm run build
```

Start production backend:

```bash
cd backend
NODE_ENV=production npm start
```

Recommended process manager:

```bash
pm2 start npm --name rental-management -- start --prefix backend
pm2 save
```

## Deployment Checks

```bash
curl http://localhost:5003/health
```

Expected response:

```json
{"status":"Backend is running"}
```

Then open `APP_URL` in a browser and sign in.

# Production Deployment Guide

This app can be deployed as one Node/Express service. In production, the backend serves the built frontend from `frontend/dist`.

## 1. Prepare Environment Files

Create backend production env:

```bash
cp backend/.env.production.example backend/.env
```

Edit `backend/.env` and set:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=5003`
- `APP_URL=https://your-domain.example`
- strong `JWT_SECRET`
- strong `SESSION_SECRET`
- production `DEFAULT_ADMIN_PASSWORD`
- SMTP/Twilio/Google/OpenAI values only if those features are used

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Create frontend production env:

```bash
cp frontend/.env.production.example frontend/.env.production
```

For same-origin deployment, keep:

```env
VITE_API_BASE_URL=/api
```

## 2. Install Dependencies

```bash
npm --prefix backend install
npm --prefix frontend install
```

## 3. Build Frontend

```bash
npm run build
```

This creates `frontend/dist`.

## Managed Hosting Settings

Use a Node web service when deploying the full app. Do not deploy this as a
static-only site unless you are hosting the backend separately.

```text
Build Command: npm install && npm run build
Start Command: npm start
Health Check Path: /health
Output Directory: frontend/dist
```

Required production environment variables:

```text
NODE_ENV=production
HOST=0.0.0.0
APP_URL=https://your-domain.example
JWT_SECRET=<strong random value>
SESSION_SECRET=<different strong random value>
VITE_API_BASE_URL=/api
WHATSAPP_REMINDERS_ENABLED=false
ALLOW_DEV_TOKEN=false
REQUIRE_DEVICE_LOCK=true
DEVICE_LOCK_FINGERPRINT=<deployment machine fingerprint>
```

In production, user sessions are stored in SQLite through the app database, so
the default Express in-memory session store is not used.

On platforms that inject `PORT`, do not set a fixed `PORT`. On VPS or managed
Node hosting, set `PORT` to the port assigned by the host.

## 4. Start Production Server

```bash
cd backend
NODE_ENV=production npm start
```

The app will be available on the public `APP_URL` through the backend server.

Recommended PM2 setup:

```bash
pm2 start npm --name rental-management -- start --prefix backend
pm2 save
pm2 startup
```

## 5. Required Files To Deploy

See `DEPLOYMENT_FILES.md` for the exact file list.

At minimum, deploy:

- `backend/`
- `frontend/dist/`
- `frontend/public/` and source files if building on the server
- root `package.json`
- production `.env` files
- database and uploads if preserving existing data

## 6. Verify Deployment

Health check:

```bash
curl http://localhost:5003/health
```

Expected:

```json
{"status":"Backend is running"}
```

Security spot checks:

- weak passwords should be rejected
- `dev-token` should be rejected unless explicitly enabled in non-production
- repeated failed login attempts should return `429`

## 7. Reverse Proxy Notes

If using Nginx, proxy your domain to backend port `5003`.

Example:

```nginx
location / {
  proxy_pass http://127.0.0.1:5003;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Use HTTPS in production.

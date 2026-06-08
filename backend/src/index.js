const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');

const initialEnvKeys = new Set(Object.keys(process.env));

const loadEnvFile = (filename, { overrideBase = false } = {}) => {
  const envPath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(envPath)) return;

  const parsed = dotenv.parse(fs.readFileSync(envPath));
  Object.entries(parsed).forEach(([key, value]) => {
    if (!process.env[key] || (overrideBase && !initialEnvKeys.has(key))) {
      process.env[key] = value;
    }
  });
};

loadEnvFile('.env');
if (process.env.NODE_ENV) {
  loadEnvFile(`.env.${process.env.NODE_ENV}`, { overrideBase: true });
}

// Import database
require('../config/database');
require('../config/migrate');

// Import routes
const authRoutes = require('./routes/authRoutes');
const buildingRoutes = require('./routes/buildingRoutes');
const unitRoutes = require('./routes/unitRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const contractRoutes = require('./routes/contractRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const chatRoutes = require('./routes/chatRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const calendarEventRoutes = require('./routes/calendarEventRoutes');
const auditRoutes = require('./routes/auditRoutes');
const systemRoutes = require('./routes/systemRoutes');
const tenantPortalRoutes = require('./routes/tenantPortalRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');
const { startWhatsAppReminderScheduler } = require('./services/whatsappReminderService');
const { startBackupScheduler } = require('./services/backupService');
const { broadcastRentalAppRefresh } = require('./services/realtimeService');
const { enforceDeviceLock } = require('./services/deviceLockService');
const SQLiteSessionStore = require('./services/sqliteSessionStore');
const securityHeaders = require('./middleware/securityHeaders');
const { createRateLimiter, getClientIp } = require('./middleware/rateLimit');
const fileAccessAuth = require('./middleware/fileAccessAuth');
const auditLogger = require('./middleware/auditLogger');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!process.env.JWT_SECRET || !process.env.SESSION_SECRET)) {
  throw new Error('JWT_SECRET and SESSION_SECRET must be set in production.');
}
enforceDeviceLock();

const frontendDistPath = path.join(__dirname, '../../frontend/dist');
const corsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  ...(process.env.APP_URL ? process.env.APP_URL.split(',').map((origin) => origin.trim()).filter(Boolean) : [])
];
const isAllowedCorsOrigin = (origin) => {
  if (!origin || corsOrigins.includes(origin)) return true;

  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'https:' && (
      hostname === 'ubumwehouse.netlify.app'
      || hostname.endsWith('--ubumwehouse.netlify.app')
    );
  } catch (error) {
    return false;
  }
};

app.disable('x-powered-by');
app.set('trust proxy', isProduction ? 1 : false);
app.use(securityHeaders);
app.use('/api', createRateLimiter({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10),
  max: parseInt(process.env.API_RATE_LIMIT_MAX || '600', 10),
  message: 'Too many API requests. Please slow down and try again.',
  keyGenerator: (req) => `${getClientIp(req)}:${req.method}:${req.path}`
}));
app.use(auditLogger);

app.use((req, res, next) => {
  const isApiWrite = req.path.startsWith('/api') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isApiWrite) return next();

  res.on('finish', () => {
    const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
    const isIgnoredPath = req.path.startsWith('/api/auth');
    if (!isSuccess || isIgnoredPath) return;

    broadcastRentalAppRefresh({
      method: req.method,
      path: req.path,
      status: res.statusCode
    });
  });

  return next();
});

app.use(express.json({ limit: '1mb' }));
// CORS middleware
app.use(cors({
  origin(origin, callback) {
    if (isAllowedCorsOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));

// Session middleware (required for passport)
app.use(session({
  store: isProduction ? new SQLiteSessionStore() : undefined,
  secret: process.env.SESSION_SECRET || crypto.randomUUID(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 30 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, './uploads');
app.use('/uploads', fileAccessAuth, express.static(uploadDir, {
  dotfiles: 'deny',
  fallthrough: false,
  index: false,
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
  }
}));

// Passport Google OAuth strategy. Keep it optional so deployments without
// Google credentials can still start and use email/password authentication.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const appUrl = (process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 5003}`)
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${appUrl}/api/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    // Only allow login if email exists in users table
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    if (!email) return done(null, false);
    const db = require('../config/database');
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (err) return done(err);
      if (!user) return done(null, false);
      return done(null, user);
    });
  }));
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  const db = require('../config/database');
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
    if (err) return done(err);
    done(null, user);
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/calendar-events', calendarEventRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/tenant-portal', tenantPortalRoutes);
app.use('/api/realtime', realtimeRoutes);

if (isProduction) {
  app.use(express.static(frontendDistPath));
}

// Health check
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is running',
    uptime: Math.round(process.uptime()),
    checked_at: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const payload = { error: 'Internal server error' };
  if (!isProduction) {
    payload.message = err.message;
  }
  res.status(500).json(payload);
});

// 404 handler
app.use((req, res) => {
  if (isProduction && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  }

  res.status(404).json({ error: 'Route not found' });
});

const startServer = () => {
  const PORT = process.env.PORT || 5003;
  const HOST = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');
  const server = app.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`✅ Server running on http://${displayHost}:${PORT}`);
    try {
      startWhatsAppReminderScheduler();
    } catch (e) {
      console.error('WhatsApp scheduler failed to start:', e.message);
    }
    try {
      startBackupScheduler();
    } catch (e) {
      console.error('Backup scheduler failed to start:', e.message);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process or set a different PORT in backend/.env.`);
    } else if (err.code === 'EPERM') {
      console.error(`Cannot listen on ${HOST}:${PORT}. Try HOST=127.0.0.1 or choose a different PORT in backend/.env.`);
    } else {
      console.error('Server failed to start:', err);
    }

    process.exit(1);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer
};

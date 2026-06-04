const serverless = require('serverless-http');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.HOST = process.env.HOST || '127.0.0.1';
process.env.APP_URL = process.env.APP_URL || 'https://ubumwehouse.netlify.app';
process.env.VITE_API_BASE_URL = process.env.VITE_API_BASE_URL || '/api';
process.env.DB_PATH = process.env.DB_PATH || '/tmp/rental_management.db';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/uploads';
process.env.BACKUP_DIR = process.env.BACKUP_DIR || '/tmp/secure-backups';
process.env.BACKUPS_ENABLED = process.env.BACKUPS_ENABLED || 'false';
process.env.WHATSAPP_REMINDERS_ENABLED = process.env.WHATSAPP_REMINDERS_ENABLED || 'false';
process.env.REQUIRE_DEVICE_LOCK = process.env.REQUIRE_DEVICE_LOCK || 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'netlify-temporary-jwt-secret-change-in-site-env';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'netlify-temporary-session-secret-change-in-site-env';
process.env.DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
process.env.DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
process.env.DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
process.env.DISABLE_PUBLIC_REGISTRATION = process.env.DISABLE_PUBLIC_REGISTRATION || 'true';

const app = require('../../backend/src/index');

module.exports.handler = serverless(app);

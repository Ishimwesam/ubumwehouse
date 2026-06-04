#!/usr/bin/env node

/**
 * System Configuration Verification Script
 * Checks which features are properly configured and ready to use
 */

const fs = require('fs');
const path = require('path');

// Load environment variables manually (dotenv may not be installed globally)
const envPath = path.join(__dirname, 'backend/.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf-8');
  env.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset}  ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ️${colors.reset}  ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`)
};

const checkEnvironment = () => {
  log.section('🌍 Environment Configuration');

  const nodeEnv = process.env.NODE_ENV || 'development';
  log.info(`Environment: ${nodeEnv}`);

  if (nodeEnv === 'production') {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length > 32) {
      log.success('JWT_SECRET is configured (production-grade)');
    } else {
      log.error('JWT_SECRET is missing or too short (required for production)');
    }

    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length > 32) {
      log.success('SESSION_SECRET is configured (production-grade)');
    } else {
      log.error('SESSION_SECRET is missing or too short (required for production)');
    }
  } else {
    log.warning('Running in development mode');
  }

  log.info(`App URL: ${process.env.APP_URL || 'http://localhost:5173'}`);
  log.info(`Server Port: ${process.env.PORT || 5003}`);
};

const checkDatabase = () => {
  log.section('🗄️ Database Configuration');

  const dbPath = path.resolve(__dirname, 'backend', process.env.DB_PATH || 'rental_management.db');
  
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    log.success(`Database found: ${dbPath}`);
    log.info(`Database size: ${sizeMB} MB`);
  } else {
    log.warning(`Database not found at ${dbPath}`);
    log.info('Database will be created on first startup');
  }

  log.info(`Upload directory: ${path.resolve(__dirname, 'backend', process.env.UPLOAD_DIR || 'src/uploads')}`);
};

const isConfiguredValue = (value) => {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return ![
    '',
    'your-email@gmail.com',
    'your-app-password-not-regular-password',
    'your-16-digit-app-password',
    'your-twilio-account-sid',
    'your-twilio-auth-token',
    'your-twilio-phone-number',
    'your_meta_whatsapp_api_access_token',
    'your_phone_number_id_from_meta'
  ].includes(normalized);
};

const checkSmtp = () => {
  log.section('📧 Email/SMTP Configuration');

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (isConfiguredValue(smtpHost) && isConfiguredValue(smtpUser) && isConfiguredValue(smtpPass)) {
    log.success('SMTP is fully configured');
    log.info(`Provider: ${smtpHost}`);
    log.info(`Port: ${process.env.SMTP_PORT || 587}`);
    log.info(`Secure: ${process.env.SMTP_SECURE === 'true' ? 'Yes' : 'No'}`);
    log.info(`From: ${process.env.SMTP_FROM || smtpUser}`);
  } else {
    log.warning('SMTP is not configured');
    log.info('Features affected:');
    log.info('  - Password reset will not send emails');
    log.info('  - Email verification will show links in console');
    log.info('  - Account recovery will be limited');
  }
};

const checkGoogleOAuth = () => {
  log.section('🔑 Google OAuth Configuration');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (clientId && clientSecret) {
    log.success('Google OAuth is configured');
    log.info('Social login enabled: Users can sign in with Google');
  } else {
    log.warning('Google OAuth is not configured');
    log.info('Feature: Social login via Google (optional)');
    log.info('Setup: https://console.cloud.google.com');
  }
};

const checkWhatsApp = () => {
  log.section('📱 WhatsApp Configuration');

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const enabled = process.env.WHATSAPP_REMINDERS_ENABLED === 'true';

  if (isConfiguredValue(token) && isConfiguredValue(phoneId)) {
    if (enabled) {
      log.success('WhatsApp reminders are enabled');
      log.info(`Reminder days before: ${process.env.WHATSAPP_REMINDER_DAYS_BEFORE || 3}`);
      log.info(`Check interval: ${process.env.WHATSAPP_REMINDER_INTERVAL_HOURS || 24} hours`);
    } else {
      log.warning('WhatsApp credentials configured but reminders disabled');
      log.info('To enable: Set WHATSAPP_REMINDERS_ENABLED=true');
    }
  } else {
    log.warning('WhatsApp is not configured');
    log.info('Feature: Automated rent reminders via WhatsApp (optional)');
    log.info('Setup: https://www.whatsapp.com/business/');
  }
};

const checkUploadDirectory = () => {
  log.section('📁 File Upload System');

  const uploadDir = path.resolve(__dirname, 'backend', process.env.UPLOAD_DIR || 'src/uploads');

  if (fs.existsSync(uploadDir)) {
    try {
      fs.accessSync(uploadDir, fs.constants.W_OK);
      log.success('Upload directory exists and is writable');
      log.info(`Location: ${uploadDir}`);

      const files = fs.readdirSync(uploadDir);
      log.info(`Files stored: ${files.length}`);
    } catch {
      log.error('Upload directory exists but is not writable');
    }
  } else {
    log.warning('Upload directory does not exist');
    log.info('Will be created on first file upload');
  }
};

const printSummary = () => {
  log.section('📊 Feature Summary');

  const features = {
    'Database': fs.existsSync(path.resolve(__dirname, 'backend', process.env.DB_PATH || 'rental_management.db')),
    'Email/SMTP': !!(isConfiguredValue(process.env.SMTP_HOST) && isConfiguredValue(process.env.SMTP_USER) && isConfiguredValue(process.env.SMTP_PASS)),
    'Google OAuth': !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    'WhatsApp Reminders': !!(isConfiguredValue(process.env.WHATSAPP_ACCESS_TOKEN) && isConfiguredValue(process.env.WHATSAPP_PHONE_NUMBER_ID)),
    'File Upload': fs.existsSync(path.resolve(__dirname, 'backend', process.env.UPLOAD_DIR || 'src/uploads'))
  };

  Object.entries(features).forEach(([name, active]) => {
    const symbol = active ? '✅' : '⚠️';
    const status = active ? 'Enabled' : 'Disabled';
    console.log(`${symbol} ${name.padEnd(20)} ${status}`);
  });

  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  const allConfigured = Object.values(features).every(v => v);
  if (allConfigured) {
    log.success('All features are configured and ready! 🎉');
  } else {
    log.warning('Some features are not configured (see above)');
    log.info('See SYSTEM_SETUP.md for configuration instructions');
  }
};

// Run all checks
console.clear();
console.log(`${colors.cyan}
╔════════════════════════════════════════════════════════╗
║       Rental Management System - Configuration         ║
║                  Verification Tool                     ║
╚════════════════════════════════════════════════════════╝
${colors.reset}`);

checkEnvironment();
checkDatabase();
checkSmtp();
checkGoogleOAuth();
checkWhatsApp();
checkUploadDirectory();
printSummary();

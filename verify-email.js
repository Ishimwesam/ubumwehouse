#!/usr/bin/env node

/**
 * Email Configuration Verification Script
 * Tests if email is properly configured and ready to send
 */

const fs = require('fs');
const path = require('path');

// Load environment variables manually
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
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset}  ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ️${colors.reset}  ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}${colors.bright}━━ ${msg} ━━${colors.reset}\n`)
};

const checkEmailConfiguration = () => {
  log.header('📧 Email Configuration Check');

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFromEmail = process.env.SMTP_FROM_EMAIL;
  const smtpFromName = process.env.SMTP_FROM_NAME;

  let isConfigured = true;

  if (!smtpHost) {
    log.error('SMTP_HOST is not set');
    isConfigured = false;
  } else {
    log.success(`SMTP Host: ${smtpHost}`);
  }

  if (!smtpPort) {
    log.warning('SMTP_PORT not set, will use default (587)');
  } else {
    log.info(`SMTP Port: ${smtpPort}`);
  }

  if (!smtpUser) {
    log.error('SMTP_USER is not set');
    isConfigured = false;
  } else {
    log.success(`SMTP User: ${smtpUser.replace(/@.*/, '@***')}`);
  }

  if (!smtpPass) {
    log.error('SMTP_PASS is not set');
    isConfigured = false;
  } else {
    log.success('SMTP Password: ••••••••');
  }

  if (!smtpFromEmail) {
    log.warning('SMTP_FROM_EMAIL not set, will use SMTP_USER');
  } else {
    log.info(`From Email: ${smtpFromEmail}`);
  }

  if (!smtpFromName) {
    log.warning('SMTP_FROM_NAME not set, will use default');
  } else {
    log.success(`From Name: ${smtpFromName}`);
  }

  return isConfigured;
};

const checkForCommonIssues = () => {
  log.header('🔍 Common Issues Check');

  const smtpPass = process.env.SMTP_PASS || '';

  // Check for Gmail app password format
  if (process.env.SMTP_HOST === 'smtp.gmail.com') {
    if (smtpPass && smtpPass.length !== 16 && smtpPass.replace(/\s/g, '').length !== 16) {
      log.warning('Gmail app password should be 16 characters');
      log.info('Get app password: https://myaccount.google.com/apppasswords');
    } else if (smtpPass.length === 16) {
      log.success('Gmail app password format looks correct');
    }
  }

  // Check for spaces in password
  if (smtpPass && /\s/.test(smtpPass)) {
    log.warning('Password contains spaces - this is OK but verify it works');
  }

  // Check for @ symbol in password without quotes
  if (process.env.SMTP_PASS && process.env.SMTP_PASS.includes('@')) {
    log.warning('Password contains @ - ensure it is properly quoted in .env file');
    log.info('Example: SMTP_PASS="pass@word123"');
  }

  // Check NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    log.info('Running in PRODUCTION mode');
  } else {
    log.info(`Running in ${process.env.NODE_ENV || 'development'} mode`);
  }
};

const suggestNextSteps = (isConfigured) => {
  log.header('🚀 Next Steps');

  if (!isConfigured) {
    console.log(`
${colors.yellow}Email is not fully configured. Follow these steps:${colors.reset}

1. Get Gmail App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Enable 2-Factor Authentication first
   - Generate 16-character app password
   - Copy it (you'll use it only once)

2. Update backend/.env:
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-digit-app-password
   SMTP_FROM_EMAIL=your-email@gmail.com
   SMTP_FROM_NAME=UBUMWE RENTAL SYSTEM

3. Restart backend:
   cd backend && npm run dev

4. Test email:
   - Register new account at http://localhost:5173
   - Check your email for verification link

Read full guide: EMAIL_SETUP_GUIDE.md
    `);
  } else {
    console.log(`
${colors.green}Email is configured! Follow these steps to test:${colors.reset}

1. Start backend:
   cd backend && npm run dev

2. Start frontend:
   cd frontend && npm run dev

3. Test email sending:
   - Go to http://localhost:5173
   - Click "Register"
   - Create account with your real email
   - Check inbox for verification email
   - Should arrive within 1 minute

4. Check for issues:
   - Look at backend console for error messages
   - Check spam folder if not in inbox
   - Verify email has "UBUMWE RENTAL SYSTEM" as sender

For troubleshooting: EMAIL_SETUP_GUIDE.md
    `);
  }
};

const main = () => {
  console.clear();
  console.log(`${colors.cyan}
╔════════════════════════════════════════════════════════╗
║         Email Configuration Verification Tool         ║
║                    UBUMWE Rental System                ║
╚════════════════════════════════════════════════════════╝
${colors.reset}`);

  const isConfigured = checkEmailConfiguration();
  checkForCommonIssues();
  suggestNextSteps(isConfigured);

  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  if (isConfigured) {
    log.success('Email is ready to test!');
  } else {
    log.error('Email needs configuration before testing');
  }
};

main();

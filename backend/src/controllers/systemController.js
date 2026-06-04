const path = require('path');
const { createEncryptedBackup, getBackupStatus, prepareBackupRestore, verifyLatestBackup } = require('../services/backupService');

const getSystemBackupStatus = (req, res) => {
  try {
    res.json(getBackupStatus());
  } catch (error) {
    res.status(500).json({ error: 'Failed to read backup status' });
  }
};

const runSystemBackup = (req, res) => {
  try {
    const backupPath = createEncryptedBackup();

    if (!backupPath) {
      return res.status(400).json({ error: 'Backup could not be created because the database was not found' });
    }

    res.json({
      message: 'Encrypted backup created successfully',
      backup: path.basename(backupPath),
      status: getBackupStatus()
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to create encrypted backup' });
  }
};

const verifySystemBackup = (req, res) => {
  try {
    const verification = verifyLatestBackup();

    res.json({
      ...verification,
      status: getBackupStatus()
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to verify latest backup' });
  }
};

const restoreSystemBackup = (req, res) => {
  try {
    const result = prepareBackupRestore(req.body?.backup);
    res.json({
      ...result,
      status: getBackupStatus()
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to prepare backup restore' });
  }
};

const isConfiguredValue = (value) => {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return ![
    '',
    'your-email@gmail.com',
    'your-app-password-not-regular-password',
    'your-twilio-account-sid',
    'your-twilio-auth-token',
    'your-twilio-phone-number',
    'your_meta_whatsapp_api_access_token',
    'your_phone_number_id_from_meta'
  ].includes(normalized);
};

const getMessagingStatus = (req, res) => {
  try {
    const smtpRequired = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
    const twilioRequired = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'];
    const whatsappRequired = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'];

    const missingSmtp = smtpRequired.filter((key) => !isConfiguredValue(process.env[key]));
    const missingTwilio = twilioRequired.filter((key) => !isConfiguredValue(process.env[key]));
    const missingWhatsapp = whatsappRequired.filter((key) => !isConfiguredValue(process.env[key]));

    res.json({
      checked_at: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      email: {
        configured: missingSmtp.length === 0,
        host: process.env.SMTP_HOST || '',
        from_email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || '',
        from_name: process.env.SMTP_FROM_NAME || 'Rental Management',
        missing: missingSmtp
      },
      sms: {
        configured: missingTwilio.length === 0,
        provider: 'Twilio',
        from_number: process.env.TWILIO_FROM_NUMBER || '',
        missing: missingTwilio
      },
      whatsapp: {
        enabled: process.env.WHATSAPP_REMINDERS_ENABLED === 'true',
        configured: missingWhatsapp.length === 0,
        missing: missingWhatsapp
      },
      login_otp: {
        enabled: process.env.LOGIN_OTP_ENABLED === 'true',
        roles: String(process.env.LOGIN_OTP_ROLES || 'admin')
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read messaging status' });
  }
};

module.exports = {
  getSystemBackupStatus,
  runSystemBackup,
  verifySystemBackup,
  restoreSystemBackup,
  getMessagingStatus
};

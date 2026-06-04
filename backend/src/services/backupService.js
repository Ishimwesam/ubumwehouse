const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const resolvePath = (value, fallback) => {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
};

const getEncryptionKey = () => {
  const raw = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(raw).digest();
};

const encryptBuffer = (buffer) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('UBUMWE-BACKUP-V1\n'), iv, tag, encrypted]);
};

const decryptBuffer = (buffer) => {
  const prefix = Buffer.from('UBUMWE-BACKUP-V1\n');
  if (!Buffer.isBuffer(buffer) || buffer.length <= prefix.length + 28) {
    throw new Error('Backup file is too small or invalid.');
  }

  if (!buffer.subarray(0, prefix.length).equals(prefix)) {
    throw new Error('Backup file has an invalid signature.');
  }

  const iv = buffer.subarray(prefix.length, prefix.length + 12);
  const tag = buffer.subarray(prefix.length + 12, prefix.length + 28);
  const encrypted = buffer.subarray(prefix.length + 28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};

const cleanupBackups = (backupDir, keepCount) => {
  const files = fs.readdirSync(backupDir)
    .filter((name) => name.endsWith('.db.enc'))
    .map((name) => ({
      name,
      path: path.join(backupDir, name),
      mtimeMs: fs.statSync(path.join(backupDir, name)).mtimeMs
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  files.slice(keepCount).forEach((file) => {
    fs.unlinkSync(file.path);
  });
};

const getBackupConfig = () => {
  const dbPath = resolvePath(process.env.DB_PATH, path.join(__dirname, '../../rental_management.db'));
  const backupDir = resolvePath(process.env.BACKUP_DIR, path.join(__dirname, '../../secure-backups'));
  const restorePendingPath = resolvePath(
    process.env.RESTORE_PENDING_PATH,
    path.join(path.dirname(dbPath), 'restore-pending', 'rental_management.restore.db')
  );
  const keepCount = Math.max(parseInt(process.env.BACKUP_KEEP_COUNT || '14', 10) || 14, 1);
  const intervalHours = Math.max(parseFloat(process.env.BACKUP_INTERVAL_HOURS || '24') || 24, 0.25);

  return {
    dbPath,
    backupDir,
    restorePendingPath,
    keepCount,
    intervalHours,
    enabled: process.env.BACKUPS_ENABLED !== 'false',
    hasDedicatedEncryptionKey: Boolean(process.env.BACKUP_ENCRYPTION_KEY)
  };
};

const listEncryptedBackups = () => {
  const { backupDir } = getBackupConfig();
  if (!fs.existsSync(backupDir)) return [];

  return fs.readdirSync(backupDir)
    .filter((name) => name.endsWith('.db.enc'))
    .map((name) => {
      const filePath = path.join(backupDir, name);
      const stats = fs.statSync(filePath);
      return {
        name,
        size_bytes: stats.size,
        created_at: stats.birthtime.toISOString(),
        modified_at: stats.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.modified_at) - new Date(a.modified_at));
};

const getBackupStatus = () => {
  const config = getBackupConfig();
  const backups = listEncryptedBackups();
  const latest = backups[0] || null;
  const latestAgeHours = latest
    ? Math.max((Date.now() - new Date(latest.modified_at).getTime()) / (60 * 60 * 1000), 0)
    : null;
  const nextBackupAt = latest && config.enabled
    ? new Date(new Date(latest.modified_at).getTime() + config.intervalHours * 60 * 60 * 1000).toISOString()
    : null;
  const storageUsedBytes = backups.reduce((sum, backup) => sum + backup.size_bytes, 0);
  let health = 'healthy';
  let healthMessage = 'Backups are active and current.';

  if (!config.enabled) {
    health = 'disabled';
    healthMessage = 'Automatic backups are disabled.';
  } else if (!fs.existsSync(config.dbPath)) {
    health = 'database-missing';
    healthMessage = 'The database file was not found.';
  } else if (!latest) {
    health = 'no-backup';
    healthMessage = 'No encrypted backup has been created yet.';
  } else if (latestAgeHours > config.intervalHours * 1.5) {
    health = 'stale';
    healthMessage = 'The latest backup is older than expected.';
  }

  return {
    enabled: config.enabled,
    encrypted: true,
    health,
    health_message: healthMessage,
    has_dedicated_encryption_key: config.hasDedicatedEncryptionKey,
    database_found: fs.existsSync(config.dbPath),
    restore_pending: fs.existsSync(config.restorePendingPath),
    restore_pending_file: fs.existsSync(config.restorePendingPath) ? path.basename(config.restorePendingPath) : null,
    backup_directory: process.env.BACKUP_DIR || './secure-backups',
    keep_count: config.keepCount,
    interval_hours: config.intervalHours,
    backup_count: backups.length,
    latest_age_hours: latestAgeHours,
    storage_used_bytes: storageUsedBytes,
    latest_backup: latest,
    next_backup_at: nextBackupAt,
    checked_at: new Date().toISOString(),
    backups: backups.slice(0, 10)
  };
};

const verifyLatestBackup = () => {
  const backups = listEncryptedBackups();
  const latest = backups[0];

  if (!latest) {
    return {
      verified: false,
      message: 'No backup file is available to verify.',
      backup: null
    };
  }

  decryptAndValidateBackup(latest.name);

  return {
    verified: true,
    message: 'Latest encrypted backup decrypted successfully and contains a valid SQLite database.',
    backup: latest,
    checked_at: new Date().toISOString()
  };
};

const getBackupByName = (backupName) => {
  const safeName = path.basename(String(backupName || ''));
  if (!safeName || !safeName.endsWith('.db.enc')) {
    throw new Error('Select a valid encrypted backup file.');
  }

  const backup = listEncryptedBackups().find((item) => item.name === safeName);
  if (!backup) {
    throw new Error('Backup file was not found.');
  }

  return backup;
};

const decryptAndValidateBackup = (backupName) => {
  const backup = getBackupByName(backupName);
  const { backupDir } = getBackupConfig();
  const filePath = path.join(backupDir, backup.name);
  const encryptedBytes = fs.readFileSync(filePath);
  const decryptedBytes = decryptBuffer(encryptedBytes);
  const sqliteHeader = Buffer.from('SQLite format 3\0');

  if (!decryptedBytes.subarray(0, sqliteHeader.length).equals(sqliteHeader)) {
    throw new Error('Backup decrypted, but it is not a valid SQLite database.');
  }

  return { backup, decryptedBytes };
};

const prepareBackupRestore = (backupName) => {
  const config = getBackupConfig();
  const { backup, decryptedBytes } = decryptAndValidateBackup(backupName);
  const safetyBackupPath = createEncryptedBackup();

  fs.mkdirSync(path.dirname(config.restorePendingPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(config.restorePendingPath, decryptedBytes, { mode: 0o600 });

  return {
    prepared: true,
    restart_required: true,
    message: 'Restore prepared. Restart the backend to apply this backup before SQLite opens.',
    backup,
    safety_backup: safetyBackupPath ? path.basename(safetyBackupPath) : null,
    pending_restore: path.basename(config.restorePendingPath),
    prepared_at: new Date().toISOString()
  };
};

const createEncryptedBackup = () => {
  const { dbPath, backupDir, keepCount } = getBackupConfig();

  if (!fs.existsSync(dbPath)) {
    console.warn(`Database backup skipped; database not found at ${dbPath}`);
    return null;
  }

  if (!process.env.BACKUP_ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('BACKUP_ENCRYPTION_KEY is required in production.');
  }

  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetPath = path.join(backupDir, `rental-management-${timestamp}.db.enc`);
  const databaseBytes = fs.readFileSync(dbPath);
  const encryptedBytes = encryptBuffer(databaseBytes);

  fs.writeFileSync(targetPath, encryptedBytes, { mode: 0o600 });
  cleanupBackups(backupDir, keepCount);
  console.log(`Encrypted database backup created: ${targetPath}`);
  return targetPath;
};

const startBackupScheduler = () => {
  if (process.env.BACKUPS_ENABLED === 'false') {
    console.log('Encrypted backups disabled (BACKUPS_ENABLED=false)');
    return;
  }

  const intervalHours = Math.max(parseFloat(process.env.BACKUP_INTERVAL_HOURS || '24') || 24, 0.25);

  setTimeout(() => {
    try {
      createEncryptedBackup();
    } catch (error) {
      console.error('Initial encrypted backup failed:', error.message);
    }
  }, 5000);

  setInterval(() => {
    try {
      createEncryptedBackup();
    } catch (error) {
      console.error('Scheduled encrypted backup failed:', error.message);
    }
  }, intervalHours * 60 * 60 * 1000);
};

module.exports = {
  createEncryptedBackup,
  getBackupStatus,
  prepareBackupRestore,
  verifyLatestBackup,
  startBackupScheduler
};

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const resolvePath = (value, fallback) => {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
};

const isProduction = process.env.NODE_ENV === 'production';
const persistentDbRoot = process.env.PERSISTENT_DB_ROOT || '/data';

if (isProduction && !process.env.DB_PATH) {
  throw new Error('DB_PATH must be set in production. Use the persistent disk path, for example /data/rental_management.db.');
}

const dbPath = resolvePath(process.env.DB_PATH, path.join(__dirname, '../rental_management.db'));

if (isProduction) {
  const relativeToPersistentRoot = path.relative(persistentDbRoot, dbPath);
  const isOnPersistentRoot = relativeToPersistentRoot && !relativeToPersistentRoot.startsWith('..') && !path.isAbsolute(relativeToPersistentRoot);

  if (!isOnPersistentRoot) {
    throw new Error(`Unsafe production DB_PATH "${dbPath}". It must live under persistent storage: ${persistentDbRoot}`);
  }
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const restorePendingPath = resolvePath(
  process.env.RESTORE_PENDING_PATH,
  path.join(path.dirname(dbPath), 'restore-pending', 'rental_management.restore.db')
);

if (fs.existsSync(restorePendingPath)) {
  const restoreDir = path.dirname(restorePendingPath);
  const archiveDir = path.join(restoreDir, 'applied');
  fs.mkdirSync(archiveDir, { recursive: true, mode: 0o700 });

  if (fs.existsSync(dbPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(dbPath, path.join(archiveDir, `pre-restore-${timestamp}.db`));
  }

  fs.copyFileSync(restorePendingPath, dbPath);
  fs.unlinkSync(restorePendingPath);
  console.log('Pending database restore applied before opening SQLite.');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

module.exports = db;

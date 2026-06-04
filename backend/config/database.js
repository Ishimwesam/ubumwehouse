const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../rental_management.db');
const restorePendingPath = process.env.RESTORE_PENDING_PATH || path.join(path.dirname(dbPath), 'restore-pending', 'rental_management.restore.db');

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

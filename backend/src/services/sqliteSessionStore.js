const session = require('express-session');
const db = require('../../config/database');

const Store = session.Store;

class SQLiteSessionStore extends Store {
  get(sid, callback) {
    db.get('SELECT sess, expired_at FROM sessions WHERE sid = ?', [sid], (err, row) => {
      if (err) return callback(err);
      if (!row) return callback(null, null);

      if (row.expired_at <= Date.now()) {
        return this.destroy(sid, (destroyErr) => callback(destroyErr, null));
      }

      try {
        return callback(null, JSON.parse(row.sess));
      } catch (parseErr) {
        return callback(parseErr);
      }
    });
  }

  set(sid, sess, callback = () => {}) {
    const expiredAt = this.getExpiry(sess);
    const payload = JSON.stringify(sess);

    db.run(
      `INSERT INTO sessions (sid, sess, expired_at)
       VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET
         sess = excluded.sess,
         expired_at = excluded.expired_at,
         updated_at = CURRENT_TIMESTAMP`,
      [sid, payload, expiredAt],
      callback
    );
  }

  destroy(sid, callback = () => {}) {
    db.run('DELETE FROM sessions WHERE sid = ?', [sid], callback);
  }

  touch(sid, sess, callback = () => {}) {
    db.run(
      'UPDATE sessions SET expired_at = ?, updated_at = CURRENT_TIMESTAMP WHERE sid = ?',
      [this.getExpiry(sess), sid],
      callback
    );
  }

  clearExpired(callback = () => {}) {
    db.run('DELETE FROM sessions WHERE expired_at <= ?', [Date.now()], callback);
  }

  getExpiry(sess) {
    const cookieExpiry = sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : null;
    return Number.isFinite(cookieExpiry) ? cookieExpiry : Date.now() + (30 * 60 * 1000);
  }
}

module.exports = SQLiteSessionStore;

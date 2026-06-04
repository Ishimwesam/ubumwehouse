const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

const getChatTableColumns = (callback) => {
  db.all('PRAGMA table_info(chat_messages)', (err, rows) => {
    if (err) {
      return callback(err);
    }

    const columns = new Set((rows || []).map((row) => row.name));
    return callback(null, {
      hasUserId: columns.has('user_id'),
      hasSenderId: columns.has('sender_id'),
      hasReceiverId: columns.has('receiver_id'),
      hasPriority: columns.has('priority'),
      hasMessageType: columns.has('message_type'),
      hasPinned: columns.has('is_pinned')
    });
  });
};

const normalizeTarget = (value) => {
  const target = String(value || 'ROOM_GLOBAL').trim();
  return target || 'ROOM_GLOBAL';
};

const normalizePriority = (value) => {
  const priority = String(value || 'normal').toLowerCase().trim();
  return ['normal', 'important', 'urgent'].includes(priority) ? priority : 'normal';
};

const getUsers = (req, res) => {
  db.all(
    `SELECT id, username, email, full_name, role, profile_image, created_at
     FROM users
     ORDER BY
       CASE WHEN id = ? THEN 0 ELSE 1 END,
       LOWER(COALESCE(full_name, username)) ASC`,
    [req.user?.id || ''],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching chat users' });
      }

      return res.json(rows || []);
    }
  );
};

const getMessages = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '80', 10), 200);
  const targetId = normalizeTarget(req.query.receiver_id || req.query.target);
  const currentUserId = req.user?.id;

  getChatTableColumns((schemaErr, schema) => {
    if (schemaErr) {
      return res.status(500).json({ error: 'Error fetching chat messages' });
    }

    const senderColumn = schema.hasUserId
      ? 'cm.user_id'
      : schema.hasSenderId
        ? 'cm.sender_id'
        : 'NULL';
    const receiverColumn = schema.hasReceiverId ? 'cm.receiver_id' : "'ROOM_GLOBAL'";
    const priorityColumn = schema.hasPriority ? 'cm.priority' : "'normal'";
    const messageTypeColumn = schema.hasMessageType ? 'cm.message_type' : "'text'";
    const pinnedColumn = schema.hasPinned ? 'cm.is_pinned' : '0';
    let whereSql = '1 = 1';
    let params = [limit];
    if (schema.hasReceiverId && targetId === 'ROOM_GLOBAL') {
      whereSql = `(cm.receiver_id IS NULL OR cm.receiver_id = 'ROOM_GLOBAL')`;
    } else if (schema.hasReceiverId) {
      whereSql = `(
        (${senderColumn} = ? AND cm.receiver_id = ?)
        OR (${senderColumn} = ? AND cm.receiver_id = ?)
      )`;
      params = [currentUserId, targetId, targetId, currentUserId, limit];
    }

    db.all(
      `SELECT cm.id, cm.message, cm.created_at,
              ${senderColumn} AS user_id,
              ${receiverColumn} AS receiver_id,
              ${priorityColumn} AS priority,
              ${messageTypeColumn} AS message_type,
              ${pinnedColumn} AS is_pinned,
              COALESCE(u.full_name, u.username, 'User') AS sender_name,
              u.username AS sender_username,
              COALESCE(r.full_name, r.username, 'Team room') AS receiver_name,
              r.username AS receiver_username
       FROM chat_messages cm
       LEFT JOIN users u ON u.id = ${senderColumn}
       LEFT JOIN users r ON r.id = ${receiverColumn}
       WHERE ${whereSql}
       ORDER BY cm.created_at DESC
       LIMIT ?`,
      params,
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Error fetching chat messages' });
        }

        return res.json((rows || []).reverse());
      }
    );
  });
};

const sendMessage = (req, res) => {
  const rawMessage = String(req.body?.message || '').trim();
  const receiverId = normalizeTarget(req.body?.receiver_id || req.body?.target);
  const priority = normalizePriority(req.body?.priority);
  if (!rawMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (rawMessage.length > 1000) {
    return res.status(400).json({ error: 'Message is too long (max 1000 characters)' });
  }

  const messageId = uuidv4();
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  getChatTableColumns((schemaErr, schema) => {
    if (schemaErr) {
      return res.status(500).json({ error: 'Error sending message' });
    }

    const insertMessage = () => {
      const insertColumns = ['id', 'message'];
      const insertValues = [messageId, rawMessage];

      if (schema.hasUserId) {
        insertColumns.push('user_id');
        insertValues.push(userId);
      }

      if (schema.hasSenderId) {
        insertColumns.push('sender_id');
        insertValues.push(userId);
      }

      if (schema.hasReceiverId) {
        insertColumns.push('receiver_id');
        insertValues.push(receiverId);
      }

      if (schema.hasPriority) {
        insertColumns.push('priority');
        insertValues.push(priority);
      }

      if (schema.hasMessageType) {
        insertColumns.push('message_type');
        insertValues.push(receiverId === 'ROOM_GLOBAL' ? 'room' : 'direct');
      }

      const placeholders = insertColumns.map(() => '?').join(', ');
      const insertSql = `INSERT INTO chat_messages (${insertColumns.join(', ')}) VALUES (${placeholders})`;

      db.run(insertSql, insertValues, (insertErr) => {
        if (insertErr) {
          return res.status(500).json({ error: 'Error sending message' });
        }

        const senderColumn = schema.hasUserId
          ? 'cm.user_id'
          : schema.hasSenderId
            ? 'cm.sender_id'
            : 'NULL';
        const receiverColumn = schema.hasReceiverId ? 'cm.receiver_id' : "'ROOM_GLOBAL'";
        const priorityColumn = schema.hasPriority ? 'cm.priority' : "'normal'";
        const messageTypeColumn = schema.hasMessageType ? 'cm.message_type' : "'text'";
        const pinnedColumn = schema.hasPinned ? 'cm.is_pinned' : '0';

        db.get(
          `SELECT cm.id, cm.message, cm.created_at,
                  ${senderColumn} AS user_id,
                  ${receiverColumn} AS receiver_id,
                  ${priorityColumn} AS priority,
                  ${messageTypeColumn} AS message_type,
                  ${pinnedColumn} AS is_pinned,
                  COALESCE(u.full_name, u.username, 'User') AS sender_name,
                  u.username AS sender_username,
                  COALESCE(r.full_name, r.username, 'Team room') AS receiver_name,
                  r.username AS receiver_username
           FROM chat_messages cm
           LEFT JOIN users u ON u.id = ${senderColumn}
           LEFT JOIN users r ON r.id = ${receiverColumn}
           WHERE cm.id = ?`,
          [messageId],
          (selectErr, row) => {
            if (selectErr) {
              return res.status(500).json({ error: 'Message sent but failed to load message payload' });
            }

            return res.status(201).json(row);
          }
        );
      });
    };

    if (receiverId === 'ROOM_GLOBAL') {
      return insertMessage();
    }

    db.get('SELECT id FROM users WHERE id = ?', [receiverId], (targetErr, targetUser) => {
      if (targetErr) {
        return res.status(500).json({ error: 'Error checking recipient' });
      }

      if (!targetUser) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      return insertMessage();
    });
  });
};

module.exports = {
  getUsers,
  getMessages,
  sendMessage
};

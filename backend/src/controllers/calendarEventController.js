const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

const allowedCategories = new Set(['Rent', 'Payment', 'Follow-up', 'Due Date', 'Maintenance', 'Meeting', 'Other']);
const allowedPriorities = new Set(['High', 'Medium', 'Low']);
const allowedStatuses = new Set(['Open', 'In Progress', 'Done']);
const allowedReminderLeads = new Set(['none', 'same-day', '1-day', '3-days', '7-days']);

const normalizeText = (value, maxLength = 500) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
const normalizePath = (value) => {
  const path = normalizeText(value, 120);
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
};

const normalizeDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const getCalendarTableColumns = (callback) => {
  db.all('PRAGMA table_info(calendar_events)', (err, rows = []) => {
    if (err) return callback(err);
    return callback(null, new Set(rows.map((row) => row.name)));
  });
};

const mapCalendarEvent = (row) => ({
  id: row.id,
  title: row.title,
  start: row.start,
  end: row.end || row.start,
  category: row.category || 'Other',
  note: row.note || '',
  priority: row.priority || 'Medium',
  status: row.status || 'Open',
  reminderLead: row.reminder_lead || 'same-day',
  actionPath: row.action_path || '',
  actionLabel: row.action_label || '',
  createdBy: row.created_by || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const buildPayload = (body) => {
  const title = normalizeText(body.title, 180);
  const start = normalizeDateTime(body.start);
  const end = normalizeDateTime(body.end || body.start);
  const category = allowedCategories.has(body.category) ? body.category : 'Other';
  const priority = allowedPriorities.has(body.priority) ? body.priority : 'Medium';
  const status = allowedStatuses.has(body.status) ? body.status : 'Open';
  const reminderLead = allowedReminderLeads.has(body.reminderLead) ? body.reminderLead : 'same-day';

  return {
    title,
    start,
    end,
    category,
    note: normalizeText(body.note, 1200),
    priority,
    status,
    reminderLead,
    actionPath: normalizePath(body.actionPath),
    actionLabel: normalizeText(body.actionLabel, 120)
  };
};

exports.getAll = (req, res) => {
  db.all(
    `SELECT * FROM calendar_events
     ORDER BY datetime(start) ASC, created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      return res.json(rows.map(mapCalendarEvent));
    }
  );
};

exports.create = (req, res) => {
  const payload = buildPayload(req.body);

  if (!payload.title) return res.status(400).json({ error: 'Event title is required' });
  if (!payload.start) return res.status(400).json({ error: 'Event start date is invalid' });

  const id = uuidv4();

  getCalendarTableColumns((schemaErr, columns) => {
    if (schemaErr) return res.status(500).json({ error: schemaErr.message });

    const insert = {
      id,
      title: payload.title
    };

    const setIfColumn = (column, value) => {
      if (columns.has(column)) insert[column] = value;
    };

    setIfColumn('start', payload.start);
    setIfColumn('end', payload.end || payload.start);
    setIfColumn('category', payload.category);
    setIfColumn('note', payload.note);
    setIfColumn('priority', payload.priority);
    setIfColumn('status', payload.status);
    setIfColumn('reminder_lead', payload.reminderLead);
    setIfColumn('action_path', payload.actionPath);
    setIfColumn('action_label', payload.actionLabel);
    setIfColumn('created_by', req.user?.id || null);
    setIfColumn('user_id', req.user?.id || null);
    setIfColumn('description', payload.note);
    setIfColumn('start_date', payload.start);
    setIfColumn('end_date', payload.end || payload.start);
    setIfColumn('event_type', payload.category);

    const insertColumns = Object.keys(insert);
    const placeholders = insertColumns.map(() => '?').join(', ');

    db.run(
      `INSERT INTO calendar_events (${insertColumns.join(', ')}) VALUES (${placeholders})`,
      insertColumns.map((column) => insert[column]),
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT * FROM calendar_events WHERE id = ?', [id], (fetchErr, row) => {
          if (fetchErr) return res.status(500).json({ error: fetchErr.message });
          return res.status(201).json(mapCalendarEvent(row));
        });
      }
    );
  });
};

exports.update = (req, res) => {
  const { id } = req.params;
  const payload = buildPayload(req.body);

  if (!payload.title) return res.status(400).json({ error: 'Event title is required' });
  if (!payload.start) return res.status(400).json({ error: 'Event start date is invalid' });

  getCalendarTableColumns((schemaErr, columns) => {
    if (schemaErr) return res.status(500).json({ error: schemaErr.message });

    const updates = {
      title: payload.title
    };

    const setIfColumn = (column, value) => {
      if (columns.has(column)) updates[column] = value;
    };

    setIfColumn('start', payload.start);
    setIfColumn('end', payload.end || payload.start);
    setIfColumn('category', payload.category);
    setIfColumn('note', payload.note);
    setIfColumn('priority', payload.priority);
    setIfColumn('status', payload.status);
    setIfColumn('reminder_lead', payload.reminderLead);
    setIfColumn('action_path', payload.actionPath);
    setIfColumn('action_label', payload.actionLabel);
    setIfColumn('description', payload.note);
    setIfColumn('start_date', payload.start);
    setIfColumn('end_date', payload.end || payload.start);
    setIfColumn('event_type', payload.category);
    setIfColumn('updated_at', new Date().toISOString());

    const updateColumns = Object.keys(updates);
    const setClause = updateColumns.map((column) => `${column} = ?`).join(', ');

    db.run(
      `UPDATE calendar_events SET ${setClause} WHERE id = ?`,
      [...updateColumns.map((column) => updates[column]), id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Calendar event not found' });
        db.get('SELECT * FROM calendar_events WHERE id = ?', [id], (fetchErr, row) => {
          if (fetchErr) return res.status(500).json({ error: fetchErr.message });
          return res.json(mapCalendarEvent(row));
        });
      }
    );
  });
};

exports.remove = (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM calendar_events WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Calendar event not found' });
    return res.json({ message: 'Calendar event deleted' });
  });
};

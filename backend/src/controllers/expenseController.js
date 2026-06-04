const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

const allowedCategories = new Set(['Utilities', 'Maintenance', 'Salaries', 'Supplies', 'Other']);
const allowedStatuses = new Set(['paid', 'pending']);
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const normalizeText = (value, maxLength = 180) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);

// GET /api/expenses
exports.getAll = (req, res) => {
  db.all(
    'SELECT * FROM expenses ORDER BY date DESC, created_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// POST /api/expenses
exports.create = (req, res) => {
  const { title, category, amount, date, status, notes } = req.body;
  const normalizedTitle = normalizeText(title);
  const normalizedCategory = allowedCategories.has(category) ? category : 'Other';
  const normalizedStatus = allowedStatuses.has(status) ? status : 'pending';
  const normalizedDate = date || new Date().toISOString().split('T')[0];

  if (!normalizedTitle) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than zero' });
  }
  if (!isValidDate(normalizedDate)) {
    return res.status(400).json({ error: 'Expense date must use YYYY-MM-DD format' });
  }

  const id = uuidv4();
  db.run(
    `INSERT INTO expenses (id, title, category, amount, date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      normalizedTitle,
      normalizedCategory,
      amt,
      normalizedDate,
      normalizedStatus,
      normalizeText(notes, 1000)
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM expenses WHERE id = ?', [id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.status(201).json(row);
      });
    }
  );
};

// DELETE /api/expenses/:id
exports.remove = (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM expenses WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  });
};

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { expenseService } from '../services/api';
import useFeedbackToast from '../hooks/useFeedbackToast';

const formatCurrency = (value) => `${parseFloat(value || 0).toLocaleString()} RWF`;
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const initialFormState = {
  title: '',
  category: 'Utilities',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  status: 'paid',
  notes: ''
};

const Expenses = () => {
  const { isManager } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const canManageOperations = isManager();
  useFeedbackToast(error, 'error');
  useFeedbackToast(success, 'success');

  const loadExpenses = () => {
    expenseService.getAll()
      .then((res) => setExpenses(res.data || []))
      .catch(() => setExpenses([]));
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateExpense = async (event) => {
    event.preventDefault();
    setError('');

    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    if (!formData.title.trim()) {
      setError('Expense title is required.');
      return;
    }

    const amount = parseFloat(formData.amount || 0);
    if (!amount || amount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (!isValidDate(formData.date)) {
      setError('Choose a valid expense date.');
      return;
    }

    setLoading(true);
    try {
      await expenseService.create({
        title: formData.title.trim(),
        category: formData.category,
        amount,
        date: formData.date,
        status: formData.status,
        notes: formData.notes.trim()
      });
      setSuccess('Expense saved successfully.');
      setFormData(initialFormState);
      loadExpenses();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save expense.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    if (!window.confirm('Delete this expense?')) return;

    try {
      setDeletingId(id);
      await expenseService.remove(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      setSuccess('Expense deleted.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to delete expense.');
    } finally {
      setDeletingId(null);
    }
  };

  const thisMonthExpenses = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
  }, [expenses]);

  const pendingCount = useMemo(
    () => expenses.filter((expense) => expense.status === 'pending').length,
    [expenses]
  );

  const topCategory = useMemo(() => {
    if (expenses.length === 0) return '-';

    const totalsByCategory = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + parseFloat(expense.amount || 0);
      return acc;
    }, {});

    return Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1])[0][0] || '-';
  }, [expenses]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.eyebrowPill}>Operations Ledger</div>
        <h1 style={styles.title}>Expenses</h1>
        <p style={styles.subtitle}>Track and review operational spending clearly.</p>
      </div>

      {!canManageOperations ? (
        <div style={styles.readOnlyBanner}>
          You have view-only access here. Expense records can be reviewed, but only managers and admins can create or delete them.
        </div>
      ) : null}

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>This Month Expenses</div>
          <div style={styles.cardValue}>{formatCurrency(thisMonthExpenses)}</div>
          <div style={styles.cardHint}>Total of all expenses in current month.</div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>Pending Records</div>
          <div style={styles.cardValue}>{pendingCount}</div>
          <div style={styles.cardHint}>Expenses waiting to be paid.</div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>Top Category</div>
          <div style={styles.cardValue}>{topCategory}</div>
          <div style={styles.cardHint}>Category with highest total spending.</div>
        </div>
      </div>

      <div style={styles.mainCard}>
        <h2 style={styles.sectionTitle}>Create Expense</h2>
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleCreateExpense}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="e.g. Water bill"
                required
                disabled={!canManageOperations}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Category</label>
              <select name="category" value={formData.category} onChange={handleInputChange} style={styles.input} disabled={!canManageOperations}>
                <option value="Utilities">Utilities</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Salaries">Salaries</option>
                <option value="Supplies">Supplies</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Amount (RWF) *</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                style={styles.input}
                min="0"
                step="0.01"
                placeholder="0"
                required
                disabled={!canManageOperations}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                style={styles.input}
                disabled={!canManageOperations}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange} style={styles.input} disabled={!canManageOperations}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
              <label style={styles.label}>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                style={styles.textarea}
                placeholder="Optional details"
                disabled={!canManageOperations}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{ ...styles.btnPrimary, ...(!canManageOperations ? styles.btnDisabled : {}) }}
            disabled={loading || !canManageOperations}
          >
            {loading ? 'Saving...' : !canManageOperations ? 'View Only' : '+ Create Expense'}
          </button>
        </form>
      </div>

      <div style={styles.mainCard}>
        <h2 style={styles.sectionTitle}>Recent Expenses</h2>
        {expenses.length > 0 ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Title</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td style={styles.td}>{new Date(expense.date).toLocaleDateString()}</td>
                    <td style={styles.td}>{expense.title}</td>
                    <td style={styles.td}>{expense.category}</td>
                    <td style={styles.td}>{formatCurrency(expense.amount)}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...(expense.status === 'pending' ? styles.badgePending : styles.badgePaid) }}>
                        {expense.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={{ ...styles.btnDelete, ...(!canManageOperations || deletingId === expense.id ? styles.btnDisabled : {}) }}
                        onClick={() => handleDeleteExpense(expense.id)}
                        disabled={!canManageOperations || deletingId === expense.id}
                      >
                        {deletingId === expense.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={styles.sectionText}>No expenses yet. Create your first one above.</p>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '1rem'
  },
  header: {
    marginBottom: '1.25rem',
    padding: '1.5rem',
    borderRadius: '1.1rem',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 56%, #0f766e 100%)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: '0 22px 46px rgba(15, 23, 42, 0.18)'
  },
  eyebrowPill: {
    display: 'inline-flex',
    color: '#0f172a',
    backgroundColor: '#ccfbf1',
    border: '1px solid rgba(255, 255, 255, 0.45)',
    borderRadius: '999px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.76rem',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.14)'
  },
  title: {
    margin: '0.5rem 0 0 0',
    fontSize: '2rem',
    fontWeight: 900,
    color: '#ffffff',
    lineHeight: 1.1,
    textShadow: '0 2px 10px rgba(15, 23, 42, 0.28)'
  },
  subtitle: {
    marginTop: '0.4rem',
    marginBottom: 0,
    color: '#dbeafe',
    fontSize: '1rem',
    fontWeight: '600',
    lineHeight: 1.55
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem'
  },
  card: {
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '0.75rem',
    padding: '1rem',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.1)'
  },
  cardLabel: {
    color: '#475569',
    fontWeight: 700,
    fontSize: '0.82rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em'
  },
  cardValue: {
    marginTop: '0.5rem',
    fontSize: '1.55rem',
    fontWeight: 900,
    color: '#0f172a'
  },
  cardHint: {
    marginTop: '0.5rem',
    color: '#64748b',
    fontSize: '0.86rem'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    border: '1px solid #fecaca',
    borderRadius: '0.5rem',
    padding: '0.65rem 0.8rem',
    marginBottom: '0.85rem',
    fontWeight: 600
  },
  readOnlyBanner: {
    marginBottom: '0.85rem',
    padding: '0.8rem 0.9rem',
    borderRadius: '0.75rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontWeight: 600,
    lineHeight: 1.5
  },
  mainCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '0.75rem',
    padding: '1rem',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.1)',
    marginBottom: '1rem'
  },
  sectionTitle: {
    margin: 0,
    color: '#0f172a'
  },
  sectionText: {
    marginTop: '0.7rem',
    marginBottom: 0,
    color: '#334155',
    lineHeight: 1.6
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.85rem',
    marginBottom: '0.95rem'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '0.8rem',
    color: '#334155',
    fontWeight: 700,
    marginBottom: '0.35rem'
  },
  input: {
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    padding: '0.62rem 0.7rem',
    fontSize: '0.9rem',
    fontFamily: 'inherit'
  },
  textarea: {
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    padding: '0.62rem 0.7rem',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    resize: 'vertical'
  },
  btnPrimary: {
    border: 'none',
    backgroundColor: '#1d4ed8',
    color: 'white',
    borderRadius: '0.5rem',
    padding: '0.65rem 1rem',
    fontWeight: 700,
    cursor: 'pointer'
  },
  tableWrap: {
    overflowX: 'auto',
    marginTop: '0.8rem',
    border: '1px solid #cbd5e1',
    borderRadius: '0.65rem'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#ffffff'
  },
  th: {
    textAlign: 'left',
    padding: '0.85rem 0.7rem',
    fontSize: '0.77rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#ffffff',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 100%)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
    fontWeight: 900
  },
  td: {
    padding: '0.7rem',
    borderBottom: '1px solid #f1f5f9',
    color: '#0f172a',
    fontSize: '0.9rem'
  },
  badge: {
    borderRadius: '999px',
    padding: '0.2rem 0.55rem',
    fontSize: '0.76rem',
    fontWeight: 700,
    textTransform: 'uppercase'
  },
  badgePaid: {
    backgroundColor: '#dcfce7',
    color: '#166534'
  },
  badgePending: {
    backgroundColor: '#fef3c7',
    color: '#92400e'
  },
  btnDelete: {
    border: '1px solid #fecaca',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '0.45rem',
    padding: '0.35rem 0.55rem',
    fontWeight: 700,
    cursor: 'pointer'
  },
  btnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none'
  }
};

export default Expenses;

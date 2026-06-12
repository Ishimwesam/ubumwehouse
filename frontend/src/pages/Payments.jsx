import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService, resolveUploadUrl, tenantService } from '../services/api';
import { useToast } from '../context/ToastContext';
import PageLoader from '../components/PageLoader';

const formatCurrency = (value) =>
  `${parseFloat(value || 0).toLocaleString()} RWF`;

const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

const Payments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  // Default to 'confirm' if there are pending payments
  const [activeSection, setActiveSection] = useState('make');

  useEffect(() => {
    if (payments.some((p) => p.payment_status === 'pending')) {
      setActiveSection('confirm');
    }
  }, [payments.length]);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    tenant_id: '',
    unit_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_period: getCurrentPeriod(),
    payment_method: 'cash',
    notes: '',
    receipt: null
  });

  useEffect(() => {
    fetchPayments();
    fetchTenants();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await paymentService.getAll();
      setPayments(response.data);
    } catch (err) {
      setError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await tenantService.getAll();
      setTenants(response.data);
    } catch (err) {
      console.error('Failed to load tenants');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editingId && !formData.receipt) {
      const message = 'Please upload a receipt before saving a new payment.';
      setError(message);
      showToast(message, 'warning');
      return;
    }

    try {
      if (editingId) {
        await paymentService.update(editingId, formData);
        setSuccess('Payment updated successfully');
        showToast('Payment updated successfully');
      } else {
        await paymentService.create(formData);
        setSuccess('Payment saved as pending. Confirm it after checking the receipt.');
        showToast('Payment saved as pending. Confirm it after checking the receipt.', 'info');
        resetForm();
        fetchPayments();
        fetchTenants();
        navigate('/manual-confirmation');
        return;
      }

      resetForm();
      fetchPayments();
      fetchTenants();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save payment');
      showToast(err.response?.data?.error || 'Failed to save payment', 'error');
    }
  };

  const handleConfirm = async (payment) => {
    try {
      await paymentService.confirm(payment.id);
      setSuccess('Payment confirmed successfully');
      showToast('Payment confirmed successfully');
      fetchPayments();
      fetchTenants();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm payment');
      showToast(err.response?.data?.error || 'Failed to confirm payment', 'error');
    }
  };

  const handleEdit = (payment) => {
    setFormData({
      tenant_id: payment.tenant_id,
      unit_id: payment.unit_id,
      amount: payment.amount,
      payment_date: payment.payment_date,
      payment_period: payment.payment_period || getCurrentPeriod(),
      payment_method: payment.payment_method || 'cash',
      notes: payment.notes || '',
      receipt: null
    });
    setEditingId(payment.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this payment?')) {
      try {
        await paymentService.delete(id);
        setSuccess('Payment deleted successfully');
        showToast('Payment deleted successfully');
        fetchPayments();
      } catch (err) {
        setError('Failed to delete payment');
        showToast('Failed to delete payment', 'error');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      tenant_id: '',
      unit_id: '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_period: getCurrentPeriod(),
      payment_method: 'cash',
      notes: '',
      receipt: null
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0] || null;
    setFormData({ ...formData, receipt: file });
    if (file) {
      setError('');
    }
  };

  const handleTenantChange = (e) => {
    const tenantId = e.target.value;
    const tenant = tenants.find((t) => t.id === tenantId);
    setFormData({
      ...formData,
      tenant_id: tenantId,
      unit_id: tenant?.unit_id || ''
    });
  };

  const selectedTenant = tenants.find((tenant) => tenant.id === formData.tenant_id);
  const selectedMonthlyRent = parseFloat(selectedTenant?.monthly_rent || 0);
  const selectedAmount = parseFloat(formData.amount || 0);
  const estimatedBalance = Math.max(selectedMonthlyRent - selectedAmount, 0);
  const pendingPayments = payments.filter((payment) => payment.payment_status === 'pending');
  // Store pending payments count in localStorage for Sidebar badge
  useEffect(() => {
    localStorage.setItem('pendingPaymentsCount', pendingPayments.length);
  }, [pendingPayments.length]);
  const confirmedPayments = payments.filter((payment) => payment.payment_status !== 'pending');

  if (loading) return <PageLoader text="Loading payments..." />;

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Payments Management</h1>
        <button
          type="button"
          style={styles.btnPrimary}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Record Payment'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.moduleNav}>
        {[
          ['make', 'Make Payment'],
          ['confirm', 'Confirm Payment'],
          ['history', 'Payment History'],
          ['pending', 'Pending Payments'],
          ['reports', 'Reports']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            style={{
              ...styles.navButton,
              ...(activeSection === key ? styles.navButtonActive : {})
            }}
            onClick={() => {
              setActiveSection(key);
              if (key === 'make') setShowForm(true);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.infoPanel}>
        <h2 style={styles.infoTitle}>Payment Module</h2>
        <p style={styles.infoText}>
          The payment module records, stores, and tracks all rent payments made by tenants.
          It answers who paid, how much was paid, when it was paid, and what remains unpaid.
        </p>
        <div style={styles.infoGrid}>
          <div>
            <h3 style={styles.infoHeading}>Payment Form</h3>
            <p style={styles.infoText}>
              Select the tenant, enter the amount paid, choose the payment date and month,
              upload a receipt, and add an optional comment such as partial payment.
            </p>
          </div>
          <div>
            <h3 style={styles.infoHeading}>Balance Tracking</h3>
            <p style={styles.infoText}>
              The system compares the unit rent with payments for the selected month.
              If rent is 400,000 RWF and 250,000 RWF is paid, 150,000 RWF remains unpaid.
            </p>
          </div>
          <div>
            <h3 style={styles.infoHeading}>Receipts and History</h3>
            <p style={styles.infoText}>
              Every payment stays as its own record, with receipt proof available anytime
              for transparency, verification, reports, edits, and corrections.
            </p>
          </div>
        </div>
      </div>

      {showForm && activeSection === 'make' && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>
            {editingId ? 'Edit Payment' : 'Record New Payment'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label>Tenant *</label>
                <select
                  name="tenant_id"
                  value={formData.tenant_id}
                  onChange={handleTenantChange}
                  required
                >
                  <option value="">Select a tenant</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.full_name} - {tenant.unit_number}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label>Amount *</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  step="0.01"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label>Payment Period *</label>
                <input
                  type="month"
                  name="payment_period"
                  value={formData.payment_period}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label>Payment Date *</label>
                <input
                  type="date"
                  name="payment_date"
                  value={formData.payment_date}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label>Payment Method</label>
                <select
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleInputChange}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="check">Check</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label>Upload Receipt (Image/PDF)</label>
                <div style={styles.receiptInputRow}>
                  <input
                    type="file"
                    name="receipt"
                    onChange={handleFileChange}
                    accept=".jpg,.jpeg,.png,.pdf"
                    required={!editingId}
                  />
                  <label style={styles.cameraButton}>
                    Take Photo
                    <input
                      type="file"
                      name="receipt"
                      onChange={handleFileChange}
                      accept="image/*"
                      capture="environment"
                      style={styles.hiddenFileInput}
                    />
                  </label>
                </div>
              </div>

              {selectedTenant && (
                <div style={styles.balancePreview}>
                  <strong>{selectedTenant.full_name}</strong>
                  <span>Monthly rent: {formatCurrency(selectedMonthlyRent)}</span>
                  <span>Amount paid now: {formatCurrency(selectedAmount)}</span>
                  <span>Remaining for this month: {formatCurrency(estimatedBalance)}</span>
                </div>
              )}

              <div style={styles.fullWidth}>
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={styles.formActions}>
              <button type="submit" style={styles.btnPrimary}>
                {editingId ? 'Update Payment' : 'Save Pending Payment & Go to Confirm'}
              </button>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {(activeSection === 'confirm' || activeSection === 'pending') && (
        <div style={styles.tableCard}>
          <h2 style={styles.formTitle}>Pending Payments</h2>
          {pendingPayments.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Unit</th>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>Receipt</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.tenant_name}</td>
                    <td>{payment.unit_number}</td>
                    <td>{payment.payment_period || '-'}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>
                      {payment.receipt_path ? (
                        <a
                          href={resolveUploadUrl(payment.receipt_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#2563eb' }}
                        >
                          View receipt
                        </a>
                      ) : (
                        'No receipt'
                      )}
                    </td>
                    <td>
                      <button type="button" style={styles.btnConfirm} onClick={() => handleConfirm(payment)}>
                        Confirm Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.noData}>No pending payments</p>
          )}
        </div>
      )}

      {activeSection === 'reports' && (
        <div style={styles.infoPanel}>
          <h2 style={styles.infoTitle}>Payment Reports Snapshot</h2>
          <div style={styles.infoGrid}>
            <div><strong>Confirmed payments:</strong> {confirmedPayments.length}</div>
            <div><strong>Pending payments:</strong> {pendingPayments.length}</div>
            <div><strong>Total confirmed:</strong> {formatCurrency(confirmedPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0))}</div>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div style={styles.tableCard}>
        <h2 style={styles.formTitle}>Payment History Per Tenant</h2>
        {payments.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Unit</th>
                <th>Period</th>
                <th>Rent</th>
                <th>Amount</th>
                <th>Paid This Period</th>
                <th>Unpaid Balance</th>
                <th>Payment Date</th>
                <th>Method</th>
                <th>Status</th>
                <th>Receipt</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.tenant_name}</td>
                  <td>{payment.unit_number}</td>
                  <td>{payment.payment_period || '-'}</td>
                  <td>{formatCurrency(payment.monthly_rent)}</td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td>{formatCurrency(payment.period_total_paid)}</td>
                  <td style={{ color: parseFloat(payment.period_balance || 0) > 0 ? '#ef4444' : '#10b981', fontWeight: '600' }}>
                    {formatCurrency(payment.period_balance)}
                  </td>
                  <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td>{payment.payment_method}</td>
                  <td>
                    <span style={{
                      ...styles.statusBadge,
                      ...(payment.payment_status === 'pending' ? styles.pendingBadge : styles.confirmedBadge)
                    }}>
                      {payment.payment_status || 'confirmed'}
                    </span>
                  </td>
                  <td>
                    {payment.receipt_path ? (
                      <a
                        href={resolveUploadUrl(payment.receipt_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2563eb' }}
                      >
                        View
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      style={styles.btnSmall}
                      onClick={() => handleEdit(payment)}
                    >
                      Edit
                    </button>
                    {payment.payment_status === 'pending' && (
                      <button
                        type="button"
                        style={{ ...styles.btnSmall, ...styles.btnSuccess }}
                        onClick={() => handleConfirm(payment)}
                      >
                        Confirm
                      </button>
                    )}
                    <button
                      type="button"
                      style={{ ...styles.btnSmall, ...styles.btnDanger }}
                      onClick={() => handleDelete(payment.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={styles.noData}>No payments found</p>
        )}
      </div>
    </div>
  );
};

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem'
  },
  title: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#1f2937',
    margin: 0
  },
  btnPrimary: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontWeight: '500'
  },
  btnSecondary: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontWeight: '500'
  },
  btnSmall: {
    padding: '0.375rem 0.75rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    marginRight: '0.5rem'
  },
  btnDanger: {
    backgroundColor: '#ef4444'
  },
  btnSuccess: {
    backgroundColor: '#10b981'
  },
  btnConfirm: {
    padding: '0.55rem 0.9rem',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontWeight: '600'
  },
  moduleNav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginBottom: '1.5rem'
  },
  navButton: {
    padding: '0.7rem 1rem',
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: '600'
  },
  navButtonActive: {
    backgroundColor: '#2563eb',
    color: 'white',
    borderColor: '#2563eb'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    padding: '1rem',
    borderRadius: '0.375rem',
    marginBottom: '1rem'
  },
  success: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '1rem',
    borderRadius: '0.375rem',
    marginBottom: '1rem'
  },
  infoPanel: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    marginBottom: '2rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb'
  },
  infoTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 0,
    marginBottom: '0.75rem'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginTop: '1rem'
  },
  infoHeading: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '0.5rem'
  },
  infoText: {
    color: '#4b5563',
    lineHeight: 1.6,
    margin: 0
  },
  loading: {
    textAlign: 'center',
    padding: '2rem'
  },
  formCard: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '0.5rem',
    marginBottom: '2rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  formTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '1.5rem',
    color: '#1f2937'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem'
  },
  fullWidth: {
    gridColumn: '1 / -1'
  },
  balancePreview: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    backgroundColor: '#f9fafb',
    padding: '1rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    color: '#374151'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  receiptInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  cameraButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '38px',
    padding: '0 0.9rem',
    borderRadius: '0.5rem',
    border: '1px solid #99f6e4',
    backgroundColor: '#f0fdfa',
    color: '#0f766e',
    fontWeight: 700,
    cursor: 'pointer'
  },
  hiddenFileInput: {
    display: 'none'
  },
  formActions: {
    display: 'flex',
    gap: '1rem'
  },
  tableCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  statusBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.6rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: '700'
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e'
  },
  confirmedBadge: {
    backgroundColor: '#d1fae5',
    color: '#065f46'
  },
  noData: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '2rem'
  }
};

export default Payments;

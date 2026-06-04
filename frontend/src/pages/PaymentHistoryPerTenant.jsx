import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useLocation } from 'react-router-dom';
import ReceiptModal from '../components/ReceiptModal';
import { paymentService, resolveUploadUrl, tenantService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useDataSync } from '../context/DataSyncContext';


const formatCurrency = (value) => `${parseFloat(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});
const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getReceiptUrl = (receiptPath) => {
  if (!receiptPath) return null;
  return resolveUploadUrl(receiptPath);
};

const escapeCsvCell = (value) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};


const PaymentHistoryPerTenant = () => {

  const [currentTenantIdx, setCurrentTenantIdx] = useState(0);
  const tenantRefs = useRef([]);
  const [tenants, setTenants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const filteredTenants = tenants.filter((tenant) =>
    tenant.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.phone.includes(searchTerm)
  );

    // Scroll to and select tenant when index changes
    useEffect(() => {
      if (tenantRefs.current[currentTenantIdx]) {
        tenantRefs.current[currentTenantIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (filteredTenants[currentTenantIdx]) {
        setSelectedTenant(filteredTenants[currentTenantIdx]);
        fetchPaymentHistory(filteredTenants[currentTenantIdx].id);
      }
      // eslint-disable-next-line
    }, [currentTenantIdx, filteredTenants.length]);
  const location = useLocation();
  const { versions } = useDataSync();
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const { showToast } = useToast();

  const [receiptPayment, setReceiptPayment] = useState(null);

  useEffect(() => {
    fetchTenants();
  }, [versions.tenants]);

  useEffect(() => {
    if (!selectedTenant?.id) return;
    fetchPaymentHistory(selectedTenant.id);
  }, [versions.payments]);

  // Always select tenant from navigation state if present
  useEffect(() => {
    if (!tenants.length) return;
    const tenantIdFromState = location.state?.tenantId;
    if (!tenantIdFromState) return;

    // Only update if not already selected
    if (!selectedTenant || selectedTenant.id !== tenantIdFromState) {
      const matched = tenants.find((tenant) => tenant.id === tenantIdFromState);
      if (matched) {
        handleTenantSelect(matched);
      }
    }
  }, [tenants, location.state, selectedTenant]);

  const fetchTenants = async () => {
    try {
      const response = await tenantService.getAll();
      setTenants(response.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching tenants:', err);
      showToast('Failed to load tenants', 'error');
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async (tenantId) => {
    try {
      const response = await paymentService.getByTenant(tenantId);
      setPaymentHistory(response.data || []);
      showToast('Payment history loaded', 'success');
    } catch (err) {
      console.error('Error fetching payment history:', err);
      showToast('Failed to load payment history', 'error');
    }
  };

  const handleTenantSelect = (tenant) => {
    setSelectedTenant(tenant);
    fetchPaymentHistory(tenant.id);
  };



  const filteredPayments = paymentHistory
    .filter((payment) => {
      if (filterStatus === 'all') return true;
      return payment.payment_status === filterStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.payment_date) - new Date(a.payment_date);
        case 'date_asc':
          return new Date(a.payment_date) - new Date(b.payment_date);
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

  const totalPaid = filteredPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const confirmedPayments = filteredPayments.filter((p) => p.payment_status === 'confirmed' || !p.payment_status);
  const pendingPayments = filteredPayments.filter((p) => p.payment_status === 'pending');

  const handlePrintHistory = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!selectedTenant) {
      showToast('Select a tenant first', 'error');
      return;
    }

    const rows = [
      ['Tenant Name', selectedTenant.full_name || '-'],
      ['Phone', selectedTenant.phone || '-'],
      ['Unit', selectedTenant.unit_number || 'N/A'],
      ['Monthly Rent', formatCurrency(selectedTenant.monthly_rent)],
      [],
      ['Payment ID', 'Date', 'Unit', 'Building', 'Amount', 'Period', 'Method', 'Status', 'Receipt File', 'Notes', 'Created']
    ];

    filteredPayments.forEach((payment) => {
      rows.push([
        String(payment.id || '-').slice(0, 8),
        formatDate(payment.payment_date),
        payment.unit_number || selectedTenant.unit_number || 'N/A',
        payment.building_name || selectedTenant.building_name || 'N/A',
        formatCurrency(payment.amount),
        payment.payment_period || 'N/A',
        payment.payment_method || 'Cash',
        payment.payment_status === 'confirmed' || !payment.payment_status ? 'Confirmed' : 'Pending',
        payment.receipt_path ? getReceiptUrl(payment.receipt_path) : 'No file',
        payment.notes || '-',
        formatDateTime(payment.created_at)
      ]);
    });

    const csvContent = rows
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (selectedTenant.full_name || 'tenant-history').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    link.href = url;
    link.download = `${safeName}-payment-history.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Excel export downloaded', 'success');
  };

  const handleDownloadPdf = async () => {
    if (!selectedTenant) {
      showToast('Select a tenant first', 'error');
      return;
    }

    const target = document.getElementById('tenant-history-export');
    if (!target) {
      showToast('History area not found', 'error');
      return;
    }

    try {
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const renderWidth = canvas.width * ratio;
      const renderHeight = canvas.height * ratio;

      pdf.addImage(imgData, 'PNG', margin, margin, renderWidth, renderHeight);

      const safeName = (selectedTenant.full_name || 'tenant-history').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      pdf.save(`${safeName}-payment-history.pdf`);
      showToast('PDF export downloaded', 'success');
    } catch (error) {
      showToast('Failed to export PDF', 'error');
    }
  };

  if (loading) {

    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Confirmed payments for summary table
  const confirmedSummaryPayments = paymentHistory.filter(
    (p) => p.payment_status === 'confirmed' || !p.payment_status
  );

  return (
    <div style={styles.container}>
      {/* Confirmed Payments Summary Table */}
      {selectedTenant && confirmedSummaryPayments.length > 0 && (
        <div style={{ marginBottom: '2rem', background: '#f8fafc', borderRadius: 8, boxShadow: '0 1px 4px #e5e7eb', padding: 16 }}>
          <h2 style={{ fontSize: '1.2rem', color: '#2563eb', marginBottom: 8 }}>Confirmed Payments</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>Tenant</th>
                <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>Unit</th>
                <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>Amount</th>
                <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>Date</th>
                <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {confirmedSummaryPayments.map((p, idx) => (
                <tr key={p.id || idx}>
                  <td style={{ padding: 8, border: '1px solid #e5e7eb', fontWeight: 500 }}>{p.tenant_name || selectedTenant.full_name}</td>
                  <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{p.unit_number || selectedTenant.unit_number || '-'}</td>
                  <td style={{ padding: 8, border: '1px solid #e5e7eb', color: '#10b981', fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                  <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{formatDate(p.payment_date)}</td>
                  <td style={{ padding: 8, border: '1px solid #e5e7eb', color: '#22c55e', fontWeight: 700 }}>
                    ✔ Confirmed
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <style>{`
        .print-watermark {
          display: none;
        }
        @media print {
          body * { visibility: hidden !important; }
          #payment-history-print, #payment-history-print * { visibility: visible !important; }
          #payment-history-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #fff !important;
            padding: 16px !important;
          }
          .print-watermark {
            display: block !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 420px !important;
            height: 420px !important;
            object-fit: contain !important;
            opacity: 0.05 !important;
            pointer-events: none !important;
            z-index: 0 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      {/* Header */}
      <div style={styles.header}>
      {receiptPayment && (
        <ReceiptModal
          payment={receiptPayment}
          onClose={() => setReceiptPayment(null)}
        />
      )}
        <div>
          <h1 style={styles.pageTitle}>Payment History Per Tenant</h1>
          <p style={styles.subtitle}>View complete payment records for dispute resolution</p>
        </div>
      </div>
        {/* Left Panel - Tenant List */}
        <div style={styles.leftPanel}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>Select Tenant</div>
            <div style={styles.searchBox}>
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            {/* Pagination Controls for Tenant List */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="button" style={styles.exportExcelBtn} onClick={() => setCurrentTenantIdx(0)} disabled={currentTenantIdx === 0}>First</button>
              <button type="button" style={styles.exportExcelBtn} onClick={() => setCurrentTenantIdx(idx => Math.max(0, idx - 1))} disabled={currentTenantIdx === 0}>Prev</button>
              <button type="button" style={styles.exportExcelBtn} onClick={() => setCurrentTenantIdx(idx => Math.min(filteredTenants.length - 1, idx + 1))} disabled={currentTenantIdx === filteredTenants.length - 1}>Next</button>
              <button type="button" style={styles.exportExcelBtn} onClick={() => setCurrentTenantIdx(filteredTenants.length - 1)} disabled={currentTenantIdx === filteredTenants.length - 1}>Last</button>
            </div>
            <div style={styles.tenantList}>
              {filteredTenants.length > 0 ? (
                filteredTenants.map((tenant, idx) => (
                  <button
                    key={tenant.id}
                    type="button"
                    style={{
                      ...styles.tenantButton,
                      ...(selectedTenant?.id === tenant.id ? styles.tenantButtonActive : {}),
                      ...(idx === currentTenantIdx ? { border: '2px solid #6366f1' } : {})
                    }}
                    onClick={() => setCurrentTenantIdx(idx)}
                    ref={el => tenantRefs.current[idx] = el}
                  >
                    <div style={styles.tenantName}>{tenant.full_name}</div>
                    <div style={styles.tenantInfo}>{tenant.phone}</div>
                    {tenant.unit_number && (
                      <div style={styles.tenantUnit}>Unit {tenant.unit_number}</div>
                    )}
                  </button>
                ))
              ) : (
                <div style={styles.emptyState}>No tenants found</div>
              )}
            </div>
          </div>

        {/* Right Panel - Payment History */}
        <div style={styles.rightPanel}>
          {selectedTenant ? (
            <>
              <div className="no-print" style={styles.historyActionBar}>
                <div>
                  <div style={styles.historyActionLabel}>Selected Tenant</div>
                  <div style={styles.historyActionName}>{selectedTenant.full_name}</div>
                </div>
                <div style={styles.historyActionsRight}>
                  <button type="button" onClick={handleExportExcel} style={styles.exportExcelBtn}>
                    Export Excel
                  </button>
                  <button type="button" onClick={handleDownloadPdf} style={styles.exportPdfBtn}>
                    Download PDF
                  </button>
                  <button type="button" onClick={handlePrintHistory} style={styles.printHistoryBtn}>
                    Print History
                  </button>
                </div>
              </div>

              <div id="tenant-history-export">
              {/* Tenant Info */}
              <div style={styles.card}>
                <div style={styles.tenantDetailsHeader}>
                  <div>
                    <h2 style={styles.tenantNameLarge}>{selectedTenant.full_name}</h2>
                    <div style={styles.tenantDetailsGrid}>
                      <div>
                        <div style={styles.label}>Phone</div>
                        <div style={styles.value}>{selectedTenant.phone}</div>
                      </div>
                      <div>
                        <div style={styles.label}>Unit</div>
                        <div style={styles.value}>{selectedTenant.unit_number || 'N/A'}</div>
                      </div>
                      <div>
                        <div style={styles.label}>Monthly Rent</div>
                        <div style={styles.value}>
                          {formatCurrency(selectedTenant.monthly_rent)}
                        </div>
                      </div>
                      <div>
                        <div style={styles.label}>Status</div>
                        <div style={{
                          ...styles.value,
                          color: selectedTenant.status === 'active' ? '#10b981' : '#ef4444'
                        }}>
                          {selectedTenant.status?.charAt(0).toUpperCase() + selectedTenant.status?.slice(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div style={styles.summaryGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Total Paid</div>
                  <div style={{ ...styles.statValue, color: '#10b981' }}>
                    {formatCurrency(totalPaid)}
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Confirmed</div>
                  <div style={{ ...styles.statValue, color: '#2563eb' }}>
                    {confirmedPayments.length}
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Pending</div>
                  <div style={{ ...styles.statValue, color: '#f59e0b' }}>
                    {pendingPayments.length}
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Total Payments</div>
                  <div style={{ ...styles.statValue, color: '#7c3aed' }}>
                    {filteredPayments.length}
                  </div>
                </div>
              </div>

              {/* Filters & Sort */}
              <div style={styles.card}>
                <div style={styles.filterGrid}>
                  <div>
                    <label style={styles.label}>Filter by Status</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={styles.select}>
                      <option value="all">All Payments</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Sort by</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={styles.select}>
                      <option value="date_desc">Recent First</option>
                      <option value="date_asc">Oldest First</option>
                      <option value="amount_desc">Highest Amount</option>
                      <option value="amount_asc">Lowest Amount</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Payment History Table */}
              <div style={styles.card}>
                <div style={styles.cardHeaderRow}>
                  <div style={styles.cardHeader}>Payment History ({filteredPayments.length})</div>
                </div>
                {filteredPayments.length > 0 ? (
                  <div style={styles.tableWrapper}>
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Date</th>
                          <th>Unit</th>
                          <th>Building</th>
                          <th>Amount</th>
                          <th>Period</th>
                          <th>Method</th>
                          <th>Status</th>
                          <th>Receipt File</th>
                          <th>Notes</th>
                          <th>Created</th>
                          <th>Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((payment, idx) => (
                          <tr key={idx}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                              {String(payment.id || '-').slice(0, 8)}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {formatDate(payment.payment_date)}
                            </td>
                            <td>{payment.unit_number || selectedTenant?.unit_number || 'N/A'}</td>
                            <td>{payment.building_name || selectedTenant?.building_name || 'N/A'}</td>
                            <td style={{ color: '#10b981', fontWeight: 600 }}>
                              {formatCurrency(payment.amount)}
                            </td>
                            <td>{payment.payment_period || 'N/A'}</td>
                            <td style={{ textTransform: 'capitalize' }}>
                              {payment.payment_method || 'Cash'}
                            </td>
                            <td>
                              <span
                                style={{
                                  ...styles.badge,
                                  backgroundColor:
                                    payment.payment_status === 'confirmed' || !payment.payment_status
                                      ? '#dcfce7'
                                      : '#fef3c7',
                                  color:
                                    payment.payment_status === 'confirmed' || !payment.payment_status
                                      ? '#166534'
                                      : '#92400e'
                                }}
                              >
                                {payment.payment_status === 'confirmed' || !payment.payment_status
                                  ? 'Confirmed'
                                  : 'Pending'}
                              </span>
                            </td>
                            <td>
                              {payment.receipt_path ? (
                                <a
                                  href={getReceiptUrl(payment.receipt_path)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={styles.receiptLinkBtn}
                                >
                                  View Upload
                                </a>
                              ) : (
                                <span style={styles.noReceiptText}>No file</span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {payment.notes || '-'}
                            </td>
                            <td style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {formatDateTime(payment.created_at)}
                            </td>
                            <td>
                              {(payment.payment_status === 'confirmed' || !payment.payment_status) ? (
                                <button
                                  style={styles.printRowBtn}
                                  onClick={() => setReceiptPayment({ ...payment, tenant_name: selectedTenant?.full_name, tenant_phone: selectedTenant?.phone, unit_number: selectedTenant?.unit_number, building_name: selectedTenant?.building_name })}
                                >
                                  Receipt
                                </button>
                              ) : (
                                <span style={styles.pendingReceiptText}>Confirm first</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={styles.emptyState}>No payment history found for selected filters</div>
                )}
              </div>
              </div>
            </>
          ) : (
            <div style={styles.card}>
              <div style={styles.emptyState}>
                <h3>Select a Tenant</h3>
                <p>Choose a tenant from the list to view their payment history</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '2rem'
  },
  pageTitle: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: 0,
    color: '#1f2937'
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
    margin: 0
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: '1.5rem'
  },
  leftPanel: {},
  rightPanel: {},
  historyActionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '1rem',
    padding: '0.9rem 1rem',
    borderRadius: '0.75rem',
    background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)',
    border: '1px solid #bfdbfe'
  },
  historyActionsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  card: {
    background: '#ffffff',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    marginBottom: '1.5rem'
  },
  cardHeader: {
    fontSize: '1.125rem',
    fontWeight: 700,
    marginBottom: '1rem',
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '1rem',
    color: '#1f2937'
  },
  cardHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem'
  },
  historyActionLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.2rem'
  },
  historyActionName: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  printHistoryBtn: {
    border: 'none',
    borderRadius: '0.5rem',
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '0.55rem 0.9rem',
    whiteSpace: 'nowrap'
  },
  exportExcelBtn: {
    border: 'none',
    borderRadius: '0.5rem',
    background: 'linear-gradient(135deg, #047857, #059669)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '0.55rem 0.9rem',
    whiteSpace: 'nowrap'
  },
  exportPdfBtn: {
    border: 'none',
    borderRadius: '0.5rem',
    background: 'linear-gradient(135deg, #b91c1c, #dc2626)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '0.55rem 0.9rem',
    whiteSpace: 'nowrap'
  },
  searchBox: {
    marginBottom: '1rem'
  },
  searchInput: {
    width: '100%',
    padding: '0.75rem',
    border: '1.5px solid #e5e7eb',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit'
  },
  tenantList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxHeight: '600px',
    overflowY: 'auto'
  },
  tenantButton: {
    padding: '1rem',
    background: '#f9fafb',
    border: '1.5px solid #e5e7eb',
    borderRadius: '0.5rem',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  tenantButtonActive: {
    background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)',
    borderColor: '#2563eb',
    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)'
  },
  tenantName: {
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '0.25rem',
    fontSize: '0.875rem'
  },
  tenantInfo: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginBottom: '0.25rem'
  },
  tenantUnit: {
    fontSize: '0.75rem',
    color: '#2563eb',
    fontWeight: 500
  },
  tenantDetailsHeader: {
    marginBottom: '1rem'
  },
  tenantNameLarge: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 1rem 0',
    color: '#1f2937'
  },
  tenantDetailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem'
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem'
  },
  value: {
    fontSize: '0.95rem',
    fontWeight: 500,
    color: '#1f2937'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem'
  },
  statCard: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
    border: '2px solid #e5e7eb',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    textAlign: 'center'
  },
  statLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 700
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem'
  },
  select: {
    width: '100%',
    padding: '0.75rem',
    border: '1.5px solid #e5e7eb',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit'
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '0.75rem'
  },
  badge: {
    display: 'inline-block',
    padding: '0.375rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  emptyState: {
    textAlign: 'center',
    padding: '2rem',
    color: '#6b7280'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    color: '#6b7280'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '1rem'
  },
  printRowBtn: {
    padding: '0.3rem 0.7rem',
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    color: '#fff',
    border: 'none',
    borderRadius: '0.4rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  receiptLinkBtn: {
    display: 'inline-block',
    padding: '0.32rem 0.6rem',
    borderRadius: '0.4rem',
    background: '#dbeafe',
    color: '#1e40af',
    textDecoration: 'none',
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  noReceiptText: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  pendingReceiptText: {
    fontSize: '0.75rem',
    color: '#b45309',
    fontWeight: 600,
    whiteSpace: 'nowrap'
  }
};

export default PaymentHistoryPerTenant;

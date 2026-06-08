import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, paymentService } from '../services/api';
import { useToast } from '../context/ToastContext';

const getCurrentPeriodRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
};

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const ExportCenter = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [exportingIncome, setExportingIncome] = useState(false);

  const exportIncomePdf = async () => {
    setExportingIncome(true);
    try {
      const range = getCurrentPeriodRange();
      const response = await paymentService.exportIncomeReportPDF({ from: range.start, to: range.end });
      downloadBlob(response.data, `income-report-${range.start}-to-${range.end}.pdf`);
      showToast('Income report PDF downloaded.', 'success');
    } catch (error) {
      showToast(getReadableApiError(error, 'Failed to export income PDF.'), 'error');
    } finally {
      setExportingIncome(false);
    }
  };

  const cards = [
    {
      title: 'Monthly Rent Sheet',
      text: 'Export current rent collection sheets as Excel/CSV or PDF from the rent sheet screen.',
      action: 'Open rent sheet',
      path: '/monthly-rent-sheet'
    },
    {
      title: 'Tenant Payment History',
      text: 'Download tenant-by-tenant payment history as CSV or PDF.',
      action: 'Open payment history',
      path: '/payment-history'
    },
    {
      title: 'Building Performance',
      text: 'Open a building detail page and export that building payment history.',
      action: 'Open buildings',
      path: '/buildings'
    },
    {
      title: 'Reports Center',
      text: 'Use analytics filters and detailed report views for management reporting.',
      action: 'Open reports',
      path: '/reports'
    }
  ];

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Export Center</div>
          <h1 style={styles.title}>Reports and downloads</h1>
          <p style={styles.subtitle}>A single launch point for receipts, ledgers, rent sheets, income reports, and building performance exports.</p>
        </div>
        <button type="button" style={styles.primaryButton} onClick={exportIncomePdf} disabled={exportingIncome}>
          {exportingIncome ? 'Exporting...' : 'Download Monthly Income PDF'}
        </button>
      </section>

      <section style={styles.grid}>
        {cards.map((card) => (
          <article key={card.title} style={styles.card}>
            <h2 style={styles.cardTitle}>{card.title}</h2>
            <p style={styles.cardText}>{card.text}</p>
            <button type="button" style={styles.secondaryButton} onClick={() => navigate(card.path)}>
              {card.action}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
};

const styles = {
  page: {
    minHeight: '100%',
    padding: '8px 4px 24px',
    background: '#f6f8fc'
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '18px',
    flexWrap: 'wrap',
    padding: '22px',
    borderRadius: '16px',
    background: '#ffffff',
    border: '1px solid #dbe4f0',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)',
    marginBottom: '18px'
  },
  eyebrow: {
    color: '#2563eb',
    fontSize: '12px',
    fontWeight: 900,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '8px'
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: 'clamp(1.55rem, 4vw, 2.35rem)',
    lineHeight: 1.12
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#475569',
    maxWidth: '720px',
    lineHeight: 1.55
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '14px'
  },
  card: {
    border: '1px solid #dbe4f0',
    borderRadius: '14px',
    background: '#ffffff',
    padding: '18px',
    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)'
  },
  cardTitle: {
    margin: '0 0 8px',
    color: '#172554',
    fontSize: '18px'
  },
  cardText: {
    margin: '0 0 15px',
    color: '#64748b',
    lineHeight: 1.5,
    fontSize: '14px'
  },
  primaryButton: {
    minHeight: '42px',
    border: 'none',
    borderRadius: '9px',
    background: '#2563eb',
    color: '#ffffff',
    padding: '0 16px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  secondaryButton: {
    minHeight: '40px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#ffffff',
    color: '#1e293b',
    padding: '0 14px',
    fontWeight: 800,
    cursor: 'pointer'
  }
};

export default ExportCenter;

import React from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const formatCurrency = (value) =>
  `${parseFloat(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatPeriod = (period) => {
  if (!period) return '-';
  const [year, month] = period.split('-');
  return new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long'
  });
};

const formatPaymentMethod = (method) => {
  const labels = {
    cash: 'Cash',
    check: 'Check',
    bank_transfer: 'Bank Transfer',
    mobile_money: 'Mobile Money',
    other: 'Other'
  };
  return labels[method] || method || 'Cash';
};

const RECEIPT_WATERMARK_SRC = '/samm.svg';

const waitForImages = async (root) => {
  const images = Array.from(root?.querySelectorAll?.('img') || []);
  await Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth !== 0) return Promise.resolve();
    return new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    });
  }));
};

const ReceiptModal = ({ payment, tenant, onClose, onReceiptPrinted }) => {
  if (!payment) return null;

  const receiptNumber = String(payment.id || '').padStart(5, '0');
  const isConfirmed = !payment.payment_status || payment.payment_status === 'confirmed';
  const verificationCode = payment.verification_code || `UB-${String(payment.id || '').replace(/-/g, '').slice(0, 10).toUpperCase() || 'VERIFY'}`;
  const isDuplicateCopy = Number(payment.receipt_print_count || 0) > 0 || Number(payment.receipt_printed || 0) === 1;

  const handlePrint = async () => {
    if (!isConfirmed) return;

    const printContent = document.getElementById('printable-receipt');
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=900,height=720');
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <base href="${window.location.origin}/">
          <title>UBUMWE SYSTEM COMPANY</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body {
              margin: 0;
              padding: 24px;
              background: #ffffff;
              color: #0f172a;
              font-family: Arial, sans-serif;
            }
          </style>
        </head>
        <body>${printContent.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    await waitForImages(printWindow.document);
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 150);

    if (onReceiptPrinted) {
      await onReceiptPrinted();
    }
  };

  const handleDownloadPdf = async () => {
    if (!isConfirmed) return;

    const receipt = document.getElementById('printable-receipt');
    if (!receipt) return;

    await waitForImages(receipt);

    const canvas = await html2canvas(receipt, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);

    const renderWidth = imgWidth * ratio;
    const renderHeight = imgHeight * ratio;

    const x = (pageWidth - renderWidth) / 2;
    const y = margin;

    pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
    const safeName = (payment.tenant_name || tenant?.full_name || 'tenant')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/gi, '')
      .toLowerCase();
    pdf.save(`receipt-${safeName}-${receiptNumber}.pdf`);

    if (onReceiptPrinted) {
      await onReceiptPrinted();
    }
  };

  const tenantName = payment.tenant_name || tenant?.full_name || '-';
  const tenantPhone = payment.tenant_phone || tenant?.phone || '-';
  const unitNumber = payment.unit_number || tenant?.unit_number || '-';
  const buildingName = payment.building_name || tenant?.building_name || '-';
  const paymentStatus = payment.payment_status === 'confirmed' || !payment.payment_status ? 'CONFIRMED' : 'PENDING';

  return (
    <>
      {/* Print styles injected into head when modal is open */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-receipt, #printable-receipt * { visibility: visible !important; }
          #printable-receipt {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 2rem !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Overlay */}
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.modalOuter} onClick={(e) => e.stopPropagation()}>
          {/* Action Buttons */}
          <div style={styles.actions}>
            <button style={{ ...styles.pdfBtn, ...(!isConfirmed ? styles.disabledActionBtn : {}) }} onClick={handleDownloadPdf} disabled={!isConfirmed}>
              Download PDF
            </button>
            <button style={{ ...styles.printBtn, ...(!isConfirmed ? styles.disabledActionBtn : {}) }} onClick={handlePrint} disabled={!isConfirmed}>
              Print Receipt
            </button>
            <button style={styles.closeBtn} onClick={onClose}>
              Close
            </button>
          </div>

          {!isConfirmed && (
            <div style={styles.blockedMessage}>
              Receipt printing is blocked. Confirm this payment first, then print the receipt.
            </div>
          )}

          {/* The actual receipt */}
          <div id="printable-receipt" style={styles.receipt}>
            <img src={RECEIPT_WATERMARK_SRC} alt="" aria-hidden="true" style={styles.watermarkLogo} />
            {/* Header */}
            <div style={styles.receiptHeader}>
              <img src={RECEIPT_WATERMARK_SRC} alt="UBUMWE SYSTEM COMPANY" style={styles.companyLogo} />
              <div style={styles.companyInfo}>
                <div style={styles.companyName}>UBUMWE<br />SYSTEM<br />COMPANY</div>
                <div style={styles.companySubtitle}>UBUMWE HOUSE LTD / IHURIRO HOUSE LTD</div>
              </div>
              <div style={styles.receiptMeta}>
                {isDuplicateCopy ? <div style={styles.receiptCopy}>Duplicate Copy</div> : null}
                <div style={styles.receiptNumber}>Receipt #{receiptNumber}</div>
                <div style={styles.receiptDate}>Issued: {formatDate(new Date().toISOString())}</div>
                <div style={styles.receiptDate}>Verify: {verificationCode}</div>
              </div>
            </div>

            <div style={styles.receiptTitle}>OFFICIAL PAYMENT RECEIPT</div>

            <div style={styles.divider} />

            {/* Tenant & Unit info */}
            <div style={styles.section}>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Received From</span>
                  <span style={styles.infoValue}>{tenantName}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Unit / Room</span>
                  <span style={styles.infoValue}>{unitNumber !== '-' ? `Room ${unitNumber}` : '-'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Phone</span>
                  <span style={styles.infoValue}>{tenantPhone}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Building</span>
                  <span style={styles.infoValue}>{buildingName}</span>
                </div>
              </div>
            </div>

            <div style={styles.divider} />

            {/* Payment details */}
            <div style={styles.section}>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Payment Date</span>
                  <span style={styles.infoValue}>{formatDate(payment.payment_date)}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Payment Method</span>
                  <span style={styles.infoValue}>{formatPaymentMethod(payment.payment_method)}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Payment Period</span>
                  <span style={styles.infoValue}>{formatPeriod(payment.payment_period)}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Verification Code</span>
                  <span style={styles.infoValue}>{verificationCode}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Status</span>
                  <span style={{
                    ...styles.infoValue,
                    color: payment.payment_status === 'confirmed' || !payment.payment_status ? '#16a34a' : '#d97706',
                    fontWeight: 700
                  }}>
                    {paymentStatus}
                  </span>
                </div>
                {payment.notes && (
                  <div style={{ ...styles.infoItem, gridColumn: '1 / -1' }}>
                    <span style={styles.infoLabel}>Notes</span>
                    <span style={styles.infoValue}>{payment.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={styles.divider} />

            {/* Amount box */}
            <div style={styles.amountBox}>
              <div style={styles.amountLabel}>TOTAL AMOUNT PAID</div>
              <div style={styles.amountValue}>{formatCurrency(payment.amount)}</div>
              <div style={styles.paidStamp}><span style={styles.paidIcon}>✓</span> PAID</div>
            </div>

            <div style={styles.divider} />

            {/* Signature area */}
            <div style={styles.signatureArea}>
              <div style={styles.signatureBlock}>
                <div style={styles.signatureLine}></div>
                <div style={styles.signatureLabel}>Tenant Signature</div>
              </div>
              <div style={styles.signatureBlock}>
                <div style={styles.signatureLine}></div>
                <div style={styles.signatureLabel}>Authorized by UBUMWE SYSTEM COMPANY</div>
              </div>
            </div>

            {/* Footer */}
            <div style={styles.receiptFooter}>
              <div>Thank you for your payment. Please keep this receipt for your records.</div>
              <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: '#9ca3af' }}>
                Generated on {new Date().toLocaleString()}
              </div>
              <div style={styles.receiptFinePrint}>
                Company contact: UBUMWE HOUSE LTD / IHURIRO HOUSE LTD. Verify this receipt using code {verificationCode}.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    overflowY: 'auto'
  },
  modalOuter: {
    background: '#f3f4f6',
    borderRadius: '1rem',
    padding: '1.5rem',
    maxWidth: '640px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1rem',
    justifyContent: 'flex-end'
  },
  pdfBtn: {
    padding: '0.6rem 1.2rem',
    background: 'linear-gradient(135deg, #0f766e, #0d9488)',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(13,148,136,0.3)'
  },
  printBtn: {
    padding: '0.6rem 1.5rem',
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
  },
  closeBtn: {
    padding: '0.6rem 1.2rem',
    background: '#e5e7eb',
    color: '#374151',
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer'
  },
  disabledActionBtn: {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  blockedMessage: {
    marginBottom: '0.8rem',
    padding: '0.62rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #fcd34d',
    backgroundColor: '#fffbeb',
    color: '#92400e',
    fontSize: '0.86rem',
    fontWeight: 700
  },
  receipt: {
    position: 'relative',
    width: '540px',
    maxWidth: '100%',
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: '0.75rem',
    padding: '2rem 2rem 1.55rem',
    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact'
  },
  watermarkLogo: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '330px',
    height: '330px',
    objectFit: 'contain',
    opacity: 0.08,
    pointerEvents: 'none',
    zIndex: 0
  },
  receiptHeader: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.9rem',
    marginBottom: '1.1rem'
  },
  companyLogo: {
    width: '60px',
    height: '60px',
    objectFit: 'contain',
    flexShrink: 0
  },
  companyInfo: {
    flex: 1
  },
  companyName: {
    fontSize: '1.18rem',
    fontWeight: 800,
    color: '#1e3a5f',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    lineHeight: 1.25
  },
  companySubtitle: {
    fontSize: '0.78rem',
    color: '#6b7280',
    marginTop: '0.5rem',
    lineHeight: 1.35,
    textTransform: 'uppercase'
  },
  receiptMeta: {
    textAlign: 'right',
    maxWidth: '230px'
  },
  receiptCopy: {
    display: 'inline-flex',
    justifyContent: 'center',
    padding: '0.24rem 0.58rem',
    marginBottom: '0.34rem',
    borderRadius: '999px',
    border: '1px solid #bfdbfe',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '0.66rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em'
  },
  receiptNumber: {
    fontSize: '0.84rem',
    fontWeight: 800,
    color: '#1d4ed8',
    overflowWrap: 'anywhere'
  },
  receiptDate: {
    fontSize: '0.74rem',
    color: '#6b7280',
    marginTop: '0.22rem'
  },
  receiptTitle: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '0.28em',
    color: '#374151',
    textTransform: 'uppercase',
    margin: '0.95rem 0 0.85rem'
  },
  receiptStatusStrip: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '0.75rem'
  },
  statusPill: {
    padding: '0.28rem 0.62rem',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    backgroundColor: '#f9fafb',
    color: '#374151',
    fontSize: '0.64rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em'
  },
  divider: {
    position: 'relative',
    zIndex: 1,
    borderTop: '1px dashed #d1d5db',
    margin: '0.68rem 0'
  },
  section: {
    marginBottom: '0.2rem',
    position: 'relative',
    zIndex: 1
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '1.8rem',
    rowGap: '0.78rem'
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.14rem'
  },
  infoLabel: {
    fontSize: '0.66rem',
    fontWeight: 800,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    lineHeight: 1.15
  },
  infoValue: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: '#111827',
    lineHeight: 1.32
  },
  amountBox: {
    position: 'relative',
    zIndex: 1,
    background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
    border: '2px solid #86efac',
    borderRadius: '0.75rem',
    padding: '1.25rem 1rem',
    textAlign: 'center',
    margin: '0.65rem 0'
  },
  amountLabel: {
    fontSize: '0.7rem',
    fontWeight: 800,
    color: '#16a34a',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '0.35rem'
  },
  amountValue: {
    fontSize: '2.05rem',
    fontWeight: 900,
    color: '#15803d'
  },
  amountWords: {
    marginTop: '0.32rem',
    color: '#166534',
    fontSize: '0.78rem',
    fontWeight: 700
  },
  paidStamp: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.42rem',
    marginTop: '0.55rem',
    padding: 0,
    border: 'none',
    borderRadius: 0,
    fontSize: '0.95rem',
    fontWeight: 900,
    color: '#16a34a',
    letterSpacing: '0.22em'
  },
  paidIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    fontSize: '0.76rem',
    letterSpacing: 0,
    lineHeight: 1
  },
  summaryGrid: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.55rem',
    marginTop: '0.65rem'
  },
  summaryItem: {
    border: '1px solid #e5e7eb',
    borderRadius: '0.6rem',
    padding: '0.58rem',
    backgroundColor: 'rgba(249, 250, 251, 0.86)'
  },
  summaryLabel: {
    display: 'block',
    color: '#9ca3af',
    fontSize: '0.61rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.2rem'
  },
  summaryValue: {
    color: '#111827',
    fontSize: '0.78rem',
    fontWeight: 800
  },
  signatureArea: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    gap: '3rem',
    justifyContent: 'space-around',
    padding: '0.35rem 0'
  },
  signatureBlock: {
    flex: 1,
    textAlign: 'center'
  },
  signatureLine: {
    borderBottom: '1.5px solid #374151',
    height: '2.15rem',
    marginBottom: '0.35rem'
  },
  signatureLabel: {
    fontSize: '0.68rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  receiptFooter: {
    position: 'relative',
    zIndex: 1,
    marginTop: '0.65rem',
    textAlign: 'center',
    fontSize: '0.74rem',
    color: '#6b7280',
    borderTop: '1px solid #f3f4f6',
    paddingTop: '0.68rem'
  },
  receiptFinePrint: {
    marginTop: '0.25rem',
    fontSize: '0.68rem',
    color: '#9ca3af'
  }
};

export default ReceiptModal;

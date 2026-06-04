import React, { useContext, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildingService, paymentService, tenantService, unitService } from '../services/api';
import { useDataSync } from '../context/DataSyncContext';
import useFeedbackToast from '../hooks/useFeedbackToast';
import { ThemeContext } from '../components/Layout';

const formatCurrency = (value) => `${parseFloat(value || 0).toLocaleString()} RWF`;
const idsEqual = (first, second) => String(first || '') === String(second || '');
const escapeCsvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const getSafeFileName = (value) => String(value || 'rent-sheet')
  .trim()
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();
const getTenantRentForPeriod = (tenant, period) => {
  const history = Array.isArray(tenant.rent_history) ? tenant.rent_history : [];
  const matchingRecord = history
    .filter((record) => record.start_period <= period && (!record.end_period || record.end_period >= period))
    .sort((first, second) => second.start_period.localeCompare(first.start_period))[0];

  return parseFloat(matchingRecord?.amount || tenant.monthly_rent || 0);
};
const rowSorter = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const getFloorSortValue = (floor = '') => {
  const normalized = String(floor || '').toUpperCase();
  const unitPrefix = normalized.split(/\s+/)[0];
  if (normalized === 'GROUND FLOOR' || unitPrefix === 'GF') return 0;
  if (normalized === '1ST FLOOR' || unitPrefix === '1F') return 1;
  if (normalized === '2ND FLOOR' || unitPrefix === '2F') return 2;
  if (normalized === '3RD FLOOR' || unitPrefix === '3F') return 3;
  if (normalized === 'CONT' || unitPrefix === 'CONT') return 900;
  return 500;
};

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const getDarkRentSheetStyles = (base) => ({
  ...base,
  successText: '#86efac',
  warningText: '#fde68a',
  dangerText: '#fca5a5',
  container: {
    ...base.container,
    color: '#f8fbff'
  },
  searchInput: {
    ...base.searchInput,
    backgroundColor: '#0b1627',
    color: '#f8fbff',
    border: '1px solid #33445f',
    boxShadow: '0 14px 28px rgba(0, 0, 0, 0.24)'
  },
  error: {
    ...base.error,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    color: '#fecaca',
    border: '1px solid rgba(248, 113, 113, 0.44)'
  },
  sheetCard: {
    ...base.sheetCard,
    background: 'linear-gradient(180deg, #14233a 0%, #0f1b2d 100%)',
    border: '1px solid #24344c',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.34)',
    color: '#f8fbff'
  },
  formTitle: {
    ...base.formTitle,
    color: '#f8fbff'
  },
  detailsSubtext: {
    ...base.detailsSubtext,
    color: '#c4d2e7'
  },
  yearPickerWrap: {
    ...base.yearPickerWrap,
    backgroundColor: '#0b1627',
    color: '#e4eefc',
    border: '1px solid #33445f',
    boxShadow: '0 10px 18px rgba(0, 0, 0, 0.22)'
  },
  yearInput: {
    ...base.yearInput,
    backgroundColor: '#111f34',
    color: '#f8fbff',
    border: '1px solid #33445f'
  },
  monthTabs: {
    ...base.monthTabs,
    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.16) 0%, rgba(15, 118, 110, 0.14) 100%)',
    border: '1px solid #33445f',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)'
  },
  monthTab: {
    ...base.monthTab,
    backgroundColor: '#0b1627',
    color: '#dbeafe',
    border: '1px solid #33445f',
    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.18)'
  },
  buildingSection: {
    ...base.buildingSection,
    background: 'linear-gradient(135deg, rgba(15, 27, 45, 0.98) 0%, rgba(15, 118, 110, 0.16) 100%)',
    border: '1px solid rgba(45, 212, 191, 0.28)',
    boxShadow: '0 18px 34px rgba(0, 0, 0, 0.28)'
  },
  buildingSectionTitle: {
    ...base.buildingSectionTitle,
    color: '#f8fbff'
  },
  buildingSectionText: {
    ...base.buildingSectionText,
    color: '#c4d2e7'
  },
  buildingMetaPill: {
    ...base.buildingMetaPill,
    background: 'rgba(37, 99, 235, 0.22)',
    color: '#dbeafe',
    border: '1px solid rgba(96, 165, 250, 0.44)'
  },
  buildingMetaText: {
    ...base.buildingMetaText,
    color: '#c4d2e7'
  },
  exportButton: {
    ...base.exportButton,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    color: '#dbeafe',
    border: '1px solid rgba(96, 165, 250, 0.48)'
  },
  exportPdfButton: {
    ...base.exportPdfButton,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    color: '#bbf7d0',
    border: '1px solid rgba(52, 211, 153, 0.44)'
  },
  buildingButton: {
    ...base.buildingButton,
    background: 'linear-gradient(180deg, #111f34 0%, #0b1627 100%)',
    color: '#f8fbff',
    border: '1px solid #33445f',
    boxShadow: '0 14px 24px rgba(0, 0, 0, 0.24)'
  },
  buildingButtonSubtext: {
    ...base.buildingButtonSubtext,
    color: '#c4d2e7',
    opacity: 1
  },
  filterPanel: {
    ...base.filterPanel,
    background: '#111f34',
    border: '1px solid #33445f'
  },
  filterLabel: {
    ...base.filterLabel,
    color: '#c4d2e7'
  },
  filterCount: {
    ...base.filterCount,
    color: '#c4d2e7'
  },
  segmentButtonBackground: '#0b1627',
  segmentButtonColor: '#dbeafe',
  segmentButtonBorder: '#33445f',
  sheetSummaryCard: {
    ...base.sheetSummaryCard,
    background: 'linear-gradient(180deg, #111f34 0%, #0b1627 100%)',
    border: '1px solid #33445f',
    borderTop: '4px solid #14b8a6',
    boxShadow: '0 16px 28px rgba(0, 0, 0, 0.22)'
  },
  sheetSummaryLabel: {
    ...base.sheetSummaryLabel,
    color: '#c4d2e7'
  },
  sheetSummaryValue: {
    ...base.sheetSummaryValue,
    color: '#f8fbff'
  },
  sheetTableWrap: {
    ...base.sheetTableWrap,
    backgroundColor: '#0f1b2d',
    border: '1px solid #33445f',
    boxShadow: '0 18px 34px rgba(0, 0, 0, 0.28)'
  },
  table: {
    ...base.table,
    backgroundColor: '#0f1b2d'
  },
  td: {
    ...base.td,
    backgroundColor: '#0f1b2d',
    color: '#e4eefc',
    borderBottom: '1px solid #24344c'
  },
  tdPrimary: {
    ...base.tdPrimary,
    backgroundColor: '#0f1b2d',
    color: '#f8fbff',
    borderBottom: '1px solid #24344c'
  },
  stickyTenantCell: {
    ...base.stickyTenantCell,
    backgroundColor: '#0f1b2d',
    boxShadow: '10px 0 18px rgba(0, 0, 0, 0.28)'
  },
  stickyUnitCell: {
    ...base.stickyUnitCell,
    backgroundColor: '#0f1b2d',
    boxShadow: '10px 0 18px rgba(0, 0, 0, 0.22)'
  },
  stickyActionCell: {
    ...base.stickyActionCell,
    backgroundColor: '#0f1b2d',
    boxShadow: '-10px 0 18px rgba(0, 0, 0, 0.28)'
  },
  tdStrong: {
    ...base.tdStrong,
    backgroundColor: '#0f1b2d',
    borderBottom: '1px solid #24344c'
  },
  tableRowAlt: {
    backgroundColor: '#111f34'
  },
  badgePaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    color: '#bbf7d0',
    border: '1px solid rgba(52, 211, 153, 0.44)'
  },
  badgePartial: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    color: '#fde68a',
    border: '1px solid rgba(251, 191, 36, 0.44)'
  },
  badgeUnpaid: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    color: '#fecaca',
    border: '1px solid rgba(248, 113, 113, 0.44)'
  },
  emptyState: {
    ...base.emptyState,
    backgroundColor: '#111f34',
    border: '1px dashed #33445f'
  },
  emptyStateTitle: {
    ...base.emptyStateTitle,
    color: '#f8fbff'
  },
  emptyStateText: {
    ...base.emptyStateText,
    color: '#c4d2e7'
  },
  receiptDownloadButton: {
    ...base.receiptDownloadButton,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    color: '#dbeafe',
    border: '1px solid rgba(96, 165, 250, 0.48)'
  },
  receiptPrintButton: {
    ...base.receiptPrintButton,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    color: '#bbf7d0',
    border: '1px solid rgba(52, 211, 153, 0.44)'
  },
  receiptCloseButton: {
    ...base.receiptCloseButton,
    backgroundColor: '#111f34',
    color: '#e4eefc',
    border: '1px solid #33445f'
  },
  receiptCard: {
    ...base.receiptCard,
    backgroundColor: '#ffffff',
    color: '#111827',
    border: '1px solid #dbe5f4'
  },
  receiptWatermark: {
    ...base.receiptWatermark,
    opacity: 0.1
  },
  receiptTitle: {
    ...base.receiptTitle,
    color: '#374151'
  },
  receiptMeta: {
    ...base.receiptMeta,
    color: '#6b7280'
  },
  receiptSection: {
    ...base.receiptSection,
    border: 'none'
  },
  receiptRow: {
    ...base.receiptRow,
    color: '#111827',
    borderBottom: '1px solid #e5e7eb'
  }
});

const MonthlyRentSheet = () => {
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const { theme } = useContext(ThemeContext);
  const { versions } = useDataSync();
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('all');
  const [selectedSheetYear, setSelectedSheetYear] = useState(new Date().getFullYear());
  const [selectedSheetMonth, setSelectedSheetMonth] = useState(new Date().getMonth());
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedTenantPayments, setSelectedTenantPayments] = useState([]);
  const [showTenantDetails, setShowTenantDetails] = useState(false);
  const [payStatusFilter, setPayStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const exportTableRef = useRef(null);
  const tenantReceiptRef = useRef(null);
  const [tenantReceiptRow, setTenantReceiptRow] = useState(null);
  const canManageOperations = isManager();
  const isDark = theme === 'dark';
  const ui = isDark ? getDarkRentSheetStyles(styles) : styles;
  const getSegmentButtonStyle = (active, color) => ({
    ...ui.segmentButton,
    border: `2px solid ${active ? color : ui.segmentButtonBorder}`,
    background: active ? color : ui.segmentButtonBackground,
    color: active ? '#ffffff' : ui.segmentButtonColor,
    boxShadow: active ? `0 4px 12px ${color}55` : 'none'
  });
  const getSheetStatusBadgeStyle = (status) => {
    if (status === 'Fully paid') return { ...ui.badge, ...ui.badgePaid };
    if (status === 'Partially paid') return { ...ui.badge, ...ui.badgePartial };
    return { ...ui.badge, ...ui.badgeUnpaid };
  };
  useFeedbackToast(error, 'error');

  useEffect(() => {
    fetchData();
  }, [versions.tenants, versions.payments, versions.units]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [buildingsResponse, unitsResponse, tenantsResponse, paymentsResponse] = await Promise.all([
        buildingService.getAll(),
        unitService.getAll(),
        tenantService.getAll(),
        paymentService.getAll()
      ]);

      setBuildings(buildingsResponse.data || []);
      setUnits(unitsResponse.data || []);
      setTenants(tenantsResponse.data || []);
      setPayments(paymentsResponse.data || []);
    } catch (err) {
      setError('Failed to load monthly rent sheet data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTenant = async (tenant) => {
    try {
      const [tenantResponse, paymentsResponse] = await Promise.all([
        tenantService.getById(tenant.id),
        paymentService.getByTenant(tenant.id)
      ]);

      setSelectedTenant(tenantResponse.data);
      setSelectedTenantPayments(paymentsResponse.data || []);
      setShowTenantDetails(true);
    } catch (err) {
      setError('Failed to load tenant details');
    }
  };

  const handleRecordPayment = (row) => {
    navigate('/payments', {
      state: {
        recordPaymentFor: {
          tenantId: row.tenant.id,
          unitId: row.tenant.unit_id,
          amount: row.balance > 0 ? row.balance : row.monthlyRent,
          period: selectedSheetPeriod,
          notes: `Rent payment for ${MONTH_LABELS[selectedSheetMonth]} ${selectedSheetYear}`
        }
      }
    });
  };

  const selectedSheetPeriod = `${selectedSheetYear}-${String(selectedSheetMonth + 1).padStart(2, '0')}`;
  const normalizedSearch = tenantSearch.trim().toLowerCase();

  const resolveTenantBuildingId = (tenant) => {
    if (tenant?.building_id) return tenant.building_id;

    const matchedUnitById = units.find((unit) => idsEqual(unit.id, tenant?.unit_id));
    if (matchedUnitById?.building_id) return matchedUnitById.building_id;

    const normalizedTenantUnit = String(tenant?.unit_number || '').trim().toLowerCase();
    if (normalizedTenantUnit) {
      const matchedUnitByNumber = units.find((unit) => String(unit.unit_number || '').trim().toLowerCase() === normalizedTenantUnit);
      if (matchedUnitByNumber?.building_id) return matchedUnitByNumber.building_id;
    }

    const normalizedBuildingName = String(tenant?.building_name || '').trim().toLowerCase();
    if (normalizedBuildingName) {
      const matchedBuilding = buildings.find((building) => String(building.name || '').trim().toLowerCase() === normalizedBuildingName);
      if (matchedBuilding?.id) return matchedBuilding.id;
    }

    return '';
  };

  const selectedBuilding = selectedBuildingId === 'all'
    ? null
    : buildings.find((building) => idsEqual(building.id, selectedBuildingId)) || null;

  const filteredTenants = tenants.filter((tenant) => {
    const resolvedBuildingId = resolveTenantBuildingId(tenant);
    const matchesBuilding = selectedBuildingId === 'all'
      ? true
      : String(resolvedBuildingId || '') === selectedBuildingId;

    if (!matchesBuilding) return false;
    if (!normalizedSearch) return true;

    return [
      tenant.full_name,
      tenant.email,
      tenant.phone,
      tenant.unit_number,
      tenant.building_name,
      tenant.national_id
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
  });

  const monthlySheetRows = filteredTenants.map((tenant) => {
    const monthlyPayments = payments.filter((payment) => {
      const period = payment.payment_period || payment.payment_date?.slice(0, 7);
      return idsEqual(payment.tenant_id, tenant.id) && period === selectedSheetPeriod;
    });

    const confirmedPaid = monthlyPayments
      .filter((payment) => payment.payment_status !== 'pending')
      .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);

    const pendingAmount = monthlyPayments
      .filter((payment) => payment.payment_status === 'pending')
      .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);

    const totalSubmitted = confirmedPaid + pendingAmount;
    const monthlyRent = getTenantRentForPeriod(tenant, selectedSheetPeriod);
    const balance = Math.max(monthlyRent - confirmedPaid, 0);
    const lastPaymentDate = monthlyPayments.length > 0
      ? monthlyPayments.map((payment) => payment.payment_date).sort().reverse()[0]
      : null;

    let status = 'Not paid';
    if (confirmedPaid >= monthlyRent && monthlyRent > 0) status = 'Fully paid';
    else if (confirmedPaid > 0 || pendingAmount > 0) status = 'Partially paid';

    return {
      tenant,
      confirmedPaid,
      pendingAmount,
      totalSubmitted,
      monthlyRent,
      balance,
      lastPaymentDate,
      status
    };
  }).filter((row) => {
    if (payStatusFilter === 'paid') return row.status === 'Fully paid';
    if (payStatusFilter === 'unpaid') return row.status !== 'Fully paid';
    return true;
  }).filter((row) => {
    if (floorFilter === 'all') return true;
    const rowFloor = String(row.tenant.floor || '').trim().toUpperCase();
    return rowFloor === floorFilter;
  }).sort((firstRow, secondRow) => {
    const buildingComparison = String(firstRow.tenant.building_name || '').localeCompare(String(secondRow.tenant.building_name || ''));
    if (buildingComparison) return buildingComparison;

    const floorDifference = getFloorSortValue(firstRow.tenant.floor || firstRow.tenant.unit_number) - getFloorSortValue(secondRow.tenant.floor || secondRow.tenant.unit_number);
    if (floorDifference) return floorDifference;

    return rowSorter.compare(firstRow.tenant.unit_number || '', secondRow.tenant.unit_number || '');
  });

  const monthlyTotals = monthlySheetRows.reduce((acc, row) => ({
    rent: acc.rent + row.monthlyRent,
    confirmed: acc.confirmed + row.confirmedPaid,
    pending: acc.pending + row.pendingAmount,
      balance: acc.balance + row.balance
  }), { rent: 0, confirmed: 0, pending: 0, balance: 0 });

  const buildingTenantCount = monthlySheetRows.length;

  const handleExportSheet = () => {
    if (monthlySheetRows.length === 0) {
      setError('There are no rent sheet rows to export for the current selection.');
      return;
    }

    const csvRows = [
      [
        'Building',
        'Period',
        'Tenant',
        'Unit',
        'Monthly Rent',
        'Confirmed Paid',
        'Pending',
        'Total Submitted',
        'Balance',
        'Last Payment Date',
        'Sheet Status'
      ],
      ...monthlySheetRows.map((row) => [
        selectedBuilding?.name || row.tenant.building_name || 'Unassigned Building',
        `${MONTH_LABELS[selectedSheetMonth]} ${selectedSheetYear}`,
        row.tenant.full_name || '-',
        row.tenant.unit_number || '-',
        formatCurrency(row.monthlyRent),
        formatCurrency(row.confirmedPaid),
        formatCurrency(row.pendingAmount),
        formatCurrency(row.totalSubmitted),
        formatCurrency(row.balance),
        row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString() : '-',
        row.status
      ])
    ];

    const csvContent = `\uFEFF${csvRows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeBuildingName = getSafeFileName(selectedBuilding?.name || 'all-buildings');

    link.href = url;
    link.download = `${safeBuildingName || 'rent-sheet'}-${selectedSheetPeriod}-rent-sheet.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setError('');
  };

  const handleExportPdf = async () => {
    if (monthlySheetRows.length === 0) {
      setError('There are no rent sheet rows to export for the current selection.');
      return;
    }

    const exportNode = exportTableRef.current;
    if (!exportNode) {
      setError('The PDF export table could not be prepared.');
      return;
    }

    try {
      const canvas = await html2canvas(exportNode, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: exportNode.scrollWidth,
        height: exportNode.scrollHeight,
        windowWidth: exportNode.scrollWidth,
        logging: false
      });

      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageCanvasHeight = Math.floor((usableHeight * canvas.width) / usableWidth);

      let renderedHeight = 0;
      let pageIndex = 0;

      while (renderedHeight < canvas.height) {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(pageCanvasHeight, canvas.height - renderedHeight);

        const sliceContext = sliceCanvas.getContext('2d');
        sliceContext.drawImage(
          canvas,
          0,
          renderedHeight,
          canvas.width,
          sliceCanvas.height,
          0,
          0,
          canvas.width,
          sliceCanvas.height
        );

        const sliceImgData = sliceCanvas.toDataURL('image/png', 1.0);
        const sliceHeightMm = (sliceCanvas.height * imgWidth) / canvas.width;

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(sliceImgData, 'PNG', margin, margin, imgWidth, sliceHeightMm);
        renderedHeight += sliceCanvas.height;
        pageIndex += 1;
      }

      pdf.save(`${getSafeFileName(selectedBuilding?.name || 'all-buildings')}-${selectedSheetPeriod}-rent-sheet.pdf`);
      setError('');
    } catch (exportError) {
      setError('Failed to export PDF rent sheet.');
    }
  };

  const handleDownloadTenantReceiptPdf = async () => {
    if (!tenantReceiptRow || !tenantReceiptRef.current) {
      setError('The tenant receipt is not ready yet.');
      return;
    }

    try {
      const receiptImages = Array.from(tenantReceiptRef.current.querySelectorAll('img') || []);
      await Promise.all(receiptImages.map((image) => (
        image.complete && image.naturalWidth !== 0
          ? Promise.resolve()
          : new Promise((resolve) => {
            image.onload = resolve;
            image.onerror = resolve;
          })
      )));

      const canvas = await html2canvas(tenantReceiptRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const renderWidth = Math.min(usableWidth, 125);
      const imageHeight = (canvas.height * renderWidth) / canvas.width;
      const x = (pageWidth - renderWidth) / 2;
      const imageData = canvas.toDataURL('image/png', 1.0);

      pdf.addImage(imageData, 'PNG', x, margin, renderWidth, imageHeight);
      pdf.save(`${getSafeFileName(tenantReceiptRow.tenant.full_name)}-${selectedSheetPeriod}-tenant-receipt.pdf`);
      setError('');
    } catch (receiptError) {
      setError('Failed to generate tenant receipt PDF.');
    }
  };

  const handlePrintTenantReceipt = () => {
    if (!tenantReceiptRow || !tenantReceiptRef.current) {
      setError('The tenant receipt is not ready yet.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=720');
    if (!printWindow) {
      setError('Allow pop-ups to print tenant receipt.');
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <base href="${window.location.origin}/">
          <title>Tenant Receipt</title>
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
        <body>${tenantReceiptRef.current.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    const printImages = Array.from(printWindow.document.images || []);
    Promise.all(printImages.map((image) => (
      image.complete && image.naturalWidth !== 0
        ? Promise.resolve()
        : new Promise((resolve) => {
          image.onload = resolve;
          image.onerror = resolve;
        })
    ))).then(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    });
    setError('');
  };

  if (loading) return <div style={ui.loading}>Loading...</div>;

  return (
    <div className="rent-sheet-page-shell" style={ui.container}>
      <div style={ui.header}>
        <div>
          <h1 style={ui.title}>Rent Collection Sheet</h1>
          <p style={ui.subtitle}>Dedicated monthly collection page, separate from tenant list.</p>
        </div>
        <div style={ui.headerActions}>
          <input
            type="text"
            value={tenantSearch}
            onChange={(event) => setTenantSearch(event.target.value)}
            placeholder="Search tenant by name, phone, unit, or building"
            style={ui.searchInput}
          />
          <button
            type="button"
            style={ui.btnSecondary}
            onClick={() => navigate(canManageOperations ? '/tenants' : '/payments')}
          >
            {canManageOperations ? 'Back to Tenants' : 'Back to Payments'}
          </button>
        </div>
      </div>

      {error && <div style={ui.error}>{error}</div>}

      <div style={ui.sheetCard}>
        <div style={ui.sheetHeader}>
          <div>
            <h2 style={ui.formTitle}>Rent Collection Sheet</h2>
            <p style={ui.detailsSubtext}>
              Excel-style collection sheet for <strong>{MONTH_LABELS[selectedSheetMonth]} {selectedSheetYear}</strong>
            </p>
          </div>
          <div style={ui.yearPickerWrap}>
            <label htmlFor="sheetYear">Year</label>
            <input
              id="sheetYear"
              type="number"
              value={selectedSheetYear}
              min="2020"
              max="2100"
              onChange={(event) => setSelectedSheetYear(Number(event.target.value) || new Date().getFullYear())}
              style={ui.yearInput}
            />
          </div>
        </div>

        <div style={ui.monthTabs}>
          {MONTH_LABELS.map((month, index) => (
            <button
              key={month}
              type="button"
              style={{
                ...ui.monthTab,
                ...(selectedSheetMonth === index ? ui.monthTabActive : {})
              }}
              onClick={() => setSelectedSheetMonth(index)}
            >
              {month}
            </button>
          ))}
        </div>

        <div style={ui.buildingSection}>
          <div style={ui.buildingSectionHeader}>
            <div>
              <h3 style={ui.buildingSectionTitle}>Choose Building</h3>
              <p style={ui.buildingSectionText}>
                Click a building to view only the tenants and rent sheet rows for that property.
              </p>
            </div>
            <div style={ui.buildingMeta}>
              <span style={ui.buildingMetaPill}>
                {selectedBuilding ? selectedBuilding.name : 'All buildings'}
              </span>
              <span style={ui.buildingMetaText}>
                {buildingTenantCount} tenant{buildingTenantCount === 1 ? '' : 's'} shown
              </span>
              <button
                type="button"
                style={{
                  ...ui.exportButton,
                  ...(monthlySheetRows.length === 0 ? ui.exportButtonDisabled : {})
                }}
                onClick={handleExportSheet}
                disabled={monthlySheetRows.length === 0}
              >
                Export Excel Sheet
              </button>
              <button
                type="button"
                style={{
                  ...ui.exportPdfButton,
                  ...(monthlySheetRows.length === 0 ? ui.exportButtonDisabled : {})
                }}
                onClick={handleExportPdf}
                disabled={monthlySheetRows.length === 0}
              >
                Export PDF
              </button>
            </div>
          </div>

          <div style={ui.buildingButtons}>
            <button
              type="button"
              style={{
                ...ui.buildingButton,
                ...(selectedBuildingId === 'all' ? ui.buildingButtonActive : {})
              }}
              onClick={() => { setSelectedBuildingId('all'); setFloorFilter('all'); }}
            >
              <span style={ui.buildingButtonTitle}>All Buildings</span>
              <span style={ui.buildingButtonSubtext}>Show every tenant in the selected month</span>
            </button>

            {buildings.map((building) => {
              const tenantCount = tenants.filter((tenant) => resolveTenantBuildingId(tenant) === building.id).length;

              return (
                <button
                  key={building.id}
                  type="button"
                  style={{
                    ...ui.buildingButton,
                    ...(selectedBuildingId === building.id ? ui.buildingButtonActive : {})
                  }}
                  onClick={() => { setSelectedBuildingId(building.id); setFloorFilter('all'); }}
                >
                  <span style={ui.buildingButtonTitle}>{building.name}</span>
                  <span style={ui.buildingButtonSubtext}>
                    {building.city || 'Kigali'} • {tenantCount} tenant{tenantCount === 1 ? '' : 's'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={ui.filterPanel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={ui.filterLabel}>Payment:</span>
            {[
              { key: 'all', label: 'All Tenants', color: '#2563eb' },
              { key: 'paid', label: '✓ Paid', color: '#047857' },
              { key: 'unpaid', label: '✗ Unpaid / Partial', color: '#b91c1c' }
            ].map(({ key, label, color }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPayStatusFilter(key)}
                style={getSegmentButtonStyle(payStatusFilter === key, color)}
              >
                {label}
              </button>
            ))}
          </div>
          {(() => {
            const allFloors = [...new Set(
              filteredTenants
                .map((t) => String(t.floor || '').trim().toUpperCase())
                .filter(Boolean)
            )].sort((a, b) => getFloorSortValue(a) - getFloorSortValue(b));
            if (allFloors.length === 0) return null;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={ui.filterLabel}>Floor:</span>
                <button
                  type="button"
                  onClick={() => setFloorFilter('all')}
                  style={getSegmentButtonStyle(floorFilter === 'all', '#7c3aed')}
                >
                  All Floors
                </button>
                {allFloors.map((floor) => (
                  <button
                    key={floor}
                    type="button"
                    onClick={() => setFloorFilter(floor)}
                    style={getSegmentButtonStyle(floorFilter === floor, '#7c3aed')}
                  >
                    {floor.charAt(0) + floor.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            );
          })()}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={ui.filterCount}>
              {monthlySheetRows.length} tenant{monthlySheetRows.length === 1 ? '' : 's'} shown
            </span>
          </div>
        </div>

        <div style={ui.sheetSummaryGrid}>
          <div style={ui.sheetSummaryCard}>
            <div style={ui.sheetSummaryLabel}>Total Rent</div>
            <div style={ui.sheetSummaryValue}>{formatCurrency(monthlyTotals.rent)}</div>
          </div>
          <div style={ui.sheetSummaryCard}>
            <div style={ui.sheetSummaryLabel}>Confirmed Collected</div>
            <div style={{ ...ui.sheetSummaryValue, color: ui.successText }}>{formatCurrency(monthlyTotals.confirmed)}</div>
          </div>
          <div style={ui.sheetSummaryCard}>
            <div style={ui.sheetSummaryLabel}>Pending Confirmation</div>
            <div style={{ ...ui.sheetSummaryValue, color: ui.warningText }}>{formatCurrency(monthlyTotals.pending)}</div>
          </div>
          <div style={ui.sheetSummaryCard}>
            <div style={ui.sheetSummaryLabel}>Remaining Balance</div>
            <div style={{ ...ui.sheetSummaryValue, color: ui.dangerText }}>{formatCurrency(monthlyTotals.balance)}</div>
          </div>
        </div>

        <div style={ui.sheetTableWrap}>
          {monthlySheetRows.length > 0 ? (
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={{ ...ui.th, ...ui.stickyTenantHead }}>Tenant</th>
                  <th style={{ ...ui.th, ...ui.stickyUnitHead }}>Unit</th>
                  <th style={ui.th}>Monthly Rent</th>
                  <th style={ui.th}>Confirmed Paid</th>
                  <th style={ui.th}>Pending</th>
                  <th style={ui.th}>Total Submitted</th>
                  <th style={ui.th}>Balance</th>
                  <th style={ui.th}>Last Payment Date</th>
                  <th style={ui.th}>Sheet Status</th>
                  <th style={{ ...ui.th, ...ui.stickyActionHead }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {monthlySheetRows.map((row, index) => (
                  <tr key={`${row.tenant.id}-${selectedSheetPeriod}`} style={index % 2 === 1 ? ui.tableRowAlt : undefined}>
                    <td style={{ ...ui.tdPrimary, ...ui.stickyTenantCell }}>{row.tenant.full_name}</td>
                    <td style={{ ...ui.td, ...ui.stickyUnitCell }}>{row.tenant.unit_number || '-'}</td>
                    <td style={ui.td}>{formatCurrency(row.monthlyRent)}</td>
                    <td style={{ ...ui.tdStrong, color: ui.successText }}>{formatCurrency(row.confirmedPaid)}</td>
                    <td style={{ ...ui.tdStrong, color: ui.warningText }}>{formatCurrency(row.pendingAmount)}</td>
                    <td style={ui.td}>{formatCurrency(row.totalSubmitted)}</td>
                    <td style={{ ...ui.tdStrong, color: row.balance > 0 ? ui.dangerText : ui.successText }}>
                      {formatCurrency(row.balance)}
                    </td>
                    <td style={ui.td}>{row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString() : '-'}</td>
                    <td style={ui.td}>
                      <span
                        style={{
                          ...getSheetStatusBadgeStyle(row.status),
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        title="Open tenant details"
                        onClick={() => handleViewTenant(row.tenant)}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td style={{ ...ui.td, ...ui.stickyActionCell }}>
                      <div style={ui.actionButtonsWrap}>
                        <button
                          type="button"
                          style={ui.recordPaymentButton}
                          onClick={() => handleRecordPayment(row)}
                        >
                          Record Payment
                        </button>
                        <button
                          type="button"
                          style={ui.tenantReceiptButton}
                          onClick={() => setTenantReceiptRow(row)}
                        >
                          Print Tenant Receipt
                        </button>
                        <button
                          type="button"
                          style={ui.ledgerButton}
                          onClick={() => navigate(`/tenants/${row.tenant.id}/ledger`)}
                        >
                          Tenant Ledger
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={ui.emptyState}>
              <h3 style={ui.emptyStateTitle}>No tenants found for this building</h3>
              <p style={ui.emptyStateText}>
                {selectedBuilding
                  ? `No rent sheet rows matched ${selectedBuilding.name} for ${MONTH_LABELS[selectedSheetMonth]} ${selectedSheetYear}.`
                  : 'No rent sheet rows matched the current search and month filters.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {showTenantDetails && selectedTenant && (
        <div
          className="tenant-view-modal"
          style={ui.detailsOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowTenantDetails(false);
          }}
        >
          <div className="tenant-view-modal__window" role="dialog" aria-modal="true" aria-labelledby="rent-sheet-tenant-title">
            <div className="tenant-view-modal__header">
              <div>
                <h2 id="rent-sheet-tenant-title">{selectedTenant.full_name}</h2>
                <p>
                  {selectedTenant.unit_number || 'No unit assigned'} - {selectedTenant.building_name || 'No building'}
                </p>
              </div>
              <button
                type="button"
                className="tenant-view-modal__close"
                onClick={() => setShowTenantDetails(false)}
                aria-label="Close tenant details"
              >
                x
              </button>
            </div>

            <div className="tenant-view-modal__body">
              <div className="tenant-view-modal__summary">
                <div>
                  <span>Monthly Rent</span>
                  <strong>{formatCurrency(selectedTenant.monthly_rent)}</strong>
                </div>
                <div>
                  <span>Total Paid</span>
                  <strong>{formatCurrency(selectedTenant.total_paid)}</strong>
                </div>
                <div className={parseFloat(selectedTenant.balance || 0) > 0 ? 'tenant-view-modal__summary-danger' : 'tenant-view-modal__summary-success'}>
                  <span>Unpaid Balance</span>
                  <strong>{formatCurrency(selectedTenant.balance)}</strong>
                </div>
              </div>

              <div className="tenant-view-modal__section">Tenant Details</div>
              <div className="tenant-view-modal__details">
                <div><span>Email</span><strong>{selectedTenant.email || '-'}</strong></div>
                <div><span>Phone</span><strong>{selectedTenant.phone || '-'}</strong></div>
                <div><span>Status</span><strong>{selectedTenant.status || '-'}</strong></div>
                <div><span>Total Rent Required</span><strong>{formatCurrency(selectedTenant.total_owed)}</strong></div>
              </div>

              <div className="tenant-view-modal__section">Payment History</div>
              {selectedTenantPayments.length > 0 ? (
                <div className="tenant-view-modal__table-wrap">
                  <table className="tenant-view-modal__table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Balance</th>
                        <th>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTenantPayments.map((payment) => {
                        const hasBalance = parseFloat(payment.period_balance || 0) > 0;
                        return (
                          <tr key={payment.id} className={hasBalance ? 'tenant-view-modal__unpaid-row' : 'tenant-view-modal__paid-row'}>
                            <td>{payment.payment_period || '-'}</td>
                            <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                            <td>{formatCurrency(payment.amount)}</td>
                            <td className={hasBalance ? 'tenant-view-modal__unpaid-text' : 'tenant-view-modal__paid-text'}>
                              {formatCurrency(payment.period_balance)}
                            </td>
                            <td>{payment.payment_method || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="tenant-view-modal__empty">No payments recorded for this tenant</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tenantReceiptRow && (
        <div
          style={ui.receiptOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTenantReceiptRow(null);
          }}
        >
          <div style={ui.receiptModal} role="dialog" aria-modal="true" aria-labelledby="tenant-receipt-title">
            <div style={ui.receiptToolbar}>
              <button
                type="button"
                style={ui.receiptPrintButton}
                onClick={handlePrintTenantReceipt}
              >
                Print Tenant Receipt
              </button>
              <button
                type="button"
                style={ui.receiptDownloadButton}
                onClick={handleDownloadTenantReceiptPdf}
              >
                Download Receipt PDF
              </button>
              <button
                type="button"
                style={ui.receiptCloseButton}
                onClick={() => setTenantReceiptRow(null)}
              >
                Close
              </button>
            </div>

            <div ref={tenantReceiptRef} style={ui.receiptCard}>
              <img src="/samm.svg" alt="" aria-hidden="true" style={ui.receiptWatermark} />
              <div style={ui.receiptHeaderBlock}>
                <img src="/samm.svg" alt="UBUMWE SYSTEM COMPANY" style={ui.receiptLogo} />
                <div style={ui.receiptCompanyBlock}>
                  <div style={ui.receiptBrand}>UBUMWE<br />SYSTEM<br />COMPANY</div>
                  <div style={ui.receiptCompanySubtitle}>UBUMWE HOUSE LTD / IHURIRO HOUSE LTD</div>
                </div>
                <div style={ui.receiptMetaBlock}>
                  <div style={ui.receiptNumber}>Tenant Receipt #{String(tenantReceiptRow.tenant.id || '').slice(0, 8) || 'status'}</div>
                  <div style={ui.receiptMeta}>Issued: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              <h2 id="tenant-receipt-title" style={ui.receiptTitle}>TENANT RENT STATUS RECEIPT</h2>

              <div style={ui.receiptSection}>
                <div style={ui.receiptInfoItem}>
                  <span style={ui.receiptInfoLabel}>Received From</span>
                  <strong>{tenantReceiptRow.tenant.full_name || '-'}</strong>
                </div>
                <div style={ui.receiptInfoItem}>
                  <span style={ui.receiptInfoLabel}>Unit / Room</span>
                  <strong>{tenantReceiptRow.tenant.unit_number ? `Room ${tenantReceiptRow.tenant.unit_number}` : '-'}</strong>
                </div>
                <div style={ui.receiptInfoItem}>
                  <span style={ui.receiptInfoLabel}>Phone</span>
                  <strong>{tenantReceiptRow.tenant.phone || '-'}</strong>
                </div>
                <div style={ui.receiptInfoItem}>
                  <span style={ui.receiptInfoLabel}>Building</span>
                  <strong>{tenantReceiptRow.tenant.building_name || 'Unassigned Building'}</strong>
                </div>
                <div style={ui.receiptInfoItem}>
                  <span style={ui.receiptInfoLabel}>Payment Period</span>
                  <strong>{MONTH_LABELS[selectedSheetMonth]} {selectedSheetYear}</strong>
                </div>
                <div style={ui.receiptInfoItem}>
                  <span style={ui.receiptInfoLabel}>Status</span>
                  <strong style={tenantReceiptRow.status === 'Fully paid' ? ui.receiptPaidText : ui.receiptUnpaidText}>{tenantReceiptRow.status}</strong>
                </div>
              </div>

              <div style={ui.receiptAmountBox}>
                <div style={ui.receiptAmountLabel}>TOTAL AMOUNT PAID</div>
                <div style={ui.receiptAmountValue}>{formatCurrency(tenantReceiptRow.confirmedPaid)}</div>
                <div style={ui.receiptPaidStamp}>
                  {tenantReceiptRow.status === 'Fully paid' ? <span style={ui.receiptPaidIcon}>✓</span> : null}
                  {tenantReceiptRow.status === 'Fully paid' ? 'PAID' : `${formatCurrency(tenantReceiptRow.balance)} BALANCE`}
                </div>
              </div>

              <div style={ui.receiptSummaryGrid}>
                <div style={ui.receiptSummaryItem}>
                  <span style={ui.receiptInfoLabel}>Required Rent</span>
                  <strong>{formatCurrency(tenantReceiptRow.monthlyRent)}</strong>
                </div>
                <div style={ui.receiptSummaryItem}>
                  <span style={ui.receiptInfoLabel}>Pending Submitted</span>
                  <strong>{formatCurrency(tenantReceiptRow.pendingAmount)}</strong>
                </div>
                <div style={ui.receiptSummaryItem}>
                  <span style={ui.receiptInfoLabel}>Remaining Balance</span>
                  <strong>{formatCurrency(tenantReceiptRow.balance)}</strong>
                </div>
              </div>

              <div style={ui.receiptSignatureArea}>
                <div style={ui.receiptSignatureBlock}>
                  <div style={ui.receiptSignatureLine}></div>
                  <div style={ui.receiptSignatureLabel}>Tenant Signature</div>
                </div>
                <div style={ui.receiptSignatureBlock}>
                  <div style={ui.receiptSignatureLine}></div>
                  <div style={ui.receiptSignatureLabel}>Authorized by</div>
                </div>
              </div>

              <div style={ui.receiptFooter}>
                <div>Thank you for your payment. Please keep this receipt for your records.</div>
                <div style={ui.receiptFooterMuted}>Generated on {new Date().toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={styles.exportCanvasWrap}>
        <div ref={exportTableRef} style={styles.exportCanvasCard}>
          <div style={styles.exportCanvasHeader}>
            <div style={styles.exportCanvasBrand}>UBUMWE SYSTEM COMPANY</div>
            <div style={styles.exportCanvasTitle}>Rent Collection Sheet</div>
            <div style={styles.exportCanvasMetaRow}>
              <span><strong>Building:</strong> {selectedBuilding?.name || 'All Buildings'}</span>
              <span><strong>Period:</strong> {MONTH_LABELS[selectedSheetMonth]} {selectedSheetYear}</span>
              <span><strong>Generated:</strong> {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <table style={styles.exportTable}>
            <thead>
              <tr>
                <th style={styles.exportTh}>Tenant</th>
                <th style={styles.exportTh}>Unit</th>
                <th style={styles.exportTh}>Monthly Rent</th>
                <th style={styles.exportTh}>Confirmed Paid</th>
                <th style={styles.exportTh}>Pending</th>
                <th style={styles.exportTh}>Total Submitted</th>
                <th style={styles.exportTh}>Balance</th>
                <th style={styles.exportTh}>Last Payment Date</th>
                <th style={styles.exportTh}>Sheet Status</th>
              </tr>
            </thead>
            <tbody>
              {monthlySheetRows.map((row, index) => (
                <tr key={`export-${row.tenant.id}-${selectedSheetPeriod}`} style={index % 2 === 1 ? styles.exportRowAlt : undefined}>
                  <td style={styles.exportTdPrimary}>{row.tenant.full_name}</td>
                  <td style={styles.exportTd}>{row.tenant.unit_number || '-'}</td>
                  <td style={styles.exportTd}>{formatCurrency(row.monthlyRent)}</td>
                  <td style={{ ...styles.exportTdStrong, color: '#047857' }}>{formatCurrency(row.confirmedPaid)}</td>
                  <td style={{ ...styles.exportTdStrong, color: '#b45309' }}>{formatCurrency(row.pendingAmount)}</td>
                  <td style={styles.exportTd}>{formatCurrency(row.totalSubmitted)}</td>
                  <td style={{ ...styles.exportTdStrong, color: row.balance > 0 ? '#b91c1c' : '#047857' }}>{formatCurrency(row.balance)}</td>
                  <td style={styles.exportTd}>{row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString() : '-'}</td>
                  <td style={styles.exportTd}>
                    <span style={styles.exportStatus}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={styles.exportTotals}>
            <div style={styles.exportTotalCard}>
              <span style={styles.exportTotalLabel}>Total Rent</span>
              <span style={styles.exportTotalValue}>{formatCurrency(monthlyTotals.rent)}</span>
            </div>
            <div style={styles.exportTotalCard}>
              <span style={styles.exportTotalLabel}>Confirmed Collected</span>
              <span style={{ ...styles.exportTotalValue, color: '#047857' }}>{formatCurrency(monthlyTotals.confirmed)}</span>
            </div>
            <div style={styles.exportTotalCard}>
              <span style={styles.exportTotalLabel}>Pending Confirmation</span>
              <span style={{ ...styles.exportTotalValue, color: '#b45309' }}>{formatCurrency(monthlyTotals.pending)}</span>
            </div>
            <div style={styles.exportTotalCard}>
              <span style={styles.exportTotalLabel}>Remaining Balance</span>
              <span style={{ ...styles.exportTotalValue, color: '#b91c1c' }}>{formatCurrency(monthlyTotals.balance)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '1rem 0.55rem 2.5rem',
    background: 'radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 24%), linear-gradient(180deg, #f8fbff 0%, #f2f7fd 100%)',
    borderRadius: '1.25rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 56%, #0f766e 100%)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '1.15rem',
    padding: '1.5rem',
    boxShadow: '0 22px 46px rgba(15, 23, 42, 0.18)'
  },
  title: {
    fontSize: '2rem',
    fontWeight: '900',
    color: '#ffffff',
    margin: 0,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    textShadow: '0 2px 10px rgba(15, 23, 42, 0.28)'
  },
  subtitle: {
    margin: '0.35rem 0 0 0',
    color: '#dbeafe',
    fontSize: '1.02rem',
    fontWeight: '600',
    lineHeight: 1.6,
    maxWidth: '640px'
  },
  successText: '#047857',
  warningText: '#b45309',
  dangerText: '#b91c1c',
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    alignSelf: 'center'
  },
  searchInput: {
    minWidth: '340px',
    padding: '0.92rem 1.05rem',
    borderRadius: '0.95rem',
    border: '1px solid rgba(255, 255, 255, 0.28)',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    boxShadow: '0 14px 28px rgba(15, 23, 42, 0.18)',
    fontSize: '0.95rem'
  },
  btnSecondary: {
    padding: '0.9rem 1.35rem',
    background: 'rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.28)',
    borderRadius: '0.95rem',
    cursor: 'pointer',
    fontWeight: '800',
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.16)',
    fontSize: '0.92rem',
    backdropFilter: 'blur(10px)'
  },
  loading: {
    textAlign: 'center',
    padding: '2rem'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    padding: '1rem 1.1rem',
    borderRadius: '0.95rem',
    marginBottom: '1rem',
    border: '1px solid #fecaca',
    boxShadow: '0 10px 20px rgba(127, 29, 29, 0.08)'
  },
  sheetCard: {
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    padding: '1.5rem',
    borderRadius: '1.25rem',
    marginBottom: '2rem',
    boxShadow: '0 24px 48px rgba(15, 23, 42, 0.10)',
    border: '1px solid #d8e4f5'
  },
  sheetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '1.15rem',
    paddingBottom: '0.35rem'
  },
  formTitle: {
    fontSize: '1.34rem',
    fontWeight: '800',
    margin: 0,
    color: '#1f2937'
  },
  detailsSubtext: {
    margin: '0.35rem 0 0 0',
    color: '#475569',
    lineHeight: 1.6
  },
  yearPickerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#0f172a',
    fontWeight: '900',
    padding: '0.75rem 0.92rem',
    borderRadius: '0.95rem',
    backgroundColor: '#ffffff',
    border: '1px solid #dbe5f4',
    boxShadow: '0 10px 18px rgba(15, 23, 42, 0.05)'
  },
  yearInput: {
    width: '96px',
    padding: '0.58rem 0.64rem',
    borderRadius: '0.72rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontWeight: '700'
  },
  monthTabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(102px, 1fr))',
    gap: '0.55rem',
    marginBottom: '1.15rem',
    padding: '0.45rem',
    background: 'linear-gradient(135deg, #e0f2fe 0%, #eef2ff 100%)',
    borderRadius: '1rem',
    border: '1px solid #c7d2fe',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.7)'
  },
  monthTab: {
    border: '1px solid #d4deef',
    backgroundColor: '#ffffff',
    borderRadius: '0.84rem',
    padding: '0.72rem 0.6rem',
    fontSize: '0.82rem',
    fontWeight: '800',
    color: '#334155',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(148, 163, 184, 0.08)'
  },
  monthTabActive: {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    borderColor: '#1d4ed8',
    boxShadow: '0 14px 24px rgba(37, 99, 235, 0.22)'
  },
  buildingSection: {
    marginBottom: '1.35rem',
    padding: '1.15rem',
    borderRadius: '1.05rem',
    background: 'linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)',
    border: '1px solid #99f6e4',
    boxShadow: '0 18px 34px rgba(15, 118, 110, 0.10)'
  },
  buildingSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '0.85rem'
  },
  buildingSectionTitle: {
    margin: 0,
    fontSize: '1.06rem',
    fontWeight: '800',
    color: '#0f172a'
  },
  buildingSectionText: {
    margin: '0.3rem 0 0 0',
    color: '#475569',
    fontSize: '0.94rem',
    lineHeight: 1.6,
    maxWidth: '620px'
  },
  buildingMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flexWrap: 'wrap'
  },
  buildingMetaPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.5rem 0.92rem',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    color: '#1d4ed8',
    fontWeight: '800',
    fontSize: '0.84rem',
    boxShadow: '0 8px 14px rgba(37, 99, 235, 0.14)'
  },
  buildingMetaText: {
    color: '#475569',
    fontSize: '0.88rem',
    fontWeight: '700'
  },
  exportButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.72rem 1.08rem',
    borderRadius: '0.9rem',
    border: '1px solid #1d4ed8',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: '0.86rem',
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(29, 78, 216, 0.12)'
  },
  exportPdfButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.72rem 1.08rem',
    borderRadius: '0.9rem',
    border: '1px solid #0f766e',
    backgroundColor: '#ecfeff',
    color: '#0f766e',
    fontWeight: '700',
    fontSize: '0.86rem',
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(15, 118, 110, 0.12)'
  },
  exportButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  buildingButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.88rem'
  },
  buildingButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.3rem',
    padding: '1.05rem 1.1rem',
    borderRadius: '1rem',
    border: '1px solid #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    color: '#0f172a',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    boxShadow: '0 14px 24px rgba(15, 23, 42, 0.07)'
  },
  buildingButtonActive: {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    borderColor: '#1d4ed8',
    color: '#ffffff',
    boxShadow: '0 18px 32px rgba(29, 78, 216, 0.24)',
    transform: 'translateY(-1px)'
  },
  buildingButtonTitle: {
    fontSize: '0.98rem',
    fontWeight: '800'
  },
  buildingButtonSubtext: {
    fontSize: '0.84rem',
    lineHeight: 1.55,
    opacity: 0.9
  },
  filterPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    margin: '0 0 1rem 0',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '0.85rem',
    padding: '0.85rem 1rem'
  },
  filterLabel: {
    fontWeight: '700',
    fontSize: '0.85rem',
    color: '#64748b',
    minWidth: '90px'
  },
  filterCount: {
    fontWeight: '700',
    fontSize: '0.88rem',
    color: '#64748b'
  },
  segmentButton: {
    padding: '0.45rem 1.05rem',
    borderRadius: '999px',
    fontWeight: '800',
    fontSize: '0.83rem',
    cursor: 'pointer',
    transition: 'all 0.18s'
  },
  segmentButtonBackground: '#ffffff',
  segmentButtonColor: '#374151',
  segmentButtonBorder: '#d1d5db',
  sheetSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.9rem',
    marginBottom: '1.25rem'
  },
  sheetSummaryCard: {
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px solid #dae6f7',
    borderRadius: '1rem',
    padding: '1.1rem',
    boxShadow: '0 16px 28px rgba(148, 163, 184, 0.11)',
    borderTop: '4px solid #0f766e'
  },
  sheetSummaryLabel: {
    fontSize: '0.76rem',
    color: '#64748b',
    marginBottom: '0.38rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: '800'
  },
  sheetSummaryValue: {
    fontSize: '1.2rem',
    fontWeight: '900',
    color: '#0f172a'
  },
  sheetTableWrap: {
    overflowX: 'auto',
    borderRadius: '1.1rem',
    border: '1px solid #d5e2f4',
    boxShadow: '0 18px 34px rgba(15, 23, 42, 0.08)',
    backgroundColor: '#ffffff',
    position: 'relative',
    maxWidth: '100%'
  },
  th: {
    padding: '1rem 0.92rem',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 100%)',
    color: '#ffffff',
    fontSize: '0.82rem',
    textAlign: 'left',
    fontWeight: '900',
    borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
    whiteSpace: 'normal',
    lineHeight: 1.35,
    letterSpacing: '0.04em',
    position: 'sticky',
    top: 0,
    zIndex: 4
  },
  td: {
    padding: '0.96rem 0.92rem',
    fontSize: '0.9rem',
    color: '#1f2937',
    borderBottom: '1px solid #edf2f7',
    verticalAlign: 'top'
  },
  tdPrimary: {
    padding: '0.96rem 0.92rem',
    fontSize: '0.93rem',
    color: '#0f172a',
    borderBottom: '1px solid #edf2f7',
    verticalAlign: 'top',
    fontWeight: '700',
    minWidth: '250px',
    lineHeight: 1.5
  },
  tdStrong: {
    padding: '0.96rem 0.92rem',
    fontSize: '0.9rem',
    borderBottom: '1px solid #edf2f7',
    verticalAlign: 'top',
    fontWeight: '700'
  },
  tableRowAlt: {
    backgroundColor: '#f8fbff'
  },
  emptyState: {
    padding: '2rem 1rem',
    textAlign: 'center',
    backgroundColor: '#ffffff',
    border: '1px dashed #cbd5e1',
    borderRadius: '0.9rem'
  },
  emptyStateTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.05rem',
    fontWeight: '700'
  },
  emptyStateText: {
    margin: '0.45rem auto 0',
    maxWidth: '560px',
    color: '#475569',
    lineHeight: 1.6
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    marginTop: '0.5rem',
    backgroundColor: 'white',
    minWidth: '1120px'
  },
  stickyTenantHead: {
    left: 0,
    zIndex: 8,
    minWidth: '250px',
    boxShadow: '10px 0 18px rgba(15, 23, 42, 0.18)'
  },
  stickyUnitHead: {
    left: '250px',
    zIndex: 7,
    minWidth: '110px',
    boxShadow: '10px 0 18px rgba(15, 23, 42, 0.12)'
  },
  stickyActionHead: {
    right: 0,
    zIndex: 7,
    minWidth: '210px',
    boxShadow: '-10px 0 18px rgba(15, 23, 42, 0.12)'
  },
  stickyTenantCell: {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    minWidth: '250px',
    backgroundColor: '#ffffff',
    boxShadow: '10px 0 18px rgba(15, 23, 42, 0.08)'
  },
  stickyUnitCell: {
    position: 'sticky',
    left: '250px',
    zIndex: 3,
    minWidth: '110px',
    backgroundColor: '#ffffff',
    boxShadow: '10px 0 18px rgba(15, 23, 42, 0.04)'
  },
  stickyActionCell: {
    position: 'sticky',
    right: 0,
    zIndex: 3,
    minWidth: '210px',
    backgroundColor: '#ffffff',
    boxShadow: '-10px 0 18px rgba(15, 23, 42, 0.08)'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.38rem 0.76rem',
    borderRadius: '999px',
    fontSize: '0.77rem',
    fontWeight: '900',
    boxShadow: '0 6px 12px rgba(15, 23, 42, 0.06)',
    minWidth: '86px'
  },
  badgePaid: {
    backgroundColor: '#d1fae5',
    color: '#065f46'
  },
  badgePartial: {
    backgroundColor: '#fef3c7',
    color: '#92400e'
  },
  badgeUnpaid: {
    backgroundColor: '#fee2e2',
    color: '#991b1b'
  },
  recordPaymentButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.55rem 0.8rem',
    borderRadius: '999px',
    border: '1px solid #0f766e',
    background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
    color: '#ffffff',
    fontSize: '0.78rem',
    fontWeight: '900',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 10px 18px rgba(15, 118, 110, 0.18)'
  },
  actionButtonsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap'
  },
  tenantReceiptButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.55rem 0.8rem',
    borderRadius: '999px',
    border: '1px solid #1d4ed8',
    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
    color: '#ffffff',
    fontSize: '0.78rem',
    fontWeight: '900',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 10px 18px rgba(29, 78, 216, 0.18)'
  },
  ledgerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.55rem 0.8rem',
    borderRadius: '999px',
    border: '1px solid #7c3aed',
    background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
    color: '#ffffff',
    fontSize: '0.78rem',
    fontWeight: '900',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 10px 18px rgba(124, 58, 237, 0.18)'
  },
  receiptOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.25rem',
    background: 'rgba(15, 23, 42, 0.58)',
    backdropFilter: 'blur(3px)'
  },
  receiptModal: {
    width: 'min(680px, 100%)',
    maxHeight: '92vh',
    overflow: 'auto',
    borderRadius: '1rem'
  },
  receiptToolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: '0.6rem',
    marginBottom: '0.75rem'
  },
  receiptPrintButton: {
    padding: '0.62rem 0.92rem',
    borderRadius: '0.74rem',
    border: '1px solid #047857',
    backgroundColor: '#ecfdf5',
    color: '#047857',
    fontWeight: '800',
    cursor: 'pointer'
  },
  receiptDownloadButton: {
    padding: '0.62rem 0.92rem',
    borderRadius: '0.74rem',
    border: '1px solid #1d4ed8',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: '800',
    cursor: 'pointer'
  },
  receiptCloseButton: {
    padding: '0.62rem 0.92rem',
    borderRadius: '0.74rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontWeight: '800',
    cursor: 'pointer'
  },
  receiptCard: {
    position: 'relative',
    width: '420px',
    maxWidth: '100%',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: '1rem',
    padding: '1rem 1.05rem 0.85rem',
    border: '1px solid #dbe5f4',
    boxShadow: '0 18px 36px rgba(15, 23, 42, 0.16)',
    overflow: 'hidden',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact'
  },
  receiptWatermark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '220px',
    height: '220px',
    objectFit: 'contain',
    opacity: 0.08,
    pointerEvents: 'none',
    zIndex: 0
  },
  receiptHeaderBlock: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.55rem',
    marginBottom: '0.5rem'
  },
  receiptLogo: {
    width: '40px',
    height: '40px',
    objectFit: 'contain',
    flexShrink: 0
  },
  receiptCompanyBlock: {
    flex: 1
  },
  receiptBrand: {
    position: 'relative',
    zIndex: 1,
    fontSize: '0.78rem',
    fontWeight: '900',
    letterSpacing: '0.04em',
    color: '#1e3a5f',
    lineHeight: 1.25
  },
  receiptCompanySubtitle: {
    marginTop: '0.28rem',
    color: '#6b7280',
    fontSize: '0.52rem',
    fontWeight: 800,
    lineHeight: 1.35,
    textTransform: 'uppercase'
  },
  receiptMetaBlock: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '150px',
    textAlign: 'right'
  },
  receiptNumber: {
    color: '#1d4ed8',
    fontSize: '0.62rem',
    fontWeight: 900,
    overflowWrap: 'anywhere'
  },
  receiptTitle: {
    position: 'relative',
    zIndex: 1,
    margin: '0.5rem 0 0.45rem',
    textAlign: 'center',
    fontSize: '0.68rem',
    fontWeight: '900',
    color: '#374151',
    letterSpacing: '0.14em',
    textTransform: 'uppercase'
  },
  receiptMeta: {
    position: 'relative',
    zIndex: 1,
    color: '#475569',
    fontSize: '0.58rem',
    marginTop: '0.12rem'
  },
  receiptSection: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '0.75rem',
    rowGap: '0.38rem',
    marginTop: '0.45rem',
    paddingTop: '0.45rem',
    borderTop: '1px dashed #d1d5db'
  },
  receiptInfoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.08rem',
    color: '#111827',
    fontSize: '0.66rem',
    fontWeight: 800,
    lineHeight: 1.32
  },
  receiptInfoLabel: {
    display: 'block',
    color: '#9ca3af',
    fontSize: '0.48rem',
    fontWeight: 900,
    letterSpacing: '0.08em',
    lineHeight: 1.15,
    textTransform: 'uppercase',
    marginBottom: '0.08rem'
  },
  receiptPaidText: {
    color: '#16a34a'
  },
  receiptUnpaidText: {
    color: '#d97706'
  },
  receiptRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.72rem 0.85rem',
    borderBottom: '1px solid #e2e8f0',
    color: '#1f2937'
  },
  receiptStatus: {
    position: 'relative',
    zIndex: 1,
    marginTop: '1rem',
    padding: '0.75rem 0.9rem',
    borderRadius: '0.8rem',
    fontWeight: '800'
  },
  receiptStatusPaid: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    border: '1px solid #86efac'
  },
  receiptStatusUnpaid: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fcd34d'
  },
  receiptAmountBox: {
    position: 'relative',
    zIndex: 1,
    margin: '0.5rem 0 0.42rem',
    padding: '0.62rem 0.55rem',
    textAlign: 'center',
    background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
    border: '2px solid #86efac',
    borderRadius: '0.75rem'
  },
  receiptAmountLabel: {
    color: '#16a34a',
    fontSize: '0.54rem',
    fontWeight: 900,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '0.22rem'
  },
  receiptAmountValue: {
    color: '#15803d',
    fontSize: '1.24rem',
    fontWeight: 900,
    lineHeight: 1.15
  },
  receiptPaidStamp: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.28rem',
    marginTop: '0.32rem',
    color: '#16a34a',
    fontSize: '0.58rem',
    fontWeight: 900,
    letterSpacing: '0.16em'
  },
  receiptPaidIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '13px',
    height: '13px',
    borderRadius: '4px',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    fontSize: '0.55rem',
    letterSpacing: 0,
    lineHeight: 1
  },
  receiptSummaryGrid: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.25rem',
    paddingTop: '0.45rem',
    borderTop: '1px dashed #d1d5db'
  },
  receiptSummaryItem: {
    border: '1px solid #e5e7eb',
    borderRadius: '0.6rem',
    padding: '0.3rem',
    backgroundColor: 'rgba(249, 250, 251, 0.86)',
    color: '#111827',
    fontSize: '0.54rem',
    fontWeight: 900
  },
  receiptSignatureArea: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    gap: '1.2rem',
    justifyContent: 'space-around',
    padding: '0.55rem 0 0.15rem'
  },
  receiptSignatureBlock: {
    flex: 1,
    textAlign: 'center'
  },
  receiptSignatureLine: {
    borderBottom: '1.5px solid #374151',
    height: '1.25rem',
    marginBottom: '0.2rem'
  },
  receiptSignatureLabel: {
    color: '#6b7280',
    fontSize: '0.5rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase'
  },
  receiptFooter: {
    position: 'relative',
    zIndex: 1,
    marginTop: '0.42rem',
    paddingTop: '0.42rem',
    borderTop: '1px solid #f3f4f6',
    color: '#6b7280',
    fontSize: '0.54rem',
    textAlign: 'center'
  },
  receiptFooterMuted: {
    marginTop: '0.25rem',
    color: '#9ca3af',
    fontSize: '0.5rem'
  },
  detailsOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.25rem',
    background: 'rgba(15, 23, 42, 0.58)',
    backdropFilter: 'blur(3px)'
  },
  detailsCard: {
    backgroundColor: '#f8fafc',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    marginBottom: '2rem',
    border: '1px solid #cbd5e1'
  },
  detailsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1rem',
    color: '#1f2937'
  },
  detailSectionTitle: {
    marginTop: '1.2rem',
    marginBottom: '0.75rem',
    fontSize: '1.05rem',
    color: '#1f2937'
  },
  noData: {
    textAlign: 'center',
    color: '#64748b',
    padding: '1.2rem'
  },
  exportCanvasWrap: {
    position: 'fixed',
    left: '-20000px',
    top: 0,
    width: '1800px',
    pointerEvents: 'none',
    opacity: 0
  },
  exportCanvasCard: {
    width: '1800px',
    padding: '34px',
    backgroundColor: '#ffffff',
    color: '#020617',
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  },
  exportCanvasHeader: {
    marginBottom: '18px',
    borderBottom: '3px solid #1d4ed8',
    paddingBottom: '12px'
  },
  exportCanvasBrand: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: '0.06em'
  },
  exportCanvasTitle: {
    marginTop: '6px',
    fontSize: '34px',
    fontWeight: '800',
    color: '#020617'
  },
  exportCanvasMetaRow: {
    marginTop: '8px',
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
    fontSize: '18px',
    color: '#0f172a'
  },
  exportTable: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'auto',
    backgroundColor: '#ffffff'
  },
  exportTh: {
    backgroundColor: '#dbeafe',
    color: '#020617',
    padding: '18px 12px',
    textAlign: 'left',
    fontSize: '18px',
    fontWeight: '800',
    border: '1px solid #93c5fd',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    lineHeight: 1.35
  },
  exportTd: {
    padding: '15px 12px',
    fontSize: '17px',
    color: '#020617',
    border: '1px solid #cbd5e1',
    verticalAlign: 'top',
    wordBreak: 'break-word',
    whiteSpace: 'normal',
    fontWeight: '600',
    lineHeight: 1.45,
    backgroundColor: '#ffffff'
  },
  exportTdPrimary: {
    padding: '15px 12px',
    fontSize: '17px',
    color: '#020617',
    border: '1px solid #cbd5e1',
    verticalAlign: 'top',
    wordBreak: 'break-word',
    whiteSpace: 'normal',
    fontWeight: '800',
    lineHeight: 1.45,
    backgroundColor: '#ffffff'
  },
  exportTdStrong: {
    padding: '15px 12px',
    fontSize: '17px',
    border: '1px solid #cbd5e1',
    verticalAlign: 'top',
    wordBreak: 'break-word',
    whiteSpace: 'normal',
    fontWeight: '800',
    lineHeight: 1.45,
    backgroundColor: '#ffffff'
  },
  exportRowAlt: {
    backgroundColor: '#eef4ff'
  },
  exportStatus: {
    display: 'inline-block',
    padding: '7px 14px',
    borderRadius: '999px',
    backgroundColor: '#fecaca',
    color: '#7f1d1d',
    fontWeight: '800',
    fontSize: '15px'
  },
  exportTotals: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '18px',
    marginTop: '24px'
  },
  exportTotalCard: {
    border: '1px solid #bfdbfe',
    borderRadius: '12px',
    padding: '18px 20px',
    backgroundColor: '#eff6ff'
  },
  exportTotalLabel: {
    display: 'block',
    color: '#334155',
    fontSize: '15px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px'
  },
  exportTotalValue: {
    display: 'block',
    color: '#020617',
    fontSize: '24px',
    fontWeight: '800'
  }
};

export default MonthlyRentSheet;

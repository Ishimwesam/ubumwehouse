import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useLocation, useNavigate } from 'react-router-dom';
import ReceiptModal from '../components/ReceiptModal';
import { contractService, paymentService, resolveUploadUrl, tenantService, unitService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useDataSync } from '../context/DataSyncContext';
import { useAuth } from '../context/AuthContext';
import PageLoader from '../components/PageLoader';

const formatCurrency = (value) =>
  `${parseFloat(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;

const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);
const formatPeriodLabel = (value) => {
  if (!value) return 'All periods';
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const getReceiptUrl = (receiptPath) => {
  if (!receiptPath) return null;
  return resolveUploadUrl(receiptPath);
};

const getPaymentStatus = (payment) => payment.payment_status || 'confirmed';
const idsEqual = (first, second) => String(first || '') === String(second || '');
const receiptAllowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const maxReceiptSize = 10 * 1024 * 1024;

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6l4 2" />
  </svg>
);

const WalletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7.5h13.5A2.5 2.5 0 0 1 20 10v6.5A2.5 2.5 0 0 1 17.5 19H6.5A2.5 2.5 0 0 1 4 16.5z" />
    <path d="M5.5 7.5 15 4.8a2 2 0 0 1 2.5 1.9v.8" />
    <path d="M15.5 12h3" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);

const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16" />
    <path d="M7 12h10" />
    <path d="M10 18h4" />
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
  </svg>
);

const SparkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4" />
    <path d="M12 17v4" />
    <path d="M3 12h4" />
    <path d="M17 12h4" />
    <path d="m5.6 5.6 2.8 2.8" />
    <path d="m15.6 15.6 2.8 2.8" />
  </svg>
);

const EnhancedPayments = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { versions, notifyDataChanged } = useDataSync();
  const { isManager } = useAuth();
  const [activeTab, setActiveTab] = useState('make');
  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState(getCurrentPeriod());
  const [receiptPrintFilter, setReceiptPrintFilter] = useState('all');
  const [tenantOptionSearch, setTenantOptionSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const { showToast } = useToast();

  const [receiptPayment, setReceiptPayment] = useState(null);
  const [tenantStatusReceipt, setTenantStatusReceipt] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(null);
  const tenantStatusReceiptRef = useRef(null);

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
    fetchData();
  }, [versions.payments, versions.tenants, versions.contracts, versions.units]);

  useEffect(() => {
    if (!formData.receipt || !formData.receipt.type?.startsWith('image/')) {
      setReceiptPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(formData.receipt);
    setReceiptPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [formData.receipt]);

  useEffect(() => {
    const quickPayment = location.state?.recordPaymentFor;
    if (!quickPayment || tenants.length === 0) return;

    const tenant = tenants.find((item) => item.id === quickPayment.tenantId);
    if (!tenant) return;

    const nextUnitOptions = getTenantUnitOptions(tenant.id);
    const nextUnitId = quickPayment.unitId || nextUnitOptions[0]?.unit_id || tenant.unit_id || '';
    const amount = quickPayment.amount || tenant.monthly_rent || nextUnitOptions[0]?.monthly_rent || '';

    setFormData((prev) => ({
      ...prev,
      tenant_id: tenant.id,
      unit_id: nextUnitId,
      amount,
      payment_period: quickPayment.period || getCurrentPeriod(),
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: prev.payment_method || 'cash',
      notes: quickPayment.notes || prev.notes || ''
    }));
    setTenantOptionSearch(tenant.full_name || '');
    setActiveTab('make');
    navigate('/payments', { replace: true, state: null });
  }, [location.state, tenants, units, contracts, payments]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, tenantsRes, contractsRes, unitsRes] = await Promise.all([
        paymentService.getAll(),
        tenantService.getAll(),
        contractService.getAll(),
        unitService.getAll()
      ]);
      setPayments(paymentsRes.data || []);
      setTenants(tenantsRes.data || []);
      setContracts(contractsRes.data || []);
      setUnits(unitsRes.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saving) return;

    const normalizedAmount = parseFloat(formData.amount || 0);
    const remainingAllowed = Math.max(selectedMonthlyRent - alreadyRecordedForSelection, 0);

    if (!formData.tenant_id || !formData.unit_id) {
      showToast('Select a tenant and unit before saving.', 'warning');
      return;
    }

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      showToast('Payment amount must be greater than zero.', 'warning');
      return;
    }

    if (selectedMonthlyRent > 0 && normalizedAmount > remainingAllowed + 0.000001) {
      showToast(`Amount is above the remaining allowed rent (${formatCurrency(remainingAllowed)}).`, 'warning');
      return;
    }

    if (!editingId && !formData.receipt) {
      showToast('Please upload a receipt before saving a new payment.', 'warning');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await paymentService.update(editingId, formData);
        showToast('✓ Payment updated successfully', 'success');
        notifyDataChanged(['payments', 'dashboard', 'reports', 'tenants', 'units']);
      } else {
        await paymentService.create(formData);
        showToast('✓ Payment saved as pending. Confirm first to access receipt.', 'info');
        notifyDataChanged(['payments', 'dashboard', 'reports']);
      }
      resetForm();
      fetchData();
      if (!editingId) {
        if (isManager()) {
          navigate('/manual-confirmation');
        } else {
          setActiveTab('pending');
        }
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save payment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (payment) => {
    if (!payment?.receipt_path) {
      showToast('Receipt image is required before confirmation. Review in confirmation queue.', 'warning');
      navigate('/manual-confirmation');
      return;
    }

    try {
      setConfirmingId(payment.id);
      await paymentService.confirm(payment.id);
      showToast('✓ Payment confirmed successfully', 'success');
      notifyDataChanged(['payments', 'dashboard', 'reports', 'tenants', 'units']);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to confirm payment', 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this payment?')) {
      try {
        setDeletingId(id);
        await paymentService.delete(id);
        showToast('✓ Payment deleted', 'success');
        notifyDataChanged(['payments', 'dashboard', 'reports', 'tenants', 'units']);
        fetchData();
      } catch (err) {
        showToast(err.response?.data?.error || 'Failed to delete payment', 'error');
      } finally {
        setDeletingId(null);
      }
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
    setActiveTab('make');
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
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setFormData({ ...formData, receipt: null });
      return;
    }

    if (!receiptAllowedTypes.has(file.type) || file.size > maxReceiptSize) {
      e.target.value = '';
      showToast('Receipt must be a JPG, PNG, or PDF file up to 10MB.', 'warning');
      setFormData({ ...formData, receipt: null });
      return;
    }

    setFormData({ ...formData, receipt: file });
  };

  const handleTenantChange = (e) => {
    const tenantId = e.target.value;
    const nextUnitOptions = getTenantUnitOptions(tenantId);
    setFormData({
      ...formData,
      tenant_id: tenantId,
      unit_id: nextUnitOptions[0]?.unit_id || ''
    });
  };

  // Calculate stats
  const pendingPayments = payments.filter((p) => p.payment_status === 'pending');
  const confirmedPayments = payments.filter(
    (p) => p.payment_status === 'confirmed' || !p.payment_status
  );

  useEffect(() => {
    try {
      localStorage.setItem('pendingPaymentsCount', String(pendingPayments.length));
    } catch (_) {}
  }, [pendingPayments.length]);

  const totalPending = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const totalConfirmed = confirmedPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const normalizeText = (value) => String(value || '').toLowerCase();
  const matchesPaymentFilters = (payment) => {
    const matchesSearch = !searchTerm || [payment.tenant_name, payment.unit_number, payment.payment_method, payment.payment_period]
      .some((value) => normalizeText(value).includes(normalizeText(searchTerm)));
    const matchesMethod = filterMethod === 'all' || (payment.payment_method || 'cash') === filterMethod;
    const paymentPeriod = payment.payment_period || payment.payment_date?.slice(0, 7);
    const matchesPeriod = !filterPeriod || paymentPeriod === filterPeriod;

    return matchesSearch && matchesMethod && matchesPeriod;
  };

  const filteredPendingPayments = pendingPayments.filter(matchesPaymentFilters);
  const filteredConfirmedPayments = confirmedPayments.filter(matchesPaymentFilters);

  const currentPeriodConfirmedTotal = confirmedPayments
    .filter((payment) => (payment.payment_period || payment.payment_date?.slice(0, 7)) === filterPeriod)
    .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);

  const currentPeriodExpectedTotal = tenants
    .filter((tenant) => tenant.status === 'active' && tenant.unit_id)
    .reduce((sum, tenant) => sum + parseFloat(tenant.monthly_rent || 0), 0);

  const collectionRate = currentPeriodExpectedTotal > 0
    ? Math.min((currentPeriodConfirmedTotal / currentPeriodExpectedTotal) * 100, 100)
    : 0;

  const attentionRows = tenants
    .filter((tenant) => tenant.status === 'active' && tenant.unit_id)
    .map((tenant) => {
      const periodPayments = payments.filter((payment) => (
        idsEqual(payment.tenant_id, tenant.id)
        && (payment.payment_period || payment.payment_date?.slice(0, 7)) === filterPeriod
      ));
      const confirmedAmount = periodPayments
        .filter((payment) => getPaymentStatus(payment) === 'confirmed')
        .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      const pendingAmount = periodPayments
        .filter((payment) => getPaymentStatus(payment) === 'pending')
        .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      const monthlyRent = parseFloat(tenant.monthly_rent || 0);
      const remaining = Math.max(monthlyRent - confirmedAmount, 0);

      return {
        tenantId: tenant.id,
        tenantName: tenant.full_name,
        unitNumber: tenant.unit_number,
        monthlyRent,
        confirmedAmount,
        pendingAmount,
        remaining,
        paymentCount: periodPayments.length
      };
    })
    .sort((first, second) => second.remaining - first.remaining);

  const topAttentionRows = attentionRows.filter((row) => row.remaining > 0).slice(0, 4);
  const noReceiptPendingCount = pendingPayments.filter((payment) => !payment.receipt_path).length;
  const latestPayment = payments[0] || null;

  const selectedTenant = tenants.find((t) => idsEqual(t.id, formData.tenant_id));
  const getTenantUnitOptions = (tenantId) => {
    const tenant = tenants.find((item) => idsEqual(item.id, tenantId));
    const optionMap = new Map();

    if (tenant?.unit_id) {
      const currentUnit = unitsById[tenant.unit_id];
      optionMap.set(tenant.unit_id, {
        unit_id: tenant.unit_id,
        unit_number: tenant.unit_number || currentUnit?.unit_number || 'Unknown unit',
        building_name: tenant.building_name || currentUnit?.building_name || 'Unknown building',
        monthly_rent: tenant.monthly_rent || currentUnit?.monthly_rent || 0,
        source: 'current'
      });
    }

    contracts
      .filter((contract) => idsEqual(contract.tenant_id, tenantId) && contract.unit_id)
      .forEach((contract) => {
        if (!optionMap.has(contract.unit_id)) {
          const contractUnit = unitsById[contract.unit_id];
          optionMap.set(contract.unit_id, {
            unit_id: contract.unit_id,
            unit_number: contract.unit_number || contractUnit?.unit_number || 'Unknown unit',
            building_name: contract.building_name || contractUnit?.building_name || 'Unknown building',
            monthly_rent: contractUnit?.monthly_rent || tenant?.monthly_rent || 0,
            source: contract.lifecycle_status || 'contract'
          });
        }
      });

    payments
      .filter((payment) => idsEqual(payment.tenant_id, tenantId) && payment.unit_id)
      .forEach((payment) => {
        if (!optionMap.has(payment.unit_id)) {
          const paymentUnit = unitsById[payment.unit_id];
          optionMap.set(payment.unit_id, {
            unit_id: payment.unit_id,
            unit_number: payment.unit_number || paymentUnit?.unit_number || 'Unknown unit',
            building_name: payment.building_name || paymentUnit?.building_name || 'Unknown building',
            monthly_rent: payment.monthly_rent || paymentUnit?.monthly_rent || tenant?.monthly_rent || 0,
            source: 'history'
          });
        }
      });

    return Array.from(optionMap.values());
  };

  const unitsById = units.reduce((acc, unit) => {
    acc[unit.id] = unit;
    return acc;
  }, {});

  const selectableTenants = tenants.filter((tenant) => {
    if (tenant.status !== 'active') {
      return false;
    }

    const matchesTenantSearch = !tenantOptionSearch || [tenant.full_name, tenant.unit_number, tenant.phone, tenant.building_name]
      .some((value) => normalizeText(value).includes(normalizeText(tenantOptionSearch)));

    return matchesTenantSearch && getTenantUnitOptions(tenant.id).length > 0;
  });

  const selectedUnitOptions = formData.tenant_id ? getTenantUnitOptions(formData.tenant_id) : [];
  const selectedUnitInfo = selectedUnitOptions.find((item) => idsEqual(item.unit_id, formData.unit_id)) || null;
  const selectedMonthlyRent = parseFloat(selectedUnitInfo?.monthly_rent || selectedTenant?.monthly_rent || 0);
  const alreadyRecordedForSelection = payments
    .filter((payment) => (
      idsEqual(payment.tenant_id, formData.tenant_id)
      && idsEqual(payment.unit_id, formData.unit_id)
      && (payment.payment_period || payment.payment_date?.slice(0, 7)) === formData.payment_period
      && ['confirmed', 'pending'].includes(getPaymentStatus(payment))
      && (!editingId || payment.id !== editingId)
    ))
    .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
  const selectedAmount = parseFloat(formData.amount || 0);
  const estimatedBalance = Math.max(selectedMonthlyRent - alreadyRecordedForSelection - selectedAmount, 0);

  const markReceiptPrinted = async (paymentId, notify = false) => {
    if (!paymentId) return;

    try {
      await paymentService.markReceiptPrinted(paymentId);
      setPayments((prev) => prev.map((item) => (
        idsEqual(item.id, paymentId)
          ? { ...item, receipt_printed: 1, receipt_printed_at: new Date().toISOString() }
          : item
      )));
      if (notify) {
        showToast('Receipt marked as printed.', 'success');
      }
    } catch (error) {
      showToast('Failed to update receipt print status.', 'error');
    }
  };

  const openTenantStatusReceipt = (payment) => {
    const period = payment.payment_period || payment.payment_date?.slice(0, 7) || filterPeriod;
    const tenant = tenants.find((item) => idsEqual(item.id, payment.tenant_id));
    const unit = units.find((item) => idsEqual(item.id, payment.unit_id));
    const expectedAmount = parseFloat(payment.monthly_rent || unit?.monthly_rent || tenant?.monthly_rent || 0);
    const matchingPayments = payments.filter((item) => (
      idsEqual(item.tenant_id, payment.tenant_id)
      && idsEqual(item.unit_id, payment.unit_id)
      && (item.payment_period || item.payment_date?.slice(0, 7)) === period
    ));
    const confirmedAmount = matchingPayments
      .filter((item) => getPaymentStatus(item) === 'confirmed')
      .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const pendingAmount = matchingPayments
      .filter((item) => getPaymentStatus(item) === 'pending')
      .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const remainingAmount = Math.max(expectedAmount - confirmedAmount, 0);

    setTenantStatusReceipt({
      paymentId: payment.id,
      tenantName: payment.tenant_name || tenant?.full_name || '-',
      unitNumber: payment.unit_number || unit?.unit_number || '-',
      buildingName: payment.building_name || unit?.building_name || tenant?.building_name || '-',
      period,
      expectedAmount,
      confirmedAmount,
      pendingAmount,
      remainingAmount,
      canMarkPrinted: getPaymentStatus(payment) === 'confirmed',
      status: remainingAmount === 0 && expectedAmount > 0 ? 'Fully paid' : (confirmedAmount > 0 || pendingAmount > 0 ? 'Partially paid' : 'Not paid')
    });
  };

  const downloadTenantStatusReceiptPdf = async () => {
    if (!tenantStatusReceipt || !tenantStatusReceiptRef.current) return;

    try {
      const canvas = await html2canvas(tenantStatusReceiptRef.current, {
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
      pdf.save(`${tenantStatusReceipt.tenantName.replace(/\s+/g, '-').toLowerCase()}-${tenantStatusReceipt.period}-tenant-status-receipt.pdf`);
      if (tenantStatusReceipt.canMarkPrinted) {
        await markReceiptPrinted(tenantStatusReceipt.paymentId, true);
      }
    } catch (error) {
      showToast('Failed to generate tenant status receipt.', 'error');
    }
  };

  const printTenantStatusReceipt = () => {
    if (!tenantStatusReceipt || !tenantStatusReceiptRef.current) return;

    const printWindow = window.open('', '_blank', 'width=900,height=720');
    if (!printWindow) {
      showToast('Allow pop-ups to print tenant receipt.', 'warning');
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
        <body>${tenantStatusReceiptRef.current.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    const images = Array.from(printWindow.document.images || []);
    Promise.all(images.map((image) => (
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

    if (tenantStatusReceipt.canMarkPrinted) {
      void markReceiptPrinted(tenantStatusReceipt.paymentId, true);
    }
  };

  const openOfficialReceipt = (payment) => {
    if (getPaymentStatus(payment) !== 'confirmed') {
      showToast('Cannot print receipt before payment is confirmed. Please confirm first.', 'warning');
      return;
    }

    setReceiptPayment(payment);
  };

  const paidReceiptRows = Array.from(
    confirmedPayments
      .filter((payment) => parseFloat(payment.period_balance || 0) <= 0)
      .reduce((map, payment) => {
        const key = `${payment.tenant_id || ''}:${payment.unit_id || ''}:${payment.payment_period || payment.payment_date?.slice(0, 7) || ''}`;
        const existing = map.get(key);
        if (!existing || new Date(payment.payment_date || 0) > new Date(existing.payment_date || 0)) {
          map.set(key, payment);
        }
        return map;
      }, new Map())
      .values()
  ).filter(matchesPaymentFilters);

  const filteredPaidReceiptRows = paidReceiptRows.filter((payment) => {
    if (receiptPrintFilter === 'printed') {
      return Number(payment.receipt_printed || 0) === 1;
    }
    if (receiptPrintFilter === 'not_printed') {
      return Number(payment.receipt_printed || 0) !== 1;
    }
    return true;
  });

  if (loading) {
    return <PageLoader text="Loading payments..." />;
  }

  return (
    <div className="payments-page-shell" style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
      {receiptPayment && (
        <ReceiptModal
          payment={receiptPayment}
          onReceiptPrinted={() => markReceiptPrinted(receiptPayment.id, true)}
          onClose={() => setReceiptPayment(null)}
        />
      )}
      {tenantStatusReceipt && (
        <div style={styles.tenantReceiptOverlay} onMouseDown={(event) => {
          if (event.target === event.currentTarget) setTenantStatusReceipt(null);
        }}>
          <div style={styles.tenantReceiptModal} role="dialog" aria-modal="true" aria-labelledby="tenant-status-receipt-title">
            <div style={styles.tenantReceiptToolbar}>
              <button type="button" style={styles.tenantReceiptPrintButton} onClick={printTenantStatusReceipt}>
                Print Tenant Receipt
              </button>
              <button type="button" style={styles.tenantReceiptDownloadButton} onClick={downloadTenantStatusReceiptPdf}>
                Download Receipt PDF
              </button>
              <button type="button" style={styles.tenantReceiptCloseButton} onClick={() => setTenantStatusReceipt(null)}>
                Close
              </button>
            </div>

            <div ref={tenantStatusReceiptRef} style={styles.tenantReceiptCard}>
              <img src="/samm.svg" alt="" aria-hidden="true" style={styles.tenantReceiptWatermark} />
              <div style={styles.tenantReceiptHeaderBlock}>
                <img src="/samm.svg" alt="UBUMWE SYSTEM COMPANY" style={styles.tenantReceiptLogo} />
                <div style={styles.tenantReceiptCompanyBlock}>
                  <div style={styles.tenantReceiptBrand}>UBUMWE<br />SYSTEM<br />COMPANY</div>
                  <div style={styles.tenantReceiptCompanySubtitle}>UBUMWE HOUSE LTD / IHURIRO HOUSE LTD</div>
                </div>
                <div style={styles.tenantReceiptMetaBlock}>
                  <div style={styles.tenantReceiptNumber}>Tenant Receipt #{String(tenantStatusReceipt.paymentId || '').slice(0, 8) || 'status'}</div>
                  <div style={styles.tenantReceiptMeta}>Issued: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              <h2 id="tenant-status-receipt-title" style={styles.tenantReceiptTitle}>TENANT RENT STATUS RECEIPT</h2>

              <div style={styles.tenantReceiptSection}>
                <div style={styles.tenantReceiptInfoItem}><span style={styles.tenantReceiptInfoLabel}>Received From</span><strong>{tenantStatusReceipt.tenantName}</strong></div>
                <div style={styles.tenantReceiptInfoItem}><span style={styles.tenantReceiptInfoLabel}>Unit / Room</span><strong>{tenantStatusReceipt.unitNumber !== '-' ? `Room ${tenantStatusReceipt.unitNumber}` : '-'}</strong></div>
                <div style={styles.tenantReceiptInfoItem}><span style={styles.tenantReceiptInfoLabel}>Payment Period</span><strong>{formatPeriodLabel(tenantStatusReceipt.period)}</strong></div>
                <div style={styles.tenantReceiptInfoItem}><span style={styles.tenantReceiptInfoLabel}>Building</span><strong>{tenantStatusReceipt.buildingName}</strong></div>
                <div style={styles.tenantReceiptInfoItem}><span style={styles.tenantReceiptInfoLabel}>Status</span><strong style={tenantStatusReceipt.status === 'Fully paid' ? styles.tenantReceiptPaidText : styles.tenantReceiptUnpaidText}>{tenantStatusReceipt.status}</strong></div>
              </div>

              <div style={styles.tenantReceiptAmountBox}>
                <div style={styles.tenantReceiptAmountLabel}>TOTAL AMOUNT PAID</div>
                <div style={styles.tenantReceiptAmountValue}>{formatCurrency(tenantStatusReceipt.confirmedAmount)}</div>
                <div style={styles.tenantReceiptPaidStamp}>
                  {tenantStatusReceipt.status === 'Fully paid' ? <span style={styles.tenantReceiptPaidIcon}>✓</span> : null}
                  {tenantStatusReceipt.status === 'Fully paid' ? 'PAID' : `${formatCurrency(tenantStatusReceipt.remainingAmount)} BALANCE`}
                </div>
              </div>

              <div style={styles.tenantReceiptSummaryGrid}>
                <div style={styles.tenantReceiptSummaryItem}><span style={styles.tenantReceiptInfoLabel}>Required Rent</span><strong>{formatCurrency(tenantStatusReceipt.expectedAmount)}</strong></div>
                <div style={styles.tenantReceiptSummaryItem}><span style={styles.tenantReceiptInfoLabel}>Pending Submitted</span><strong>{formatCurrency(tenantStatusReceipt.pendingAmount)}</strong></div>
                <div style={styles.tenantReceiptSummaryItem}><span style={styles.tenantReceiptInfoLabel}>Remaining Balance</span><strong>{formatCurrency(tenantStatusReceipt.remainingAmount)}</strong></div>
              </div>

              <div style={styles.tenantReceiptSignatureArea}>
                <div style={styles.tenantReceiptSignatureBlock}>
                  <div style={styles.tenantReceiptSignatureLine}></div>
                  <div style={styles.tenantReceiptSignatureLabel}>Tenant Signature</div>
                </div>
                <div style={styles.tenantReceiptSignatureBlock}>
                  <div style={styles.tenantReceiptSignatureLine}></div>
                  <div style={styles.tenantReceiptSignatureLabel}>Authorized by</div>
                </div>
              </div>

              <div style={styles.tenantReceiptFooter}>
                <div>Thank you for your payment. Please keep this receipt for your records.</div>
                <div style={styles.tenantReceiptFooterMuted}>Generated on {new Date().toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}
        <div>
          <div style={styles.eyebrowPill}>Payment Center</div>
          <h1 style={styles.pageTitle}>Payments Management</h1>
          <p style={styles.subtitle}>Complete payment processing and tracking</p>
          <div style={styles.headerMeta}>
            <span style={styles.metaChip}>{formatPeriodLabel(filterPeriod)}</span>
            <span style={styles.metaChipMuted}>{payments.length} total record{payments.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statCardTop}>
            <span style={{ ...styles.statIconWrap, background: '#dcfce7', color: '#166534' }}><CheckCircleIcon /></span>
          </div>
          <div style={styles.statLabel}>Total Confirmed</div>
          <div style={{ ...styles.statValue, color: '#10b981' }}>
            {formatCurrency(totalConfirmed)}
          </div>
          <div style={styles.statSubtext}>{confirmedPayments.length} payments</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statCardTop}>
            <span style={{ ...styles.statIconWrap, background: '#fef3c7', color: '#b45309' }}><ClockIcon /></span>
          </div>
          <div style={styles.statLabel}>Pending Review</div>
          <div style={{ ...styles.statValue, color: '#f59e0b' }}>
            {formatCurrency(totalPending)}
          </div>
          <div style={styles.statSubtext}>{pendingPayments.length} payments</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statCardTop}>
            <span style={{ ...styles.statIconWrap, background: '#dbeafe', color: '#1d4ed8' }}><WalletIcon /></span>
          </div>
          <div style={styles.statLabel}>Total Payments</div>
          <div style={{ ...styles.statValue, color: '#2563eb' }}>
            {payments.length}
          </div>
          <div style={styles.statSubtext}>All records</div>
        </div>
      </div>

      <div style={styles.innovationShell}>
        <div style={styles.innovationHero}>
          <div>
            <div style={styles.innovationEyebrow}>Payment Innovation</div>
            <h2 style={styles.innovationTitle}>Smart collection signals for {filterPeriod}</h2>
            <p style={styles.innovationText}>Review live collection health, narrow the records you need, and move straight from insight to action.</p>
          </div>
          <div style={styles.innovationActions}>
            <button type="button" style={styles.heroActionBtn} onClick={() => setActiveTab('make')}>Record payment</button>
            {isManager() ? (
              <button type="button" style={styles.heroGhostBtn} onClick={() => navigate('/manual-confirmation')}>Open confirmation queue</button>
            ) : null}
          </div>
        </div>

        <div style={styles.innovationGrid}>
          <div style={styles.signalCard}>
            <div style={styles.signalCardTop}>
              <span style={{ ...styles.signalIconWrap, background: '#eff6ff', color: '#1d4ed8' }}><SparkIcon /></span>
            </div>
            <div style={styles.signalLabel}>Collection Rate</div>
            <div style={styles.signalValue}>{collectionRate.toFixed(1)}%</div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${collectionRate}%` }} />
            </div>
            <div style={styles.signalHint}>
              {formatCurrency(currentPeriodConfirmedTotal)} collected from {formatCurrency(currentPeriodExpectedTotal)} expected.
            </div>
          </div>

          <div style={styles.signalCard}>
            <div style={styles.signalCardTop}>
              <span style={{ ...styles.signalIconWrap, background: '#fff7ed', color: '#c2410c' }}><AlertIcon /></span>
            </div>
            <div style={styles.signalLabel}>Attention Needed</div>
            <div style={styles.signalValue}>{topAttentionRows.length}</div>
            <div style={styles.signalHint}>Tenants still owing money for the selected month.</div>
          </div>

          <div style={styles.signalCard}>
            <div style={styles.signalCardTop}>
              <span style={{ ...styles.signalIconWrap, background: '#fef2f2', color: '#dc2626' }}><ClockIcon /></span>
            </div>
            <div style={styles.signalLabel}>Pending Without Receipt</div>
            <div style={styles.signalValue}>{noReceiptPendingCount}</div>
            <div style={styles.signalHint}>These cannot be confirmed until a receipt is attached.</div>
          </div>

          <div style={styles.signalCard}>
            <div style={styles.signalCardTop}>
              <span style={{ ...styles.signalIconWrap, background: '#ede9fe', color: '#6d28d9' }}><WalletIcon /></span>
            </div>
            <div style={styles.signalLabel}>Latest Activity</div>
            <div style={styles.signalValueSmall}>{latestPayment ? latestPayment.tenant_name : 'No payments yet'}</div>
            <div style={styles.signalHint}>
              {latestPayment ? `${formatCurrency(latestPayment.amount)} on ${new Date(latestPayment.payment_date).toLocaleDateString()}` : 'Record a first payment to start activity insights.'}
            </div>
          </div>
        </div>

        <div style={styles.filterPanel}>
          <div style={styles.filterGroupWide}>
            <label style={styles.filterLabel}>Search payments</label>
            <div style={styles.filterInputWrap}>
              <span style={styles.filterInputIcon}><SearchIcon /></span>
              <input
                id="payments-search"
                name="payments_search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tenant, unit, method, or period"
                style={styles.filterInputBare}
              />
            </div>
          </div>
          <div style={styles.filterGroupCompact}>
            <label style={styles.filterLabel}>Period</label>
            <div style={styles.filterInputWrap}>
              <span style={styles.filterInputIcon}><CalendarIcon /></span>
              <input
                id="payments-period-filter"
                name="payments_period_filter"
                type="month"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                style={styles.filterInputBare}
              />
            </div>
          </div>
          <div style={styles.filterGroupCompact}>
            <label style={styles.filterLabel}>Method</label>
            <div style={styles.filterInputWrap}>
              <span style={styles.filterInputIcon}><FilterIcon /></span>
              <select id="payments-method-filter" name="payments_method_filter" value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} style={styles.filterInputBare}>
                <option value="all">All methods</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Check</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          ['make', 'Make Payment'],
          ['history', 'Payment History'],
          ['receipt-center', 'Print Tenant Receipts'],
          ['pending', 'Pending'],
          ...(isManager() ? [['reports', 'Reports']] : []),
          ...(isManager() ? [['confirm', 'Confirm Payment']] : [])
        ].map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            style={{
              ...styles.tabButton,
              ...(activeTab === tab ? styles.tabButtonActive : {})
            }}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}

      {/* Make Payment Tab */}
      {activeTab === 'make' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            {editingId ? 'Edit Payment' : 'Record New Payment'}
          </div>
          <div style={styles.cardIntro}>
            Use this form to capture the tenant, unit, payment method, and receipt in one clean flow before sending it for confirmation.
          </div>
          <form onSubmit={handleSubmit}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Tenant *</label>
                <div style={{ ...styles.filterInputWrap, marginBottom: '0.5rem' }}>
                  <span style={styles.filterInputIcon}><SearchIcon /></span>
                  <input
                    type="text"
                    value={tenantOptionSearch}
                    onChange={(e) => setTenantOptionSearch(e.target.value)}
                    style={styles.filterInputBare}
                    placeholder="Search tenant by name, phone, unit, or building"
                  />
                </div>
                <select
                  value={formData.tenant_id}
                  onChange={handleTenantChange}
                  style={styles.select}
                  required
                >
                  <option value="">Select a tenant</option>
                  {selectableTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} - Unit {t.unit_number}
                    </option>
                  ))}
                </select>
                {!editingId && selectableTenants.length === 0 && (
                  <div style={styles.helperText}>No tenant matches the current search or available unit history.</div>
                )}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Unit / Room *</label>
                <select
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  style={styles.select}
                  required
                  disabled={!formData.tenant_id}
                >
                  <option value="">Select a unit</option>
                  {selectedUnitOptions.map((unitOption) => (
                    <option key={unitOption.unit_id} value={unitOption.unit_id}>
                      {unitOption.unit_number} - {unitOption.building_name}
                    </option>
                  ))}
                </select>
                {formData.tenant_id && selectedUnitOptions.length === 0 && (
                  <div style={styles.helperText}>No unit history found for this tenant.</div>
                )}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Amount *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={styles.input}
                  placeholder="0"
                  step="0.01"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Period *</label>
                <input
                  type="month"
                  value={formData.payment_period}
                  onChange={(e) => setFormData({ ...formData, payment_period: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Payment Date *</label>
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  style={styles.select}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="check">Check</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Receipt (Image/PDF)</label>
                <div style={styles.receiptInputRow}>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    style={{ ...styles.input, flex: '1 1 220px' }}
                    accept=".jpg,.jpeg,.png,.pdf"
                  />
                  <label style={styles.cameraButton}>
                    Take Photo
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*"
                      capture="environment"
                      style={styles.hiddenFileInput}
                    />
                  </label>
                </div>
                {formData.receipt ? (
                  <div style={styles.receiptUploadPreview}>
                    {receiptPreviewUrl ? (
                      <img src={receiptPreviewUrl} alt="Selected receipt preview" style={styles.receiptPreviewImage} />
                    ) : (
                      <div style={styles.receiptPdfPreview}>PDF selected</div>
                    )}
                    <div style={styles.receiptPreviewName}>{formData.receipt.name}</div>
                  </div>
                ) : null}
              </div>

              {selectedTenant && (
                <div style={styles.infoBox}>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Tenant:</span>
                    <span style={styles.infoValue}>{selectedTenant.full_name}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Selected Unit:</span>
                    <span style={styles.infoValue}>{selectedUnitInfo ? `${selectedUnitInfo.unit_number} - ${selectedUnitInfo.building_name}` : 'Choose a unit'}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Monthly Rent:</span>
                    <span style={styles.infoValue}>{formatCurrency(selectedMonthlyRent)}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Already Recorded:</span>
                    <span style={styles.infoValue}>{formatCurrency(alreadyRecordedForSelection)}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Payment Now:</span>
                    <span style={{ ...styles.infoValue, color: '#10b981' }}>
                      {formatCurrency(selectedAmount)}
                    </span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Remaining:</span>
                    <span
                      style={{
                        ...styles.infoValue,
                        color: estimatedBalance > 0 ? '#ef4444' : '#10b981'
                      }}
                    >
                      {formatCurrency(estimatedBalance)}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                <label style={styles.label}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={styles.textarea}
                  placeholder="E.g., Partial payment, post-dated check, etc."
                />
              </div>
            </div>

            <div style={styles.formActions}>
              <button
                type="submit"
                style={{ ...styles.btnPrimary, ...(saving ? styles.btnDisabled : {}) }}
                disabled={saving}
              >
                {saving ? 'Saving...' : editingId ? 'Update Payment' : 'Save as Pending and Go to Confirm'}
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

      {/* Confirm Payment Tab */}
      {activeTab === 'confirm' && isManager() && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>Confirm Pending Payments</div>
          {filteredPendingPayments.length > 0 ? (
            <div style={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Tenant</th>
                    <th>Amount</th>
                    <th>Period</th>
                    <th>Method</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingPayments.map((payment) => (
                    <tr key={payment.id} style={{ borderLeft: '4px solid #f59e0b' }}>
                      <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600 }}>{payment.tenant_name}</td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>
                        {formatCurrency(payment.amount)}
                      </td>
                      <td>{payment.payment_period}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {payment.payment_method || 'Cash'}
                      </td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          style={{ ...styles.btnSmallSuccess, ...(confirmingId === payment.id ? styles.btnDisabled : {}) }}
                          onClick={() => handleConfirm(payment)}
                          disabled={confirmingId === payment.id}
                        >
                          {confirmingId === payment.id ? 'Confirming...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          style={styles.btnSmallEdit}
                          onClick={() => handleEdit(payment)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={{ ...styles.btnSmallDanger, ...(deletingId === payment.id ? styles.btnDisabled : {}) }}
                          onClick={() => handleDelete(payment.id)}
                          disabled={deletingId === payment.id}
                        >
                          {deletingId === payment.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={styles.emptyState}>
              <p>No pending payments match the current filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Payment History Tab */}
      {activeTab === 'history' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>Payment History</div>
          {filteredConfirmedPayments.length > 0 ? (
            <div style={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Tenant</th>
                    <th>Amount</th>
                    <th>Period</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Printed</th>
                    <th>Receipt File</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConfirmedPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600 }}>{payment.tenant_name}</td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>
                        {formatCurrency(payment.amount)}
                      </td>
                      <td>{payment.payment_period}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {payment.payment_method || 'Cash'}
                      </td>
                      <td>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: '#dcfce7',
                            color: '#166534'
                          }}
                        >
                          Confirmed
                        </span>
                      </td>
                      <td>
                        <span style={{
                          ...styles.badge,
                          backgroundColor: Number(payment.receipt_printed || 0) === 1 ? '#dcfce7' : '#fef3c7',
                          color: Number(payment.receipt_printed || 0) === 1 ? '#166534' : '#92400e'
                        }}>
                          {Number(payment.receipt_printed || 0) === 1 ? 'Printed' : 'Not Printed'}
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
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          style={styles.btnSmallSuccess}
                          onClick={() => openOfficialReceipt(payment)}
                          title="Print or download receipt"
                        >
                          Receipt
                        </button>
                        <button
                          type="button"
                          style={styles.btnSmallEdit}
                          onClick={() => openTenantStatusReceipt(payment)}
                          title="Tenant paid/unpaid status receipt"
                        >
                          Print Tenant Receipt
                        </button>
                        <button
                          type="button"
                          style={styles.btnSmallEdit}
                          onClick={() => handleEdit(payment)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={{ ...styles.btnSmallDanger, ...(deletingId === payment.id ? styles.btnDisabled : {}) }}
                          onClick={() => handleDelete(payment.id)}
                          disabled={deletingId === payment.id}
                        >
                          {deletingId === payment.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={styles.emptyState}>No confirmed payments match the current filters</div>
          )}
        </div>
      )}

      {activeTab === 'receipt-center' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>Print Tenant Receipts</div>
          <div style={styles.receiptFilterRow}>
            <label style={styles.filterLabel}>Receipt Print Status</label>
            <select
              value={receiptPrintFilter}
              onChange={(event) => setReceiptPrintFilter(event.target.value)}
              style={styles.receiptFilterSelect}
            >
              <option value="all">All</option>
              <option value="not_printed">Not Printed</option>
              <option value="printed">Printed</option>
            </select>
            <span style={styles.receiptFilterHint}>{filteredPaidReceiptRows.length} row(s) shown</span>
          </div>
          {filteredPaidReceiptRows.length > 0 ? (
            <div style={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Unit</th>
                    <th>Period</th>
                    <th>Expected Amount</th>
                    <th>Paid Amount</th>
                    <th>Balance</th>
                    <th>Printed</th>
                    <th>Printed At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPaidReceiptRows.map((payment) => (
                    <tr key={`receipt-center-${payment.id}`}>
                      <td style={{ fontWeight: 700 }}>{payment.tenant_name}</td>
                      <td>{payment.unit_number || '-'}</td>
                      <td>{payment.payment_period || '-'}</td>
                      <td>{formatCurrency(payment.monthly_rent)}</td>
                      <td style={{ color: '#10b981', fontWeight: 700 }}>{formatCurrency(payment.period_total_paid)}</td>
                      <td style={{ color: '#166534', fontWeight: 700 }}>{formatCurrency(payment.period_balance)}</td>
                      <td>
                        <span style={{
                          ...styles.badge,
                          backgroundColor: Number(payment.receipt_printed || 0) === 1 ? '#dcfce7' : '#fef3c7',
                          color: Number(payment.receipt_printed || 0) === 1 ? '#166534' : '#92400e'
                        }}>
                          {Number(payment.receipt_printed || 0) === 1 ? 'Printed' : 'Not Printed'}
                        </span>
                      </td>
                      <td>{payment.receipt_printed_at ? new Date(payment.receipt_printed_at).toLocaleString() : '-'}</td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          style={styles.btnSmallSuccess}
                          onClick={() => openOfficialReceipt(payment)}
                        >
                          Print Receipt
                        </button>
                        <button
                          type="button"
                          style={styles.btnSmallEdit}
                          onClick={() => openTenantStatusReceipt(payment)}
                        >
                          Print Tenant Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={styles.emptyState}>No fully paid tenants match the selected print filter.</div>
          )}
        </div>
      )}

      {/* Pending Payments Tab */}
      {activeTab === 'pending' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>Pending Payments ({filteredPendingPayments.length})</div>
          {filteredPendingPayments.length > 0 ? (
            <div style={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Tenant</th>
                    <th>Amount</th>
                    <th>Period</th>
                    <th>Receipt File</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingPayments.map((payment) => (
                    <tr key={payment.id} style={{ backgroundColor: '#fffbeb' }}>
                      <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600 }}>{payment.tenant_name}</td>
                      <td style={{ color: '#f59e0b', fontWeight: 600 }}>
                        {formatCurrency(payment.amount)}
                      </td>
                      <td>{payment.payment_period}</td>
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
                      <td style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {payment.notes || '-'}
                      </td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          style={styles.btnSmallEdit}
                          onClick={() => openTenantStatusReceipt(payment)}
                          title="Tenant paid/unpaid status receipt"
                        >
                          Print Tenant Receipt
                        </button>
                        <button
                          type="button"
                          style={{ ...styles.btnSmallSuccess, ...(confirmingId === payment.id ? styles.btnDisabled : {}) }}
                          onClick={() => handleConfirm(payment)}
                          title="Confirm"
                          disabled={confirmingId === payment.id}
                        >
                          {confirmingId === payment.id ? 'Confirming...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          style={styles.btnSmallEdit}
                          onClick={() => handleEdit(payment)}
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={{ ...styles.btnSmallDanger, ...(deletingId === payment.id ? styles.btnDisabled : {}) }}
                          onClick={() => handleDelete(payment.id)}
                          title="Delete"
                          disabled={deletingId === payment.id}
                        >
                          {deletingId === payment.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={styles.emptyState}>No pending payments match the current filters</div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && isManager() && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>Reports Overview</div>
          <div style={styles.reportsGrid}>
            <div style={styles.reportCard}>
              <div style={styles.reportTitle}>Income Report</div>
              <p>Monthly income breakdown and trends analysis.</p>
              <button type="button" onClick={() => navigate('/reports')} style={styles.reportLinkBtn}>
                View Full Report →
              </button>
            </div>

            <div style={styles.reportCard}>
              <div style={styles.reportTitle}>Tenant Payments</div>
              <p>Individual tenant payment history and details.</p>
              <button type="button" onClick={() => navigate('/payment-history')} style={styles.reportLinkBtn}>
                View Tenant History →
              </button>
            </div>

            <div style={styles.reportCard}>
              <div style={styles.reportTitle}>Daily Summary</div>
              <p>Daily income tracking and progress monitoring.</p>
              <button type="button" onClick={() => navigate('/daily-income')} style={styles.reportLinkBtn}>
                View Daily Summary →
              </button>
            </div>

            <div style={styles.reportCard}>
              <div style={styles.reportTitle}>Confirmation Queue</div>
              <p>Manage and confirm pending payment submissions.</p>
              <button type="button" onClick={() => navigate('/manual-confirmation')} style={styles.reportLinkBtn}>
                View Confirmation →
              </button>
            </div>
          </div>
        </div>
      )}
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
    marginBottom: '2rem',
    padding: '1.5rem',
    borderRadius: '1.1rem',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 56%, #0f766e 100%)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: '0 22px 46px rgba(15, 23, 42, 0.18)'
  },
  pageTitle: {
    fontSize: '2rem',
    fontWeight: 900,
    margin: 0,
    color: '#ffffff',
    lineHeight: 1.1,
    textShadow: '0 2px 10px rgba(15, 23, 42, 0.28)'
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#dbeafe',
    marginTop: '0.35rem',
    margin: 0
  },
  eyebrowPill: {
    display: 'inline-flex',
    color: '#0f172a',
    backgroundColor: '#ccfbf1',
    border: '1px solid rgba(255, 255, 255, 0.45)',
    borderRadius: '999px',
    padding: '0.35rem 0.75rem',
    marginBottom: '0.5rem',
    fontSize: '0.76rem',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.14)'
  },
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    flexWrap: 'wrap',
    marginTop: '0.9rem'
  },
  metaChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.48rem 0.82rem',
    borderRadius: '999px',
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: '0.8rem',
    fontWeight: 700
  },
  metaChipMuted: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.48rem 0.82rem',
    borderRadius: '999px',
    background: '#f1f5f9',
    color: '#475569',
    fontSize: '0.8rem',
    fontWeight: 700
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem'
  },
  innovationShell: {
    marginBottom: '2rem',
    display: 'grid',
    gap: '1rem'
  },
  innovationHero: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0f766e 100%)',
    color: '#fff',
    borderRadius: '1rem',
    padding: '1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  innovationEyebrow: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    opacity: 0.8,
    marginBottom: '0.4rem'
  },
  innovationTitle: {
    fontSize: '1.5rem',
    margin: 0,
    color: '#fff'
  },
  innovationText: {
    margin: '0.5rem 0 0 0',
    maxWidth: '620px',
    color: 'rgba(255,255,255,0.88)'
  },
  innovationActions: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  heroActionBtn: {
    background: '#fff',
    color: '#0f172a',
    padding: '0.9rem 1.05rem',
    borderRadius: '0.9rem',
    border: '1px solid rgba(255,255,255,0.65)',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 14px 28px rgba(15, 23, 42, 0.12)'
  },
  heroGhostBtn: {
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    padding: '0.9rem 1.05rem',
    borderRadius: '0.9rem',
    border: '1px solid rgba(255,255,255,0.25)',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 14px 28px rgba(15, 23, 42, 0.08)'
  },
  innovationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem'
  },
  signalCard: {
    background: '#fff',
    border: '1px solid #dbeafe',
    borderRadius: '1rem',
    padding: '1.05rem',
    boxShadow: '0 10px 26px rgba(37, 99, 235, 0.08)'
  },
  signalCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.6rem'
  },
  signalIconWrap: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  signalLabel: {
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    marginBottom: '0.5rem'
  },
  signalValue: {
    fontSize: '1.8rem',
    fontWeight: 800,
    color: '#0f172a'
  },
  signalValueSmall: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#0f172a'
  },
  signalHint: {
    marginTop: '0.5rem',
    color: '#475569',
    fontSize: '0.88rem'
  },
  progressTrack: {
    marginTop: '0.75rem',
    height: '0.65rem',
    borderRadius: '999px',
    background: '#dbeafe',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: '999px',
    background: 'linear-gradient(90deg, #2563eb 0%, #0f766e 100%)'
  },
  filterPanel: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '0.9rem',
    padding: '1rem',
    display: 'grid',
    gridTemplateColumns: 'minmax(240px, 2fr) repeat(2, minmax(180px, 1fr))',
    gap: '1rem'
  },
  filterGroupWide: {
    display: 'flex',
    flexDirection: 'column'
  },
  filterGroupCompact: {
    display: 'flex',
    flexDirection: 'column'
  },
  filterLabel: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#475569',
    marginBottom: '0.35rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  filterInput: {
    padding: '0.85rem 0.95rem',
    border: '1.5px solid #cbd5e1',
    borderRadius: '0.85rem',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    background: '#ffffff',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.05)'
  },
  filterInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0 0.95rem',
    border: '1.5px solid #cbd5e1',
    borderRadius: '0.85rem',
    background: '#ffffff',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.05)'
  },
  filterInputIcon: {
    color: '#64748b',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  filterInputBare: {
    width: '100%',
    minWidth: 0,
    padding: '0.85rem 0',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    color: '#0f172a'
  },
  attentionBoard: {
    background: '#fffaf0',
    border: '1px solid #fde68a',
    borderRadius: '0.9rem',
    padding: '1rem'
  },
  attentionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1rem',
    flexWrap: 'wrap'
  },
  attentionTitle: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#78350f'
  },
  attentionSubtitle: {
    fontSize: '0.88rem',
    color: '#92400e'
  },
  attentionLinkBtn: {
    border: '1px solid #92400e',
    background: '#78350f',
    color: '#fff',
    borderRadius: '0.8rem',
    padding: '0.72rem 0.95rem',
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 10px 20px rgba(146, 64, 14, 0.18)'
  },
  attentionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.9rem'
  },
  attentionCard: {
    background: '#fff',
    borderRadius: '0.8rem',
    border: '1px solid #fcd34d',
    padding: '0.9rem'
  },
  attentionTenant: {
    fontWeight: 800,
    color: '#1f2937'
  },
  attentionMeta: {
    fontSize: '0.8rem',
    color: '#6b7280',
    marginTop: '0.2rem'
  },
  attentionAmounts: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    marginTop: '0.7rem',
    fontSize: '0.82rem',
    color: '#475569'
  },
  attentionRemaining: {
    marginTop: '0.8rem',
    fontWeight: 800,
    color: '#b45309'
  },
  statCard: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
    border: '2px solid #e5e7eb',
    borderRadius: '1rem',
    padding: '1.35rem',
    textAlign: 'left',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)'
  },
  statCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.9rem'
  },
  statIconWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
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
    fontWeight: 700,
    marginBottom: '0.5rem'
  },
  statSubtext: {
    fontSize: '0.75rem',
    color: '#6b7280'
  },
  tabs: {
    display: 'flex',
    borderBottom: '2px solid #e5e7eb',
    gap: 0,
    marginBottom: '1.5rem',
    overflowX: 'auto'
  },
  tabButton: {
    padding: '0.95rem 1.2rem',
    background: '#ffffff',
    border: '1px solid transparent',
    borderBottom: '3px solid transparent',
    color: '#6b7280',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginBottom: '-2px',
    whiteSpace: 'nowrap',
    borderTopLeftRadius: '0.8rem',
    borderTopRightRadius: '0.8rem'
  },
  tabButtonActive: {
    color: '#2563eb',
    borderBottomColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    borderColor: '#dbeafe'
  },
  card: {
    background: '#ffffff',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb'
  },
  cardHeader: {
    fontSize: '1.16rem',
    fontWeight: 800,
    marginBottom: '1.5rem',
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '1rem',
    color: '#1f2937',
    letterSpacing: '-0.01em'
  },
  cardIntro: {
    marginTop: '-0.35rem',
    marginBottom: '1.4rem',
    color: '#64748b',
    fontSize: '0.92rem',
    lineHeight: 1.6
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem',
    marginBottom: '1.5rem'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    color: '#1f2937'
  },
  input: {
    padding: '0.75rem',
    border: '1.5px solid #e5e7eb',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    transition: 'all 0.3s ease'
  },
  select: {
    padding: '0.75rem',
    border: '1.5px solid #e5e7eb',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit'
  },
  helperText: {
    marginTop: '0.5rem',
    fontSize: '0.75rem',
    color: '#92400e'
  },
  receiptUploadPreview: {
    marginTop: '0.7rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.75rem',
    padding: '0.65rem',
    background: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
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
    minHeight: '44px',
    padding: '0 1rem',
    borderRadius: '0.75rem',
    border: '1px solid #99f6e4',
    backgroundColor: '#f0fdfa',
    color: '#0f766e',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  hiddenFileInput: {
    display: 'none'
  },
  receiptPreviewImage: {
    width: '72px',
    height: '72px',
    borderRadius: '0.55rem',
    objectFit: 'cover',
    border: '1px solid #d1d5db',
    background: '#ffffff',
    flexShrink: 0
  },
  receiptPdfPreview: {
    width: '72px',
    height: '72px',
    borderRadius: '0.55rem',
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.72rem',
    fontWeight: 800,
    flexShrink: 0
  },
  receiptPreviewName: {
    color: '#374151',
    fontSize: '0.82rem',
    fontWeight: 700,
    overflowWrap: 'anywhere',
    lineHeight: 1.35
  },
  textarea: {
    padding: '0.75rem',
    border: '1.5px solid #e5e7eb',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: '100px'
  },
  infoBox: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '1rem',
    gridColumn: '1 / -1'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    fontSize: '0.875rem'
  },
  infoLabel: {
    fontWeight: 600,
    color: '#6b7280'
  },
  infoValue: {
    color: '#1f2937',
    fontWeight: 500
  },
  formActions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end'
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    color: 'white',
    padding: '0.88rem 1.35rem',
    border: 'none',
    borderRadius: '0.85rem',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 14px 26px rgba(67, 56, 202, 0.18)'
  },
  btnSecondary: {
    background: '#f3f4f6',
    color: '#374151',
    padding: '0.88rem 1.35rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.85rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnDisabled: {
    opacity: 0.58,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  btnSmallSuccess: {
    background: '#dcfce7',
    color: '#166534',
    padding: '0.58rem 0.82rem',
    border: '1px solid #bbf7d0',
    borderRadius: '0.75rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer'
  },
  btnSmallEdit: {
    background: '#dbeafe',
    color: '#1e40af',
    padding: '0.58rem 0.82rem',
    border: '1px solid #bfdbfe',
    borderRadius: '0.75rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer'
  },
  btnSmallDanger: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '0.58rem 0.82rem',
    border: '1px solid #fecaca',
    borderRadius: '0.75rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer'
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
  receiptLinkBtn: {
    display: 'inline-block',
    padding: '0.5rem 0.72rem',
    borderRadius: '0.7rem',
    background: '#dbeafe',
    color: '#1e40af',
    textDecoration: 'none',
    fontSize: '0.78rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    border: '1px solid #bfdbfe'
  },
  noReceiptText: {
    color: '#9ca3af',
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  reportsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem'
  },
  reportCard: {
    padding: '1.5rem',
    background: 'linear-gradient(135deg, #f0f9ff 0%, #f3e8ff 100%)',
    border: '1px solid #bfdbfe',
    borderRadius: '0.75rem',
    transition: 'all 0.3s ease'
  },
  reportTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
    color: '#1f2937'
  },
  reportLinkBtn: {
    border: '1px solid #bfdbfe',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.84rem',
    cursor: 'pointer',
    padding: '0.62rem 0.82rem',
    marginTop: '1rem',
    borderRadius: '0.75rem',
    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.08)'
  },
  receiptFilterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    flexWrap: 'wrap',
    marginBottom: '0.9rem'
  },
  receiptFilterSelect: {
    padding: '0.6rem 0.78rem',
    borderRadius: '0.72rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    fontWeight: 700,
    fontSize: '0.84rem'
  },
  receiptFilterHint: {
    fontSize: '0.82rem',
    color: '#64748b',
    fontWeight: 700
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
  tenantReceiptOverlay: {
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
  tenantReceiptModal: {
    width: 'min(680px, 100%)',
    maxHeight: '92vh',
    overflow: 'auto',
    borderRadius: '1rem'
  },
  tenantReceiptToolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: '0.6rem',
    marginBottom: '0.75rem'
  },
  tenantReceiptPrintButton: {
    padding: '0.62rem 0.92rem',
    borderRadius: '0.74rem',
    border: '1px solid #047857',
    backgroundColor: '#ecfdf5',
    color: '#047857',
    fontWeight: 800,
    cursor: 'pointer'
  },
  tenantReceiptDownloadButton: {
    padding: '0.62rem 0.92rem',
    borderRadius: '0.74rem',
    border: '1px solid #1d4ed8',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 800,
    cursor: 'pointer'
  },
  tenantReceiptCloseButton: {
    padding: '0.62rem 0.92rem',
    borderRadius: '0.74rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontWeight: 800,
    cursor: 'pointer'
  },
  tenantReceiptCard: {
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
  tenantReceiptWatermark: {
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
  tenantReceiptHeaderBlock: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.55rem',
    marginBottom: '0.5rem'
  },
  tenantReceiptLogo: {
    width: '40px',
    height: '40px',
    objectFit: 'contain',
    flexShrink: 0
  },
  tenantReceiptCompanyBlock: {
    flex: 1
  },
  tenantReceiptBrand: {
    position: 'relative',
    zIndex: 1,
    fontSize: '0.78rem',
    fontWeight: 900,
    letterSpacing: '0.04em',
    color: '#1e3a5f',
    lineHeight: 1.25
  },
  tenantReceiptCompanySubtitle: {
    marginTop: '0.28rem',
    color: '#6b7280',
    fontSize: '0.52rem',
    fontWeight: 800,
    lineHeight: 1.35,
    textTransform: 'uppercase'
  },
  tenantReceiptMetaBlock: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '150px',
    textAlign: 'right'
  },
  tenantReceiptNumber: {
    color: '#1d4ed8',
    fontSize: '0.62rem',
    fontWeight: 900,
    overflowWrap: 'anywhere'
  },
  tenantReceiptTitle: {
    position: 'relative',
    zIndex: 1,
    margin: '0.5rem 0 0.45rem',
    textAlign: 'center',
    fontSize: '0.68rem',
    fontWeight: 900,
    color: '#374151',
    letterSpacing: '0.14em',
    textTransform: 'uppercase'
  },
  tenantReceiptMeta: {
    position: 'relative',
    zIndex: 1,
    color: '#475569',
    fontSize: '0.58rem',
    marginTop: '0.12rem'
  },
  tenantReceiptSection: {
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
  tenantReceiptInfoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.08rem',
    color: '#111827',
    fontSize: '0.66rem',
    fontWeight: 800,
    lineHeight: 1.32
  },
  tenantReceiptInfoLabel: {
    display: 'block',
    color: '#9ca3af',
    fontSize: '0.48rem',
    fontWeight: 900,
    letterSpacing: '0.08em',
    lineHeight: 1.15,
    textTransform: 'uppercase',
    marginBottom: '0.08rem'
  },
  tenantReceiptPaidText: {
    color: '#16a34a'
  },
  tenantReceiptUnpaidText: {
    color: '#d97706'
  },
  tenantReceiptRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.72rem 0.85rem',
    borderBottom: '1px solid #e2e8f0',
    color: '#1f2937'
  },
  tenantReceiptStatus: {
    position: 'relative',
    zIndex: 1,
    marginTop: '1rem',
    padding: '0.75rem 0.9rem',
    borderRadius: '0.8rem',
    fontWeight: 800
  },
  tenantReceiptStatusPaid: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    border: '1px solid #86efac'
  },
  tenantReceiptStatusUnpaid: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fcd34d'
  },
  tenantReceiptAmountBox: {
    position: 'relative',
    zIndex: 1,
    margin: '0.5rem 0 0.42rem',
    padding: '0.62rem 0.55rem',
    textAlign: 'center',
    background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
    border: '2px solid #86efac',
    borderRadius: '0.75rem'
  },
  tenantReceiptAmountLabel: {
    color: '#16a34a',
    fontSize: '0.54rem',
    fontWeight: 900,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '0.22rem'
  },
  tenantReceiptAmountValue: {
    color: '#15803d',
    fontSize: '1.24rem',
    fontWeight: 900,
    lineHeight: 1.15
  },
  tenantReceiptPaidStamp: {
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
  tenantReceiptPaidIcon: {
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
  tenantReceiptSummaryGrid: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.25rem',
    paddingTop: '0.45rem',
    borderTop: '1px dashed #d1d5db'
  },
  tenantReceiptSummaryItem: {
    border: '1px solid #e5e7eb',
    borderRadius: '0.6rem',
    padding: '0.3rem',
    backgroundColor: 'rgba(249, 250, 251, 0.86)',
    color: '#111827',
    fontSize: '0.54rem',
    fontWeight: 900
  },
  tenantReceiptSignatureArea: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    gap: '1.2rem',
    justifyContent: 'space-around',
    padding: '0.55rem 0 0.15rem'
  },
  tenantReceiptSignatureBlock: {
    flex: 1,
    textAlign: 'center'
  },
  tenantReceiptSignatureLine: {
    borderBottom: '1.5px solid #374151',
    height: '1.25rem',
    marginBottom: '0.2rem'
  },
  tenantReceiptSignatureLabel: {
    color: '#6b7280',
    fontSize: '0.5rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase'
  },
  tenantReceiptFooter: {
    position: 'relative',
    zIndex: 1,
    marginTop: '0.42rem',
    paddingTop: '0.42rem',
    borderTop: '1px solid #f3f4f6',
    color: '#6b7280',
    fontSize: '0.54rem',
    textAlign: 'center'
  },
  tenantReceiptFooterMuted: {
    marginTop: '0.25rem',
    color: '#9ca3af',
    fontSize: '0.5rem'
  }
};

export default EnhancedPayments;

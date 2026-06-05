import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { paymentService, tenantService, unitService } from '../services/api';
import { useDataSync } from '../context/DataSyncContext';
import useFeedbackToast from '../hooks/useFeedbackToast';

const formatCurrency = (value) =>
  `${parseFloat(value || 0).toLocaleString()} RWF`;
const documentAllowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const maxDocumentSize = 10 * 1024 * 1024;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const parseLocalDate = (dateValue) => {
  if (!dateValue) return null;

  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateInputValue = (dateValue) => {
  if (!dateValue) return '';

  if (typeof dateValue === 'string') {
    const dateMatch = dateValue.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) return dateMatch[0];
  }

  const parsed = parseLocalDate(dateValue);
  if (!parsed) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTenantDueInfo = (tenant, referenceDate = new Date()) => {
  if (!tenant?.move_in_date) {
    return {
      dueDate: null,
      daysUntilDue: null,
      isDueToday: false,
      isReminderWindow: false,
      reminderText: 'No due date'
    };
  }

  const moveInDate = parseLocalDate(tenant.move_in_date);
  if (!moveInDate) {
    return {
      dueDate: null,
      daysUntilDue: null,
      isDueToday: false,
      isReminderWindow: false,
      reminderText: 'No due date'
    };
  }

  const dueDay = moveInDate.getDate();
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  const resolveDueDate = (year, month) => {
    const lastDayInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dueDay, lastDayInMonth));
  };

  let dueDate = resolveDueDate(today.getFullYear(), today.getMonth());
  if (dueDate < today) {
    dueDate = resolveDueDate(today.getFullYear(), today.getMonth() + 1);
  }

  const daysUntilDue = Math.round((dueDate - today) / MS_PER_DAY);
  const duePeriod = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
  const isDueToday = daysUntilDue === 0;
  const isReminderWindow = daysUntilDue > 0 && daysUntilDue <= 3;

  let reminderText = 'No reminder';
  if (isDueToday) reminderText = 'Due today';
  else if (isReminderWindow) reminderText = `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;

  return {
    dueDate,
    duePeriod,
    daysUntilDue,
    isDueToday,
    isReminderWindow,
    reminderText
  };
};

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const floorNameMap = {
  GF: 'GROUND FLOOR',
  '0F': 'GROUND FLOOR',
  '1F': 'FIRST FLOOR',
  '1ST FLOOR': 'FIRST FLOOR',
  '2F': 'SECOND FLOOR',
  '2ND FLOOR': 'SECOND FLOOR',
  '3F': 'THIRD FLOOR',
  '3RD FLOOR': 'THIRD FLOOR',
  '4F': 'FOURTH FLOOR',
  '4TH FLOOR': 'FOURTH FLOOR',
  '5F': 'FIFTH FLOOR',
  '6F': 'SIXTH FLOOR',
  '7F': 'SEVENTH FLOOR',
  '8F': 'EIGHTH FLOOR',
  '9F': 'NINTH FLOOR',
  '10F': 'TENTH FLOOR'
};

const getTenantFloorLabel = (tenant) => {
  const explicitFloor = String(tenant.floor || '').trim();
  if (explicitFloor) {
    const normalizedFloor = explicitFloor.toUpperCase();
    return floorNameMap[normalizedFloor] || normalizedFloor;
  }

  const unitPrefix = String(tenant.unit_number || '').trim().split(/\s+/)[0]?.toUpperCase();
  return floorNameMap[unitPrefix] || 'NO FLOOR ASSIGNED';
};

const getFloorSortValue = (floorLabel) => {
  if (floorLabel === 'GROUND FLOOR') return 0;
  if (floorLabel === 'NO FLOOR ASSIGNED') return 999;

  const orderedFloors = Object.values(floorNameMap);
  const index = orderedFloors.indexOf(floorLabel);
  return index >= 0 ? index : 500;
};

const unitNumberSorter = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

const getTenantBuildingLabel = (tenant) => String(tenant.building_name || 'NO BUILDING ASSIGNED').trim().toUpperCase();
const getTenantRentForPeriod = (tenant, period) => {
  const history = Array.isArray(tenant.rent_history) ? tenant.rent_history : [];
  const matchingRecord = history
    .filter((record) => record.start_period <= period && (!record.end_period || record.end_period >= period))
    .sort((first, second) => second.start_period.localeCompare(first.start_period))[0];

  return parseFloat(matchingRecord?.amount || tenant.monthly_rent || 0);
};

const isPastOrToday = (dateValue) => {
  const date = parseLocalDate(dateValue);
  if (!date) return false;
  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date <= localToday;
};

const isFutureDate = (dateValue) => {
  const date = parseLocalDate(dateValue);
  if (!date) return false;
  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date > localToday;
};

const getTenantLifecycleStatus = (tenant) => {
  if (tenant?.move_out_date && isPastOrToday(tenant.move_out_date)) return 'expired';
  if (tenant?.status === 'inactive') return 'inactive';
  return 'active';
};

const isCurrentOccupant = (tenant) =>
  getTenantLifecycleStatus(tenant) === 'active' && !isFutureDate(tenant?.move_in_date);

const getTenantLifecycleLabel = (tenant) => {
  const lifecycle = getTenantLifecycleStatus(tenant);
  if (lifecycle === 'expired') return 'Former';
  if (lifecycle === 'inactive') return 'Inactive';
  return 'Active';
};

const Tenants = ({ reminderWindowOnly = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isManager } = useAuth();
  const { versions, notifyDataChanged } = useDataSync();
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [tenantSearch, setTenantSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedTenantPayments, setSelectedTenantPayments] = useState([]);
  const [showTenantDetails, setShowTenantDetails] = useState(false);
  const [payments, setPayments] = useState([]);
  const [currentTenantIdx, setCurrentTenantIdx] = useState(0);
  const [buildingUnitFilter, setBuildingUnitFilter] = useState(null);
  const [tenantPendingDelete, setTenantPendingDelete] = useState(null);
  const [deletingTenant, setDeletingTenant] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantStatusFilter, setTenantStatusFilter] = useState('active');
  const [showReminderPanel, setShowReminderPanel] = useState(false);
  const tableRef = React.useRef();
  const canManageOperations = isManager();

  useFeedbackToast(error, 'error');
  useFeedbackToast(success, 'success');









  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    national_id: '',
    identification_document: '',
    identification_document_file: null,
    address: '',
    occupation_status: '',
    occupation_place: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    unit_id: '',
    move_in_date: '',
    move_out_date: '',
    status: 'active'
  });

  useEffect(() => {
    fetchTenants();
    fetchUnits();
    fetchPayments();
  }, [versions.tenants, versions.units, versions.payments]);

  useEffect(() => {
    const addTenantForBuilding = location.state?.addTenantForBuilding;
    if (!addTenantForBuilding) return;

    setBuildingUnitFilter(addTenantForBuilding);
    setShowForm(true);
    navigate('/tenants', { replace: true, state: null });
  }, [location.state, navigate]);

  const isReminderPopupWindow = reminderWindowOnly || new URLSearchParams(location.search).get('popup') === 'reminders';

  useEffect(() => {
    if (isReminderPopupWindow) {
      setShowReminderPanel(true);
    }
  }, [isReminderPopupWindow]);

  useEffect(() => {
    if (!isReminderPopupWindow) return undefined;

    const refreshReminderData = () => {
      fetchTenants();
      fetchPayments();
    };
    const intervalId = window.setInterval(refreshReminderData, 30000);

    return () => window.clearInterval(intervalId);
  }, [isReminderPopupWindow]);

  const fetchTenants = async () => {
    try {
      const response = await tenantService.getAll();
      setTenants(response.data);
    } catch (err) {
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await unitService.getAll();
      setUnits(response.data);
    } catch (err) {
      console.error('Failed to load units');
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await paymentService.getAll();
      setPayments(response.data || []);
    } catch (err) {
      console.error('Failed to load payments');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingTenant) return;
    setError('');
    setSuccess('');

    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }
    if (!formData.full_name.trim() || !formData.unit_id || !formData.move_in_date) {
      setError('Tenant name, unit, and move-in date are required.');
      return;
    }
    if (formData.move_out_date && formData.move_in_date && formData.move_out_date < formData.move_in_date) {
      setError('Move-out date cannot be before move-in date.');
      return;
    }

    try {
      setSavingTenant(true);
      const submitData = { ...formData };
      // If no file selected, remove the file field
      if (!formData.identification_document_file) {
        delete submitData.identification_document_file;
      }
      if (editingId) {
        await tenantService.update(editingId, submitData);
        setSuccess('Tenant updated successfully');
      } else {
        await tenantService.create(submitData);
        setSuccess('Tenant created successfully');
      }

      notifyDataChanged(['tenants', 'units', 'dashboard', 'reports']);

      resetForm();
      fetchTenants();
      fetchPayments();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save tenant');
    } finally {
      setSavingTenant(false);
    }
  };

  const handleEdit = (tenant) => {
    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    setFormData({
      full_name: tenant.full_name,
      email: tenant.email || '',
      phone: tenant.phone || '',
      national_id: tenant.national_id || '',
      identification_document: tenant.identification_document || '',
      address: tenant.address || '',
      occupation_status: tenant.occupation_status || '',
      occupation_place: tenant.occupation_place || '',
      emergency_contact_name: tenant.emergency_contact_name || '',
      emergency_contact_phone: tenant.emergency_contact_phone || '',
      unit_id: tenant.unit_id || '',
      move_in_date: formatDateInputValue(tenant.move_in_date),
      move_out_date: formatDateInputValue(tenant.move_out_date),
      status: tenant.status || 'active'
    });
    setEditingId(tenant.id);
    setShowForm(true);
  };

  const handleViewTenant = async (tenant) => {
    setError('');

    try {
      const [tenantResponse, paymentsResponse] = await Promise.all([
        tenantService.getById(tenant.id),
        paymentService.getByTenant(tenant.id)
      ]);

      setSelectedTenant(tenantResponse.data);
      setSelectedTenantPayments(paymentsResponse.data);
      setShowTenantDetails(true);
    } catch (err) {
      setError('Failed to load tenant details');
    }
  };

  const handleRecordPayment = (tenant) => {
    navigate('/payments', {
      state: {
        recordPaymentFor: {
          tenantId: tenant.id,
          unitId: tenant.unit_id,
          amount: tenant.balance > 0 ? tenant.balance : tenant.monthly_rent,
          period: new Date().toISOString().slice(0, 7),
          notes: `Rent payment for ${tenant.unit_number || 'assigned unit'}`
        }
      }
    });
  };

  const handleReminderPayment = (entry) => {
    if (!entry?.tenant) {
      setError(`Tenant record for ${entry?.name || 'this reminder'} was not found. Open the tenant list and confirm the name/unit.`);
      return;
    }

    handleRecordPayment(entry.tenant);
  };

  const handleOpenRemindersWindow = () => {
    if (isReminderPopupWindow) {
      navigate('/tenants');
      return;
    }

    navigate('/tenants/reminders');
  };

  const handleDelete = (tenant) => {
    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    setTenantPendingDelete(tenant);
  };

  const confirmDeleteTenant = async () => {
    if (!tenantPendingDelete || deletingTenant) return;

    setDeletingTenant(true);
    setError('');
    setSuccess('');

    try {
      await tenantService.delete(tenantPendingDelete.id);
      setSuccess('Tenant moved out successfully. History was kept under Former tenants.');
      setTenantPendingDelete(null);
      setTenantStatusFilter('expired');
      notifyDataChanged(['tenants', 'units', 'dashboard', 'reports']);
      fetchTenants();
      fetchPayments();
    } catch (err) {
      setError('Failed to move tenant out');
    } finally {
      setDeletingTenant(false);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      national_id: '',
      identification_document: '',
      address: '',
      occupation_status: '',
      occupation_place: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      unit_id: '',
      move_in_date: '',
      move_out_date: '',
      status: 'active'
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    if (type === 'file') {
      const file = files?.[0] || null;
      if (file && (!documentAllowedTypes.has(file.type) || file.size > maxDocumentSize)) {
        e.target.value = '';
        setError('Identification document must be a JPG, PNG, or PDF file up to 10MB.');
        setFormData({ ...formData, [name]: null });
        return;
      }
      setFormData({ ...formData, [name]: file });
    } else if (name === 'status' && value === 'active') {
      setFormData({ ...formData, status: value, move_out_date: '' });
    } else if (name === 'status' && value === 'inactive') {
      setFormData({ ...formData, status: value, move_out_date: formData.move_out_date || formatDateInputValue(new Date()) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleMakeTenantActive = async (tenant) => {
    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    setError('');
    setSuccess('');

    try {
      await tenantService.update(tenant.id, {
        ...tenant,
        status: 'active',
        move_out_date: ''
      });
      setSuccess('Tenant is active again.');
      setTenantStatusFilter('active');
      notifyDataChanged(['tenants', 'units', 'dashboard', 'reports']);
      fetchTenants();
      fetchPayments();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to make tenant active');
    }
  };

  const tenantDueMap = tenants.reduce((acc, tenant) => {
    acc[tenant.id] = getTenantDueInfo(tenant);
    return acc;
  }, {});
  const tenantMonthlyPaymentTotals = payments.reduce((acc, payment) => {
    if ((payment.payment_status || 'confirmed') !== 'confirmed') return acc;

    const period = payment.payment_period || payment.payment_date?.slice(0, 7);
    if (!period) return acc;

    const key = `${String(payment.tenant_id)}:${String(payment.unit_id)}:${period}`;
    acc[key] = (acc[key] || 0) + parseFloat(payment.amount || 0);
    return acc;
  }, {});
  const hasTenantPaidCurrentMonth = (tenant) => {
    const duePeriod = tenantDueMap[tenant.id]?.duePeriod;
    if (!duePeriod) return false;

    const expectedRent = getTenantRentForPeriod(tenant, duePeriod);
    const paidAmount = tenantMonthlyPaymentTotals[`${String(tenant.id)}:${String(tenant.unit_id)}:${duePeriod}`] || 0;
    return expectedRent > 0 && paidAmount >= expectedRent;
  };

  const normalizedTenantSearch = tenantSearch.trim().toLowerCase();
  const tenantStatusCounts = tenants.reduce((acc, tenant) => {
    const statusKey = getTenantLifecycleStatus(tenant);
    acc[statusKey] = (acc[statusKey] || 0) + 1;
    acc.all += 1;
    return acc;
  }, { all: 0, active: 0, expired: 0, inactive: 0 });

  const filteredTenants = tenants.filter((tenant) => {
    const lifecycleStatus = getTenantLifecycleStatus(tenant);
    const matchesStatus = tenantStatusFilter === 'all' || lifecycleStatus === tenantStatusFilter;
    if (!matchesStatus) return false;

    if (!normalizedTenantSearch) return true;

    return [
      tenant.full_name,
      tenant.email,
      tenant.phone,
      tenant.unit_number,
      tenant.building_name,
      tenant.national_id
    ].some((value) => String(value || '').toLowerCase().includes(normalizedTenantSearch));
  });
  const activeReminderTenants = tenants.filter(isCurrentOccupant);
  const selectableUnits = units
    .filter((unit) => {
      const matchesBuilding = !buildingUnitFilter?.buildingId || unit.building_id === buildingUnitFilter.buildingId || unit.id === formData.unit_id;
      const isAssignable = unit.status !== 'occupied' || unit.id === formData.unit_id;
      return matchesBuilding && isAssignable;
    })
    .sort((firstUnit, secondUnit) => {
      const buildingComparison = String(firstUnit.building_name || '').localeCompare(String(secondUnit.building_name || ''));
      if (buildingComparison) return buildingComparison;

      return unitNumberSorter.compare(firstUnit.unit_number || '', secondUnit.unit_number || '');
    });

  const dueTodayTenants = activeReminderTenants
    .filter((tenant) => tenantDueMap[tenant.id]?.isDueToday && !hasTenantPaidCurrentMonth(tenant))
    .sort((firstTenant, secondTenant) => unitNumberSorter.compare(firstTenant.unit_number || '', secondTenant.unit_number || ''));
  const upcomingDueTenants = activeReminderTenants
    .filter((tenant) => tenantDueMap[tenant.id]?.isReminderWindow && !hasTenantPaidCurrentMonth(tenant))
    .sort((firstTenant, secondTenant) => unitNumberSorter.compare(firstTenant.unit_number || '', secondTenant.unit_number || ''));

  const dueTodayReminderEntries = dueTodayTenants.map((tenant) => ({
    id: `today-${tenant.id}`,
    name: tenant.full_name,
    unit: tenant.unit_number || '-',
    dueText: 'Due today',
    tenant
  }));

  const upcomingReminderEntries = upcomingDueTenants.map((tenant) => ({
    id: `soon-${tenant.id}`,
    name: tenant.full_name,
    unit: tenant.unit_number || '-',
    dueText: tenantDueMap[tenant.id]?.reminderText || 'Due soon',
    tenant
  }));
  const totalReminderCount = dueTodayReminderEntries.length + upcomingReminderEntries.length;

  const groupedTenantsByFloor = Object.values(
    filteredTenants.reduce((groups, tenant, index) => {
      const floorLabel = getTenantFloorLabel(tenant);
      const buildingLabel = getTenantBuildingLabel(tenant);
      const groupKey = `${buildingLabel}__${floorLabel}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          buildingLabel,
          floorLabel,
          tenants: []
        };
      }

      groups[groupKey].tenants.push({ tenant, index });
      return groups;
    }, {})
  )
    .sort((firstGroup, secondGroup) => {
      const buildingComparison = firstGroup.buildingLabel.localeCompare(secondGroup.buildingLabel);
      if (buildingComparison) return buildingComparison;

      const floorDifference = getFloorSortValue(firstGroup.floorLabel) - getFloorSortValue(secondGroup.floorLabel);
      return floorDifference || firstGroup.floorLabel.localeCompare(secondGroup.floorLabel);
    })
    .map((group) => ({
      ...group,
      tenants: group.tenants.sort((firstTenant, secondTenant) =>
        unitNumberSorter.compare(firstTenant.tenant.unit_number || '', secondTenant.tenant.unit_number || '')
      )
    }));

  if (loading) return <div style={styles.loading}>Loading...</div>;

  if (reminderWindowOnly) {
    return (
      <main className="rent-reminders-window">
        <section className="rent-reminders-hero">
          <div>
            <span className="rent-reminders-eyebrow">Rent follow-up</span>
            <h1>Rent Due Reminders</h1>
            <p>Tenants due today and within the next 3 days, ready for quick payment follow-up.</p>
          </div>
          <div className="rent-reminders-total" aria-label={`${totalReminderCount} open reminders`}>
            <strong>{totalReminderCount}</strong>
            <span>open</span>
          </div>
        </section>

        <div className="rent-reminders-toolbar">
          <button type="button" className="rent-reminders-back" onClick={handleOpenRemindersWindow}>
            Back to Tenants
          </button>
        </div>

        {error && <div className="rent-reminders-alert rent-reminders-alert--error">{error}</div>}
        {success && <div className="rent-reminders-alert rent-reminders-alert--success">{success}</div>}

        <section className="rent-reminders-summary" aria-label="Reminder totals">
          <div className="rent-reminders-stat rent-reminders-stat--danger">
            <span>Due today</span>
            <strong>{dueTodayReminderEntries.length}</strong>
          </div>
          <div className="rent-reminders-stat rent-reminders-stat--warn">
            <span>Due soon</span>
            <strong>{upcomingReminderEntries.length}</strong>
          </div>
          <div className="rent-reminders-stat">
            <span>Tracked tenants</span>
            <strong>{activeReminderTenants.length}</strong>
          </div>
        </section>

        <section className="rent-reminders-board">
          <article className="rent-reminders-panel rent-reminders-panel--danger">
            <header>
              <span className="rent-reminders-panel-kicker">Immediate</span>
              <h2>Due Today</h2>
            </header>
            <div className="rent-reminders-list">
              {dueTodayReminderEntries.length > 0 ? dueTodayReminderEntries.map((entry) => (
                <div className="rent-reminders-item" key={entry.id}>
                  <div className="rent-reminders-person">
                    <button type="button" onClick={() => entry.tenant && handleViewTenant(entry.tenant)}>
                      {entry.name}
                    </button>
                    <span>Unit {entry.unit || '-'}</span>
                  </div>
                  <span className="rent-reminders-chip rent-reminders-chip--danger">Due today</span>
                  <button
                    type="button"
                    className="rent-reminders-action"
                    disabled={!entry.tenant}
                    onClick={() => handleReminderPayment(entry)}
                  >
                    Record Payment
                  </button>
                </div>
              )) : <div className="rent-reminders-empty">No rent due today.</div>}
            </div>
          </article>

          <article className="rent-reminders-panel rent-reminders-panel--warn">
            <header>
              <span className="rent-reminders-panel-kicker">Next 3 days</span>
              <h2>Due Soon</h2>
            </header>
            <div className="rent-reminders-list">
              {upcomingReminderEntries.length > 0 ? upcomingReminderEntries.map((entry) => (
                <div className="rent-reminders-item" key={entry.id}>
                  <div className="rent-reminders-person">
                    <button type="button" onClick={() => entry.tenant && handleViewTenant(entry.tenant)}>
                      {entry.name}
                    </button>
                    <span>Unit {entry.unit || '-'}</span>
                  </div>
                  <span className="rent-reminders-chip rent-reminders-chip--warn">{entry.dueText}</span>
                  <button
                    type="button"
                    className="rent-reminders-action"
                    disabled={!entry.tenant}
                    onClick={() => handleReminderPayment(entry)}
                  >
                    Record Payment
                  </button>
                </div>
              )) : <div className="rent-reminders-empty">No upcoming rent reminders.</div>}
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <div className="tenants-page-shell" style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerIntro}>
          <div style={styles.eyebrowPill}>Tenant Directory</div>
          <h1 style={styles.title}>Tenants Management</h1>
          <p style={styles.subtitle}>Manage tenant records, occupancy, and follow-up details clearly.</p>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}><SearchIcon /></span>
            <input
              type="text"
              value={tenantSearch}
              onChange={(event) => setTenantSearch(event.target.value)}
              placeholder="Search tenant by name, phone, email, unit, building, or ID"
              style={styles.searchInput}
            />
          </div>
          <button
            type="button"
            style={{ ...styles.btnPrimary, ...(!canManageOperations ? styles.readOnlyDisabledButton : {}) }}
            onClick={() => setShowForm(!showForm)}
            disabled={!canManageOperations}
          >
            <span style={styles.buttonInner}>
              <PlusIcon />
              <span>{showForm ? 'Cancel' : 'Add Tenant'}</span>
            </span>
          </button>
        </div>
      </div>

      <div style={styles.headerMetaRow}>
        <div style={styles.resultChip}>
          {filteredTenants.length} tenant{filteredTenants.length === 1 ? '' : 's'} found
        </div>
        {tenantSearch ? <div style={styles.searchHint}>Showing results for "{tenantSearch}"</div> : null}
      </div>

      <div style={styles.statusFilterBar}>
        {[
          ['active', 'Active'],
          ['expired', 'Former'],
          ['inactive', 'Inactive'],
          ['all', 'All']
        ].map(([statusKey, label]) => (
          <button
            key={statusKey}
            type="button"
            style={{
              ...styles.statusFilterButton,
              ...(tenantStatusFilter === statusKey ? styles.statusFilterButtonActive : {})
            }}
            onClick={() => setTenantStatusFilter(statusKey)}
          >
            <span style={styles.statusFilterLabel}>{label}</span>
            <strong style={styles.statusFilterCount}>{tenantStatusCounts[statusKey] || 0}</strong>
          </button>
        ))}
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {!canManageOperations ? (
        <div style={styles.readOnlyBanner}>
          You have view-only access here. Tenant details can be reviewed, but creating, editing, and deleting tenants is limited to managers and admins.
        </div>
      ) : null}

      {showTenantDetails && selectedTenant && (
        <div
          className="tenant-view-modal"
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowTenantDetails(false);
          }}
        >
          <div className="tenant-view-modal__window" role="dialog" aria-modal="true" aria-labelledby="tenant-view-title">
            <div className="tenant-view-modal__header">
              <div>
                <h2 id="tenant-view-title">{selectedTenant.full_name}</h2>
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
                <div><span>National ID</span><strong>{selectedTenant.national_id || '-'}</strong></div>
                <div><span>Identification Document</span><strong>{selectedTenant.identification_document || '-'}</strong></div>
                <div><span>Address</span><strong>{selectedTenant.address || '-'}</strong></div>
                <div><span>Occupation Status</span><strong>{selectedTenant.occupation_status || '-'}</strong></div>
                <div><span>Occupation Place</span><strong>{selectedTenant.occupation_place || '-'}</strong></div>
                <div><span>Emergency Contact Name</span><strong>{selectedTenant.emergency_contact_name || '-'}</strong></div>
                <div><span>Emergency Contact Phone</span><strong>{selectedTenant.emergency_contact_phone || '-'}</strong></div>
                <div><span>Move In Date</span><strong>{selectedTenant.move_in_date ? parseLocalDate(selectedTenant.move_in_date)?.toLocaleDateString() : '-'}</strong></div>
                <div><span>Move Out Date</span><strong>{selectedTenant.move_out_date ? parseLocalDate(selectedTenant.move_out_date)?.toLocaleDateString() : '-'}</strong></div>
                <div><span>Status</span><strong>{selectedTenant.status || '-'}</strong></div>
                <div><span>Total Rent Required</span><strong>{formatCurrency(selectedTenant.total_owed)}</strong></div>
              </div>

              <div className="tenant-view-modal__section">Payment History</div>
              {selectedTenantPayments.length > 0 ? (
                <>
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
                          const isFullyPaid = parseFloat(payment.period_balance || 0) === 0;
                          return (
                            <tr key={payment.id} className={isFullyPaid ? 'tenant-view-modal__paid-row' : 'tenant-view-modal__unpaid-row'}>
                              <td>{payment.payment_period || '-'}</td>
                              <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                              <td>{formatCurrency(payment.amount)}</td>
                              <td className={isFullyPaid ? 'tenant-view-modal__paid-text' : 'tenant-view-modal__unpaid-text'}>
                                {formatCurrency(payment.period_balance)}
                              </td>
                              <td>{payment.payment_method || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className={selectedTenantPayments.every(p => parseFloat(p.period_balance || 0) === 0) ? 'tenant-view-modal__notice tenant-view-modal__notice--success' : 'tenant-view-modal__notice tenant-view-modal__notice--danger'}>
                    {selectedTenantPayments.every(p => parseFloat(p.period_balance || 0) === 0)
                      ? 'This tenant has fully paid all months shown above.'
                      : 'This tenant has unpaid months. See the payment history above.'}
                  </div>
                </>
              ) : (
                <p className="tenant-view-modal__empty">No payments recorded for this tenant</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tenantPendingDelete && (
        <div
          className="tenant-delete-modal"
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingTenant) setTenantPendingDelete(null);
          }}
        >
          <div className="tenant-delete-modal__window" role="dialog" aria-modal="true" aria-labelledby="tenant-delete-title">
            <div className="tenant-delete-modal__icon">
              <TrashIcon />
            </div>
            <h2 id="tenant-delete-title">Move Tenant Out</h2>
            <p>
              This will archive <strong>{tenantPendingDelete.full_name}</strong>
              {tenantPendingDelete.unit_number ? ` from unit ${tenantPendingDelete.unit_number}` : ''}, keep their history, and make the room available for another tenant.
            </p>
            <div className="tenant-delete-modal__meta">
              <span>{tenantPendingDelete.building_name || 'No building assigned'}</span>
              <span>{tenantPendingDelete.phone || 'No phone'}</span>
            </div>
            <div className="tenant-delete-modal__actions">
              <button
                type="button"
                className="tenant-delete-modal__cancel"
                onClick={() => setTenantPendingDelete(null)}
                disabled={deletingTenant}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tenant-delete-modal__confirm"
                onClick={confirmDeleteTenant}
                disabled={deletingTenant}
              >
                {deletingTenant ? 'Moving out...' : 'Move Out Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="tenant-edit-modal"
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) resetForm();
          }}
        >
          <div className="tenant-edit-modal__window" style={styles.modalWindow} role="dialog" aria-modal="true" aria-labelledby="tenant-form-title">
            <div className="tenant-edit-modal__header" style={styles.modalHeader}>
              <div>
                <h2 id="tenant-form-title" style={styles.formTitle}>
                  {editingId ? 'Edit Tenant' : 'Add New Tenant'}
                </h2>
                <p style={styles.modalSubtitle}>
                  {editingId ? 'Update tenant assignment, dates, and record details.' : 'Register tenant details and assign an available unit.'}
                </p>
              </div>
              <button type="button" style={styles.modalCloseButton} onClick={resetForm} aria-label="Close tenant form">
                x
              </button>
            </div>
            <div className="tenant-edit-modal__body" style={styles.formCard}>
              <form onSubmit={handleSubmit}>
            <fieldset style={styles.formFieldset} disabled={!canManageOperations}>
            <div className="tenant-edit-modal__grid" style={styles.formGrid}>
              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Full Name *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Identity *</label>
                <input
                  type="text"
                  name="national_id"
                  value={formData.national_id}
                  onChange={handleInputChange}
                  required
                />
              </div>


              {/* Identification Document fields removed as requested */}

              <div className="tenant-edit-modal__field tenant-edit-modal__field--wide" style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                <label>Address *</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                  required
                />
              </div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Unit</label>
                {buildingUnitFilter ? (
                  <div style={styles.scopedUnitBanner}>
                    Adding tenant to {buildingUnitFilter.buildingName}
                    <button
                      type="button"
                      style={styles.clearScopeButton}
                      onClick={() => setBuildingUnitFilter(null)}
                    >
                      Show all buildings
                    </button>
                  </div>
                ) : null}
                <select
                  name="unit_id"
                  value={formData.unit_id}
                  onChange={handleInputChange}
                >
                  <option value="">Select a unit</option>
                  {selectableUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_number} - {unit.building_name}{unit.status === 'maintenance' ? ' (maintenance)' : ''}
                    </option>
                  ))}
                </select>
                {selectableUnits.length === 0 ? (
                  <small style={styles.fieldHelp}>No available units right now.</small>
                ) : null}
              </div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Move In Date</label>
                <input
                  type="date"
                  name="move_in_date"
                  value={formData.move_in_date}
                  onChange={handleInputChange}
                />
              </div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Move Out Date</label>
                <input
                  type="date"
                  name="move_out_date"
                  value={formData.move_out_date}
                  onChange={handleInputChange}
                  min={formData.move_in_date || undefined}
                />
                <small style={styles.fieldHelp}>
                  Leave empty while the tenant is still occupying the room.
                </small>
              </div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Tenant Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <small style={styles.fieldHelp}>
                  Past move-out dates archive the tenant and free the room.
                </small>
              </div>

              <div className="tenant-edit-modal__section" style={{ ...styles.sectionLabel, gridColumn: '1 / -1' }}>Place of Work</div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Occupation Status *</label>
                <input
                  type="text"
                  name="occupation_status"
                  value={formData.occupation_status}
                  onChange={handleInputChange}
                  placeholder="Employed, self-employed, student..."
                  required
                />
              </div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Occupation Place *</label>
                <input
                  type="text"
                  name="occupation_place"
                  value={formData.occupation_place}
                  onChange={handleInputChange}
                  placeholder="Company or place of work"
                  required
                />
              </div>

              <div className="tenant-edit-modal__section" style={{ ...styles.sectionLabel, gridColumn: '1 / -1' }}>Emergency Contact</div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Names *</label>
                <input
                  type="text"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="tenant-edit-modal__field" style={styles.formGroup}>
                <label>Contact *</label>
                <input
                  type="text"
                  name="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="tenant-edit-modal__actions" style={styles.formActions}>
              <button
                type="submit"
                style={{ ...styles.btnPrimary, ...(!canManageOperations || savingTenant ? styles.readOnlyDisabledButton : {}) }}
                disabled={!canManageOperations || savingTenant}
              >
                {!canManageOperations ? 'View Only' : savingTenant ? 'Saving...' : editingId ? 'Update Tenant' : 'Create Tenant'}
              </button>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
            </fieldset>
              </form>
            </div>
          </div>
        </div>
      )}

      {(dueTodayReminderEntries.length > 0 || upcomingReminderEntries.length > 0) && (
        <div style={styles.reminderWrap}>
          <button
            type="button"
            className="rent-reminder-launch"
            onClick={handleOpenRemindersWindow}
            aria-label={`Open ${totalReminderCount} rent due reminders`}
          >
            <span className="rent-reminder-launch__label">Rent Due Reminders</span>
            <span className="rent-reminder-launch__count">{totalReminderCount}</span>
            <span className="rent-reminder-launch__pulse" aria-hidden="true" />
          </button>

          {isReminderPopupWindow && showReminderPanel ? (
            <div style={styles.reminderCard}>
              {dueTodayReminderEntries.length > 0 && (
                <div style={styles.reminderBlockDanger}>
                  <div style={styles.reminderTitle}>Due Today (Highlighted in Red)</div>
                  <ul style={styles.reminderList}>
                    {dueTodayReminderEntries.map((entry) => (
                      <li key={entry.id} style={styles.reminderItem}>
                        <span
                          style={styles.reminderTenantName}
                          onClick={() => entry.tenant && handleViewTenant(entry.tenant)}
                        >
                          {entry.name}
                        </span>
                        <span style={styles.reminderUnitChip}>Unit {entry.unit || '-'}</span>
                        <span style={styles.reminderDueChipDanger}>Due today</span>
                        <button
                          type="button"
                          style={{
                            ...styles.reminderPaymentButton,
                            ...(!entry.tenant ? styles.reminderPaymentButtonDisabled : {})
                          }}
                          onClick={() => handleReminderPayment(entry)}
                        >
                          Record Payment
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {upcomingReminderEntries.length > 0 && (
                <div style={styles.reminderBlockWarn}>
                  <div style={styles.reminderTitle}>Due Within 3 Days</div>
                  <ul style={styles.reminderList}>
                    {upcomingReminderEntries.map((entry) => (
                      <li key={entry.id} style={styles.reminderItem}>
                        <span
                          style={styles.reminderTenantName}
                          onClick={() => entry.tenant && handleViewTenant(entry.tenant)}
                        >
                          {entry.name}
                        </span>
                        <span style={styles.reminderUnitChip}>Unit {entry.unit || '-'}</span>
                        <span style={styles.reminderDueChipWarn}>{entry.dueText}</span>
                        <button
                          type="button"
                          style={{
                            ...styles.reminderPaymentButton,
                            ...(!entry.tenant ? styles.reminderPaymentButtonDisabled : {})
                          }}
                          onClick={() => handleReminderPayment(entry)}
                        >
                          Record Payment
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Tenants Table with Pagination Controls */}
      <div style={styles.tableCard}>
        {filteredTenants.length > 0 ? (
          <>
            {/* Pagination Controls */}
            {/* Pagination Controls moved into table */}
            <table ref={tableRef} style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.tableHeadCell, ...styles.stickyTenantHead }}>Name</th>
                  <th style={styles.tableHeadCell}>Email</th>
                  <th style={styles.tableHeadCell}>Phone</th>
                  <th style={styles.tableHeadCell}>Unit</th>
                  <th style={styles.tableHeadCell}>Monthly Rent</th>
                  <th style={styles.tableHeadCell}>Total Paid</th>
                  <th style={styles.tableHeadCell}>Balance</th>
                  <th style={styles.tableHeadCell}>Move In</th>
                  <th style={styles.tableHeadCell}>Move Out</th>
                  <th style={styles.tableHeadCell}>Status</th>
                  <th style={{ ...styles.tableHeadCell, ...styles.stickyActionHead }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedTenantsByFloor.map((group) => (
                  <React.Fragment key={group.groupKey}>
                    <tr>
                      <td colSpan={11} style={styles.floorGroupCell}>
                        <div style={styles.floorGroupRow}>
                          <span style={styles.floorGroupTitle}>
                            <span style={styles.floorGroupBuilding}>{group.buildingLabel}</span>
                            <span style={styles.floorGroupSeparator}>-</span>
                            <span>{group.floorLabel}</span>
                          </span>
                          <span style={styles.floorGroupCount}>
                            {group.tenants.length} tenant{group.tenants.length === 1 ? '' : 's'} on this floor
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.tenants.map(({ tenant, index: idx }) => {
                  const dueInfo = tenantDueMap[tenant.id] || {};
                  const rowStyle = {
                    ...styles.clickableRow,
                    ...(dueInfo.isDueToday ? styles.dueTodayRow : {}),
                    ...(idx === currentTenantIdx ? styles.focusedRow : {})
                  };
                  return (
                    <tr
                      key={tenant.id}
                      onClick={() => handleViewTenant(tenant)}
                      style={rowStyle}
                    >
                      <td style={{ ...styles.tableCell, ...styles.stickyTenantCell }}>
                        <div style={styles.primaryCellText}>{tenant.full_name}</div>
                        <div style={styles.mutedCellText}>{tenant.building_name || 'No building assigned'}</div>
                      </td>
                      <td style={{ ...styles.tableCell, ...styles.stickyActionCell }}>
                        <div style={styles.secondaryCellText}>{tenant.email || '-'}</div>
                      </td>
                      <td style={styles.tableCell}>{tenant.phone || '-'}</td>
                      <td style={styles.tableCell}>
                        <span style={styles.unitPill}>{tenant.unit_number || '-'}</span>
                      </td>
                      <td style={styles.tableCell}>{formatCurrency(tenant.monthly_rent)}</td>
                      <td style={styles.tableCell}>{formatCurrency(tenant.total_paid)}</td>
                      <td style={{ ...styles.tableCell, color: parseFloat(tenant.balance || 0) > 0 ? '#ef4444' : '#10b981', fontWeight: '700' }}>
                        {formatCurrency(tenant.balance)}
                      </td>
                      <td style={styles.tableCell}>
                        {tenant.move_in_date
                          ? parseLocalDate(tenant.move_in_date)?.toLocaleDateString()
                          : '-'}
                      </td>
                      <td style={styles.tableCell}>
                        {tenant.move_out_date
                          ? parseLocalDate(tenant.move_out_date)?.toLocaleDateString()
                          : '-'}
                      </td>
                      <td style={styles.tableCell}>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor:
                              getTenantLifecycleStatus(tenant) === 'active'
                                ? '#d1fae5'
                                : getTenantLifecycleStatus(tenant) === 'expired'
                                ? '#fee2e2'
                                : '#fee2e2',
                            color:
                              getTenantLifecycleStatus(tenant) === 'active'
                                ? '#065f46'
                                : getTenantLifecycleStatus(tenant) === 'expired'
                                ? '#991b1b'
                                : '#7f1d1d'
                          }}
                        >
                          {getTenantLifecycleLabel(tenant)}
                        </span>
                        {(dueInfo.isDueToday || dueInfo.isReminderWindow) && (
                          <span
                            style={{
                              ...styles.badge,
                              marginLeft: '0.5rem',
                              backgroundColor: dueInfo.isDueToday ? '#fee2e2' : '#fff7ed',
                              color: dueInfo.isDueToday ? '#991b1b' : '#9a3412'
                            }}
                          >
                            {dueInfo.reminderText}
                          </span>
                        )}
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.actionGroup}>
                        <button
                          type="button"
                          style={{ ...styles.btnSmall, ...styles.btnView }}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleViewTenant(tenant);
                          }}
                          title="View tenant details"
                        >
                          <span style={styles.buttonInner}>
                            <EyeIcon />
                            <span>View</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          style={{ ...styles.btnSmall, ...styles.btnEdit, ...(!canManageOperations ? styles.readOnlyDisabledButton : {}) }}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEdit(tenant);
                          }}
                          title="Edit tenant"
                          disabled={!canManageOperations}
                        >
                          <span style={styles.buttonInner}>
                            <EditIcon />
                            <span>Edit</span>
                          </span>
                        </button>
                        {getTenantLifecycleStatus(tenant) === 'active' ? (
                          <button
                            type="button"
                            className="tenant-delete-button"
                            style={{ ...styles.btnSmall, ...styles.btnDanger, ...(!canManageOperations ? styles.readOnlyDisabledButton : {}) }}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDelete(tenant);
                            }}
                            title="Move tenant out and keep history"
                            disabled={!canManageOperations}
                          >
                            <span style={styles.buttonInner}>
                              <TrashIcon />
                              <span>Move Out</span>
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="tenant-activate-button"
                            style={{ ...styles.btnSmall, ...(!canManageOperations ? styles.readOnlyDisabledButton : {}) }}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleMakeTenantActive(tenant);
                            }}
                            title="Make tenant active again"
                            disabled={!canManageOperations}
                          >
                            <span style={styles.buttonInner}>
                              <PlusIcon />
                              <span>Make Active</span>
                            </span>
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                    })}
                  </React.Fragment>
                ))}
                {/* Pagination Controls Row */}
                <tr>
                  <td colSpan={11} style={styles.paginationCell}>
                    <div style={styles.paginationBar}>
                      <button type="button" style={{ ...styles.paginationButton, ...(currentTenantIdx === 0 ? styles.paginationButtonDisabled : {}) }} onClick={() => setCurrentTenantIdx(0)} disabled={currentTenantIdx === 0}>
                        <span style={styles.buttonInner}><ArrowLeftIcon /><span>First</span></span>
                      </button>
                      <button type="button" style={{ ...styles.paginationButton, ...(currentTenantIdx === 0 ? styles.paginationButtonDisabled : {}) }} onClick={() => setCurrentTenantIdx(idx => Math.max(0, idx - 1))} disabled={currentTenantIdx === 0}>
                        <span style={styles.buttonInner}><ArrowLeftIcon /><span>Prev</span></span>
                      </button>
                      <span style={styles.paginationIndicator}>
                        Row {Math.min(currentTenantIdx + 1, filteredTenants.length)} of {filteredTenants.length}
                      </span>
                      <button type="button" style={{ ...styles.paginationButton, ...(currentTenantIdx === filteredTenants.length - 1 ? styles.paginationButtonDisabled : {}) }} onClick={() => setCurrentTenantIdx(idx => Math.min(filteredTenants.length - 1, idx + 1))} disabled={currentTenantIdx === filteredTenants.length - 1}>
                        <span style={styles.buttonInner}><span>Next</span><ArrowRightIcon /></span>
                      </button>
                      <button type="button" style={{ ...styles.paginationButton, ...(currentTenantIdx === filteredTenants.length - 1 ? styles.paginationButtonDisabled : {}) }} onClick={() => setCurrentTenantIdx(filteredTenants.length - 1)} disabled={currentTenantIdx === filteredTenants.length - 1}>
                        <span style={styles.buttonInner}><span>Last</span><ArrowRightIcon /></span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p style={styles.noData}>No tenants found for the current search</p>
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
    padding: '1.5rem',
    borderRadius: '1.1rem',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 56%, #0f766e 100%)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: '0 22px 46px rgba(15, 23, 42, 0.18)'
  },
  headerIntro: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    maxWidth: '680px'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  headerMetaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  resultChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.8rem',
    borderRadius: '999px',
    background: '#ecfeff',
    color: '#0e7490',
    fontSize: '0.84rem',
    fontWeight: '800',
    border: '1px solid #a5f3fc'
  },
  searchHint: {
    color: '#64748b',
    fontSize: '0.88rem',
    fontWeight: '500'
  },
  statusFilterBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    alignItems: 'center',
    gap: '0.65rem',
    marginBottom: '1rem'
  },
  statusFilterButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '0.35rem',
    minHeight: '78px',
    padding: '0.72rem 0.9rem',
    borderRadius: '0.85rem',
    border: '1px solid #d6deea',
    background: '#ffffff',
    color: '#334155',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '850',
    textAlign: 'left',
    boxShadow: '0 12px 22px rgba(15, 23, 42, 0.07)'
  },
  statusFilterButtonActive: {
    background: 'linear-gradient(135deg, #0f766e 0%, #2563eb 100%)',
    color: '#ffffff',
    border: '1px solid #0f766e'
  },
  statusFilterLabel: {
    fontSize: '0.78rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  statusFilterCount: {
    fontSize: '1.35rem',
    lineHeight: 1,
    fontWeight: '900'
  },
  searchWrap: {
    minWidth: '320px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0 0.95rem',
    borderRadius: '0.85rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)'
  },
  searchIcon: {
    color: '#64748b',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  searchInput: {
    minWidth: '0',
    width: '100%',
    padding: '0.95rem 0',
    borderRadius: '0.5rem',
    border: 'none',
    outline: 'none',
    color: '#1f2937',
    backgroundColor: 'transparent',
    fontSize: '0.95rem'
  },
  title: {
    fontSize: '2rem',
    fontWeight: '900',
    color: '#ffffff',
    margin: 0,
    lineHeight: 1.1,
    textShadow: '0 2px 10px rgba(15, 23, 42, 0.28)'
  },
  subtitle: {
    margin: 0,
    color: '#dbeafe',
    fontSize: '1rem',
    fontWeight: '600',
    lineHeight: 1.55,
    maxWidth: '58ch'
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
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
  btnPrimary: {
    padding: '0.9rem 1.2rem',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '700',
    transition: 'background-color 0.3s ease',
    boxShadow: '0 14px 26px rgba(37, 99, 235, 0.24)'
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
    padding: '0.55rem 0.8rem',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '700',
    transition: 'background-color 0.2s ease',
    whiteSpace: 'nowrap'
  },
  btnView: {
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe'
  },
  btnEdit: {
    backgroundColor: '#f8fafc',
    color: '#334155',
    border: '1px solid #cbd5e1'
  },
  btnDanger: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca'
  },
  buttonInner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem'
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
  readOnlyBanner: {
    background: '#f8fafc',
    color: '#334155',
    padding: '1rem',
    borderRadius: '0.75rem',
    marginBottom: '1rem',
    border: '1px solid #cbd5e1',
    fontWeight: 600,
    lineHeight: 1.5
  },
  formFieldset: {
    border: 'none',
    padding: 0,
    margin: 0,
    minWidth: 0
  },
  readOnlyDisabledButton: {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  loading: {
    textAlign: 'center',
    padding: '2rem'
  },
  formCard: {
    backgroundColor: '#f8fafc',
    padding: '1.5rem',
    borderRadius: '0 0 0.9rem 0.9rem'
  },
  formTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    margin: 0,
    color: '#1f2937'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.25rem',
    background: 'rgba(15, 23, 42, 0.62)'
  },
  modalWindow: {
    position: 'relative',
    zIndex: 2001,
    width: 'min(980px, 100%)',
    maxHeight: '92vh',
    overflowY: 'auto',
    background: '#ffffff',
    borderRadius: '0.9rem',
    boxShadow: '0 28px 70px rgba(15, 23, 42, 0.34)',
    border: '1px solid #dbe4f0'
  },
  modalHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '1.25rem 1.5rem',
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    borderRadius: '0.9rem 0.9rem 0 0'
  },
  modalSubtitle: {
    margin: '0.35rem 0 0',
    color: '#64748b',
    fontSize: '0.9rem',
    fontWeight: 600,
    lineHeight: 1.45
  },
  modalCloseButton: {
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
    fontWeight: 900,
    textTransform: 'uppercase'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  fieldHelp: {
    marginTop: '0.35rem',
    color: '#64748b',
    fontSize: '0.78rem',
    fontWeight: '600'
  },
  scopedUnitBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.65rem',
    flexWrap: 'wrap',
    marginBottom: '0.55rem',
    padding: '0.58rem 0.7rem',
    borderRadius: '0.75rem',
    backgroundColor: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
    fontSize: '0.8rem',
    fontWeight: '800'
  },
  clearScopeButton: {
    border: '1px solid #99f6e4',
    backgroundColor: '#ffffff',
    color: '#0f766e',
    borderRadius: '999px',
    padding: '0.3rem 0.58rem',
    cursor: 'pointer',
    fontSize: '0.72rem',
    fontWeight: '900'
  },
  formActions: {
    display: 'flex',
    gap: '1rem'
  },
  detailsCard: {
    backgroundColor: '#f8fafc',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    marginBottom: '2rem',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.12)',
    border: '1px solid #cbd5e1'
  },
  detailsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-start',
    marginBottom: '1rem'
  },
  detailsSubtext: {
    margin: 0,
    color: '#6b7280'
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1.5rem',
    color: '#374151'
  },
  detailSectionTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '1rem'
  },
  clickableRow: {
    cursor: 'pointer',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    transition: 'background-color 0.18s ease, box-shadow 0.18s ease',
    boxShadow: 'inset 4px 0 0 transparent'
  },
  dueTodayRow: {
    backgroundColor: '#fef2f2'
  },
  focusedRow: {
    background: 'linear-gradient(180deg, #eef2ff 0%, #e0e7ff 100%)',
    boxShadow: 'inset 4px 0 0 #2563eb'
  },
  reminderCard: {
    background: 'linear-gradient(180deg, #ffffff 0%, #fff7ed 100%)',
    padding: '1.5rem',
    borderRadius: '1rem',
    marginBottom: '2rem',
    boxShadow: '0 18px 38px rgba(15, 23, 42, 0.10)',
    border: '1px solid #fed7aa'
  },
  reminderWrap: {
    marginBottom: '1.1rem'
  },
  reminderLaunchButton: {
    width: 'fit-content',
    minHeight: '46px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.55rem 0.9rem',
    borderRadius: '999px',
    border: '1px solid #fca5a5',
    background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)',
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(127, 29, 29, 0.26)'
  },
  reminderLaunchLabel: {
    fontSize: '0.82rem',
    fontWeight: '900',
    letterSpacing: '0.03em',
    textTransform: 'uppercase'
  },
  reminderLaunchCount: {
    minWidth: '24px',
    height: '24px',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.38)',
    fontSize: '0.78rem',
    fontWeight: '900',
    lineHeight: 1
  },
  reminderLaunchDot: {
    width: '9px',
    height: '9px',
    borderRadius: '999px',
    backgroundColor: '#fef2f2',
    boxShadow: '0 0 0 3px rgba(254, 242, 242, 0.28)'
  },
  reminderBlockDanger: {
    backgroundColor: '#fff7f7',
    border: '1px solid #fecaca',
    borderRadius: '0.9rem',
    padding: '1rem',
    marginBottom: '0.85rem'
  },
  reminderBlockWarn: {
    backgroundColor: '#fffbeb',
    border: '1px solid #facc15',
    borderRadius: '0.9rem',
    padding: '1rem'
  },
  reminderTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.4rem 0.75rem',
    borderRadius: '999px',
    background: '#0f172a',
    color: '#ffffff',
    fontWeight: '900',
    marginBottom: '0.8rem',
    fontSize: '0.82rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  reminderList: {
    margin: 0,
    padding: 0,
    color: '#374151',
    listStyle: 'none',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '0.65rem'
  },
  reminderItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    flexWrap: 'wrap',
    padding: '0.75rem 0.85rem',
    borderRadius: '0.85rem',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(203, 213, 225, 0.85)',
    boxShadow: '0 10px 18px rgba(15, 23, 42, 0.06)'
  },
  reminderTenantName: {
    cursor: 'pointer',
    color: '#0f172a',
    fontWeight: '800',
    lineHeight: 1.35,
    flex: '1 1 190px'
  },
  reminderUnitChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.3rem 0.58rem',
    borderRadius: '999px',
    backgroundColor: '#eef2ff',
    color: '#3730a3',
    border: '1px solid #c7d2fe',
    fontSize: '0.75rem',
    fontWeight: '800',
    whiteSpace: 'nowrap'
  },
  reminderDueChipWarn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.3rem 0.58rem',
    borderRadius: '999px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fcd34d',
    fontSize: '0.75rem',
    fontWeight: '900',
    whiteSpace: 'nowrap'
  },
  reminderDueChipDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.3rem 0.58rem',
    borderRadius: '999px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fca5a5',
    fontSize: '0.75rem',
    fontWeight: '900',
    whiteSpace: 'nowrap'
  },
  reminderPaymentButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.42rem 0.7rem',
    borderRadius: '999px',
    border: '1px solid #0f766e',
    background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
    color: '#ffffff',
    fontSize: '0.75rem',
    fontWeight: '900',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 8px 16px rgba(15, 118, 110, 0.16)'
  },
  reminderPaymentButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  tableCard: {
    backgroundColor: '#ffffff',
    padding: '1rem',
    borderRadius: '0.75rem',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.10)',
    border: '1px solid #dbe3ef',
    overflowX: 'auto',
    scrollbarColor: '#94a3b8 #e2e8f0'
  },
  sheetCard: {
    backgroundColor: '#f8fafc',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    marginBottom: '2rem',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.12)',
    border: '1px solid #cbd5e1'
  },
  sheetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1rem',
    flexWrap: 'wrap'
  },
  yearPickerWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    minWidth: '120px'
  },
  yearInput: {
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    padding: '0.55rem 0.65rem'
  },
  monthTabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: '0.5rem',
    marginBottom: '1rem'
  },
  monthTab: {
    border: '1px solid #d1d5db',
    borderRadius: '0.45rem',
    backgroundColor: '#f9fafb',
    color: '#374151',
    padding: '0.55rem 0.65rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  monthTabActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
    color: '#1e3a8a'
  },
  sheetSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  sheetSummaryCard: {
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    padding: '0.75rem',
    backgroundColor: '#f1f5f9'
  },
  sheetSummaryLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginBottom: '0.35rem'
  },
  sheetSummaryValue: {
    fontSize: '1rem',
    color: '#111827',
    fontWeight: '700'
  },
  sheetTableWrap: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    minWidth: '1120px'
  },
  tableHeadCell: {
    textAlign: 'left',
    padding: '1rem 0.9rem',
    background: '#f1f5f9',
    color: '#475569',
    fontSize: '0.78rem',
    fontWeight: '800',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    whiteSpace: 'nowrap'
  },
  stickyTenantHead: {
    left: 0,
    zIndex: 7,
    minWidth: '260px',
    boxShadow: '10px 0 18px rgba(15, 23, 42, 0.12)'
  },
  stickyActionHead: {
    right: 0,
    zIndex: 7,
    minWidth: '210px',
    boxShadow: '-10px 0 18px rgba(15, 23, 42, 0.12)'
  },
  tableCell: {
    padding: '0.95rem 0.9rem',
    color: '#1f2937',
    fontSize: '0.92rem',
    verticalAlign: 'middle',
    borderBottom: '1px solid #edf2f7'
  },
  stickyTenantCell: {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    minWidth: '260px',
    backgroundColor: '#ffffff',
    boxShadow: '10px 0 18px rgba(15, 23, 42, 0.08)'
  },
  stickyActionCell: {
    position: 'sticky',
    right: 0,
    zIndex: 3,
    minWidth: '210px',
    backgroundColor: '#ffffff',
    boxShadow: '-10px 0 18px rgba(15, 23, 42, 0.08)'
  },
  floorGroupCell: {
    padding: '0.75rem 0.9rem',
    background: 'linear-gradient(90deg, #0f766e 0%, #2563eb 100%)',
    borderTop: '1rem solid #ffffff',
    borderBottom: '1px solid #cbd5e1',
    position: 'sticky',
    top: '3.05rem',
    zIndex: 1,
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)'
  },
  floorGroupRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
    textAlign: 'center'
  },
  floorGroupTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.55rem',
    flexWrap: 'wrap',
    color: '#ffffff',
    fontSize: '0.98rem',
    fontWeight: '900',
    letterSpacing: '0.02em'
  },
  floorGroupBuilding: {
    color: '#ccfbf1'
  },
  floorGroupSeparator: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '700'
  },
  floorGroupCount: {
    color: '#0f172a',
    fontSize: '0.82rem',
    fontWeight: '800',
    backgroundColor: '#ffffff',
    padding: '0.35rem 0.7rem',
    borderRadius: '999px',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.16)'
  },
  primaryCellText: {
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 1.35,
    maxWidth: '280px'
  },
  secondaryCellText: {
    color: '#334155',
    lineHeight: 1.4
  },
  mutedCellText: {
    color: '#64748b',
    fontSize: '0.78rem',
    marginTop: '0.25rem',
    fontWeight: '600'
  },
  unitPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '64px',
    padding: '0.38rem 0.65rem',
    borderRadius: '999px',
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    fontWeight: '800',
    fontSize: '0.84rem',
    whiteSpace: 'nowrap'
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'nowrap'
  },
  paginationCell: {
    padding: '1rem',
    background: '#f8fafc',
    borderTop: '1px solid #e2e8f0'
  },
  paginationBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.65rem',
    flexWrap: 'wrap'
  },
  paginationButton: {
    padding: '0.65rem 0.9rem',
    borderRadius: '0.8rem',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '0.82rem',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.06)'
  },
  paginationButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  paginationIndicator: {
    padding: '0.65rem 0.95rem',
    borderRadius: '999px',
    background: '#e2e8f0',
    color: '#334155',
    fontSize: '0.83rem',
    fontWeight: '700'
  },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: '500'
  },
  noData: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '2.5rem',
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: '0.75rem',
    fontWeight: '700'
  }
};


export default Tenants;

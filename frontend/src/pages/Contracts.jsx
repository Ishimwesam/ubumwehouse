import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { contractService, resolveUploadUrl, tenantService, unitService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useDataSync } from '../context/DataSyncContext';
import '../styles/contracts.css';

const addDays = (dateValue, days) => {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const getDaysToEnd = (contractEnd) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(contractEnd);
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endDay - today) / (1000 * 60 * 60 * 24));
};
const contractAllowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const maxContractFileSize = 10 * 1024 * 1024;
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
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

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
  </svg>
);

const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const getRemainingLabel = (contract, daysToEnd) => {
  if (contract.lifecycle_status === 'terminated') return 'Terminated';
  if (contract.lifecycle_status === 'ended') return 'Ended';
  if (contract.lifecycle_status === 'others') return 'N/A';
  if (daysToEnd < 0) return 'Ended';
  if (daysToEnd === 0) return 'Ends today';
  return `${daysToEnd} day${daysToEnd === 1 ? '' : 's'}`;
};

const getStatusClassName = (status) => {
  switch (status) {
    case 'active':
      return 'contracts-page__status contracts-page__status--active';
    case 'ended':
      return 'contracts-page__status contracts-page__status--ended';
    case 'terminated':
      return 'contracts-page__status contracts-page__status--terminated';
    default:
      return 'contracts-page__status contracts-page__status--other';
  }
};

const getRemainingToneClassName = (contract, daysToEnd) => {
  if (contract.lifecycle_status === 'terminated') return 'contracts-page__remaining contracts-page__remaining--terminated';
  if (contract.lifecycle_status === 'ended' || daysToEnd < 0) return 'contracts-page__remaining contracts-page__remaining--ended';
  if (daysToEnd <= 7) return 'contracts-page__remaining contracts-page__remaining--warning';
  return 'contracts-page__remaining contracts-page__remaining--active';
};

const Contracts = () => {
  const { isManager } = useAuth();
  const { showToast } = useToast();
  const { versions, notifyDataChanged } = useDataSync();
  const [contracts, setContracts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyContractId, setBusyContractId] = useState(null);
  const [editingContractId, setEditingContractId] = useState(null);
  const [renewingContract, setRenewingContract] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const notifiedEndingSoonRef = useRef('');
  const [formData, setFormData] = useState({
    tenant_id: '',
    unit_id: '',
    contract_start: '',
    contract_end: '',
    notes: '',
    contract_file: null
  });
  const canManageOperations = isManager();

  useEffect(() => {
    fetchData();
  }, [versions.contracts, versions.tenants, versions.units]);

  const fetchData = async () => {
    setLoading(true);

    try {
      const [contractsRes, tenantsRes, unitsRes] = await Promise.all([
        contractService.getAll(),
        tenantService.getAll(),
        unitService.getAll()
      ]);

      setContracts(contractsRes.data || []);
      setTenants((tenantsRes.data || []).filter((tenant) => tenant.status === 'active'));
      setUnits(unitsRes.data || []);
    } catch (err) {
      showToast('Failed to load contracts data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      tenant_id: '',
      unit_id: '',
      contract_start: '',
      contract_end: '',
      notes: '',
      contract_file: null
    });
    setEditingContractId(null);
    setRenewingContract(null);
    setFileInputKey((prev) => prev + 1);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    if (file && (!contractAllowedTypes.has(file.type) || file.size > maxContractFileSize)) {
      e.target.value = '';
      showToast('Contract file must be a JPG, PNG, or PDF file up to 10MB.', 'warning');
      setFormData((prev) => ({ ...prev, contract_file: null }));
      return;
    }
    setFormData((prev) => ({ ...prev, contract_file: file }));
  };

  const populateForm = (contract) => {
    setFormData({
      tenant_id: contract.tenant_id || '',
      unit_id: contract.unit_id || '',
      contract_start: contract.contract_start || '',
      contract_end: contract.contract_end || '',
      notes: contract.notes || '',
      contract_file: null
    });
    setFileInputKey((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (contract) => {
    if (!canManageOperations) {
      showToast('You have view-only access on this page.', 'info');
      return;
    }

    setEditingContractId(contract.id);
    setRenewingContract(null);
    populateForm(contract);
  };

  const handleRenew = (contract) => {
    if (!canManageOperations) {
      showToast('You have view-only access on this page.', 'info');
      return;
    }

    const previousStart = new Date(contract.contract_start);
    const previousEnd = new Date(contract.contract_end);
    const durationMs = Math.max(previousEnd - previousStart, 0);
    const durationDays = Math.max(Math.round(durationMs / (1000 * 60 * 60 * 24)), 30);

    const today = new Date().toISOString().slice(0, 10);
    const startDate = contract.contract_end >= today ? addDays(contract.contract_end, 1) : today;
    const endDate = addDays(startDate, durationDays);

    setEditingContractId(null);
    setRenewingContract(contract);
    setFormData({
      tenant_id: contract.tenant_id || '',
      unit_id: contract.unit_id || '',
      contract_start: startDate,
      contract_end: endDate,
      notes: contract.notes || '',
      contract_file: null
    });
    setFileInputKey((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveContract = async (e) => {
    e.preventDefault();
    if (!canManageOperations) {
      showToast('You have view-only access on this page.', 'info');
      return;
    }
    if (!formData.tenant_id || !formData.unit_id || !formData.contract_start || !formData.contract_end) {
      showToast('Tenant, unit, start date, and end date are required.', 'warning');
      return;
    }
    if (!isValidDate(formData.contract_start) || !isValidDate(formData.contract_end)) {
      showToast('Use valid contract dates.', 'warning');
      return;
    }
    if (formData.contract_end < formData.contract_start) {
      showToast('Contract end date must be after start date.', 'warning');
      return;
    }

    setSaving(true);

    try {
      if (editingContractId) {
        await contractService.update(editingContractId, formData);
        showToast('Contract updated successfully', 'success');
      } else {
        await contractService.create(formData);
        showToast(renewingContract ? 'Contract renewed successfully' : 'Contract created successfully', 'success');
      }

      notifyDataChanged(['contracts', 'tenants', 'units', 'dashboard', 'reports']);
      resetForm();
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save contract', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTerminate = async (contractId) => {
    if (!canManageOperations) {
      showToast('You have view-only access on this page.', 'info');
      return;
    }

    const terminationReason = window.prompt('Termination reason:', '');
    if (terminationReason === null) return;
    if (!terminationReason.trim()) {
      showToast('Termination reason is required.', 'warning');
      return;
    }

    try {
      setBusyContractId(contractId);
      await contractService.terminate(contractId, { termination_reason: terminationReason });
      showToast('Contract terminated successfully', 'success');
      notifyDataChanged(['contracts', 'tenants', 'units', 'dashboard', 'reports']);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to terminate contract', 'error');
    } finally {
      setBusyContractId(null);
    }
  };

  const handleDelete = async (contractId) => {
    if (!canManageOperations) {
      showToast('You have view-only access on this page.', 'info');
      return;
    }

    if (!window.confirm('Delete this contract permanently?')) return;

    try {
      setBusyContractId(contractId);
      await contractService.delete(contractId);
      showToast('Contract deleted successfully', 'success');
      notifyDataChanged(['contracts', 'dashboard', 'reports']);
      if (editingContractId === contractId) {
        resetForm();
      }
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete contract', 'error');
    } finally {
      setBusyContractId(null);
    }
  };

  const activeContracts = contracts.filter((contract) => contract.lifecycle_status === 'active');
  const terminatedContracts = contracts.filter((contract) => contract.lifecycle_status === 'terminated');
  const endingSoonContracts = activeContracts
    .map((contract) => ({
      ...contract,
      daysToEnd: getDaysToEnd(contract.contract_end)
    }))
    .filter((contract) => contract.daysToEnd >= 0 && contract.daysToEnd <= 30)
    .sort((a, b) => a.daysToEnd - b.daysToEnd);

  useEffect(() => {
    if (!endingSoonContracts.length) {
      notifiedEndingSoonRef.current = '';
      return;
    }

    const nextKey = endingSoonContracts.map((contract) => `${contract.id}:${contract.daysToEnd}`).join('|');
    if (notifiedEndingSoonRef.current === nextKey) {
      return;
    }

    notifiedEndingSoonRef.current = nextKey;

    const firstContract = endingSoonContracts[0];
    const message = endingSoonContracts.length === 1
      ? `${firstContract.tenant_name || 'A tenant'} contract ends in ${firstContract.daysToEnd} day${firstContract.daysToEnd === 1 ? '' : 's'}.`
      : `${endingSoonContracts.length} contracts are ending soon.`;

    showToast(message, 'info');
  }, [endingSoonContracts, showToast]);

  if (loading) {
    return <div className="contracts-page__loading">Loading contracts...</div>;
  }

  return (
    <div className="contracts-page">
      <div className="contracts-page__header">
        <div>
          <h1 className="contracts-page__title">Contracts</h1>
          <p className="contracts-page__subtitle">Create, update, renew, terminate, and delete contracts from one place.</p>
        </div>
        <div className="contracts-page__summary">
          Active contracts: <strong>{activeContracts.length}</strong>
        </div>
      </div>

      <div className="contracts-page__metrics">
        <div className="contracts-page__metric">
          <span className="contracts-page__metric-label">Total Contracts</span>
          <strong className="contracts-page__metric-value">{contracts.length}</strong>
          <span className="contracts-page__metric-note">All created contract records</span>
        </div>
        <div className="contracts-page__metric">
          <span className="contracts-page__metric-label">Ending Soon</span>
          <strong className="contracts-page__metric-value">{endingSoonContracts.length}</strong>
          <span className="contracts-page__metric-note">Contracts ending in the next 30 days</span>
        </div>
        <div className="contracts-page__metric">
          <span className="contracts-page__metric-label">Terminated</span>
          <strong className="contracts-page__metric-value">{terminatedContracts.length}</strong>
          <span className="contracts-page__metric-note">Closed before their end date</span>
        </div>
      </div>

      <section className="contracts-page__card">
        <div className="contracts-page__card-header">
          <div>
            <h2 className="contracts-page__card-title">Create/Renew Contract</h2>
            <p className="contracts-page__card-note">Manage contract periods, supporting files, and renewal details from one form.</p>
          </div>
        </div>
        {!canManageOperations ? (
          <div style={readOnlyBannerStyle}>
            You have view-only access here. Contract records can be reviewed, but create, renew, terminate, and delete actions are limited to managers and admins.
          </div>
        ) : null}
        <div className="contracts-page__form-tips">
          <span className="contracts-page__tip">Select the active tenant first</span>
          <span className="contracts-page__tip">Attach the signed contract if available</span>
          <span className="contracts-page__tip">Renew starts from the next valid period automatically</span>
        </div>
        {renewingContract ? (
          <div className="contracts-page__banner contracts-page__banner--renew">
            <span>Renewing contract for <strong>{renewingContract.tenant_name || 'Tenant'}</strong> ({renewingContract.unit_number || 'Unit'})</span>
            <button type="button" className="contracts-page__banner-action" onClick={resetForm}>Cancel renew</button>
          </div>
        ) : null}
        {editingContractId ? (
          <div className="contracts-page__banner contracts-page__banner--edit">
            <span>You are editing an existing contract.</span>
            <button type="button" className="contracts-page__banner-action" onClick={resetForm}>Cancel edit</button>
          </div>
        ) : null}

        <form onSubmit={handleSaveContract} className="contracts-page__form">
          <fieldset style={readOnlyFieldsetStyle} disabled={!canManageOperations}>
          <div className="contracts-page__grid">
            <div className="contracts-page__field">
              <label className="contracts-page__label">Tenant</label>
              <select
                name="tenant_id"
                value={formData.tenant_id}
                onChange={handleInputChange}
                required
                className="contracts-page__input"
              >
                <option value="">Select tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="contracts-page__field">
              <label className="contracts-page__label">Unit/Room</label>
              <select
                name="unit_id"
                value={formData.unit_id}
                onChange={handleInputChange}
                required
                className="contracts-page__input"
              >
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_number} ({unit.building_name || 'No building'})
                  </option>
                ))}
              </select>
            </div>

            <div className="contracts-page__field">
              <label className="contracts-page__label">Contract Start</label>
              <input
                type="date"
                name="contract_start"
                value={formData.contract_start}
                onChange={handleInputChange}
                required
                className="contracts-page__input"
              />
            </div>

            <div className="contracts-page__field">
              <label className="contracts-page__label">Contract End</label>
              <input
                type="date"
                name="contract_end"
                value={formData.contract_end}
                onChange={handleInputChange}
                required
                className="contracts-page__input"
              />
            </div>

            <div className="contracts-page__field contracts-page__field--full">
              <label className="contracts-page__label">Contract File (PDF/JPG/PNG)</label>
              <input
                key={fileInputKey}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="contracts-page__file-input"
              />
              <small className="contracts-page__help-text">Leave blank while editing to keep the current file.</small>
            </div>

            <div className="contracts-page__field contracts-page__field--full">
              <label className="contracts-page__label">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Optional contract notes"
                className="contracts-page__textarea"
              />
            </div>
          </div>

          <div className="contracts-page__actions">
            <button type="submit" className="contracts-page__button contracts-page__button--primary" disabled={saving}>
              <span className="contracts-page__button-inner">
                {editingContractId ? <SaveIcon /> : <PlusIcon />}
                <span>{saving ? 'Saving...' : !canManageOperations ? 'View Only' : editingContractId ? 'Update Contract' : 'Save Contract'}</span>
              </span>
            </button>
            {(editingContractId || renewingContract) ? (
              <button type="button" className="contracts-page__button contracts-page__button--secondary" onClick={resetForm}>
                <span className="contracts-page__button-inner">
                  <CloseIcon />
                  <span>Cancel</span>
                </span>
              </button>
            ) : null}
          </div>
          </fieldset>
        </form>
      </section>

      <section className="contracts-page__card">
        <div className="contracts-page__card-header">
          <div>
            <h2 className="contracts-page__card-title">All Contracts</h2>
            <p className="contracts-page__card-note">Review each contract period, file, and status, then edit, renew, terminate, or delete as needed.</p>
          </div>
        </div>
        {contracts.length === 0 ? (
          <div className="contracts-page__empty">No contracts yet.</div>
        ) : (
          <div className="contracts-page__table-wrap">
            <table className="contracts-page__table">
              <thead>
                <tr>
                  <th className="contracts-page__th">Tenant</th>
                  <th className="contracts-page__th">Unit</th>
                  <th className="contracts-page__th">Period</th>
                  <th className="contracts-page__th">Remaining</th>
                  <th className="contracts-page__th">Status</th>
                  <th className="contracts-page__th">File</th>
                  <th className="contracts-page__th">Action</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => {
                  const daysToEnd = getDaysToEnd(contract.contract_end);
                  const canTerminate = contract.lifecycle_status === 'active' && daysToEnd >= 0;

                  return (
                    <tr key={contract.id}>
                      <td className="contracts-page__td">
                        <div className="contracts-page__cell-stack">
                          <span className={`contracts-page__cell-title ${!contract.tenant_name ? 'contracts-page__cell-title--muted' : ''}`}>{contract.tenant_name || 'Unknown'}</span>
                          <span className="contracts-page__cell-subtitle">Tenant record</span>
                        </div>
                      </td>
                      <td className="contracts-page__td">
                        <div className="contracts-page__cell-stack">
                          <span className={`contracts-page__cell-title ${!contract.unit_number ? 'contracts-page__cell-title--muted' : ''}`}>{contract.unit_number || 'N/A'}</span>
                          <span className="contracts-page__cell-subtitle">{contract.building_name || 'No linked building'}</span>
                        </div>
                      </td>
                      <td className="contracts-page__td">
                        <div className="contracts-page__cell-stack">
                          <span className="contracts-page__cell-title">{contract.contract_start} to {contract.contract_end}</span>
                          <span className="contracts-page__cell-subtitle">Contract period</span>
                        </div>
                      </td>
                      <td className="contracts-page__td">
                        <span className={getRemainingToneClassName(contract, daysToEnd)}>{getRemainingLabel(contract, daysToEnd)}</span>
                      </td>
                      <td className="contracts-page__td">
                        <span className={getStatusClassName(contract.lifecycle_status)}>
                          {contract.lifecycle_status || 'others'}
                        </span>
                      </td>
                      <td className="contracts-page__td">
                        {contract.contract_file_path ? (
                          <a href={resolveUploadUrl(contract.contract_file_path)} target="_blank" rel="noreferrer" className="contracts-page__file-link">
                            <span className="contracts-page__button-inner">
                              <EyeIcon />
                              <span>View file</span>
                            </span>
                          </a>
                        ) : (
                          <span className="contracts-page__file-empty">No file</span>
                        )}
                      </td>
                      <td className="contracts-page__td">
                        <div className="contracts-page__action-group">
                          <button type="button" className="contracts-page__action-button contracts-page__action-button--edit" onClick={() => handleEdit(contract)} disabled={!canManageOperations}>
                            <span className="contracts-page__button-inner"><EditIcon /><span>Edit</span></span>
                          </button>
                          <button
                            type="button"
                            className={`contracts-page__action-button ${canTerminate ? 'contracts-page__action-button--terminate' : 'contracts-page__action-button--renew'}`}
                            onClick={() => (canTerminate ? handleTerminate(contract.id) : handleRenew(contract))}
                            disabled={!canManageOperations || busyContractId === contract.id}
                          >
                            <span className="contracts-page__button-inner">{canTerminate ? <StopIcon /> : <RefreshIcon />}<span>{busyContractId === contract.id ? 'Working...' : canTerminate ? 'Terminate' : 'Renew'}</span></span>
                          </button>
                          <button type="button" className="contracts-page__action-button contracts-page__action-button--delete" onClick={() => handleDelete(contract.id)} disabled={!canManageOperations || busyContractId === contract.id}>
                            <span className="contracts-page__button-inner"><TrashIcon /><span>{busyContractId === contract.id ? 'Deleting...' : 'Delete'}</span></span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const readOnlyBannerStyle = {
  padding: '0.9rem 1rem',
  borderRadius: '0.9rem',
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  color: '#334155',
  fontWeight: 600,
  lineHeight: 1.5,
  marginBottom: '1rem'
};

const readOnlyFieldsetStyle = {
  border: 'none',
  padding: 0,
  margin: 0,
  minWidth: 0
};

export default Contracts;

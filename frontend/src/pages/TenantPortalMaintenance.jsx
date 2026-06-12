import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import { TenantMobileAppHeader, TenantPortalShell, useTenantLanguage } from '../components/TenantPortalNav';
import '../styles/tenant-portal.css';

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const statusLabel = (value = 'open') => String(value || 'open').replace(/_/g, ' ');

const TenantPortalMaintenance = () => {
  const navigate = useNavigate();
  const [, text] = useTenantLanguage();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [editingRequest, setEditingRequest] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    title: '',
    category: 'General',
    priority: 'normal',
    description: ''
  });

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await tenantPortalService.getMaintenanceRequests();
      setRequests(response.data?.requests || []);
    } catch (err) {
      setError(getReadableApiError(err, text.failedLoadMaintenance));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = tenantPortalService.getToken();
    if (!token) {
      navigate('/tenant-portal');
      return;
    }
    loadRequests();
  }, [navigate]);

  useEffect(() => {
    const onPortalEvent = (event) => {
      if (event.detail?.event_type !== 'tenant_maintenance_update') return;
      loadRequests();
    };
    window.addEventListener('tp:portal-event', onPortalEvent);
    return () => window.removeEventListener('tp:portal-event', onPortalEvent);
  }, []);

  const resetForm = () => {
    setForm({ title: '', category: 'General', priority: 'normal', description: '' });
    setEditingRequest(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError(text.addTitleDescription);
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (editingRequest) {
        const response = await tenantPortalService.updateMaintenanceRequest(editingRequest.id, form);
        setRequests((current) => current.map((request) => (request.id === editingRequest.id ? response.data : request)));
        setSuccess(text.maintenanceUpdated);
      } else {
        const response = await tenantPortalService.createMaintenanceRequest(form);
        setRequests((current) => [response.data, ...current]);
        setSuccess(text.maintenanceSubmitted);
      }
      resetForm();
    } catch (err) {
      setError(getReadableApiError(err, editingRequest ? text.failedUpdateMaintenance : text.failedSubmitMaintenance));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (request) => {
    setEditingRequest(request);
    setForm({
      title: request.title || '',
      category: request.category || 'General',
      priority: request.priority || 'normal',
      description: request.description || ''
    });
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (request) => {
    if (!window.confirm(text.deleteOpenRequestConfirm)) return;
    setDeletingId(request.id);
    setError('');
    setSuccess('');
    try {
      await tenantPortalService.deleteMaintenanceRequest(request.id);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      if (editingRequest?.id === request.id) resetForm();
      setSuccess(text.maintenanceDeleted);
    } catch (err) {
      setError(getReadableApiError(err, text.failedDeleteMaintenance));
    } finally {
      setDeletingId('');
    }
  };

  return (
    <TenantPortalShell current="maintenance">
        <TenantMobileAppHeader current="maintenance" />
        <header className="tp-header">
          <div>
            <h1>{text.maintenanceTitle}</h1>
            <p>{text.maintenanceSubtitle}</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            {text.backToDashboard}
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}
        {success ? <div className="tp-alert success">{success}</div> : null}

        <section className="tp-main-grid tp-section-anchor" id="maintenance">
          <article className="tp-card">
            <div className="tp-card-header-row">
              <h2>{editingRequest ? text.updateRequest : text.createRequest}</h2>
              {editingRequest ? (
                <button className="tp-btn-secondary" type="button" onClick={resetForm}>
                  {text.cancelEdit}
                </button>
              ) : null}
            </div>
            <form className="tp-upload-form maintenance-form" onSubmit={handleSubmit}>
              <label>
                {text.title}
                <input
                  value={form.title}
                  maxLength={140}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={text.maintenanceTitlePlaceholder}
                  required
                />
              </label>
              <label>
                {text.category}
                <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
                  <option value="General">{text.general}</option>
                  <option value="Plumbing">{text.plumbing}</option>
                  <option value="Electrical">{text.electrical}</option>
                  <option value="Cleaning">{text.cleaning}</option>
                  <option value="Security">{text.security}</option>
                  <option value="Appliance">{text.appliance}</option>
                </select>
              </label>
              <label>
                {text.priority}
                <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}>
                  <option value="normal">{text.normal}</option>
                  <option value="low">{text.low}</option>
                  <option value="urgent">{text.urgent}</option>
                </select>
              </label>
              <label className="full">
                {text.description}
                <textarea
                  value={form.description}
                  maxLength={1600}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={5}
                  placeholder={text.maintenanceDescriptionPlaceholder}
                  required
                />
              </label>
              <button className="tp-btn-primary" type="submit" disabled={submitting}>
                {submitting ? (editingRequest ? text.updating : text.submitting) : editingRequest ? text.updateRequest : text.submitRequest}
              </button>
            </form>
          </article>

          <article className="tp-card">
            <h2>{text.requestHistory}</h2>
            {loading ? <p className="tp-empty">{text.loadingRequests}</p> : null}
            {!loading && requests.length === 0 ? <p className="tp-empty">{text.noMaintenanceRequests}</p> : null}
            {!loading && requests.length ? (
              <div className="tp-request-list">
                {requests.map((request) => (
                  <article key={request.id} className="tp-request-item">
                    <div className="tp-request-top">
                      <strong>{request.title}</strong>
                      <span className={`tp-status-pill ${String(request.status || 'open').toLowerCase()}`}>{statusLabel(request.status)}</span>
                    </div>
                    <p>{request.description}</p>
                    <div className="tp-request-meta">
                      <span>{request.category || text.general}</span>
                      <span>{request.priority || 'normal'}</span>
                      <span>{formatDateTime(request.created_at)}</span>
                    </div>
                    {request.admin_note ? <small>{request.admin_note}</small> : null}
                    <div className="tp-request-actions">
                      {['open', 'in_progress'].includes(String(request.status || '').toLowerCase()) ? (
                        <button type="button" className="tp-btn-secondary" onClick={() => handleEdit(request)}>
                          {text.edit}
                        </button>
                      ) : null}
                      {String(request.status || '').toLowerCase() === 'open' ? (
                        <button
                          type="button"
                          className="tp-btn-danger"
                          onClick={() => handleDelete(request)}
                          disabled={deletingId === request.id}
                        >
                          {deletingId === request.id ? text.deleting : text.delete}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        </section>
    </TenantPortalShell>
  );
};

export default TenantPortalMaintenance;

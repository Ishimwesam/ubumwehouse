import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
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
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      setError(getReadableApiError(err, 'Failed to load maintenance requests.'));
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError('Add a title and description before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await tenantPortalService.createMaintenanceRequest(form);
      setRequests((current) => [response.data, ...current]);
      setForm({ title: '', category: 'General', priority: 'normal', description: '' });
      setSuccess('Maintenance request submitted. Staff can now track it in portal control.');
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to submit maintenance request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="tp-page tp-subpage">
      <section className="tp-main tp-subpage-main">
        <header className="tp-header">
          <div>
            <h1>Maintenance Requests</h1>
            <p>UBUMWE HOUSE LTD maintenance support and request tracking.</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            Back To Dashboard
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}
        {success ? <div className="tp-alert success">{success}</div> : null}

        <section className="tp-main-grid">
          <article className="tp-card">
            <h2>Create Request</h2>
            <form className="tp-upload-form maintenance-form" onSubmit={handleSubmit}>
              <label>
                Title
                <input
                  value={form.title}
                  maxLength={140}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Example: Water leak in bathroom"
                  required
                />
              </label>
              <label>
                Category
                <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
                  <option value="General">General</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Security">Security</option>
                  <option value="Appliance">Appliance</option>
                </select>
              </label>
              <label>
                Priority
                <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="full">
                Description
                <textarea
                  value={form.description}
                  maxLength={1600}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={5}
                  placeholder="Describe the issue, location, and any timing details."
                  required
                />
              </label>
              <button className="tp-btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </article>

          <article className="tp-card">
            <h2>Request History</h2>
            {loading ? <p className="tp-empty">Loading requests...</p> : null}
            {!loading && requests.length === 0 ? <p className="tp-empty">No maintenance requests yet.</p> : null}
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
                      <span>{request.category || 'General'}</span>
                      <span>{request.priority || 'normal'}</span>
                      <span>{formatDateTime(request.created_at)}</span>
                    </div>
                    {request.admin_note ? <small>{request.admin_note}</small> : null}
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        </section>
      </section>
    </main>
  );
};

export default TenantPortalMaintenance;

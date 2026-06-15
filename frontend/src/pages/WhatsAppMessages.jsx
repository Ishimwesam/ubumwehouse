import React, { useEffect, useMemo, useState } from 'react';
import { emitAppToast } from '../context/ToastContext';
import { getReadableApiError, whatsappService } from '../services/api';
import PageLoader from '../components/PageLoader';
import '../styles/whatsapp-messages.css';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const templateVariables = {
  rent_due: { message_type: 'rent_due' },
  overdue: { message_type: 'overdue' },
  payment_received: { message_type: 'payment_confirmation' },
  receipt_link: { message_type: 'receipt' },
  penalty_notice: { message_type: 'penalty' },
  announcement: { message_type: 'announcement' }
};

const WhatsAppMessages = () => {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState({ summary: null, templates: [], tenants: [], history: [] });
  const [selectedTenantIds, setSelectedTenantIds] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('rent_due');
  const [customMessage, setCustomMessage] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [receiptLink, setReceiptLink] = useState('');
  const [search, setSearch] = useState('');
  const [showOpenBalancesOnly, setShowOpenBalancesOnly] = useState(true);

  const loadDashboard = async () => {
    setError('');
    try {
      const response = await whatsappService.getDashboard();
      const next = response.data || {};
      setDashboard({
        summary: next.summary || null,
        templates: next.templates || [],
        tenants: next.tenants || [],
        history: next.history || []
      });
      if (!selectedTenantIds.length && next.tenants?.length) {
        const firstDue = next.tenants.find((tenant) => Number(tenant.balance || 0) > 0 && tenant.whatsapp_ready);
        if (firstDue) setSelectedTenantIds([firstDue.id]);
      }
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to load WhatsApp messaging.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const selectedTemplate = useMemo(
    () => dashboard.templates.find((template) => template.id === selectedTemplateId) || dashboard.templates[0] || null,
    [dashboard.templates, selectedTemplateId]
  );

  const filteredTenants = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dashboard.tenants
      .filter((tenant) => !showOpenBalancesOnly || Number(tenant.balance || 0) > 0)
      .filter((tenant) => {
        if (!term) return true;
        return [
          tenant.full_name,
          tenant.phone,
          tenant.unit_number,
          tenant.building_name
        ].some((value) => String(value || '').toLowerCase().includes(term));
      });
  }, [dashboard.tenants, search, showOpenBalancesOnly]);

  const selectedTenants = useMemo(
    () => dashboard.tenants.filter((tenant) => selectedTenantIds.includes(tenant.id)),
    [dashboard.tenants, selectedTenantIds]
  );

  const previewVariables = useMemo(() => {
    const tenant = selectedTenants[0] || {};
    return {
      tenant_name: tenant.full_name || 'Jean',
      month: tenant.month || new Date().toISOString().slice(0, 7),
      amount: Number(tenant.amount || 500000).toLocaleString('en-US', { maximumFractionDigits: 0 }),
      balance: Number(tenant.balance || 500000).toLocaleString('en-US', { maximumFractionDigits: 0 }),
      due_date: tenant.due_date || 'month end',
      company_name: dashboard.summary?.config?.companyName || 'UBUMWE SYSTEM COMPANY',
      receipt_link: receiptLink || '[receipt link]',
      announcement: announcement || 'water maintenance will happen tomorrow from 9:00 AM to 12:00 PM'
    };
  }, [selectedTenants, dashboard.summary, receiptLink, announcement]);

  const previewText = useMemo(() => {
    const source = customMessage.trim() || selectedTemplate?.body || '';
    return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => previewVariables[key] || '');
  }, [customMessage, selectedTemplate, previewVariables]);

  const toggleTenant = (tenantId) => {
    setSelectedTenantIds((current) => (
      current.includes(tenantId)
        ? current.filter((id) => id !== tenantId)
        : [...current, tenantId]
    ));
  };

  const selectVisibleReadyTenants = () => {
    setSelectedTenantIds(filteredTenants.filter((tenant) => tenant.whatsapp_ready).map((tenant) => tenant.id));
  };

  const sendSelected = async () => {
    if (!selectedTenantIds.length) {
      emitAppToast('Choose at least one tenant.', 'warning');
      return;
    }

    setWorking(true);
    setError('');
    try {
      const variables = { announcement, receipt_link: receiptLink };
      const response = await whatsappService.sendMessage({
        tenant_ids: selectedTenantIds,
        template_id: customMessage.trim() ? undefined : selectedTemplateId,
        message_type: templateVariables[selectedTemplateId]?.message_type || 'manual',
        message_body: customMessage,
        variables
      });
      const failed = Number(response.data?.failed || 0);
      emitAppToast(failed ? `WhatsApp send completed with ${failed} failed message(s).` : 'WhatsApp messages sent.', failed ? 'warning' : 'success');
      await loadDashboard();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to send WhatsApp messages.'));
    } finally {
      setWorking(false);
    }
  };

  const sendOpenBalanceReminders = async (overdueOnly = false) => {
    setWorking(true);
    setError('');
    try {
      const response = await whatsappService.sendOpenBalanceReminders(overdueOnly);
      emitAppToast(`Reminder run complete: ${response.data?.sent || 0} sent, ${response.data?.failed || 0} failed.`, 'success');
      await loadDashboard();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to send rent reminders.'));
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <PageLoader text="Loading WhatsApp messages..." />;

  const summary = dashboard.summary || {};
  const config = summary.config || {};

  return (
    <main className="whatsapp-page">
      <section className="whatsapp-header">
        <div>
          <div className="whatsapp-eyebrow">WhatsApp Tenant Messaging</div>
          <h1>Messages, reminders, receipts</h1>
          <p>Send tenant dues, overdue notices, payment confirmations, receipt links, penalty notices, and announcements from one admin workspace.</p>
        </div>
        <div className={`whatsapp-config ${config.configured ? 'ready' : 'missing'}`}>
          <span>{config.configured ? 'Cloud API configured' : 'Cloud API not configured'}</span>
          <small>Country +{config.defaultCountryCode || '250'} | Templates: utility</small>
        </div>
      </section>

      {error ? <div className="whatsapp-alert">{error}</div> : null}

      <section className="whatsapp-stats">
        <article>
          <span>{summary.totals?.tenants || 0}</span>
          <p>Active tenants</p>
        </article>
        <article>
          <span>{summary.totals?.readyTenants || 0}</span>
          <p>WhatsApp-ready numbers</p>
        </article>
        <article>
          <span>{summary.totals?.withOpenBalance || 0}</span>
          <p>Open balances</p>
        </article>
        <article>
          <span>{summary.statusCounts?.sent || 0}</span>
          <p>Sent messages logged</p>
        </article>
      </section>

      <section className="whatsapp-actions">
        <button type="button" onClick={() => sendOpenBalanceReminders(false)} disabled={working}>Send rent due reminders</button>
        <button type="button" onClick={() => sendOpenBalanceReminders(true)} disabled={working}>Send overdue reminders</button>
        <button type="button" onClick={selectVisibleReadyTenants} disabled={working}>Select visible tenants</button>
        <button type="button" className="ghost" onClick={loadDashboard} disabled={working}>Refresh</button>
      </section>

      <section className="whatsapp-workspace">
        <aside className="whatsapp-tenant-list">
          <div className="whatsapp-panel-top">
            <h2>Tenants</h2>
            <label>
              <input type="checkbox" checked={showOpenBalancesOnly} onChange={(event) => setShowOpenBalancesOnly(event.target.checked)} />
              Open balance
            </label>
          </div>
          <input
            className="whatsapp-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tenant, phone, unit..."
          />
          <div className="whatsapp-tenant-scroll">
            {filteredTenants.map((tenant) => (
              <button
                type="button"
                key={tenant.id}
                className={`whatsapp-tenant-row ${selectedTenantIds.includes(tenant.id) ? 'selected' : ''}`}
                onClick={() => toggleTenant(tenant.id)}
              >
                <span>
                  <strong>{tenant.full_name}</strong>
                  <small>{tenant.building_name || 'Building'} / {tenant.unit_number || 'Unit'} / {tenant.normalized_phone || 'No WhatsApp number'}</small>
                </span>
                <em>{formatCurrency(tenant.balance)}</em>
              </button>
            ))}
          </div>
        </aside>

        <section className="whatsapp-composer">
          <div className="whatsapp-panel-top">
            <h2>Send Message</h2>
            <span>{selectedTenantIds.length} selected</span>
          </div>

          <label className="whatsapp-field">
            Template
            <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
              {dashboard.templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>

          <div className="whatsapp-two-fields">
            <label className="whatsapp-field">
              Receipt link
              <input value={receiptLink} onChange={(event) => setReceiptLink(event.target.value)} placeholder="https://..." />
            </label>
            <label className="whatsapp-field">
              Announcement
              <input value={announcement} onChange={(event) => setAnnouncement(event.target.value)} placeholder="Notice text..." />
            </label>
          </div>

          <label className="whatsapp-field">
            Custom message
            <textarea
              value={customMessage}
              onChange={(event) => setCustomMessage(event.target.value)}
              placeholder="Leave empty to use the selected template."
            />
          </label>

          <div className="whatsapp-preview">
            <strong>Preview</strong>
            <p>{previewText}</p>
          </div>

          <button type="button" className="whatsapp-send" onClick={sendSelected} disabled={working}>
            {working ? 'Sending...' : 'Send WhatsApp Message'}
          </button>
        </section>
      </section>

      <section className="whatsapp-history">
        <div className="whatsapp-panel-top">
          <h2>Message History</h2>
          <span>Sent / delivered / failed tracking starts here</span>
        </div>
        <div className="whatsapp-history-table">
          <div className="whatsapp-history-head">
            <span>Tenant</span>
            <span>Type</span>
            <span>Status</span>
            <span>Time</span>
          </div>
          {dashboard.history.map((item) => (
            <div key={item.id} className="whatsapp-history-row">
              <span>
                <strong>{item.tenant_name || 'Tenant'}</strong>
                <small>{item.phone}</small>
              </span>
              <span>{item.message_type}</span>
              <span className={`whatsapp-status ${item.status}`}>{item.status}</span>
              <span>{formatDateTime(item.created_at)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default WhatsAppMessages;

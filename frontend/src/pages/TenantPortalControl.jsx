import React, { useEffect, useMemo, useState } from 'react';
import { getReadableApiError, tenantPortalAdminService } from '../services/api';
import { emitAppToast } from '../context/ToastContext';
import '../styles/tenant-portal-control.css';

const formatDateTime = (value) => {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Never';
  return parsed.toLocaleString();
};

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;

const formatShortDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString().slice(0, 10);
};

const getDueLabel = (account) => {
  const status = String(account?.due_status || '').toLowerCase();
  if (status === 'paid') return 'Paid';
  if (status === 'overdue') return `${Math.abs(Number(account?.days_until_due || 0))} days overdue`;
  if (status === 'due_today') return 'Due today';
  return `${Math.max(Number(account?.days_until_due || 0), 0)} days left`;
};

const TenantPortalControl = () => {
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [streamLive, setStreamLive] = useState(false);
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [maintenanceSummary, setMaintenanceSummary] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0 });
  const [workingMaintenanceId, setWorkingMaintenanceId] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '', is_published: true });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  const accountsByPriority = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const unreadDiff = Number(b.unread_tenant_messages || 0) - Number(a.unread_tenant_messages || 0);
      if (unreadDiff !== 0) return unreadDiff;
      return String(a.tenant_name || '').localeCompare(String(b.tenant_name || ''));
    });
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = showUnreadOnly
      ? accountsByPriority.filter((account) => Number(account.unread_tenant_messages || 0) > 0)
      : accountsByPriority;
    if (!term) return source;

    return source.filter((account) => [
      account.tenant_name,
      account.username,
      account.tenant_email,
      account.tenant_phone,
      account.unit_number,
      account.building_name
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [accountsByPriority, search, showUnreadOnly]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.tenant_id === selectedTenantId) || null,
    [accounts, selectedTenantId]
  );

  const openMaintenanceRequests = useMemo(
    () => maintenanceRequests.filter((request) => !['resolved', 'closed'].includes(String(request.status || '').toLowerCase())),
    [maintenanceRequests]
  );

  const dueAccounts = useMemo(
    () => accounts
      .filter((account) => Number(account.remaining_amount || 0) > 0)
      .sort((a, b) => Number(a.days_until_due || 0) - Number(b.days_until_due || 0)),
    [accounts]
  );

  const overdueAccounts = useMemo(
    () => dueAccounts.filter((account) => account.due_status === 'overdue'),
    [dueAccounts]
  );

  const dueTodayAccounts = useMemo(
    () => dueAccounts.filter((account) => account.due_status === 'due_today'),
    [dueAccounts]
  );

  const totalRemainingDue = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.remaining_amount || 0), 0),
    [accounts]
  );

  const totalPendingDue = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.pending_amount || 0), 0),
    [accounts]
  );

  const loadAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await tenantPortalAdminService.listAccounts();
      const nextAccounts = response.data?.accounts || [];
      setAccounts(nextAccounts);
      setSummary(response.data?.summary || { total: 0, active: 0, inactive: 0 });
      const unreadFirst = nextAccounts.find((account) => Number(account.unread_tenant_messages || 0) > 0);
      const selectedStillExists = nextAccounts.some((account) => account.tenant_id === selectedTenantId);
      if (!selectedStillExists && unreadFirst) {
        setSelectedTenantId(unreadFirst.tenant_id);
      } else if (!selectedStillExists && nextAccounts.length) {
        setSelectedTenantId(nextAccounts[0].tenant_id);
      } else if (!selectedTenantId && unreadFirst) {
        setSelectedTenantId(unreadFirst.tenant_id);
      } else if (!selectedTenantId && nextAccounts.length) {
        setSelectedTenantId(nextAccounts[0].tenant_id);
      }
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to load tenant portal accounts.'));
    } finally {
      setLoading(false);
    }
  };

  const loadChat = async (tenantId) => {
    if (!tenantId) return;
    setChatLoading(true);
    try {
      const response = await tenantPortalAdminService.getTenantMessages(tenantId);
      setChatMessages(response.data?.messages || []);
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to load tenant chat messages.'));
    } finally {
      setChatLoading(false);
    }
  };

  const loadMaintenanceRequests = async () => {
    try {
      const response = await tenantPortalAdminService.listMaintenanceRequests();
      setMaintenanceRequests(response.data?.requests || []);
      setMaintenanceSummary(response.data?.summary || { total: 0, open: 0, in_progress: 0, resolved: 0 });
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to load maintenance requests.'));
    }
  };

  const loadAnnouncements = async () => {
    try {
      const response = await tenantPortalAdminService.listAnnouncements();
      setAnnouncements(response.data?.announcements || []);
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to load announcements.'));
    }
  };

  const loadOperations = async () => {
    await Promise.all([loadMaintenanceRequests(), loadAnnouncements()]);
  };

  useEffect(() => {
    loadAccounts();
    loadOperations();
  }, []);

  useEffect(() => {
    if (!selectedTenantId) return;
    loadChat(selectedTenantId);
  }, [selectedTenantId]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadAccounts();
      loadMaintenanceRequests();
      if (selectedTenantId) loadChat(selectedTenantId);
    }, 15000);
    return () => clearInterval(timer);
  }, [selectedTenantId]);

  useEffect(() => {
    const streamUrl = tenantPortalAdminService.getStreamUrl();
    if (!streamUrl) return undefined;

    const source = new EventSource(streamUrl);
    const onConnected = () => setStreamLive(true);
    source.addEventListener('connected', onConnected);

    const onMessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (payload?.event_type === 'maintenance_request') {
          emitAppToast(`Live update: maintenance request${payload.tenant_name ? ` from ${payload.tenant_name}` : ''}`, 'realtime');
          loadMaintenanceRequests();
          return;
        }

        if (payload?.event_type === 'tenant_payment_update' || payload?.event_type === 'tenant_rent_due') {
          emitAppToast('Live update: rent dues changed', 'realtime');
          loadAccounts();
          return;
        }

        if (!payload?.id || !payload?.tenant_id) return;

        if (payload.sender_type === 'tenant') {
          emitAppToast(`Live update: new tenant message${payload.tenant_name ? ` from ${payload.tenant_name}` : ''}`, 'realtime');
        }

        setAccounts((prev) => prev.map((account) => {
          if (account.tenant_id !== payload.tenant_id) return account;
          const unreadDelta = payload.sender_type === 'tenant' ? 1 : 0;
          return {
            ...account,
            unread_tenant_messages: Number(account.unread_tenant_messages || 0) + unreadDelta
          };
        }));

        if (payload.tenant_id === selectedTenantId) {
          setChatMessages((prev) => (prev.some((item) => item.id === payload.id) ? prev : [...prev, payload]));
          if (payload.sender_type === 'tenant') {
            loadChat(selectedTenantId);
            loadAccounts();
          }
        }
      } catch (_) {}
    };

    source.addEventListener('message', onMessage);
    source.onerror = () => {
      setStreamLive(false);
    };

    return () => {
      setStreamLive(false);
      source.removeEventListener('connected', onConnected);
      source.removeEventListener('message', onMessage);
      source.close();
    };
  }, [selectedTenantId]);

  const handleToggleStatus = async (account) => {
    setWorkingId(account.id);
    setError('');
    setSuccess('');
    try {
      await tenantPortalAdminService.updateAccountStatus(account.id, !account.is_active);
      setSuccess(`Account ${account.username} has been ${account.is_active ? 'deactivated' : 'activated'}.`);
      await loadAccounts();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to update account status.'));
    } finally {
      setWorkingId('');
    }
  };

  const handleResetPassword = async (account) => {
    const newPassword = window.prompt(`Set a new password for ${account.username}. Password must be at least 8 characters and include a letter and a number.`);
    if (!newPassword) return;

    setWorkingId(account.id);
    setError('');
    setSuccess('');
    try {
      await tenantPortalAdminService.resetAccountPassword(account.id, newPassword);
      setSuccess(`Password reset for ${account.username} completed.`);
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to reset account password.'));
    } finally {
      setWorkingId('');
    }
  };

  const handleSendChat = async (event) => {
    event.preventDefault();
    if (!selectedTenantId || !chatDraft.trim()) return;

    setSendingChat(true);
    setError('');
    try {
      const response = await tenantPortalAdminService.sendTenantMessage(selectedTenantId, chatDraft.trim());
      setChatMessages((prev) => [...prev, response.data]);
      setChatDraft('');
      await loadAccounts();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to send support reply.'));
    } finally {
      setSendingChat(false);
    }
  };

  const handleMaintenanceStatus = async (request, status) => {
    setWorkingMaintenanceId(request.id);
    setError('');
    setSuccess('');
    try {
      await tenantPortalAdminService.updateMaintenanceRequest(request.id, {
        status,
        admin_note: request.admin_note || ''
      });
      setSuccess(`Maintenance request marked ${status.replace(/_/g, ' ')}.`);
      await loadMaintenanceRequests();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to update maintenance request.'));
    } finally {
      setWorkingMaintenanceId('');
    }
  };

  const handleAnnouncementSubmit = async (event) => {
    event.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) return;

    setSavingAnnouncement(true);
    setError('');
    setSuccess('');
    try {
      await tenantPortalAdminService.createAnnouncement(announcementForm);
      setAnnouncementForm({ title: '', body: '', is_published: true });
      setSuccess('Announcement published to tenant portal.');
      await loadAnnouncements();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to publish announcement.'));
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleToggleAnnouncement = async (announcement) => {
    setError('');
    setSuccess('');
    try {
      await tenantPortalAdminService.updateAnnouncement(announcement.id, {
        title: announcement.title,
        body: announcement.body,
        audience: announcement.audience || 'all',
        expires_at: announcement.expires_at || '',
        is_published: !announcement.is_published
      });
      await loadAnnouncements();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to update announcement.'));
    }
  };

  return (
    <div className="tenant-portal-control-page">
      <div className="tenant-portal-control-header">
        <div>
          <h1>Tenant Portal Control</h1>
          <p>Manage tenant access, reset credentials, and handle support chat from one place.</p>
        </div>
        <button type="button" onClick={loadAccounts} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <section className="tenant-portal-control-summary-grid">
        <article>
          <span>Total Accounts</span>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <span>Active</span>
          <strong>{summary.active}</strong>
        </article>
        <article>
          <span>Inactive</span>
          <strong>{summary.inactive}</strong>
        </article>
        <article className={accounts.reduce((s, a) => s + Number(a.unread_tenant_messages || 0), 0) > 0 ? 'has-unread' : ''}>
          <span>Unread Messages</span>
          <strong>{accounts.reduce((s, a) => s + Number(a.unread_tenant_messages || 0), 0)}</strong>
        </article>
        <article>
          <span>Open Maintenance</span>
          <strong>{openMaintenanceRequests.length}</strong>
        </article>
        <article>
          <span>Announcements</span>
          <strong>{announcements.length}</strong>
        </article>
        <article className={overdueAccounts.length > 0 ? 'has-due' : ''}>
          <span>Real-Time Due</span>
          <strong>{formatCurrency(totalRemainingDue)}</strong>
        </article>
      </section>

      {error ? <div className="tenant-portal-control-alert error">{error}</div> : null}
      {success ? <div className="tenant-portal-control-alert success">{success}</div> : null}

      <section className="tenant-portal-control-panel real-time-dues">
        <div className="tenant-portal-control-panel-header">
          <h2>Real-Time Rent Dues</h2>
          <span className={`stream-pill ${streamLive ? 'live' : 'offline'}`}>
            {streamLive ? 'Live dues on' : 'Live reconnecting...'}
          </span>
        </div>

        <div className="rent-dues-strip">
          <article>
            <span>Total Outstanding</span>
            <strong>{formatCurrency(totalRemainingDue)}</strong>
          </article>
          <article className={overdueAccounts.length > 0 ? 'danger' : ''}>
            <span>Overdue Tenants</span>
            <strong>{overdueAccounts.length}</strong>
          </article>
          <article className={dueTodayAccounts.length > 0 ? 'warn' : ''}>
            <span>Due Today</span>
            <strong>{dueTodayAccounts.length}</strong>
          </article>
          <article>
            <span>Pending Confirmation</span>
            <strong>{formatCurrency(totalPendingDue)}</strong>
          </article>
        </div>

        <div className="rent-dues-list">
          {dueAccounts.length ? dueAccounts.slice(0, 10).map((account) => (
            <article key={account.id} className={`rent-due-row ${account.due_status || 'upcoming'}`}>
              <div>
                <strong>{account.tenant_name || 'Unknown tenant'}</strong>
                <span>{account.building_name || 'Building'} / Unit {account.unit_number || '-'}</span>
              </div>
              <div>
                <span>Period</span>
                <strong>{account.due_period || '-'}</strong>
              </div>
              <div>
                <span>Due Date</span>
                <strong>{formatShortDate(account.due_date)}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{formatCurrency(account.remaining_amount)}</strong>
              </div>
              <span className={`due-chip ${account.due_status || 'upcoming'}`}>{getDueLabel(account)}</span>
            </article>
          )) : (
            <div className="empty">No live rent dues right now.</div>
          )}
        </div>
      </section>

      <section className="tenant-portal-control-layout">
        <article className="tenant-portal-control-panel">
          <div className="tenant-portal-control-panel-header">
            <h2>Tenant Inbox</h2>
            <span className={`stream-pill ${streamLive ? 'live' : 'offline'}`}>
              {streamLive ? 'Live updates on' : 'Live reconnecting...'}
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tenant, username, contact, unit, or building"
            />
          </div>

          <div className="tenant-portal-control-filter-row">
            <label>
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(event) => setShowUnreadOnly(event.target.checked)}
              />
              Show unread only
            </label>
          </div>

          <div className="tenant-portal-control-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Unread</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className={selectedTenantId === account.tenant_id ? 'selected' : ''}>
                    <td>
                      <button
                        type="button"
                        className="tenant-link"
                        onClick={() => setSelectedTenantId(account.tenant_id)}
                      >
                        {account.tenant_name || 'Unknown tenant'}
                      </button>
                      <div className="meta">{account.tenant_email || account.tenant_phone || 'No contact'}</div>
                      <div className="meta">{account.unit_number ? `${account.building_name || 'Building'} / ${account.unit_number}` : 'Unassigned'}</div>
                    </td>
                    <td>{account.username}</td>
                    <td>
                      <span className={`status ${account.is_active ? 'active' : 'inactive'}`}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <span className={`unread-pill ${Number(account.unread_tenant_messages || 0) > 0 ? 'has-unread' : ''}`}>
                        {Number(account.unread_tenant_messages || 0)}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setSelectedTenantId(account.tenant_id)}
                        >
                          Open Inbox
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(account)}
                          disabled={workingId === account.id}
                        >
                          {account.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleResetPassword(account)}
                          disabled={workingId === account.id}
                        >
                          Reset Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">No tenant portal accounts found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="tenant-portal-control-panel chat">
          <div className="tenant-portal-control-panel-header">
            <h2>
              Support Chat
              {selectedAccount ? ` / ${selectedAccount.tenant_name}` : ''}
            </h2>
            <span className="last-login">Last login: {selectedAccount ? formatDateTime(selectedAccount.last_login_at) : 'Never'}</span>
          </div>

          <div className="chat-log">
            {chatLoading ? <div className="empty">Loading chat...</div> : null}
            {!chatLoading && chatMessages.length === 0 ? <div className="empty">No messages yet.</div> : null}
            {!chatLoading && chatMessages.map((message) => (
              <div key={message.id} className={`bubble ${message.sender_type === 'admin' ? 'admin' : 'tenant'}`}>
                <span className="author">{message.sender_type === 'admin' ? (message.sender_name || 'Admin') : 'Tenant'}</span>
                <p>{message.message}</p>
                <small>{formatDateTime(message.created_at)}</small>
              </div>
            ))}
          </div>

          <form className="chat-compose" onSubmit={handleSendChat}>
            <textarea
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              rows={3}
              placeholder="Reply to the tenant..."
              disabled={!selectedTenantId}
            />
            <button type="submit" disabled={!selectedTenantId || sendingChat}>
              {sendingChat ? 'Sending...' : 'Send Reply'}
            </button>
          </form>
        </article>
      </section>

      <section className="tenant-portal-control-layout operations">
        <article className="tenant-portal-control-panel">
          <div className="tenant-portal-control-panel-header">
            <h2>Maintenance Queue</h2>
            <span className="last-login">{maintenanceSummary.open} open / {maintenanceSummary.in_progress} in progress</span>
          </div>

          <div className="portal-maintenance-list">
            {maintenanceRequests.length ? maintenanceRequests.slice(0, 12).map((request) => (
              <article key={request.id} className="portal-maintenance-item">
                <div>
                  <strong>{request.title}</strong>
                  <p>{request.description}</p>
                  <small>
                    {request.tenant_name || 'Tenant'} / {request.building_name || 'Building'} {request.unit_number || ''}
                    {' '} / {formatDateTime(request.created_at)}
                  </small>
                </div>
                <div className="portal-maintenance-actions">
                  <span className={`status ${String(request.status || 'open').toLowerCase()}`}>{String(request.status || 'open').replace(/_/g, ' ')}</span>
                  <button
                    type="button"
                    className="secondary"
                    disabled={workingMaintenanceId === request.id}
                    onClick={() => handleMaintenanceStatus(request, 'in_progress')}
                  >
                    In Progress
                  </button>
                  <button
                    type="button"
                    disabled={workingMaintenanceId === request.id}
                    onClick={() => handleMaintenanceStatus(request, 'resolved')}
                  >
                    Resolve
                  </button>
                </div>
              </article>
            )) : <div className="empty">No maintenance requests yet.</div>}
          </div>
        </article>

        <article className="tenant-portal-control-panel">
          <div className="tenant-portal-control-panel-header">
            <h2>Announcements</h2>
          </div>

          <form className="portal-announcement-form" onSubmit={handleAnnouncementSubmit}>
            <input
              value={announcementForm.title}
              maxLength={140}
              onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Announcement title"
              required
            />
            <textarea
              value={announcementForm.body}
              maxLength={2200}
              onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, body: event.target.value }))}
              placeholder="Write the tenant notice..."
              rows={4}
              required
            />
            <label>
              <input
                type="checkbox"
                checked={announcementForm.is_published}
                onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, is_published: event.target.checked }))}
              />
              Publish now
            </label>
            <button type="submit" disabled={savingAnnouncement}>
              {savingAnnouncement ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </form>

          <div className="portal-announcement-admin-list">
            {announcements.length ? announcements.slice(0, 8).map((announcement) => (
              <article key={announcement.id}>
                <div>
                  <strong>{announcement.title}</strong>
                  <p>{announcement.body}</p>
                  <small>{announcement.published_at ? formatDateTime(announcement.published_at) : 'Draft'}</small>
                </div>
                <button type="button" className="secondary" onClick={() => handleToggleAnnouncement(announcement)}>
                  {announcement.is_published ? 'Unpublish' : 'Publish'}
                </button>
              </article>
            )) : <div className="empty">No announcements yet.</div>}
          </div>
        </article>
      </section>
    </div>
  );
};

export default TenantPortalControl;

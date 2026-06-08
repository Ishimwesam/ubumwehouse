import React, { useEffect, useMemo, useState } from 'react';
import { getReadableApiError, tenantPortalAdminService } from '../services/api';
import '../styles/tenant-portal-control.css';

const formatDateTime = (value) => {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Never';
  return parsed.toLocaleString();
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

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return accounts;

    return accounts.filter((account) => [
      account.tenant_name,
      account.username,
      account.tenant_email,
      account.tenant_phone,
      account.unit_number,
      account.building_name
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [accounts, search]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.tenant_id === selectedTenantId) || null,
    [accounts, selectedTenantId]
  );

  const loadAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await tenantPortalAdminService.listAccounts();
      const nextAccounts = response.data?.accounts || [];
      setAccounts(nextAccounts);
      setSummary(response.data?.summary || { total: 0, active: 0, inactive: 0 });
      if (!selectedTenantId && nextAccounts.length) {
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

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (!selectedTenantId) return;
    loadChat(selectedTenantId);
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
      </section>

      {error ? <div className="tenant-portal-control-alert error">{error}</div> : null}
      {success ? <div className="tenant-portal-control-alert success">{success}</div> : null}

      <section className="tenant-portal-control-layout">
        <article className="tenant-portal-control-panel">
          <div className="tenant-portal-control-panel-header">
            <h2>Tenant Accounts</h2>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tenant, username, contact, unit, or building"
            />
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
                    <td>{Number(account.unread_tenant_messages || 0)}</td>
                    <td>
                      <div className="actions">
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
    </div>
  );
};

export default TenantPortalControl;
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import TenantPortalNav, { TenantLanguageSelect, TenantNotificationPermissionButton } from '../components/TenantPortalNav';
import { StatIconCheck, StatIconFile, StatIconWallet } from '../components/TenantPortalStatIcons';
import useTenantUnread from '../hooks/useTenantUnread';
import { clearUnread, registerTenantPushSubscription, requestNotificationPermission } from '../utils/tenantNotification';
import '../styles/tenant-portal.css';

const TenantPortalMessages = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [portalData, setPortalData] = useState(null);
  const unreadMessages = useTenantUnread();
  const chatLogRef = useRef(null);

  const tenant = portalData?.tenant;
  const accountName = 'UBUMWE HOUSE LTD';
  const tenantDisplayName = (tenant?.full_name || tenant?.tenant_name || 'Tenant').toUpperCase();
  const statusLabel = (portalData?.contracts?.[0]?.lifecycle_status || portalData?.contracts?.[0]?.status || 'active').replace(/_/g, ' ');

  useEffect(() => {
    const token = tenantPortalService.getToken();
    if (!token) {
      navigate('/tenant-portal');
      return undefined;
    }

    tenantPortalService.me()
      .then((response) => {
        setPortalData(response.data);
      })
      .catch((err) => {
        setError(getReadableApiError(err, 'Failed to load tenant portal details.'));
      });

    return undefined;
  }, [navigate]);

  const loadMessages = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await tenantPortalService.getMessages();
      setMessages(response.data?.messages || []);
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to load messages.'));
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
    clearUnread();
    requestNotificationPermission();
    registerTenantPushSubscription(tenantPortalService);
    loadMessages();
  }, [navigate]);

  useEffect(() => {
    const onPortalEvent = (event) => {
      const payload = event.detail || {};
      if (!payload?.id || !payload.sender_type) return;
      setMessages((prev) => (prev.some((item) => item.id === payload.id) ? prev : [...prev, payload]));
    };

    window.addEventListener('tp:portal-event', onPortalEvent);

    return () => {
      window.removeEventListener('tp:portal-event', onPortalEvent);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!chatLogRef.current) return;
    // Always reveal the latest message at the bottom of the chat log.
    chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;

    setSending(true);
    setError('');
    try {
      const response = await tenantPortalService.sendMessage(draft.trim());
      setMessages((prev) => [...prev, response.data]);
      setDraft('');
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to send message.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="tp-page">
      <div className="tp-dashboard">
        <aside className="tp-sidebar">
          <div className="tp-brand-block">
            <div className="tp-brand-title">UBUMWE HOUSE LTD</div>
            <div className="tp-brand-subtitle">Tenant Portal</div>
          </div>

          <TenantPortalNav current="messages" />

          <div className="tp-sidebar-actions">
            <TenantLanguageSelect />
            <TenantNotificationPermissionButton inline />
            <button
              className="tp-logout"
              type="button"
              onClick={() => {
                tenantPortalService.clearToken();
                navigate('/tenant-portal');
              }}
            >
              Logout
            </button>
          </div>
        </aside>

        <section className="tp-main">
          <header className="tp-header">
            <div>
              <h1>Messages</h1>
              <p>
                Chat with UBUMWE HOUSE LTD support team.
                <span> | </span>
                Room / Office: {tenant?.unit_number || 'N/A'}
                <span> | </span>
                Status: <strong>{statusLabel}</strong>
              </p>
            </div>
            <div className="tp-header-actions">
              <div className="tp-user">{accountName}</div>
            </div>
          </header>

          {error ? <div className="tp-alert error">{error}</div> : null}

          <section className="tp-stats-row">
            <article className="tp-stat-card">
              <div className="tp-stat-icon rent"><StatIconWallet /></div>
              <div>
                <span>Tenant</span>
                <strong>{tenantDisplayName}</strong>
              </div>
            </article>
            <article className="tp-stat-card">
              <div className="tp-stat-icon paid"><StatIconCheck /></div>
              <div>
                <span>Inbox State</span>
                <strong className="paid">{messages.length ? `${messages.length} messages` : 'Empty'}</strong>
              </div>
            </article>
            <article className="tp-stat-card">
              <div className="tp-stat-icon outstanding"><StatIconFile /></div>
              <div>
                <span>Unread</span>
                <strong className="outstanding">{unreadMessages}</strong>
              </div>
            </article>
          </section>

          <section className="tp-card" style={{ marginTop: 14 }}>
            <h2>Support Chat</h2>
            <div className="tp-chat-log" ref={chatLogRef}>
              {loading ? <div className="tp-empty">Loading messages...</div> : null}
              {!loading && messages.length === 0 ? <div className="tp-empty">No messages yet. Start a conversation.</div> : null}
              {!loading && messages.map((message) => (
                <div key={message.id} className={`tp-chat-bubble ${message.sender_type === 'tenant' ? 'tenant' : 'admin'}`}>
                  <span>{message.sender_type === 'tenant' ? 'You' : (message.sender_name || 'Admin')}</span>
                  <p>{message.message}</p>
                </div>
              ))}
            </div>

            <form className="tp-chat-compose" onSubmit={handleSend}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                placeholder="Type your message..."
              />
              <button className="tp-btn-primary" type="submit" disabled={sending}>
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
};

export default TenantPortalMessages;

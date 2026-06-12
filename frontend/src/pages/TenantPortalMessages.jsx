import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import TenantPortalNav, { TenantLanguageSelect, TenantMobileAppHeader, TenantNotificationPermissionButton, useTenantLanguage } from '../components/TenantPortalNav';
import { StatIconCheck, StatIconFile, StatIconWallet } from '../components/TenantPortalStatIcons';
import useTenantUnread from '../hooks/useTenantUnread';
import { clearUnread, registerTenantPushSubscription, requestNotificationPermission } from '../utils/tenantNotification';
import '../styles/tenant-portal.css';

const TenantPortalMessages = () => {
  const navigate = useNavigate();
  const [, text] = useTenantLanguage();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [portalData, setPortalData] = useState(null);
  const unreadMessages = useTenantUnread();
  const chatLogRef = useRef(null);

  const tenant = portalData?.tenant;
  const accountName = 'UBUMWE HOUSE SYSTEM';
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
        setError(getReadableApiError(err, text.failedLoadPortalDetails));
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
      setError(getReadableApiError(err, text.failedLoadMessages));
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
      setError(getReadableApiError(err, text.failedSendMessage));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="tp-page">
      <div className="tp-dashboard">
        <aside className="tp-sidebar">
          <div className="tp-brand-block">
            <div className="tp-brand-title">UBUMWE HOUSE SYSTEM</div>
            <div className="tp-brand-subtitle">{text.homePriority}</div>
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
              {text.logout}
            </button>
          </div>
        </aside>

        <section className="tp-main">
          <TenantMobileAppHeader current="messages" />
          <header className="tp-header">
            <div>
              <h1>{text.messagesTitle}</h1>
              <p>
                {text.messagesSubtitle}
                <span> | </span>
                {text.roomOffice}: {tenant?.unit_number || 'N/A'}
                <span> | </span>
                {text.status}: <strong>{statusLabel}</strong>
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
                <span>{text.tenantLabel}</span>
                <strong>{tenantDisplayName}</strong>
              </div>
            </article>
            <article className="tp-stat-card">
              <div className="tp-stat-icon paid"><StatIconCheck /></div>
              <div>
                <span>{text.inboxState}</span>
                <strong className="paid">{messages.length ? `${messages.length} ${text.messages}` : text.empty}</strong>
              </div>
            </article>
            <article className="tp-stat-card">
              <div className="tp-stat-icon outstanding"><StatIconFile /></div>
              <div>
                <span>{text.unread}</span>
                <strong className="outstanding">{unreadMessages}</strong>
              </div>
            </article>
          </section>

          <section className="tp-card" style={{ marginTop: 14 }}>
            <h2>{text.supportChat}</h2>
            <div className="tp-chat-log" ref={chatLogRef}>
              {loading ? <div className="tp-empty">{text.loadingMessages}</div> : null}
              {!loading && messages.length === 0 ? <div className="tp-empty">{text.noMessagesYet}</div> : null}
              {!loading && messages.map((message) => (
                <div key={message.id} className={`tp-chat-bubble ${message.sender_type === 'tenant' ? 'tenant' : 'admin'}`}>
                  <span>{message.sender_type === 'tenant' ? text.you : (message.sender_name || text.admin)}</span>
                  <p>{message.message}</p>
                </div>
              ))}
            </div>

            <form className="tp-chat-compose" onSubmit={handleSend}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                placeholder={text.messagePlaceholder}
              />
              <button className="tp-btn-primary" type="submit" disabled={sending}>
                {sending ? text.sending : text.sendMessage}
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
};

export default TenantPortalMessages;

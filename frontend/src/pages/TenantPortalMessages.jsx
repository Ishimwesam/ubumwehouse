import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import { emitAppToast } from '../context/ToastContext';
import { clearUnread, requestNotificationPermission, showBrowserNotification } from '../utils/tenantNotification';
import '../styles/tenant-portal.css';

const TenantPortalMessages = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

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
    loadMessages();
  }, [navigate]);

  useEffect(() => {
    const streamUrl = tenantPortalService.getStreamUrl();
    if (!streamUrl) return undefined;

    const source = new EventSource(streamUrl);
    const onMessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (!payload?.id) return;
        setMessages((prev) => (prev.some((item) => item.id === payload.id) ? prev : [...prev, payload]));
        if (payload.sender_type === 'admin') {
          emitAppToast('New reply from UBUMWE HOUSE LTD support', 'realtime');
          showBrowserNotification(
            'UBUMWE HOUSE LTD',
            payload.message || 'You have a new message from support.'
          );
        }
      } catch (_) {}
    };

    source.addEventListener('message', onMessage);
    source.onerror = () => {};

    return () => {
      source.removeEventListener('message', onMessage);
      source.close();
    };
  }, []);

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
    <main className="tp-page tp-subpage">
      <section className="tp-main tp-subpage-main">
        <header className="tp-header">
          <div>
            <h1>Messages</h1>
            <p>Chat with UBUMWE HOUSE LTD support team.</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            Back To Dashboard
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}

        <section className="tp-card" style={{ marginTop: 14 }}>
          <h2>Support Chat</h2>
          <div className="tp-chat-log">
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
    </main>
  );
};

export default TenantPortalMessages;

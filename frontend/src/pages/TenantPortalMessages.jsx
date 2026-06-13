import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import { TenantMobileAppHeader, TenantPortalShell, useTenantLanguage } from '../components/TenantPortalNav';
import useTenantUnread from '../hooks/useTenantUnread';
import { clearUnread, registerTenantPushSubscription, requestNotificationPermission } from '../utils/tenantNotification';
import '../styles/tenant-portal.css';

const MESSAGE_RECIPIENTS = [
  { id: 'management', name: 'Management Office', detail: 'info@ubumwehouse.rw', icon: 'office' },
  { id: 'maintenance', name: 'Maintenance Team', detail: 'maintenance@ubumwehouse.rw', icon: 'maintenance' },
  { id: 'support', name: 'Support Team', detail: 'support@ubumwehouse.rw', icon: 'support' },
  { id: 'billing', name: 'Billing Department', detail: 'billing@ubumwehouse.rw', icon: 'billing' },
  { id: 'manager', name: 'John Manager', detail: 'john.manager@ubumwehouse.rw', icon: 'manager' }
];

const formatMessageTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatMessageDate = (value) => {
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

const TenantPortalMessages = () => {
  const navigate = useNavigate();
  const [, text] = useTenantLanguage();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [newMessageDraft, setNewMessageDraft] = useState('');
  const [newMessageSubject, setNewMessageSubject] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('management');
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState('inbox');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [portalData, setPortalData] = useState(null);
  const unreadMessages = useTenantUnread();
  const chatLogRef = useRef(null);

  const tenant = portalData?.tenant;
  const statusLabel = (portalData?.contracts?.[0]?.lifecycle_status || portalData?.contracts?.[0]?.status || 'active').replace(/_/g, ' ');
  const latestMessage = messages[messages.length - 1];
  const latestAdminMessage = [...messages].reverse().find((message) => message.sender_type !== 'tenant');
  const selectedRecipientInfo = MESSAGE_RECIPIENTS.find((recipient) => recipient.id === selectedRecipient) || MESSAGE_RECIPIENTS[0];
  const contacts = MESSAGE_RECIPIENTS.map((recipient) => {
    const isManagement = recipient.id === 'management';
    const previewSource = isManagement ? latestMessage : null;
    return {
      ...recipient,
      time: isManagement ? formatMessageTime(previewSource?.created_at || previewSource?.createdAt) : '',
      preview: previewSource?.message || (isManagement ? text.noMessagesYet : 'Start a new message.'),
      unread: isManagement ? unreadMessages : 0
    };
  });
  const filteredContacts = contacts.filter((contact) => {
    const haystack = `${contact.name} ${contact.detail} ${contact.preview}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

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

  const sendMessage = async (message, onSuccess) => {
    if (!message.trim()) return;

    setSending(true);
    setError('');
    try {
      const response = await tenantPortalService.sendMessage(message.trim());
      setMessages((prev) => [...prev, response.data]);
      onSuccess?.();
      setSelectedRecipient('management');
      setMobileView('thread');
    } catch (err) {
      setError(getReadableApiError(err, text.failedSendMessage));
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    sendMessage(draft, () => setDraft(''));
  };

  const handleNewMessage = async (event) => {
    event.preventDefault();
    const subjectLine = newMessageSubject.trim();
    const messageBody = newMessageDraft.trim();
    const prefix = selectedRecipientInfo?.name ? `To ${selectedRecipientInfo.name}` : 'To Management Office';
    const fullMessage = [prefix, subjectLine ? `Subject: ${subjectLine}` : '', messageBody].filter(Boolean).join('\n\n');
    sendMessage(fullMessage, () => {
      setNewMessageDraft('');
      setNewMessageSubject('');
    });
  };

  const openContact = (contactId) => {
    setSelectedRecipient(contactId);
    setMobileView(contactId === 'management' ? 'thread' : 'compose');
  };

  return (
    <TenantPortalShell current="messages">
          <TenantMobileAppHeader current="messages" />
          <header className="tp-header tp-message-page-header">
            <div>
              <h1>Messages</h1>
              <p>
                {text.roomOffice}: {tenant?.unit_number || 'N/A'}
                <span> | </span>
                {text.status}: <strong>{statusLabel}</strong>
              </p>
            </div>
            <div className="tp-header-actions">
              <button className="tp-btn-primary tp-message-new-btn" type="button" onClick={() => setMobileView('compose')}>
                New Message
              </button>
            </div>
          </header>

          {error ? <div className="tp-alert error">{error}</div> : null}

          <section className="tp-message-app tp-section-anchor" id="support">
            <aside className={`tp-message-panel tp-message-inbox ${mobileView === 'inbox' ? 'is-active' : ''}`}>
              <div className="tp-message-panel-head">
                <div>
                  <h2>Messages (Inbox)</h2>
                  <p>{messages.length} total messages</p>
                </div>
                <button className="tp-icon-btn" type="button" aria-label="Compose message" onClick={() => setMobileView('compose')}>
                  +
                </button>
              </div>
              <div className="tp-message-search">
                <span aria-hidden="true">Search</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search messages"
                />
                <button type="button" aria-label="Filter messages">Filter</button>
              </div>
              <div className="tp-message-contact-list">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    className={`tp-message-contact ${selectedRecipient === contact.id ? 'active' : ''}`}
                    type="button"
                    onClick={() => openContact(contact.id)}
                  >
                    <span className={`tp-message-avatar ${contact.icon}`}>{contact.name.slice(0, 1)}</span>
                    <span className="tp-message-contact-body">
                      <strong>{contact.name}</strong>
                      <small>{contact.preview}</small>
                    </span>
                    <span className="tp-message-contact-meta">
                      <small>{contact.time || (contact.id === 'management' && latestAdminMessage ? formatMessageDate(latestAdminMessage.created_at || latestAdminMessage.createdAt) : '')}</small>
                      {contact.unread > 0 ? <b>{Math.min(99, contact.unread)}</b> : null}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <article className={`tp-message-panel tp-message-thread ${mobileView === 'thread' ? 'is-active' : ''}`}>
              <div className="tp-message-thread-head">
                <button className="tp-back-btn" type="button" aria-label="Back to inbox" onClick={() => setMobileView('inbox')}>
                  &lt;
                </button>
                <span className="tp-message-avatar office">M</span>
                <div>
                  <h2>Management Office</h2>
                  <p><i /> Online</p>
                </div>
                <button className="tp-info-btn" type="button" aria-label="Conversation information">i</button>
              </div>
              <div className="tp-chat-log tp-message-chat-log" ref={chatLogRef}>
                <time>{formatMessageDate(latestMessage?.created_at || latestMessage?.createdAt)}</time>
                {loading ? <div className="tp-empty">{text.loadingMessages}</div> : null}
                {!loading && messages.length === 0 ? <div className="tp-empty">{text.noMessagesYet}</div> : null}
                {!loading && messages.map((message) => (
                  <div key={message.id} className={`tp-chat-bubble ${message.sender_type === 'tenant' ? 'tenant' : 'admin'}`}>
                    <span>{message.sender_type === 'tenant' ? text.you : (message.sender_name || text.admin)}</span>
                    <p>{message.message}</p>
                    <small>{formatMessageTime(message.created_at || message.createdAt)}</small>
                  </div>
                ))}
              </div>

              <form className="tp-chat-compose tp-message-thread-compose" onSubmit={handleSend}>
                <button className="tp-attach-btn" type="button" aria-label="Attach file">+</button>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={1}
                  placeholder={text.messagePlaceholder}
                />
                <button className="tp-btn-primary" type="submit" disabled={sending || !draft.trim()}>
                  {sending ? text.sending : text.sendMessage}
                </button>
              </form>
            </article>

            <article className={`tp-message-panel tp-message-compose-panel ${mobileView === 'compose' ? 'is-active' : ''}`}>
              <div className="tp-message-compose-head">
                <button className="tp-back-btn" type="button" aria-label="Back to inbox" onClick={() => setMobileView('inbox')}>
                  &lt;
                </button>
                <h2>New Message</h2>
              </div>
              <form className="tp-new-message-form" onSubmit={handleNewMessage}>
                <label>
                  <span>To</span>
                  <select value={selectedRecipient} onChange={(event) => setSelectedRecipient(event.target.value)}>
                    {MESSAGE_RECIPIENTS.map((recipient) => (
                      <option key={recipient.id} value={recipient.id}>{recipient.name}</option>
                    ))}
                  </select>
                </label>
                <div className="tp-recipient-card">
                  {MESSAGE_RECIPIENTS.map((recipient) => (
                    <button
                      key={recipient.id}
                      className={selectedRecipient === recipient.id ? 'active' : ''}
                      type="button"
                      onClick={() => setSelectedRecipient(recipient.id)}
                    >
                      <span className={`tp-message-avatar ${recipient.icon}`}>{recipient.name.slice(0, 1)}</span>
                      <span>
                        <strong>{recipient.name}</strong>
                        <small>{recipient.detail}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <label>
                  <span>Subject</span>
                  <input
                    value={newMessageSubject}
                    onChange={(event) => setNewMessageSubject(event.target.value)}
                    placeholder="Enter subject"
                  />
                </label>
                <label>
                  <span>Message</span>
                  <textarea
                    value={newMessageDraft}
                    onChange={(event) => setNewMessageDraft(event.target.value)}
                    maxLength={1000}
                    placeholder="Type your message here..."
                  />
                  <small>{newMessageDraft.length}/1000</small>
                </label>
                <button className="tp-btn-primary" type="submit" disabled={sending || !newMessageDraft.trim()}>
                  {sending ? text.sending : text.sendMessage}
                </button>
              </form>
            </article>
          </section>
    </TenantPortalShell>
  );
};

export default TenantPortalMessages;

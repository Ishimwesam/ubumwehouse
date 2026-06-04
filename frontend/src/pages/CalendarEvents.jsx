import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { useAuth } from '../context/AuthContext';
import { calendarEventService, tenantService } from '../services/api';
import { useToast } from '../context/ToastContext';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);
const getInitialViewportWidth = () => (typeof window !== 'undefined' ? window.innerWidth : 1280);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const formatDateInput = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return new Date().toISOString().split('T')[0];
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

const formatTimeInput = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '09:00';
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
};

const addDays = (date, days) => new Date(date.getTime() + days * MS_PER_DAY);

const parseEventDateTime = (date, time = '09:00') => {
  const safeTime = time || '09:00';
  return new Date(`${date}T${safeTime.length === 5 ? `${safeTime}:00` : safeTime}`);
};

const getEventTiming = (event) => {
  const now = new Date();
  const eventDate = new Date(event.start);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEvent = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const dayDelta = Math.round((startOfEvent - startOfToday) / MS_PER_DAY);

  if (event.status === 'Done') return { label: 'Done', tone: 'done', dayDelta };
  if (dayDelta < 0) return { label: `${Math.abs(dayDelta)} day${Math.abs(dayDelta) === 1 ? '' : 's'} overdue`, tone: 'overdue', dayDelta };
  if (dayDelta === 0) return { label: 'Due today', tone: 'today', dayDelta };
  if (dayDelta <= 7) return { label: `Due in ${dayDelta} day${dayDelta === 1 ? '' : 's'}`, tone: 'soon', dayDelta };
  return { label: eventDate.toLocaleDateString(), tone: 'later', dayDelta };
};

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
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

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const EVENT_LINK_PRESETS = {
  'rent-due': {
    path: '/tenants',
    label: 'Open tenants with balances'
  },
  'receipt-review': {
    path: '/manual-confirmation',
    label: 'Open receipt review queue'
  },
  'balance-follow-up': {
    path: '/tenants',
    label: 'Open unpaid balances'
  }
};

const QUICK_LINKS = [
  {
    id: 'rent-due',
    title: 'Rent due',
    description: 'Review tenants who still have unpaid rent.',
    path: '/tenants'
  },
  {
    id: 'receipt-review',
    title: 'Receipt review',
    description: 'Confirm pending receipts that were uploaded.',
    path: '/manual-confirmation'
  },
  {
    id: 'balance-follow-up',
    title: 'Unpaid balance',
    description: 'Follow up tenants with remaining balances.',
    path: '/tenants'
  }
];

const EVENT_CATEGORIES = ['Rent', 'Payment', 'Follow-up', 'Due Date', 'Maintenance', 'Meeting', 'Other'];
const EVENT_PRIORITIES = ['High', 'Medium', 'Low'];
const EVENT_STATUSES = ['Open', 'In Progress', 'Done'];
const REMINDER_LEADS = [
  { value: 'none', label: 'No reminder' },
  { value: 'same-day', label: 'Same day' },
  { value: '1-day', label: '1 day before' },
  { value: '3-days', label: '3 days before' },
  { value: '7-days', label: '7 days before' }
];

const EVENT_TEMPLATES = [
  {
    id: 'rent-reminder-template',
    title: 'Rent Reminder',
    category: 'Rent',
    priority: 'High',
    note: 'Check tenants whose monthly rent is due or unpaid.',
    actionPath: '/tenants'
  },
  {
    id: 'due-date-template',
    title: 'Due Date',
    category: 'Due Date',
    priority: 'High',
    note: 'Track an important deadline and confirm completion before the due date.',
    actionPath: '/reports'
  },
  {
    id: 'follow-up-template',
    title: 'Follow-up Event',
    category: 'Follow-up',
    priority: 'Medium',
    note: 'Follow up with the tenant, payment record, or operational task owner.',
    actionPath: '/tenants'
  }
];

const inferEventLink = (event) => {
  if (event.actionPath) {
    return {
      actionPath: event.actionPath,
      actionLabel: event.actionLabel || 'Open linked page'
    };
  }

  if (EVENT_LINK_PRESETS[event.id]) {
    return {
      actionPath: EVENT_LINK_PRESETS[event.id].path,
      actionLabel: EVENT_LINK_PRESETS[event.id].label
    };
  }

  const normalized = `${event.title || ''} ${event.category || ''}`.toLowerCase();
  if (normalized.includes('receipt')) {
    return { actionPath: '/manual-confirmation', actionLabel: 'Open receipt review queue' };
  }
  if (normalized.includes('report') || normalized.includes('due date') || normalized.includes('deadline')) {
    return { actionPath: '/reports', actionLabel: 'Open reports center' };
  }
  if (normalized.includes('unpaid') || normalized.includes('balance') || normalized.includes('rent')) {
    return { actionPath: '/tenants', actionLabel: 'Open tenants with balances' };
  }

  return { actionPath: '', actionLabel: '' };
};

const getPermittedAction = (path, canManageLinks, fallbackLabel = 'Open linked page') => {
  if (!path) {
    return { path: '', label: fallbackLabel };
  }

  if (canManageLinks || (path !== '/tenants' && path !== '/manual-confirmation')) {
    return { path, label: fallbackLabel };
  }

  return {
    path: '/payments',
    label: 'Open payments workspace'
  };
};

const getActionToneByCategory = (category) => {
  if (category === 'Rent') {
    return {
      border: '#fca5a5',
      background: '#fee2e2',
      color: '#991b1b'
    };
  }
  if (category === 'Payment') {
    return {
      border: '#67e8f9',
      background: '#cffafe',
      color: '#0e7490'
    };
  }
  if (category === 'Follow-up') {
    return {
      border: '#fcd34d',
      background: '#fef3c7',
      color: '#92400e'
    };
  }
  return {
    border: '#93c5fd',
    background: '#dbeafe',
    color: '#1d4ed8'
  };
};

const isGeneratedReminderEvent = (event) => String(event?.id || '').startsWith('rent-due-') || event?.source === 'backend';
const getCustomEvents = (items) => items.filter((event) => !isGeneratedReminderEvent(event));

const hydrateEvents = (items) => (Array.isArray(items) ? items : []).flatMap((item) => {
  const start = new Date(item.start);
  const end = new Date(item.end || item.start);

  if (!item.title || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  const linked = inferEventLink(item);
  return [{
    ...item,
    ...linked,
    start,
    end,
    time: item.time || formatTimeInput(start),
    status: item.status || 'Open',
    priority: item.priority || (item.category === 'Rent' ? 'High' : 'Medium'),
    reminderLead: item.reminderLead || 'same-day',
    createdAt: item.createdAt || new Date().toISOString()
  }];
});

const mergeEvents = (customEvents, backendEvents) => {
  const custom = getCustomEvents(customEvents);
  return [...custom, ...backendEvents.map((event) => ({ ...event, source: 'backend' }))];
};

const loadStoredEvents = () => {
  try {
    const savedEvents = localStorage.getItem('calendarEvents');
    if (!savedEvents) return defaultEvents;
    const parsed = JSON.parse(savedEvents);
    const hydrated = hydrateEvents(parsed);
    return hydrated.length > 0 ? hydrated : defaultEvents;
  } catch (_) {
    return defaultEvents;
  }
};

const persistCustomEvents = (items) => {
  try {
    localStorage.setItem('calendarEvents', JSON.stringify(getCustomEvents(items)));
  } catch (_) {}
};

const serializeEventForApi = (event) => ({
  title: event.title,
  start: new Date(event.start).toISOString(),
  end: new Date(event.end || event.start).toISOString(),
  category: event.category || 'Other',
  note: event.note || '',
  priority: event.priority || 'Medium',
  status: event.status || 'Open',
  reminderLead: event.reminderLead || 'same-day',
  actionPath: event.actionPath || '',
  actionLabel: event.actionLabel || ''
});

const defaultEvents = [
  { 
    id: 'rent-due', 
    title: 'Rent due', 
    start: new Date(), 
    end: new Date(),
    category: 'Rent', 
    note: 'Check tenants whose monthly rent is not fully paid.',
    actionPath: '/tenants',
    actionLabel: 'Open tenants with balances',
    priority: 'High',
    status: 'Open',
    reminderLead: 'same-day'
  },
  { 
    id: 'receipt-review', 
    title: 'Receipt review', 
    start: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), 
    end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    category: 'Payment', 
    note: 'Open the payment record and confirm the uploaded proof.',
    actionPath: '/manual-confirmation',
    actionLabel: 'Open receipt review queue',
    priority: 'Medium',
    status: 'Open',
    reminderLead: '1-day'
  },
  { 
    id: 'balance-follow-up', 
    title: 'Unpaid balance follow-up', 
    start: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 
    end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    category: 'Follow-up', 
    note: 'Use reports to contact tenants with remaining balances.',
    actionPath: '/tenants',
    actionLabel: 'Open unpaid balances',
    priority: 'Medium',
    status: 'Open',
    reminderLead: '3-days'
  }
];

const emptyForm = {
  title: '',
  date: formatDateInput(),
  time: '09:00',
  category: 'Rent',
  priority: 'Medium',
  status: 'Open',
  reminderLead: 'same-day',
  actionPath: '',
  note: ''
};

const CalendarEvents = () => {
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const { showToast } = useToast();
  const [viewportWidth, setViewportWidth] = useState(getInitialViewportWidth);
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderError, setReminderError] = useState('');

  useEffect(() => {
    loadSavedEvents();
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadSavedEvents = async () => {
    try {
      const response = await calendarEventService.getAll();
      const savedEvents = hydrateEvents(response.data || []);
      const localEvents = loadStoredEvents();
      const nextEvents = savedEvents.length > 0 ? savedEvents : localEvents;
      setEvents(nextEvents);
      persistCustomEvents(nextEvents);
    } catch (_) {
      const storedEvents = loadStoredEvents();
      setEvents(storedEvents);
      persistCustomEvents(storedEvents);
    } finally {
      loadReminderEvents();
    }
  };

  const loadReminderEvents = async () => {
    try {
      setReminderLoading(true);
      setReminderError('');
      const response = await tenantService.getReminderEvents();
      const backendEvents = hydrateEvents(response.data || []);

      setEvents((prev) => {
        const merged = mergeEvents(prev, backendEvents);
        persistCustomEvents(merged);
        return merged;
      });
    } catch (error) {
      setReminderError('Live rent reminders could not be loaded. Custom events are still available.');
    } finally {
      setReminderLoading(false);
    }
  };

  const saveEvents = (nextEvents) => {
    setEvents(nextEvents);
    persistCustomEvents(nextEvents);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const title = formData.title.trim();
    const dateObj = parseEventDateTime(formData.date, formData.time);

    if (!title) {
      showToast('Event title is required.', 'warning');
      return;
    }

    if (Number.isNaN(dateObj.getTime())) {
      showToast('Choose a valid event date.', 'warning');
      return;
    }

    if (editingId) {
      const existingEvent = events.find((item) => item.id === editingId);
      const updatedEvent = {
        ...existingEvent,
        title,
        start: dateObj,
        end: dateObj,
        time: formData.time || formatTimeInput(dateObj),
        category: formData.category,
        priority: formData.priority,
        status: formData.status,
        reminderLead: formData.reminderLead,
        actionPath: formData.actionPath,
        note: formData.note.trim(),
        ...inferEventLink({ ...existingEvent, title, category: formData.category, actionPath: formData.actionPath })
      };

      try {
        const response = await calendarEventService.update(editingId, serializeEventForApi(updatedEvent));
        const [serverEvent] = hydrateEvents([response.data]);
        saveEvents(events.map((item) => (item.id === editingId ? serverEvent : item)));
        showToast('Event updated', 'success');
      } catch (_) {
        saveEvents(events.map((item) => (item.id === editingId ? updatedEvent : item)));
        showToast('Event updated locally. Backend sync was unavailable.', 'warning');
      }
    } else {
      const linked = inferEventLink({ title, category: formData.category, actionPath: formData.actionPath });
      const newEvent = {
        id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}`,
        title,
        start: dateObj,
        end: dateObj,
        time: formData.time || formatTimeInput(dateObj),
        category: formData.category,
        priority: formData.priority,
        status: formData.status,
        reminderLead: formData.reminderLead,
        note: formData.note.trim(),
        createdAt: new Date().toISOString(),
        ...linked
      };

      try {
        const response = await calendarEventService.create(serializeEventForApi(newEvent));
        const [serverEvent] = hydrateEvents([response.data]);
        saveEvents([...events, serverEvent]);
        showToast('Event created', 'success');
      } catch (_) {
        saveEvents([...events, newEvent]);
        showToast('Event saved locally. Backend sync was unavailable.', 'warning');
      }
    }

    resetForm();
  };

  const handleEdit = (event) => {
    if (isGeneratedReminderEvent(event)) {
      showToast('Generated rent reminders cannot be edited here.', 'info');
      return;
    }

    setFormData({
      title: event.title,
      date: formatDateInput(event.start),
      time: event.time || formatTimeInput(event.start),
      category: event.category || 'Rent',
      priority: event.priority || 'Medium',
      status: event.status || 'Open',
      reminderLead: event.reminderLead || 'same-day',
      actionPath: event.actionPath || '',
      note: event.note || ''
    });
    setEditingId(event.id);
    setShowForm(true);
    setSelectedEvent(null);
  };

  const handleDelete = async (id) => {
    const eventToDelete = events.find((event) => event.id === id);
    if (isGeneratedReminderEvent(eventToDelete)) {
      showToast('Generated rent reminders cannot be deleted here.', 'info');
      return;
    }

    if (window.confirm('Delete this calendar event?')) {
      let synced = true;
      try {
        await calendarEventService.delete(id);
      } catch (_) {
        synced = false;
      }
      saveEvents(events.filter((event) => event.id !== id));
      setSelectedEvent(null);
      showToast(synced ? 'Event deleted' : 'Event removed locally. Backend sync was unavailable.', synced ? 'success' : 'warning');
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setShowForm(false);
  };

  const handleSelectSlot = (slotInfo) => {
    setFormData({
      ...emptyForm,
      date: formatDateInput(slotInfo.start),
      time: formatTimeInput(slotInfo.start)
    });
    setEditingId(null);
    setSelectedEvent(null);
    setShowForm(true);
  };

  const handleTemplateCreate = (template) => {
    setFormData({
      ...emptyForm,
      title: template.title,
      category: template.category,
      priority: template.priority,
      actionPath: template.actionPath,
      note: template.note
    });
    setEditingId(null);
    setSelectedEvent(null);
    setShowForm(true);
  };

  const updateCustomEvent = async (eventId, getChanges, message) => {
    const target = events.find((event) => event.id === eventId);
    if (isGeneratedReminderEvent(target)) {
      showToast('Live tenant reminders cannot be changed from the calendar.', 'info');
      return;
    }

    if (!target) return;

    const updatedEvent = { ...target, ...getChanges(target) };
    let savedEvent = updatedEvent;
    let synced = true;

    try {
      const response = await calendarEventService.update(eventId, serializeEventForApi(updatedEvent));
      [savedEvent] = hydrateEvents([response.data]);
    } catch (_) {
      synced = false;
    }

    saveEvents(events.map((event) => (event.id === eventId ? savedEvent : event)));
    setSelectedEvent((current) => (current?.id === eventId ? savedEvent : current));
    if (message) showToast(synced ? message : `${message}. Backend sync was unavailable.`, synced ? 'success' : 'warning');
  };

  const handleMarkDone = (eventId) => {
    updateCustomEvent(eventId, () => ({ status: 'Done' }), 'Event marked done');
  };

  const handleSnooze = (eventId, days = 1) => {
    updateCustomEvent(eventId, (event) => {
      const nextStart = addDays(new Date(event.start), days);
      return {
        start: nextStart,
        end: nextStart,
        date: formatDateInput(nextStart),
        time: formatTimeInput(nextStart),
        status: event.status === 'Done' ? 'Open' : event.status
      };
    }, `Event moved ${days} day${days === 1 ? '' : 's'} ahead`);
  };

  const handleCreateFollowUp = (baseEvent) => {
    const followUpDate = addDays(new Date(baseEvent?.start || new Date()), 1);
    setFormData({
      ...emptyForm,
      title: `Follow up: ${baseEvent?.title || 'Event'}`,
      date: formatDateInput(followUpDate),
      time: baseEvent?.time || formatTimeInput(followUpDate),
      category: 'Follow-up',
      priority: baseEvent?.priority || 'Medium',
      actionPath: baseEvent?.actionPath || '/tenants',
      note: baseEvent?.note ? `Follow up on: ${baseEvent.note}` : 'Follow up on this item and record the result.'
    });
    setEditingId(null);
    setSelectedEvent(null);
    setShowForm(true);
  };

  const handleEventWordClick = (event, clickEvent) => {
    clickEvent.stopPropagation();
    const action = getPermittedAction(event.actionPath, isManager(), event.actionLabel || 'Open linked page');
    if (action.path) {
      navigate(action.path);
    } else {
      handleSelectEvent(event);
    }
  };

  const CalendarEventWord = ({ event }) => (
    <button
      type="button"
      style={styles.calendarEventWord}
      onClick={(clickEvent) => handleEventWordClick(event, clickEvent)}
      title={event.actionLabel || 'Open event details'}
    >
      {event.title}
    </button>
  );

  const eventStyleGetter = (event) => {
    let backgroundColor = '#2563eb';
    
    if (event.category === 'Rent') backgroundColor = '#dc2626';
    else if (event.category === 'Payment') backgroundColor = '#0891b2';
    else if (event.category === 'Follow-up') backgroundColor = '#f59e0b';
    else if (event.category === 'Due Date') backgroundColor = '#be123c';
    else if (event.category === 'Maintenance') backgroundColor = '#7c3aed';
    else if (event.category === 'Meeting') backgroundColor = '#059669';
    if (event.status === 'Done') backgroundColor = '#64748b';

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: event.status === 'Done' ? 0.62 : 0.9,
        color: 'white',
        border: 'none',
        display: 'block',
        fontSize: '0.85rem',
        padding: '2px 4px',
        textDecoration: event.status === 'Done' ? 'line-through' : 'none'
      }
    };
  };

  const isCompact = viewportWidth < 1120;
  const isMobile = viewportWidth < 768;
  const canManageLinks = isManager();
  const customEventCount = getCustomEvents(events).length;
  const generatedReminderCount = events.length - customEventCount;
  const selectedEventAction = selectedEvent
    ? getPermittedAction(selectedEvent.actionPath, canManageLinks, selectedEvent.actionLabel || 'Open linked page')
    : null;
  const openEvents = events.filter((event) => event.status !== 'Done');
  const completedCount = events.length - openEvents.length;
  const overdueCount = openEvents.filter((event) => getEventTiming(event).tone === 'overdue').length;
  const dueTodayCount = openEvents.filter((event) => getEventTiming(event).tone === 'today').length;
  const plannerEvents = [...openEvents]
    .sort((a, b) => {
      const priorityWeight = { High: 0, Medium: 1, Low: 2 };
      const priorityDelta = (priorityWeight[a.priority] ?? 1) - (priorityWeight[b.priority] ?? 1);
      const dateDelta = new Date(a.start) - new Date(b.start);
      return dateDelta || priorityDelta;
    })
    .slice(0, 8);

  const quickLinkIcon = (id) => {
    if (id === 'receipt-review') return <CalendarIcon />;
    if (id === 'balance-follow-up') return <AlertIcon />;
    return <SearchIcon />;
  };

  return (
    <div className="calendar-events-page-shell" style={styles.container}>
      <style>{`
        .calendar-shell .rbc-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.8rem;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.1rem;
        }
        .calendar-shell .rbc-toolbar .rbc-toolbar-label {
          font-size: 1.35rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .calendar-shell .rbc-btn-group {
          display: inline-flex;
          gap: 0.45rem;
          flex-wrap: wrap;
        }
        .calendar-shell .rbc-btn-group button {
          border: 1px solid #dbe4f0;
          background: #ffffff;
          color: #334155;
          border-radius: 12px;
          padding: 0.62rem 0.88rem;
          font-weight: 700;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
        }
        .calendar-shell .rbc-btn-group button:hover,
        .calendar-shell .rbc-btn-group button:focus-visible {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
          transform: translateY(-1px);
          outline: none;
        }
        .calendar-shell .rbc-btn-group button.rbc-active {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 12px 22px rgba(37, 99, 235, 0.22);
        }
        .calendar-shell .rbc-month-view,
        .calendar-shell .rbc-time-view,
        .calendar-shell .rbc-agenda-view table.rbc-agenda-table {
          border: 1px solid #dbe4f0;
          border-radius: 18px;
          overflow: hidden;
          background: #ffffff;
        }
        .calendar-shell .rbc-header {
          background: linear-gradient(135deg, #0f172a 0%, #155e75 100%);
          color: #ffffff;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.85rem 0.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.18);
        }
        .calendar-shell .rbc-date-cell {
          padding: 0.45rem 0.55rem 0 0;
          color: #334155;
          font-weight: 700;
        }
        .calendar-shell .rbc-off-range {
          color: #94a3b8;
        }
        .calendar-shell .rbc-off-range-bg {
          background: #f8fafc;
        }
        .calendar-shell .rbc-today {
          background: #eff6ff;
        }
        .calendar-shell .rbc-day-bg + .rbc-day-bg,
        .calendar-shell .rbc-month-row + .rbc-month-row,
        .calendar-shell .rbc-header + .rbc-header {
          border-left-color: #e2e8f0;
        }
        .calendar-shell .rbc-event {
          border-radius: 10px !important;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
          padding: 0.12rem 0.3rem;
        }
        .calendar-shell .rbc-event-label {
          display: none;
        }
        .calendar-shell .rbc-show-more {
          color: #2563eb;
          font-weight: 700;
          background: transparent;
        }
        @media (max-width: 768px) {
          .calendar-shell .rbc-toolbar {
            align-items: stretch;
          }
          .calendar-shell .rbc-toolbar .rbc-toolbar-label {
            width: 100%;
            text-align: left;
            font-size: 1.1rem;
          }
        }
      `}</style>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrowPill}>Operations Calendar</div>
          <h1 style={styles.title}>Calendar Events</h1>
          <p style={styles.subtitle}>
            Create rent reminders, receipt checks, and follow-up tasks.
          </p>
          <div style={styles.quickLinksRow}>
            {QUICK_LINKS.map((item) => {
              const quickLinkAction = getPermittedAction(item.path, canManageLinks, item.description);

              return (
                <button
                  key={item.id}
                  type="button"
                  style={styles.quickLinkBtn}
                  onClick={() => navigate(quickLinkAction.path)}
                  title={item.description}
                >
                  <span style={styles.buttonInner}>
                    {quickLinkIcon(item.id)}
                    <span>{item.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div style={styles.headerMeta}>
            <span style={styles.metaChip}>{customEventCount} custom event{customEventCount === 1 ? '' : 's'}</span>
            <span style={styles.metaChipMuted}>{generatedReminderCount} live reminder{generatedReminderCount === 1 ? '' : 's'}</span>
            <span style={overdueCount > 0 ? styles.metaChipDanger : styles.metaChipMuted}>{overdueCount} overdue</span>
            <span style={dueTodayCount > 0 ? styles.metaChipWarn : styles.metaChipMuted}>{dueTodayCount} due today</span>
            <span style={styles.metaChipMuted}>{completedCount} done</span>
            {reminderLoading ? <span style={styles.metaChipMuted}>Refreshing reminders...</span> : null}
          </div>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            style={styles.btnSecondaryOnDark}
            onClick={loadReminderEvents}
            disabled={reminderLoading}
          >
            {reminderLoading ? 'Refreshing...' : 'Refresh Reminders'}
          </button>
          <button
            type="button"
            style={styles.btnPrimary}
            onClick={() => {
              setFormData(emptyForm);
              setEditingId(null);
              setSelectedEvent(null);
              setShowForm(!showForm);
            }}
          >
            <span style={styles.buttonInner}>
              <PlusIcon />
              <span>{showForm ? 'Cancel' : 'Create Event'}</span>
            </span>
          </button>
        </div>
      </div>

      {reminderError ? <div style={styles.warningBanner}>{reminderError}</div> : null}

      <div style={styles.templateBar}>
        <span style={styles.templateLabel}>Quick plan</span>
        {EVENT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            style={styles.templateButton}
            onClick={() => handleTemplateCreate(template)}
          >
            {template.title}
          </button>
        ))}
      </div>

      <div style={{ ...styles.content, ...(isCompact ? styles.contentStacked : {}) }}>
        <div style={styles.calendarSection} className="calendar-shell">
          <div style={{ ...styles.calendarWrapper, ...(isMobile ? styles.calendarWrapperMobile : {}) }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              popup
              eventPropGetter={eventStyleGetter}
              components={{ event: CalendarEventWord }}
            />
          </div>
        </div>

        <div style={{ ...styles.sidebar, ...(isCompact ? styles.sidebarStacked : {}) }}>
          {showForm ? (
            <div style={styles.formCard}>
              <h2 style={styles.formTitle}>{editingId ? 'Edit Event' : 'Create Event'}</h2>
              <form onSubmit={handleSubmit}>
                <div style={styles.formGroup}>
                  <label>Event Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Rent follow-up"
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Time</label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                  >
                    {EVENT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label>Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                  >
                    {EVENT_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    {EVENT_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label>Reminder</label>
                  <select
                    name="reminderLead"
                    value={formData.reminderLead}
                    onChange={handleInputChange}
                  >
                    {REMINDER_LEADS.map((lead) => (
                      <option key={lead.value} value={lead.value}>{lead.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label>Linked Action</label>
                  <select
                    name="actionPath"
                    value={formData.actionPath}
                    onChange={handleInputChange}
                  >
                    <option value="">No linked page</option>
                    <option value="/tenants">Tenants</option>
                    <option value="/payments">Payments</option>
                    <option value="/manual-confirmation">Receipt Review</option>
                    <option value="/reports">Reports</option>
                    <option value="/expenses">Expenses</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label>Notes</label>
                  <textarea
                    name="note"
                    value={formData.note}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="What should be done?"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={styles.formActions}>
                  <button type="submit" style={styles.btnPrimary}>
                    {editingId ? 'Update Event' : 'Save Event'}
                  </button>
                  <button type="button" style={styles.btnSecondary} onClick={resetForm}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : selectedEvent ? (
            <div style={styles.eventDetailsCard}>
              <h2 style={styles.eventDetailsTitle}>{selectedEvent.title}</h2>
              <div style={styles.eventDetailsGrid}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Due Date</span>
                  <span>{selectedEvent.start.toLocaleDateString()} at {selectedEvent.time || formatTimeInput(selectedEvent.start)}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Category</span>
                  <span style={styles.categoryBadge}>{selectedEvent.category || 'Event'}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Priority</span>
                  <span style={{
                    ...styles.priorityBadge,
                    ...(selectedEvent.priority === 'High' ? styles.priorityHigh : {}),
                    ...(selectedEvent.priority === 'Low' ? styles.priorityLow : {})
                  }}>{selectedEvent.priority || 'Medium'}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Status</span>
                  <span style={styles.statusBadge}>{selectedEvent.status || 'Open'}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Timing</span>
                  <span style={styles.timingText}>{getEventTiming(selectedEvent).label}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Reminder</span>
                  <span>{REMINDER_LEADS.find((lead) => lead.value === selectedEvent.reminderLead)?.label || 'Same day'}</span>
                </div>
              </div>
              <div style={styles.noteSection}>
                <span style={styles.detailLabel}>Notes</span>
                <p style={styles.noteText}>{selectedEvent.note || 'No notes added.'}</p>
              </div>
              {selectedEventAction?.path && (
                <div style={styles.linkSection}>
                  <span style={styles.detailLabel}>Linked Action</span>
                  <button
                    type="button"
                    style={{
                      ...styles.btnLinkAction,
                      ...(() => {
                        const tone = getActionToneByCategory(selectedEvent.category);
                        return {
                          border: `1px solid ${tone.border}`,
                          background: tone.background,
                          color: tone.color
                        };
                      })()
                    }}
                    onClick={() => navigate(selectedEventAction.path)}
                  >
                    {selectedEventAction.label}
                  </button>
                </div>
              )}
              <div style={styles.detailActions}>
                {!isGeneratedReminderEvent(selectedEvent) ? (
                  <>
                    {selectedEvent.status !== 'Done' ? (
                      <button
                        type="button"
                        style={{ ...styles.btnSmall, ...styles.btnDone }}
                        onClick={() => handleMarkDone(selectedEvent.id)}
                      >
                        Mark Done
                      </button>
                    ) : null}
                    <button
                      type="button"
                      style={styles.btnSmall}
                      onClick={() => handleSnooze(selectedEvent.id, 1)}
                    >
                      Snooze 1 Day
                    </button>
                    <button
                      type="button"
                      style={styles.btnSmall}
                      onClick={() => handleEdit(selectedEvent)}
                    >
                      <span style={styles.buttonInner}>
                        <EditIcon />
                        <span>Edit</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      style={{ ...styles.btnSmall, ...styles.btnDanger }}
                      onClick={() => handleDelete(selectedEvent.id)}
                    >
                      <span style={styles.buttonInner}>
                        <TrashIcon />
                        <span>Delete</span>
                      </span>
                    </button>
                  </>
                ) : (
                  <span style={styles.generatedHint}>Live reminder from tenant balances</span>
                )}
                <button
                  type="button"
                  style={styles.btnSmall}
                  onClick={() => handleCreateFollowUp(selectedEvent)}
                >
                  Follow Up
                </button>
                <button
                  type="button"
                  style={styles.btnSecondary}
                  onClick={() => setSelectedEvent(null)}
                >
                  <span style={styles.buttonInner}>
                    <CloseIcon />
                    <span>Close</span>
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.emptyStateCard}>
              <div style={styles.emptyIconWrap}>
                <CalendarIcon />
              </div>
              <div style={styles.emptyTitle}>No event selected</div>
              <p style={styles.emptyText}>Click on a date to create an event,<br/>or click on an event to view details.</p>
              <div style={styles.emptyHint}>Use the quick links above to jump straight to common reminders and follow-up workflows.</div>
            </div>
          )}

          <div style={styles.plannerCard}>
            <div style={styles.plannerHeader}>
              <div>
                <div style={styles.plannerEyebrow}>Planner Queue</div>
                <h2 style={styles.plannerTitle}>Open Reminders</h2>
              </div>
              <span style={styles.plannerCount}>{plannerEvents.length}</span>
            </div>
            <div style={styles.plannerList}>
              {plannerEvents.length > 0 ? plannerEvents.map((event) => {
                const timing = getEventTiming(event);
                return (
                  <div key={`planner-${event.id}`} style={styles.plannerItem}>
                    <button
                      type="button"
                      style={styles.plannerItemMain}
                      onClick={() => handleSelectEvent(event)}
                    >
                      <span style={styles.plannerItemTitle}>{event.title}</span>
                      <span style={styles.plannerItemMeta}>
                        {event.category || 'Event'} · {event.priority || 'Medium'} · {event.time || formatTimeInput(event.start)}
                      </span>
                    </button>
                    <span style={{
                      ...styles.timingBadge,
                      ...(timing.tone === 'overdue' ? styles.timingOverdue : {}),
                      ...(timing.tone === 'today' ? styles.timingToday : {}),
                      ...(timing.tone === 'soon' ? styles.timingSoon : {})
                    }}>
                      {timing.label}
                    </span>
                    {!isGeneratedReminderEvent(event) ? (
                      <div style={styles.plannerActions}>
                        <button type="button" style={styles.plannerActionButton} onClick={() => handleMarkDone(event.id)}>Done</button>
                        <button type="button" style={styles.plannerActionButton} onClick={() => handleSnooze(event.id, 1)}>+1d</button>
                      </div>
                    ) : null}
                  </div>
                );
              }) : (
                <div style={styles.plannerEmpty}>No open reminders or due dates.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '0.25rem 0'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    gap: '1rem',
    flexWrap: 'wrap',
    padding: '1.5rem',
    borderRadius: '1.1rem',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 56%, #0f766e 100%)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: '0 22px 46px rgba(15, 23, 42, 0.18)'
  },
  eyebrowPill: {
    display: 'inline-flex',
    color: '#0f172a',
    backgroundColor: '#ccfbf1',
    border: '1px solid rgba(255, 255, 255, 0.45)',
    borderRadius: '999px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.76rem',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.14)'
  },
  title: {
    fontSize: '2rem',
    fontWeight: '900',
    margin: '0.5rem 0 0 0',
    color: '#ffffff',
    lineHeight: 1.1,
    textShadow: '0 2px 10px rgba(15, 23, 42, 0.28)'
  },
  subtitle: {
    marginTop: '0.5rem',
    color: '#dbeafe',
    marginBottom: '0.75rem',
    fontSize: '1rem',
    fontWeight: '600',
    lineHeight: 1.55
  },
  quickLinksRow: {
    display: 'flex',
    gap: '0.55rem',
    flexWrap: 'wrap'
  },
  headerMeta: {
    display: 'flex',
    gap: '0.55rem',
    flexWrap: 'wrap',
    marginTop: '0.85rem'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.7rem',
    flexWrap: 'wrap'
  },
  metaChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.42rem 0.72rem',
    borderRadius: '999px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '0.76rem',
    fontWeight: 800
  },
  metaChipMuted: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.42rem 0.72rem',
    borderRadius: '999px',
    background: 'rgba(241,245,249,0.92)',
    color: '#334155',
    fontSize: '0.76rem',
    fontWeight: 800
  },
  metaChipWarn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.42rem 0.72rem',
    borderRadius: '999px',
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '0.76rem',
    fontWeight: 800
  },
  metaChipDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.42rem 0.72rem',
    borderRadius: '999px',
    background: '#fee2e2',
    color: '#991b1b',
    fontSize: '0.76rem',
    fontWeight: 800
  },
  warningBanner: {
    marginBottom: '1rem',
    padding: '0.85rem 1rem',
    borderRadius: '0.8rem',
    border: '1px solid #fcd34d',
    background: '#fef3c7',
    color: '#92400e',
    fontWeight: 700
  },
  quickLinkBtn: {
    border: '1px solid rgba(147, 197, 253, 0.4)',
    background: 'rgba(15,23,42,0.48)',
    color: '#e2e8f0',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 700,
    padding: '0.55rem 0.95rem',
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.18)'
  },
  btnPrimary: {
    padding: '0.88rem 1.2rem',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: 'white',
    border: 'none',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '700',
    boxShadow: '0 14px 24px rgba(29, 78, 216, 0.24)'
  },
  btnSecondary: {
    padding: '0.7rem 1rem',
    backgroundColor: '#f8fafc',
    color: '#1f2937',
    border: '1px solid #dbe4f0',
    borderRadius: '0.8rem',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.875rem'
  },
  btnSecondaryOnDark: {
    padding: '0.78rem 1rem',
    backgroundColor: 'rgba(15,23,42,0.48)',
    color: '#e2e8f0',
    border: '1px solid rgba(147, 197, 253, 0.44)',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '0.84rem'
  },
  btnSmall: {
    padding: '0.58rem 0.85rem',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: '0.8rem',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '700'
  },
  btnDanger: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca'
  },
  btnDone: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    border: '1px solid #86efac'
  },
  buttonInner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem'
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
    gap: '1.5rem',
    flex: 1,
    minHeight: 0
  },
  templateBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
    padding: '0.8rem 1rem',
    borderRadius: '0.9rem',
    background: '#f8fafc',
    border: '1px solid #dbe4f0',
    boxShadow: '0 10px 22px rgba(15, 23, 42, 0.08)'
  },
  templateLabel: {
    color: '#475569',
    fontSize: '0.78rem',
    fontWeight: 900,
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  templateButton: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    borderRadius: '999px',
    padding: '0.46rem 0.78rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 800
  },
  contentStacked: {
    gridTemplateColumns: '1fr'
  },
  calendarSection: {
    backgroundColor: '#f8fafc',
    borderRadius: '1rem',
    boxShadow: '0 10px 24px rgba(15,23,42,0.18)',
    border: '1px solid #cbd5e1',
    overflow: 'hidden',
    padding: '1.1rem'
  },
  calendarWrapper: {
    height: '100%',
    minHeight: 600
  },
  calendarWrapperMobile: {
    minHeight: 520
  },
  calendarEventWord: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: '0.8rem',
    fontWeight: 700,
    textAlign: 'left',
    cursor: 'pointer',
    padding: '0 0.1rem',
    textDecoration: 'underline'
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column'
  },
  sidebarStacked: {
    minHeight: 'unset'
  },
  formCard: {
    backgroundColor: '#f8fafc',
    padding: '1.5rem',
    borderRadius: '1rem',
    boxShadow: '0 10px 24px rgba(15,23,42,0.18)',
    border: '1px solid #cbd5e1',
    overflow: 'auto'
  },
  formTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#1f2937'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '1rem'
  },
  formActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1.5rem'
  },
  eventDetailsCard: {
    backgroundColor: '#f8fafc',
    padding: '1.5rem',
    borderRadius: '1rem',
    boxShadow: '0 10px 24px rgba(15,23,42,0.18)',
    border: '1px solid #cbd5e1',
    overflow: 'auto'
  },
  eventDetailsTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#1f2937',
    wordBreak: 'break-word'
  },
  eventDetailsGrid: {
    display: 'grid',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  detailLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase'
  },
  categoryBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    backgroundColor: '#e0e7ff',
    color: '#4f46e5',
    borderRadius: '0.25rem',
    fontSize: '0.85rem',
    fontWeight: '500',
    width: 'fit-content'
  },
  priorityBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: '999px',
    fontSize: '0.82rem',
    fontWeight: 800,
    width: 'fit-content'
  },
  priorityHigh: {
    backgroundColor: '#fee2e2',
    color: '#991b1b'
  },
  priorityLow: {
    backgroundColor: '#dcfce7',
    color: '#166534'
  },
  statusBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    backgroundColor: '#e0f2fe',
    color: '#075985',
    borderRadius: '999px',
    fontSize: '0.82rem',
    fontWeight: 800,
    width: 'fit-content'
  },
  timingText: {
    color: '#0f172a',
    fontWeight: 800
  },
  noteSection: {
    marginBottom: '1rem'
  },
  linkSection: {
    marginBottom: '1rem'
  },
  btnLinkAction: {
    marginTop: '0.5rem',
    width: '100%',
    border: '1px solid #60a5fa',
    background: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: '0.8rem',
    padding: '0.75rem 0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(37, 99, 235, 0.08)'
  },
  noteText: {
    color: '#4b5563',
    fontSize: '0.9rem',
    lineHeight: '1.5',
    margin: '0.5rem 0 0 0'
  },
  detailActions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap'
  },
  generatedHint: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.58rem 0.82rem',
    borderRadius: '0.75rem',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '0.78rem',
    fontWeight: 800
  },
  emptyStateCard: {
    background: 'linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)',
    padding: '1.7rem',
    borderRadius: '1rem',
    boxShadow: '0 10px 24px rgba(15,23,42,0.18)',
    border: '1px solid #cbd5e1',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '220px'
  },
  emptyIconWrap: {
    width: '52px',
    height: '52px',
    borderRadius: '16px',
    background: '#dbeafe',
    color: '#1d4ed8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.9rem'
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: '1rem',
    fontWeight: 800,
    marginBottom: '0.45rem'
  },
  emptyText: {
    color: '#64748b',
    fontSize: '0.92rem',
    lineHeight: 1.6,
    margin: 0
  },
  emptyHint: {
    marginTop: '0.9rem',
    color: '#475569',
    fontSize: '0.82rem',
    lineHeight: 1.55,
    maxWidth: '280px'
  },
  plannerCard: {
    marginTop: '1rem',
    backgroundColor: '#f8fafc',
    padding: '1rem',
    borderRadius: '1rem',
    boxShadow: '0 10px 24px rgba(15,23,42,0.14)',
    border: '1px solid #cbd5e1'
  },
  plannerHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginBottom: '0.9rem'
  },
  plannerEyebrow: {
    color: '#2563eb',
    fontSize: '0.72rem',
    fontWeight: 900,
    letterSpacing: '0.07em',
    textTransform: 'uppercase'
  },
  plannerTitle: {
    margin: '0.2rem 0 0',
    color: '#0f172a',
    fontSize: '1rem',
    fontWeight: 900
  },
  plannerCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '30px',
    height: '30px',
    borderRadius: '999px',
    background: '#dbeafe',
    color: '#1d4ed8',
    fontWeight: 900
  },
  plannerList: {
    display: 'grid',
    gap: '0.65rem'
  },
  plannerItem: {
    display: 'grid',
    gap: '0.55rem',
    padding: '0.75rem',
    borderRadius: '0.85rem',
    background: '#ffffff',
    border: '1px solid #e2e8f0'
  },
  plannerItemMain: {
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: '#0f172a',
    textAlign: 'left',
    cursor: 'pointer'
  },
  plannerItemTitle: {
    display: 'block',
    color: '#0f172a',
    fontSize: '0.88rem',
    fontWeight: 900,
    lineHeight: 1.35
  },
  plannerItemMeta: {
    display: 'block',
    marginTop: '0.2rem',
    color: '#64748b',
    fontSize: '0.76rem',
    fontWeight: 700
  },
  timingBadge: {
    display: 'inline-flex',
    width: 'fit-content',
    padding: '0.28rem 0.58rem',
    borderRadius: '999px',
    background: '#e2e8f0',
    color: '#334155',
    fontSize: '0.74rem',
    fontWeight: 900
  },
  timingOverdue: {
    background: '#fee2e2',
    color: '#991b1b'
  },
  timingToday: {
    background: '#fef3c7',
    color: '#92400e'
  },
  timingSoon: {
    background: '#dbeafe',
    color: '#1d4ed8'
  },
  plannerActions: {
    display: 'flex',
    gap: '0.45rem',
    flexWrap: 'wrap'
  },
  plannerActionButton: {
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#334155',
    borderRadius: '999px',
    padding: '0.32rem 0.58rem',
    cursor: 'pointer',
    fontSize: '0.74rem',
    fontWeight: 800
  },
  plannerEmpty: {
    padding: '0.9rem',
    borderRadius: '0.8rem',
    background: '#ffffff',
    color: '#64748b',
    textAlign: 'center',
    fontSize: '0.85rem',
    fontWeight: 700
  }
};

export default CalendarEvents;

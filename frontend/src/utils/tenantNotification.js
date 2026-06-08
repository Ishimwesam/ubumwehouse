const STORAGE_KEY = 'tp-unread-messages';

export const getUnreadCount = () => {
  try {
    return Math.max(0, parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10));
  } catch (_) {
    return 0;
  }
};

export const incrementUnread = () => {
  try {
    const next = getUnreadCount() + 1;
    localStorage.setItem(STORAGE_KEY, String(next));
    window.dispatchEvent(new CustomEvent('tp:unread-changed', { detail: { count: next } }));
    return next;
  } catch (_) {
    return 0;
  }
};

export const clearUnread = () => {
  try {
    localStorage.setItem(STORAGE_KEY, '0');
    window.dispatchEvent(new CustomEvent('tp:unread-changed', { detail: { count: 0 } }));
  } catch (_) {}
};

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch (_) {
    return 'denied';
  }
};

export const showBrowserNotification = (title, body, options = {}) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const notification = new Notification(title, {
      body,
      icon: '/samm.ico',
      badge: '/samm.ico',
      tag: 'tp-admin-message',
      renotify: true,
      ...options
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (_) {}
};

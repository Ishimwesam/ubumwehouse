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

// ─── Web Push (PWA — works when app is fully closed) ─────────────────────────

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const registerTenantPushSubscription = async (tenantPortalServiceRef) => {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') return;

    const swReg = await navigator.serviceWorker.ready;
    if (!swReg.pushManager) return;

    const vapidRes = await tenantPortalServiceRef.getVapidPublicKey();
    const vapidPublicKey = vapidRes?.data?.publicKey;
    if (!vapidPublicKey) return;

    let subscription = await swReg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }

    await tenantPortalServiceRef.subscribePush({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
      }
    });
  } catch (_) {}
};

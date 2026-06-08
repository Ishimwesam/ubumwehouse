import { useEffect, useState } from 'react';
import { getUnreadCount } from '../utils/tenantNotification';

const useTenantUnread = () => {
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());

  useEffect(() => {
    const handler = (event) => setUnreadCount(event.detail?.count ?? 0);
    window.addEventListener('tp:unread-changed', handler);
    // Also sync when the tab regains focus (other tabs may have changed storage)
    const syncFromStorage = () => setUnreadCount(getUnreadCount());
    window.addEventListener('focus', syncFromStorage);
    return () => {
      window.removeEventListener('tp:unread-changed', handler);
      window.removeEventListener('focus', syncFromStorage);
    };
  }, []);

  return unreadCount;
};

export default useTenantUnread;

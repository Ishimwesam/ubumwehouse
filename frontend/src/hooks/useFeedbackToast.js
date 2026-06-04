import { useEffect, useRef } from 'react';
import { emitAppToast } from '../context/ToastContext';

const useFeedbackToast = (message, type = 'info') => {
  const previousMessageRef = useRef('');

  useEffect(() => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) {
      previousMessageRef.current = '';
      return;
    }

    if (previousMessageRef.current === normalizedMessage) {
      return;
    }

    emitAppToast(normalizedMessage, type);
    previousMessageRef.current = normalizedMessage;
  }, [message, type]);
};

export default useFeedbackToast;

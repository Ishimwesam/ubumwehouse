import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext();
const TOAST_DURATION = 4400;

export const emitAppToast = (message, type = 'success') => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const audioContextRef = useRef(null);
  const lastChimeAtRef = useRef(0);

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    return audioContextRef.current;
  }, []);

  const playRealtimeChime = useCallback(() => {
    const now = Date.now();
    if (now - lastChimeAtRef.current < 1300) return;

    const context = getAudioContext();
    if (!context) return;

    const scheduleChime = () => {
      lastChimeAtRef.current = Date.now();
      const start = context.currentTime + 0.02;
      const notes = [
        { frequency: 659.25, offset: 0, duration: 0.1 },
        { frequency: 880, offset: 0.1, duration: 0.12 },
        { frequency: 739.99, offset: 0.22, duration: 0.13 }
      ];

      notes.forEach(({ frequency, offset, duration }) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start + offset);
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.08, start + offset + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + duration + 0.02);
      });
    };

    if (context.state === 'suspended') {
      context.resume().then(scheduleChime).catch(() => {});
      return;
    }

    scheduleChime();
  }, [getAudioContext]);

  useEffect(() => {
    const unlockAudio = () => {
      const context = getAudioContext();
      if (context?.state === 'suspended') {
        context.resume().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [getAudioContext]);

  const showToast = useCallback((message, type = 'success') => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) return;

    if (type === 'realtime') {
      playRealtimeChime();
    }

    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [
      ...current.slice(-3),
      { id, message: normalizedMessage, type, removing: false }
    ]);

    setTimeout(() => {
      setToasts((current) => current.map((toast) => (
        toast.id === id ? { ...toast, removing: true } : toast
      )));
    }, TOAST_DURATION - 320);

    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_DURATION);
  }, [playRealtimeChime]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.map((toast) => (
      toast.id === id ? { ...toast, removing: true } : toast
    )));

    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 280);
  }, []);

  useEffect(() => {
    const handleToast = (event) => {
      showToast(event.detail?.message || 'Action completed', event.detail?.type || 'success');
    };

    window.addEventListener('app:toast', handleToast);
    return () => window.removeEventListener('app:toast', handleToast);
  }, [showToast]);

  const toneStyles = useMemo(() => ({
    success: {
      borderColor: 'rgba(16, 185, 129, 0.3)',
      iconBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      glow: '0 22px 38px rgba(5, 150, 105, 0.18)',
      progress: 'linear-gradient(90deg, #34d399 0%, #059669 100%)'
    },
    error: {
      borderColor: 'rgba(239, 68, 68, 0.3)',
      iconBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      glow: '0 22px 38px rgba(220, 38, 38, 0.18)',
      progress: 'linear-gradient(90deg, #f87171 0%, #dc2626 100%)'
    },
    warning: {
      borderColor: 'rgba(245, 158, 11, 0.3)',
      iconBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      glow: '0 22px 38px rgba(217, 119, 6, 0.18)',
      progress: 'linear-gradient(90deg, #fbbf24 0%, #d97706 100%)'
    },
    info: {
      borderColor: 'rgba(37, 99, 235, 0.28)',
      iconBg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      glow: '0 22px 38px rgba(29, 78, 216, 0.18)',
      progress: 'linear-gradient(90deg, #60a5fa 0%, #1d4ed8 100%)'
    },
    realtime: {
      borderColor: 'rgba(20, 184, 166, 0.34)',
      iconBg: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
      glow: '0 22px 38px rgba(15, 118, 110, 0.2)',
      progress: 'linear-gradient(90deg, #5eead4 0%, #0f766e 100%)'
    }
  }), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <style>{`
        @keyframes toast-slide-up {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toast-slide-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(12px) scale(0.96); }
        }
        @keyframes toast-progress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
      <div style={styles.container}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              ...styles.toast,
              borderColor: toneStyles[toast.type]?.borderColor || toneStyles.success.borderColor,
              boxShadow: toneStyles[toast.type]?.glow || toneStyles.success.glow,
              animation: toast.removing ? 'toast-slide-out 0.28s ease forwards' : 'toast-slide-up 0.34s cubic-bezier(.2,.8,.2,1) forwards'
            }}
          >
            <div style={styles.toastInner}>
              <div
                style={{
                  ...styles.iconWrap,
                  background: toneStyles[toast.type]?.iconBg || toneStyles.success.iconBg
                }}
              >
                {toast.type === 'error' ? '!' : toast.type === 'warning' ? '!' : toast.type === 'info' ? 'i' : toast.type === 'realtime' ? '•' : '✓'}
              </div>
              <div style={styles.messageWrap}>
                <div style={styles.toastTitle}>
                  {toast.type === 'error' ? 'Action Failed' : toast.type === 'warning' ? 'Attention Needed' : toast.type === 'info' ? 'Heads Up' : toast.type === 'realtime' ? 'Live Update' : 'Success'}
                </div>
                <div style={styles.toastMessage}>{toast.message}</div>
              </div>
              <button type="button" style={styles.dismissButton} onClick={() => dismissToast(toast.id)}>
                ×
              </button>
            </div>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressBar,
                  background: toneStyles[toast.type]?.progress || toneStyles.success.progress,
                  animation: 'toast-progress 4.1s linear forwards'
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const styles = {
  container: {
    position: 'fixed',
    right: '1rem',
    top: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    zIndex: 20000,
    maxWidth: '390px',
    width: 'calc(100vw - 1.5rem)',
    pointerEvents: 'none'
  },
  toast: {
    background: 'rgba(255, 255, 255, 0.96)',
    color: '#0f172a',
    padding: '0.85rem 0.95rem 0.75rem',
    borderRadius: '1rem',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    backdropFilter: 'blur(12px)',
    overflow: 'hidden',
    pointerEvents: 'auto'
  },
  toastInner: {
    display: 'grid',
    gridTemplateColumns: '44px minmax(0, 1fr) auto',
    gap: '0.8rem',
    alignItems: 'flex-start'
  },
  iconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '1.1rem',
    fontWeight: '800',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)'
  },
  messageWrap: {
    minWidth: 0
  },
  toastTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: '0.92rem',
    marginBottom: '0.2rem'
  },
  toastMessage: {
    color: '#334155',
    fontWeight: '600',
    lineHeight: 1.45,
    fontSize: '0.89rem'
  },
  dismissButton: {
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    fontSize: '1.15rem',
    lineHeight: 1,
    cursor: 'pointer',
    padding: '0.1rem 0.15rem'
  },
  progressTrack: {
    marginTop: '0.75rem',
    height: '5px',
    background: '#e2e8f0',
    borderRadius: '999px',
    overflow: 'hidden'
  },
  progressBar: {
    width: '100%',
    height: '100%',
    transformOrigin: 'left center'
  }
};

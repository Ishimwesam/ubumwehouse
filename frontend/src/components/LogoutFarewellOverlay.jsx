import React from 'react';

const LogoutFarewellOverlay = ({ open, userName }) => {
  if (!open) return null;

  const safeName = userName || 'Administrator';

  return (
    <>
      <style>{`
        @keyframes logout-farewell-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes logout-farewell-card {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes logout-farewell-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes logout-farewell-pulse {
          0%, 100% { transform: scale(1); opacity: 0.92; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes logout-farewell-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes logout-farewell-bar {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
      <div style={styles.overlay}>
        <div style={styles.backdropGlow} />
        <div style={styles.card}>
          <div style={styles.orbit}>
            <div style={styles.orbitRing} />
            <div style={styles.coreBadge}>
              <span style={styles.coreBadgeInner}>USC</span>
            </div>
          </div>

          <div style={styles.kicker}>Session Closed Safely</div>
          <h1 style={styles.title}>THANK YOU FOR USING THE SYSTEM</h1>
          <p style={styles.message}>
            Your workspace is signing out securely, {safeName}. We appreciate your time and hope the system helped you move faster today.
          </p>
          <p style={styles.suggestion}>
            Tip: sign in again anytime to continue managing tenants, payments, buildings, and reports without losing momentum.
          </p>

          <div style={styles.loaderWrap}>
            <div style={styles.loaderLabel}>Redirecting to login</div>
            <div style={styles.loaderTrack}>
              <div style={styles.loaderBar} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 30000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.25rem',
    background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.18), transparent 36%), linear-gradient(135deg, rgba(8, 15, 38, 0.95) 0%, rgba(13, 32, 74, 0.97) 48%, rgba(18, 43, 102, 0.98) 100%)',
    animation: 'logout-farewell-fade 0.3s ease forwards',
    overflow: 'hidden'
  },
  backdropGlow: {
    position: 'absolute',
    inset: '8%',
    borderRadius: '40px',
    background: 'radial-gradient(circle, rgba(96, 165, 250, 0.18), rgba(37, 99, 235, 0.02) 62%, transparent 76%)',
    filter: 'blur(28px)',
    pointerEvents: 'none'
  },
  card: {
    position: 'relative',
    width: 'min(680px, 100%)',
    borderRadius: '30px',
    padding: '2.4rem 2rem 2rem',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
    border: '1px solid rgba(191, 219, 254, 0.22)',
    boxShadow: '0 38px 90px rgba(3, 7, 18, 0.42)',
    backdropFilter: 'blur(18px)',
    color: '#f8fbff',
    textAlign: 'center',
    animation: 'logout-farewell-card 0.45s cubic-bezier(.2,.8,.2,1) forwards'
  },
  orbit: {
    position: 'relative',
    width: '112px',
    height: '112px',
    margin: '0 auto 1.35rem'
  },
  orbitRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '999px',
    border: '1px solid rgba(191, 219, 254, 0.42)',
    boxShadow: '0 0 0 14px rgba(96, 165, 250, 0.06)',
    animation: 'logout-farewell-orbit 7s linear infinite'
  },
  coreBadge: {
    position: 'absolute',
    inset: '18px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 55%, #1d4ed8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 20px 44px rgba(37, 99, 235, 0.38)',
    animation: 'logout-farewell-pulse 2.2s ease-in-out infinite'
  },
  coreBadgeInner: {
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    color: '#ffffff'
  },
  kicker: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '32px',
    padding: '0 0.9rem',
    borderRadius: '999px',
    marginBottom: '0.95rem',
    background: 'rgba(191, 219, 254, 0.14)',
    color: '#dbeafe',
    fontSize: '0.78rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  },
  title: {
    margin: 0,
    fontSize: 'clamp(1.75rem, 4.4vw, 2.8rem)',
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: '-0.04em',
    color: '#ffffff',
    backgroundImage: 'linear-gradient(90deg, #ffffff 0%, #dbeafe 38%, #93c5fd 65%, #ffffff 100%)',
    backgroundSize: '220% 220%',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'logout-farewell-shimmer 3.8s linear infinite'
  },
  message: {
    margin: '1rem auto 0',
    maxWidth: '560px',
    color: 'rgba(239, 246, 255, 0.96)',
    fontSize: '1.01rem',
    lineHeight: 1.72,
    fontWeight: 600
  },
  suggestion: {
    margin: '0.75rem auto 0',
    maxWidth: '560px',
    color: 'rgba(191, 219, 254, 0.94)',
    fontSize: '0.93rem',
    lineHeight: 1.7,
    fontWeight: 600
  },
  loaderWrap: {
    marginTop: '1.6rem'
  },
  loaderLabel: {
    color: '#dbeafe',
    fontSize: '0.84rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    marginBottom: '0.7rem'
  },
  loaderTrack: {
    height: '8px',
    width: 'min(360px, 100%)',
    margin: '0 auto',
    borderRadius: '999px',
    background: 'rgba(219, 234, 254, 0.22)',
    overflow: 'hidden'
  },
  loaderBar: {
    width: '100%',
    height: '100%',
    borderRadius: '999px',
    background: 'linear-gradient(90deg, #bfdbfe 0%, #60a5fa 42%, #2563eb 100%)',
    transformOrigin: 'left center',
    animation: 'logout-farewell-bar 3.15s linear forwards'
  }
};

export default LogoutFarewellOverlay;

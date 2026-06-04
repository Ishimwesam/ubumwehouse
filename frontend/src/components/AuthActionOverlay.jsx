import React from 'react';

const variantMap = {
  success: {
    kicker: 'Access Granted',
    title: 'WELCOME BACK TO THE SYSTEM',
    badge: 'USC',
    panel: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.09) 100%)',
    ring: 'rgba(191, 219, 254, 0.44)',
    glow: 'radial-gradient(circle, rgba(96, 165, 250, 0.2), rgba(37, 99, 235, 0.02) 62%, transparent 76%)',
    badgeBg: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 55%, #1d4ed8 100%)',
    titleGradient: 'linear-gradient(90deg, #ffffff 0%, #dbeafe 38%, #93c5fd 65%, #ffffff 100%)',
    subtitle: 'Your dashboard is getting ready. We are taking you into your workspace now.',
    progress: 'linear-gradient(90deg, #bfdbfe 0%, #60a5fa 42%, #2563eb 100%)'
  },
  error: {
    kicker: 'Login Failed',
    title: 'WE COULD NOT SIGN YOU IN',
    badge: '!',
    panel: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
    ring: 'rgba(253, 186, 116, 0.42)',
    glow: 'radial-gradient(circle, rgba(248, 113, 113, 0.2), rgba(220, 38, 38, 0.02) 62%, transparent 76%)',
    badgeBg: 'linear-gradient(135deg, #fb7185 0%, #ef4444 55%, #dc2626 100%)',
    titleGradient: 'linear-gradient(90deg, #ffffff 0%, #fee2e2 38%, #fca5a5 65%, #ffffff 100%)',
    subtitle: 'Check your username or password and try again. If you still need help, contact the administrator.',
    progress: 'linear-gradient(90deg, #fecaca 0%, #f87171 42%, #dc2626 100%)'
  }
};

const AuthActionOverlay = ({ open, variant = 'success', message, userName, duration = 3000 }) => {
  if (!open) return null;

  const tone = variantMap[variant] || variantMap.success;
  const safeMessage = message || tone.subtitle;
  const safeName = userName ? `${userName}, ` : '';

  return (
    <>
      <style>{`
        @keyframes auth-action-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes auth-action-card {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes auth-action-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes auth-action-pulse {
          0%, 100% { transform: scale(1); opacity: 0.92; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes auth-action-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes auth-action-bar {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
      <div style={styles.overlay}>
        <div style={{ ...styles.backdropGlow, background: tone.glow }} />
        <div style={{ ...styles.card, background: tone.panel }}>
          <div style={styles.orbit}>
            <div style={{ ...styles.orbitRing, borderColor: tone.ring }} />
            <div style={{ ...styles.coreBadge, background: tone.badgeBg }}>
              <span style={styles.coreBadgeInner}>{tone.badge}</span>
            </div>
          </div>

          <div style={styles.kicker}>{tone.kicker}</div>
          <h1
            style={{
              ...styles.title,
              backgroundImage: tone.titleGradient
            }}
          >
            {tone.title}
          </h1>
          <p style={styles.message}>
            {safeName}{safeMessage}
          </p>

          <div style={styles.loaderWrap}>
            <div style={styles.loaderLabel}>
              {variant === 'success' ? 'Opening your dashboard' : 'Please try again'}
            </div>
            <div style={styles.loaderTrack}>
              <div
                style={{
                  ...styles.loaderBar,
                  background: tone.progress,
                  animationDuration: `${Math.max(duration - 120, 1200)}ms`
                }}
              />
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
    animation: 'auth-action-fade 0.26s ease forwards',
    overflow: 'hidden'
  },
  backdropGlow: {
    position: 'absolute',
    inset: '8%',
    borderRadius: '40px',
    filter: 'blur(28px)',
    pointerEvents: 'none'
  },
  card: {
    position: 'relative',
    width: 'min(660px, 100%)',
    borderRadius: '30px',
    padding: '2.35rem 2rem 2rem',
    border: '1px solid rgba(191, 219, 254, 0.2)',
    boxShadow: '0 38px 90px rgba(3, 7, 18, 0.42)',
    backdropFilter: 'blur(18px)',
    color: '#f8fbff',
    textAlign: 'center',
    animation: 'auth-action-card 0.42s cubic-bezier(.2,.8,.2,1) forwards'
  },
  orbit: {
    position: 'relative',
    width: '104px',
    height: '104px',
    margin: '0 auto 1.3rem'
  },
  orbitRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '999px',
    border: '1px solid',
    boxShadow: '0 0 0 14px rgba(255,255,255,0.05)',
    animation: 'auth-action-orbit 7s linear infinite'
  },
  coreBadge: {
    position: 'absolute',
    inset: '18px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 20px 44px rgba(15, 23, 42, 0.26)',
    animation: 'auth-action-pulse 2.2s ease-in-out infinite'
  },
  coreBadgeInner: {
    fontSize: '1.3rem',
    fontWeight: 900,
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
    background: 'rgba(255, 255, 255, 0.12)',
    color: '#e2e8f0',
    fontSize: '0.78rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  },
  title: {
    margin: 0,
    fontSize: 'clamp(1.7rem, 4.2vw, 2.65rem)',
    lineHeight: 1.06,
    fontWeight: 900,
    letterSpacing: '-0.04em',
    backgroundSize: '220% 220%',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'auth-action-shimmer 3.8s linear infinite'
  },
  message: {
    margin: '1rem auto 0',
    maxWidth: '530px',
    color: 'rgba(239, 246, 255, 0.97)',
    fontSize: '1rem',
    lineHeight: 1.72,
    fontWeight: 600
  },
  loaderWrap: {
    marginTop: '1.55rem'
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
    width: 'min(340px, 100%)',
    margin: '0 auto',
    borderRadius: '999px',
    background: 'rgba(219, 234, 254, 0.22)',
    overflow: 'hidden'
  },
  loaderBar: {
    width: '100%',
    height: '100%',
    borderRadius: '999px',
    transformOrigin: 'left center',
    animation: 'auth-action-bar 3s linear forwards'
  }
};

export default AuthActionOverlay;

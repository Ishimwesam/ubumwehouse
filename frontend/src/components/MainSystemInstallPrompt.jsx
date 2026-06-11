import React, { useEffect, useState } from 'react';

const DISMISS_KEY = 'ubumwe-main-install-dismissed';

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

const MainSystemInstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === 'true';
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setInstalled(false);
      setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
    };

    const handleInstalled = () => {
      setInstallEvent(null);
      setInstalled(true);
      setDismissed(true);
      localStorage.setItem(DISMISS_KEY, 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (installed || dismissed || !installEvent) return null;

  const handleInstall = async () => {
    installEvent.prompt();
    const result = await installEvent.userChoice;

    if (result?.outcome === 'accepted') {
      setInstalled(true);
      localStorage.setItem(DISMISS_KEY, 'true');
    }

    setInstallEvent(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  return (
    <div className="main-system-install-prompt" role="status" aria-label="Install main app prompt">
      <button type="button" className="main-system-install-button" onClick={handleInstall}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12" />
          <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
          <path d="M4 20h16" />
        </svg>
        <span>Install App</span>
      </button>
      <button type="button" className="main-system-install-dismiss" onClick={handleDismiss} aria-label="Dismiss install prompt">
        x
      </button>
    </div>
  );
};

export default MainSystemInstallPrompt;

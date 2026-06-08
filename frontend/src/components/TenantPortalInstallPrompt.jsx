import React, { useEffect, useState } from 'react';

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

const TenantPortalInstallPrompt = ({ compact = false }) => {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setInstalled(false);
    };

    const handleInstalled = () => {
      setInstallEvent(null);
      setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (installed || !installEvent) return null;

  const handleInstall = async () => {
    installEvent.prompt();
    const result = await installEvent.userChoice;
    if (result?.outcome === 'accepted') {
      setInstalled(true);
    }
    setInstallEvent(null);
  };

  return (
    <div className={compact ? 'tp-install-card compact' : 'tp-install-card'}>
      <div>
        <strong>Tenant Portal App</strong>
        {!compact ? <span>Install for faster phone access.</span> : null}
      </div>
      <button className="tp-btn-primary" type="button" onClick={handleInstall}>
        Install App
      </button>
    </div>
  );
};

export default TenantPortalInstallPrompt;

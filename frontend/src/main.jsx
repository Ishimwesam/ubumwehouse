import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/globals.css'
import { SpinnerProvider } from './context/SpinnerContext';
import { applyAppFont, getStoredAppFont } from './utils/appFont';

applyAppFont(getStoredAppFont());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SpinnerProvider>
      <App />
    </SpinnerProvider>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((registration) => registration.active?.scriptURL?.includes('/tenant-portal-sw.js'))
          .map((registration) => registration.unregister())
      );
      await navigator.serviceWorker.register('/main-system-sw.js', { scope: '/' });
    } catch (_) {}
  });
}

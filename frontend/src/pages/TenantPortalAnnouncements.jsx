import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import TenantPortalNav, { TenantMobileAppHeader, useTenantLanguage } from '../components/TenantPortalNav';
import '../styles/tenant-portal.css';

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const TenantPortalAnnouncements = () => {
  const navigate = useNavigate();
  const [, text] = useTenantLanguage();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnnouncements = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const response = await tenantPortalService.getAnnouncements();
      setAnnouncements(response.data?.announcements || []);
    } catch (err) {
      if (!silent) setError(getReadableApiError(err, text.failedLoadAnnouncements));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const token = tenantPortalService.getToken();
    if (!token) {
      navigate('/tenant-portal');
      return undefined;
    }

    loadAnnouncements().finally(() => {
      if (!mounted) return;
    });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    const onPortalEvent = (event) => {
      if (event.detail?.event_type !== 'tenant_announcement') return;
      loadAnnouncements({ silent: true });
    };
    window.addEventListener('tp:portal-event', onPortalEvent);
    return () => window.removeEventListener('tp:portal-event', onPortalEvent);
  }, []);

  return (
    <main className="tp-page tp-subpage">
      <section className="tp-main tp-subpage-main">
        <TenantMobileAppHeader current="announcements" />
        <header className="tp-header">
          <div>
            <h1>{text.announcementsTitle}</h1>
            <p>{text.announcementsSubtitle}</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            {text.backToDashboard}
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}

        <section className="tp-card" style={{ marginTop: 14 }}>
          <h2>{text.latestUpdates}</h2>
          {loading ? <p className="tp-empty">{text.loadingAnnouncements}</p> : null}
          {!loading && announcements.length === 0 ? (
            <p className="tp-empty">{text.noAnnouncementsLong}</p>
          ) : null}
          {!loading && announcements.length ? (
            <div className="tp-announcement-list">
              {announcements.map((announcement) => (
                <article key={announcement.id} className="tp-announcement-item">
                  <div className="tp-request-top">
                    <strong>{announcement.title}</strong>
                    <span>{formatDateTime(announcement.published_at || announcement.created_at)}</span>
                  </div>
                  <p>{announcement.body}</p>
                  {announcement.expires_at ? <small>{text.expires} {formatDateTime(announcement.expires_at)}</small> : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>
      <TenantPortalNav current="announcements" mobileOnly />
    </main>
  );
};

export default TenantPortalAnnouncements;

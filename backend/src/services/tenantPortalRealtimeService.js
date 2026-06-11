const tenantPortalSseClients = new Map();
const adminPortalSseClients = new Set();

const writeSseEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const registerTenantPortalClient = (tenantId, res) => {
  const normalizedTenantId = String(tenantId);
  const clients = tenantPortalSseClients.get(normalizedTenantId) || new Set();
  clients.add(res);
  tenantPortalSseClients.set(normalizedTenantId, clients);

  writeSseEvent(res, 'connected', { tenant_id: normalizedTenantId, connected_at: new Date().toISOString() });
  const heartbeat = setInterval(() => writeSseEvent(res, 'ping', { ts: Date.now() }), 25000);

  return () => {
    clearInterval(heartbeat);
    const currentClients = tenantPortalSseClients.get(normalizedTenantId);
    if (!currentClients) return;
    currentClients.delete(res);
    if (!currentClients.size) tenantPortalSseClients.delete(normalizedTenantId);
  };
};

const registerAdminTenantPortalClient = (res) => {
  adminPortalSseClients.add(res);
  writeSseEvent(res, 'connected', { connected_at: new Date().toISOString() });
  const heartbeat = setInterval(() => writeSseEvent(res, 'ping', { ts: Date.now() }), 25000);

  return () => {
    clearInterval(heartbeat);
    adminPortalSseClients.delete(res);
  };
};

const notifyTenantStream = (tenantId, payload) => {
  const clients = tenantPortalSseClients.get(String(tenantId));
  if (!clients || !clients.size) return;
  clients.forEach((res) => writeSseEvent(res, 'message', payload));
};

const notifyAdminStream = (payload) => {
  if (!adminPortalSseClients.size) return;
  adminPortalSseClients.forEach((res) => writeSseEvent(res, 'message', payload));
};

const notifyAllTenants = (payload) => {
  tenantPortalSseClients.forEach((clients) => {
    clients.forEach((res) => writeSseEvent(res, 'message', payload));
  });
};

module.exports = {
  registerTenantPortalClient,
  registerAdminTenantPortalClient,
  notifyTenantStream,
  notifyAdminStream,
  notifyAllTenants
};

const rentalAppSseClients = new Set();

const writeSseEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const registerRentalAppClient = (res) => {
  rentalAppSseClients.add(res);
  writeSseEvent(res, 'connected', { connected_at: new Date().toISOString() });

  const heartbeat = setInterval(() => {
    writeSseEvent(res, 'ping', { ts: Date.now() });
  }, 25000);

  return () => {
    clearInterval(heartbeat);
    rentalAppSseClients.delete(res);
  };
};

const broadcastRentalAppRefresh = (payload = {}) => {
  if (!rentalAppSseClients.size) return;

  const eventPayload = {
    type: 'refresh',
    at: new Date().toISOString(),
    ...payload
  };

  rentalAppSseClients.forEach((res) => writeSseEvent(res, 'refresh', eventPayload));
};

module.exports = {
  registerRentalAppClient,
  broadcastRentalAppRefresh
};

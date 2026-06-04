const crypto = require('crypto');
const os = require('os');

const normalize = (value) => String(value || '').trim().toLowerCase();

const getNetworkIds = () => Object.values(os.networkInterfaces())
  .flat()
  .filter((item) => item && !item.internal && item.mac && item.mac !== '00:00:00:00:00:00')
  .map((item) => item.mac)
  .sort();

const getDeviceFingerprint = () => {
  const parts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()?.[0]?.model || ''
  ].map(normalize);

  return crypto
    .createHash('sha256')
    .update(parts.join('|'))
    .digest('hex');
};

const getLegacyNetworkFingerprint = () => {
  const parts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()?.[0]?.model || '',
    ...getNetworkIds()
  ].map(normalize);

  return crypto
    .createHash('sha256')
    .update(parts.join('|'))
    .digest('hex');
};

const getAllowedFingerprints = () => String(process.env.DEVICE_LOCK_FINGERPRINTS || process.env.DEVICE_LOCK_FINGERPRINT || '')
  .split(',')
  .map(normalize)
  .filter(Boolean);

const enforceDeviceLock = () => {
  const currentFingerprint = getDeviceFingerprint();
  const candidateFingerprints = new Set([currentFingerprint, getLegacyNetworkFingerprint()]);
  const allowedFingerprints = getAllowedFingerprints();
  const lockExplicitlyDisabled = process.env.REQUIRE_DEVICE_LOCK === 'false';
  const requireLock = !lockExplicitlyDisabled
    && (process.env.REQUIRE_DEVICE_LOCK === 'true' || process.env.NODE_ENV === 'production');

  if (allowedFingerprints.length === 0) {
    if (requireLock) {
      throw new Error(
        `DEVICE_LOCK_FINGERPRINT is required. Set it to this machine fingerprint: ${currentFingerprint}`
      );
    }

    console.warn(`Device lock is not enabled. Current machine fingerprint: ${currentFingerprint}`);
    return currentFingerprint;
  }

  if (!allowedFingerprints.some((fingerprint) => candidateFingerprints.has(fingerprint))) {
    throw new Error('This copy is not licensed for this device. Device fingerprint mismatch.');
  }

  console.log('Device lock verified for this machine.');
  return currentFingerprint;
};

module.exports = {
  enforceDeviceLock,
  getDeviceFingerprint
};

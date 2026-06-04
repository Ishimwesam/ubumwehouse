const buckets = new Map();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  'unknown';

const defaultKey = (req) => `${getClientIp(req)}:${req.method}:${req.originalUrl.split('?')[0]}`;

const cleanupExpiredBuckets = (now) => {
  if (buckets.size < 1000) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = 'Too many requests. Please try again later.',
  keyGenerator = defaultKey
} = {}) => {
  const limitWindowMs = parsePositiveInt(windowMs, 15 * 60 * 1000);
  const maxRequests = parsePositiveInt(max, 20);

  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const key = keyGenerator(req);
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + limitWindowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    const retryAfter = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(maxRequests - bucket.count, 0)));
    res.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message });
    }

    return next();
  };
};

module.exports = {
  createRateLimiter,
  getClientIp
};

const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimit');

const router = express.Router();
const isGoogleOAuthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const identifierKey = (req) => `${getClientIp(req)}:${String(req.body?.username || req.body?.identifier || req.query?.token || '').toLowerCase()}`;
const authLimiter = createRateLimiter({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10),
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10),
  message: 'Too many authentication requests. Please try again later.',
  keyGenerator: identifierKey
});
const recoveryLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RECOVERY_RATE_LIMIT_WINDOW_MS || `${60 * 60 * 1000}`, 10),
  max: parseInt(process.env.RECOVERY_RATE_LIMIT_MAX || '8', 10),
  message: 'Too many recovery requests. Please try again later.',
  keyGenerator: identifierKey
});

// Google OAuth
if (isGoogleOAuthConfigured) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login?error=google' }), authController.googleCallback);
} else {
  router.get(['/google', '/google/callback'], (req, res) => {
    res.status(503).json({ error: 'Google OAuth is not configured' });
  });
}

// Public routes
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/verify-login-otp', authLimiter, authController.verifyLoginOtp);
router.get('/verify-email', recoveryLimiter, authController.verifyEmail);
router.post('/forgot-password', recoveryLimiter, authController.forgotPassword);
router.post('/reset-password', recoveryLimiter, authController.resetPasswordWithToken);
router.post('/reset-password-otp', recoveryLimiter, authController.resetPasswordWithOtp);

// Protected routes
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/change-password', authMiddleware, authController.changePassword);
router.get('/users', authMiddleware, authController.listUsers);
router.post('/users', authMiddleware, authController.createUserByAdmin);
router.put('/users/:id/status', authMiddleware, authController.updateUserStatus);
router.put('/users/:id/password', authMiddleware, authController.resetUserPasswordByAdmin);
router.post('/profile-picture', authMiddleware, upload.single('profile_picture'), authController.uploadProfilePicture);

module.exports = router;

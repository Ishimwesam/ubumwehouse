const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
const LOGIN_MAX_ATTEMPTS = parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '5', 10);
const MIN_PASSWORD_LENGTH = parseInt(process.env.MIN_PASSWORD_LENGTH || '8', 10);

const normalizeIdentifier = (value = '') => String(value || '').trim();

const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  'unknown';

const getLoginAttemptKey = (req, identifier) =>
  `${getClientIp(req)}:${normalizeIdentifier(identifier).toLowerCase()}`;

const getLoginAttemptState = (key) => {
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || current.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(key, fresh);
    return fresh;
  }

  return current;
};

const isLoginRateLimited = (req, identifier) => {
  const key = getLoginAttemptKey(req, identifier);
  const state = getLoginAttemptState(key);
  return state.count >= LOGIN_MAX_ATTEMPTS;
};

const recordFailedLogin = (req, identifier) => {
  const key = getLoginAttemptKey(req, identifier);
  const state = getLoginAttemptState(key);
  state.count += 1;
  loginAttempts.set(key, state);
};

const clearFailedLogins = (req, identifier) => {
  loginAttempts.delete(getLoginAttemptKey(req, identifier));
};

const getRetryAfterSeconds = (req, identifier) => {
  const state = loginAttempts.get(getLoginAttemptKey(req, identifier));
  if (!state) return Math.ceil(LOGIN_WINDOW_MS / 1000);
  return Math.max(Math.ceil((state.resetAt - Date.now()) / 1000), 1);
};

const validatePasswordStrength = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }

  return '';
};

const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  full_name: user.full_name,
  role: user.role || 'user',
  profile_image: user.profile_image || null,
  phone: user.phone || null,
  created_at: user.created_at || null,
  updated_at: user.updated_at || null
});

const googleCallback = (req, res) => {
  if (!req.user) {
    return res.redirect('/login?error=notfound');
  }

  if (!process.env.JWT_SECRET) {
    return res.redirect('/login?error=config');
  }

  const user = req.user;
  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
  const appUrl = (process.env.APP_URL || 'http://localhost:5173').split(',')[0].trim();
  return res.redirect(`${appUrl}/login?token=${encodeURIComponent(token)}`);
};

const createMailTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const sendSmsWithTwilio = async (to, body) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('SMS provider is not configured');
  }

  const payload = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: body
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: payload.toString()
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Twilio send failed: ${response.status} ${details}`);
  }
};

const getEmailFromAddress = () => {
  const name = process.env.SMTP_FROM_NAME || 'Rental Management';
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
  return `"${name}" <${email}>`;
};

const sendVerificationEmail = async (email, token) => {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;
  const transporter = createMailTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service not configured');
    }
    console.log('📧 EMAIL NOT CONFIGURED - Development Mode');
    console.log(`Verification link for ${email}: ${verifyUrl}`);
    return;
  }

  await transporter.sendMail({
    from: getEmailFromAddress(),
    to: email,
    subject: 'Verify your Rental Management Account - UBUMWE',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">UBUMWE RENTAL SYSTEM</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Welcome to our platform</p>
        </div>
        <div style="border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; padding: 30px; background: #f9fafb;">
          <h2 style="margin-top: 0; color: #1f2937;">Verify Your Email Address</h2>
          <p>Thank you for registering with UBUMWE Rental System. To activate your account and access all features, please verify your email address.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">Or copy this link into your browser:</p>
          <p style="color: #667eea; word-break: break-all; font-size: 12px; background: #f3f4f6; padding: 10px; border-radius: 4px;">${verifyUrl}</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">This verification link expires in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">If you did not create this account, please contact our support team.</p>
        </div>
      </div>
    `
  });
};

const sendPasswordResetEmail = async (email, token) => {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
  const transporter = createMailTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service not configured');
    }
    console.log('📧 EMAIL NOT CONFIGURED - Development Mode');
    console.log(`Reset link for ${email}: ${resetUrl}`);
    throw new Error('SMTP not configured - use devResetLink');
  }

  await transporter.sendMail({
    from: getEmailFromAddress(),
    to: email,
    subject: 'Reset your UBUMWE Rental Account Password',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">UBUMWE RENTAL SYSTEM</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Account Recovery</p>
        </div>
        <div style="border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; padding: 30px; background: #f9fafb;">
          <h2 style="margin-top: 0; color: #1f2937;">Password Reset Request</h2>
          <p>We received a password reset request for your UBUMWE Rental Management account.</p>
          <p style="color: #6b7280;">If you didn't make this request, you can ignore this email.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">Or copy this link into your browser:</p>
          <p style="color: #667eea; word-break: break-all; font-size: 12px; background: #f3f4f6; padding: 10px; border-radius: 4px;">${resetUrl}</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;"><strong>Security Note:</strong> This link expires in 15 minutes.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">If you need help, contact our support team.</p>
        </div>
      </div>
    `
  });
};

const sendPasswordResetSms = async (phone, otp) => {
  await sendSmsWithTwilio(phone, `UBUMWE: Your password reset OTP is ${otp}. Expires in 15 minutes.`);
};

const sendLoginOtpEmail = async (email, otp) => {
  const transporter = createMailTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service not configured');
    }
    console.log('📧 EMAIL NOT CONFIGURED - Development Mode');
    console.log(`Login OTP for ${email}: ${otp}`);
    return;
  }

  await transporter.sendMail({
    from: getEmailFromAddress(),
    to: email,
    subject: 'Your UBUMWE Rental Account Login Code',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2>Login Verification Code</h2>
        <p>Your one-time verification code for UBUMWE Rental System is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #2563eb; text-align: center; padding: 20px 0;">${otp}</p>
        <p>This code expires in 10 minutes.</p>
        <p style="color: #6b7280; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `
  });
};

const sendLoginOtpSms = async (phone, otp) => {
  await sendSmsWithTwilio(phone, `UBUMWE: Your login code is ${otp}. Expires in 10 minutes.`);
};

const getLoginOtpRoles = () => String(process.env.LOGIN_OTP_ROLES || 'admin')
  .split(',')
  .map((role) => role.trim().toLowerCase())
  .filter(Boolean);

const shouldRequireLoginOtp = (user) => {
  if (process.env.LOGIN_OTP_ENABLED !== 'true') return false;
  const roles = getLoginOtpRoles();
  return roles.includes('all') || roles.includes(String(user.role || 'user').toLowerCase());
};

const maskDestination = (value = '') => {
  const text = String(value || '');
  if (!text) return 'your registered contact';
  if (text.includes('@')) {
    const [name, domain] = text.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return `${text.slice(0, 4)}***${text.slice(-2)}`;
};

const issueLoginToken = (user) => {
  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

  return {
    message: 'Login successful',
    token,
    user: sanitizeUser(user)
  };
};

const deliverLoginOtp = async (user, otp) => {
  if (user.email) {
    await sendLoginOtpEmail(user.email, otp);
    return maskDestination(user.email);
  }

  if (user.phone) {
    await sendLoginOtpSms(user.phone, otp);
    return maskDestination(user.phone);
  }

  throw new Error('No email or phone is available for login OTP delivery.');
};

const createUserRecord = ({ username, email, password, full_name, phone, role = 'user' }, callback) => {
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    callback(new Error(passwordError));
    return;
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const userId = uuidv4();

  db.run(
    `INSERT INTO users
      (id, username, email, password, full_name, phone, role, email_verified, verification_token, verification_token_expires)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, username, email, hashedPassword, full_name || '', phone || null, role, 1, null, null],
    function(err) {
      callback(err, {
        id: userId,
        username,
        email,
        full_name: full_name || '',
        phone: phone || null,
        role,
        email_verified: 1
      });
    }
  );
};

// Register new user
const register = (req, res) => {
  if (process.env.DISABLE_PUBLIC_REGISTRATION === 'true') {
    return res.status(403).json({ error: 'Public registration is disabled. Ask an admin to create your account.' });
  }

  const { username, email, password, full_name, phone } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  createUserRecord({ username, email, password, full_name, phone, role: 'user' }, (err, user) => {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
      if (err.message.startsWith('Password must')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: 'Error creating user' });
    }

    res.status(201).json({
      message: 'User registered successfully. You can now log in.',
      user
    });
  });
};

const createUserByAdmin = (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can create users' });
  }

  const { username, email, password, full_name, phone, role } = req.body;
  const normalizedRole = role || 'user';
  const allowedRoles = ['user', 'manager', 'admin'];

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  if (!allowedRoles.includes(normalizedRole)) {
    return res.status(400).json({ error: 'Invalid role selected' });
  }

  createUserRecord({ username, email, password, full_name, phone, role: normalizedRole }, (err, user) => {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
      if (err.message.startsWith('Password must')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: 'Error creating user' });
    }

    res.status(201).json({
      message: 'User created successfully',
      user
    });
  });
};

// Login user
const login = (req, res) => {
  const { username, password } = req.body;
  const identifier = normalizeIdentifier(username);

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (isLoginRateLimited(req, identifier)) {
    const retryAfter = getRetryAfterSeconds(req, identifier);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: `Too many login attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).` });
  }

  // Allow login by username, email, or phone
  db.get(
    `SELECT * FROM users WHERE username = ? OR email = ? OR phone = ?`,
    [identifier, identifier, identifier],
    (err, user) => {
      if (err) {
        console.error('Login DB error:', err);
        return res.status(500).json({ error: 'Error fetching user' });
      }

      if (!user) {
        recordFailedLogin(req, identifier);
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      if (user.is_active === 0) {
        recordFailedLogin(req, identifier);
        return res.status(403).json({ error: 'This account is disabled. Contact an administrator.' });
      }

      let isPasswordValid = false;
      try {
        isPasswordValid = bcrypt.compareSync(password, user.password);
      } catch (bcryptErr) {
        console.error('Bcrypt error:', bcryptErr);
        return res.status(500).json({ error: 'Password check failed' });
      }

      if (!isPasswordValid) {
        recordFailedLogin(req, identifier);
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      if (!user.email_verified) {
        return res.status(403).json({
          error: 'Please verify your email before logging in'
        });
      }

      if (shouldRequireLoginOtp(user)) {
        const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        return db.run(
          `UPDATE users
           SET login_otp = ?, login_otp_expires = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [otp, expiresAt, user.id],
          async (otpErr) => {
            if (otpErr) {
              return res.status(500).json({ error: 'Error preparing login verification' });
            }

            try {
              const destination = await deliverLoginOtp(user, otp);
              return res.json({
                requires_otp: true,
                username: user.username,
                destination,
                message: 'A login verification code has been sent.'
              });
            } catch (deliveryErr) {
              console.error('Login OTP delivery failed:', deliveryErr.message);
              return res.status(500).json({ error: deliveryErr.message || 'Could not send login verification code' });
            }
          }
        );
      }

      clearFailedLogins(req, identifier);
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user'
      };
      try {
        return res.json(issueLoginToken(user));
      } catch (jwtErr) {
        console.error('JWT sign error:', jwtErr);
        return res.status(500).json({ error: 'Token generation failed' });
      }
    }
  );
};

const verifyLoginOtp = (req, res) => {
  const identifier = normalizeIdentifier(req.body?.username || req.body?.identifier);
  const otp = String(req.body?.otp || '').trim();

  if (!identifier || !otp) {
    return res.status(400).json({ error: 'Username and OTP are required' });
  }

  db.get(
    `SELECT * FROM users WHERE username = ? OR email = ? OR phone = ?`,
    [identifier, identifier, identifier],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching user' });
      }

      if (!user || !user.login_otp) {
        return res.status(401).json({ error: 'Invalid or expired login code' });
      }

      if (!user.login_otp_expires || new Date(user.login_otp_expires) < new Date()) {
        return res.status(401).json({ error: 'Login code expired. Please sign in again.' });
      }

      if (String(user.login_otp) !== otp) {
        return res.status(401).json({ error: 'Invalid login code' });
      }

      db.run(
        `UPDATE users
         SET login_otp = NULL, login_otp_expires = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [user.id],
        (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ error: 'Error verifying login code' });
          }

          clearFailedLogins(req, identifier);
          req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user'
          };

          try {
            return res.json(issueLoginToken(user));
          } catch (jwtErr) {
            console.error('JWT sign error:', jwtErr);
            return res.status(500).json({ error: 'Token generation failed' });
          }
        }
      );
    }
  );
};

const listUsers = (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can list users' });
  }

  db.all(
    `SELECT id, username, email, phone, full_name, role, profile_image, is_active, created_at, updated_at
     FROM users
     ORDER BY LOWER(COALESCE(full_name, username)) ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error fetching users' });
      return res.json(rows.map((row) => ({ ...row, is_active: row.is_active !== 0 })));
    }
  );
};

const updateUserStatus = (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can update users' });
  }

  const { id } = req.params;
  const isActive = req.body?.is_active === true || req.body?.is_active === 1;

  if (String(id) === String(req.user.id) && !isActive) {
    return res.status(400).json({ error: 'You cannot disable your own account' });
  }

  db.get('SELECT id, role FROM users WHERE id = ?', [id], (findErr, targetUser) => {
    if (findErr) return res.status(500).json({ error: 'Error fetching user' });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const updateStatus = () => {
      db.run(
        'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [isActive ? 1 : 0, id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: 'Error updating user status' });
          return res.json({ message: isActive ? 'User enabled successfully' : 'User disabled successfully' });
        }
      );
    };

    if (targetUser.role === 'admin' && !isActive) {
      db.get(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND COALESCE(is_active, 1) = 1 AND id != ?",
        [id],
        (countErr, row) => {
          if (countErr) return res.status(500).json({ error: 'Error validating admin status' });
          if (!row?.count) return res.status(400).json({ error: 'At least one active admin account is required' });
          return updateStatus();
        }
      );
      return;
    }

    return updateStatus();
  });
};

const resetUserPasswordByAdmin = (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can reset user passwords' });
  }

  const { id } = req.params;
  const newPassword = String(req.body?.newPassword || '').trim();
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.run(
    `UPDATE users
     SET password = ?, login_otp = NULL, login_otp_expires = NULL,
         reset_token = NULL, reset_token_expires = NULL,
         reset_otp = NULL, reset_otp_expires = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [hashedPassword, id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error resetting user password' });
      if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
      return res.json({ message: 'User password reset successfully' });
    }
  );
};

// Forgot password: request reset link (email) or OTP (sms)
const forgotPassword = (req, res) => {
  const { identifier, method } = req.body;

  if (!identifier) {
    return res.status(400).json({ error: 'Email or phone is required' });
  }

  const normalizedMethod = (method || 'email').toLowerCase();
  const query = identifier.includes('@')
    ? 'SELECT id, email, phone FROM users WHERE email = ?'
    : 'SELECT id, email, phone FROM users WHERE phone = ?';

  db.get(query, [identifier], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error processing password recovery request' });
    }

    // Always return generic response to avoid account enumeration
    const genericMessage = 'If an account exists, recovery instructions have been sent.';

    if (!user) {
      return res.json({ message: genericMessage });
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    if (normalizedMethod === 'sms') {
      const otp = `${Math.floor(100000 + Math.random() * 900000)}`;

      db.run(
        `UPDATE users
         SET reset_otp = ?, reset_otp_expires = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [otp, expiresAt, user.id],
        async (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ error: 'Error generating OTP' });
          }

          try {
            if (user.phone) {
              await sendPasswordResetSms(user.phone, otp);
            }
          } catch (smsErr) {
            console.error('Password reset SMS send failed:', smsErr);
          }

          return res.json({ message: genericMessage, method: 'sms' });
        }
      );

      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    db.run(
      `UPDATE users
       SET reset_token = ?, reset_token_expires = ?, reset_otp = NULL, reset_otp_expires = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [resetToken, expiresAt, user.id],
      async (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ error: 'Error generating reset link' });
        }

        try {
          if (user.email) {
            await sendPasswordResetEmail(user.email, resetToken);
          }
        } catch (mailErr) {
          console.error('Password reset email send failed:', mailErr);
          if (process.env.NODE_ENV !== 'production') {
            return res.json({
              message: 'Email delivery failed in development. Use the temporary reset link below.',
              method: 'email',
              delivery: 'failed',
              devResetLink: resetUrl
            });
          }
          return res.status(502).json({ error: 'Failed to send recovery email. Please verify SMTP credentials.' });
        }

        return res.json({ message: genericMessage, method: 'email' });
      }
    );
  });
};

// Reset password with email token
const resetPasswordWithToken = (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  db.get(
    'SELECT id, reset_token_expires FROM users WHERE reset_token = ?',
    [token],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Error validating reset token' });
      }

      if (!user) {
        return res.status(400).json({ error: 'Invalid reset token' });
      }

      if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
        return res.status(400).json({ error: 'Reset token has expired' });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);

      db.run(
        `UPDATE users
         SET password = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [hashedPassword, user.id],
        (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ error: 'Error resetting password' });
          }

          return res.json({ message: 'Password updated successfully' });
        }
      );
    }
  );
};

// Reset password with SMS OTP
const resetPasswordWithOtp = (req, res) => {
  const { identifier, otp, newPassword } = req.body;

  if (!identifier || !otp || !newPassword) {
    return res.status(400).json({ error: 'Identifier, OTP, and new password are required' });
  }

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const query = identifier.includes('@')
    ? 'SELECT id, reset_otp, reset_otp_expires FROM users WHERE email = ?'
    : 'SELECT id, reset_otp, reset_otp_expires FROM users WHERE phone = ?';

  db.get(query, [identifier], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error validating OTP' });
    }

    if (!user || !user.reset_otp) {
      return res.status(400).json({ error: 'Invalid OTP or account' });
    }

    if (!user.reset_otp_expires || new Date(user.reset_otp_expires) < new Date()) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (user.reset_otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    db.run(
      `UPDATE users
       SET password = ?, reset_otp = NULL, reset_otp_expires = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [hashedPassword, user.id],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ error: 'Error resetting password' });
        }

        return res.json({ message: 'Password updated successfully' });
      }
    );
  });
};

// Verify email token
const verifyEmail = (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  db.get(
    'SELECT id, verification_token_expires FROM users WHERE verification_token = ?',
    [token],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Error verifying token' });
      }

      if (!user) {
        return res.status(400).json({ error: 'Invalid verification token' });
      }

      if (!user.verification_token_expires || new Date(user.verification_token_expires) < new Date()) {
        return res.status(400).json({ error: 'Verification token has expired' });
      }

      db.run(
        `UPDATE users 
         SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [user.id],
        function(updateErr) {
          if (updateErr) {
            return res.status(500).json({ error: 'Error verifying email' });
          }

          return res.json({ message: 'Email verified successfully. You can now log in.' });
        }
      );
    }
  );
};

// Get current user
const getProfile = (req, res) => {
  const userId = req.user.id;

  db.get('SELECT id, username, email, phone, full_name, role, profile_image, created_at, updated_at FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching user profile' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  });
};

// Upload profile picture
const uploadProfilePicture = (req, res) => {
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ error: 'Choose a profile image before uploading.' });
  }

  const profileImagePath = `/uploads/${req.file.filename}`;

  db.run(
    'UPDATE users SET profile_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [profileImagePath, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating profile image' });
      }

      db.get(
        'SELECT id, username, email, phone, full_name, role, profile_image, created_at, updated_at FROM users WHERE id = ?',
        [userId],
        (getErr, user) => {
          if (getErr || !user) {
            return res.status(500).json({ error: 'Profile image uploaded, but failed to fetch updated user' });
          }

          res.json({ message: 'Profile image uploaded successfully', user });
        }
      );
    }
  );
};

// Update user profile
const updateProfile = (req, res) => {
  const { full_name, email, phone } = req.body;
  const userId = req.user.id;

  db.run(
    'UPDATE users SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [full_name, email, phone || null, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating profile' });
      }

      res.json({ message: 'Profile updated successfully' });
    }
  );
};

// Change password
const changePassword = (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new passwords are required' });
  }

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  db.get('SELECT password FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching user' });
    }

    const isPasswordValid = bcrypt.compareSync(oldPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Old password is incorrect' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    db.run(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error changing password' });
        }

        res.json({ message: 'Password changed successfully' });
      }
    );
  });
};

module.exports = {
  register,
  login,
  verifyLoginOtp,
  listUsers,
  updateUserStatus,
  resetUserPasswordByAdmin,
  getProfile,
  updateProfile,
  changePassword,
  uploadProfilePicture,
  verifyEmail,
  createUserByAdmin,
  forgotPassword,
  resetPasswordWithToken,
  resetPasswordWithOtp,
  googleCallback
};

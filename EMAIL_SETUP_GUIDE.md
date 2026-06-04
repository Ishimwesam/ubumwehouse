# 📧 Email Configuration & Testing Guide

Complete guide for configuring SMTP email and troubleshooting email issues.

---

## ✅ Email Features Configured

- ✅ Account verification emails
- ✅ Password reset emails  
- ✅ Login OTP emails
- ✅ Professional HTML templates
- ✅ "UBUMWE RENTAL SYSTEM" branding on all emails
- ✅ Support for Gmail, SendGrid, Office365, and custom SMTP

---

## 🚀 Quick Setup with Gmail (15 minutes)

### Step 1: Enable 2-Factor Authentication

1. Go to: https://myaccount.google.com/security
2. Find "2-Step Verification"
3. Click "Enable 2-Step Verification"
4. Follow the steps to enable

### Step 2: Create App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Select **Mail** and **Windows Computer** (or your device)
3. Click "Generate"
4. Google shows a 16-character password
5. **Copy this password** (you'll use it only once)

### Step 3: Configure Backend

Edit `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=paste-your-16-digit-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=UBUMWE RENTAL SYSTEM
```

**Important**: 
- `SMTP_PASS` is the 16-character app password (with or without spaces)
- NOT your regular Gmail password
- NOT your 2FA backup codes

### Step 4: Test Configuration

1. Start backend: `npm run dev` in the `backend` folder
2. Open frontend: http://localhost:5173
3. Click "Register" and create account
4. Check email inbox (also check spam folder)
5. Click verification link

**Expected**: Email arrives within 1 minute from "UBUMWE RENTAL SYSTEM"

---

## 🔍 Testing Email Manually

### Test 1: Verification Email

```bash
# Through the frontend
1. Go to http://localhost:5173
2. Click "Register"
3. Fill in details (use real email you can check)
4. Click "Register"
5. Check your email for verification link
```

### Test 2: Password Reset

```bash
# Through the frontend
1. Go to http://localhost:5173
2. Click "Login"
3. Click "Forgot Password"
4. Enter your email
5. Check your email for password reset link
6. Click link and set new password
```

### Test 3: Check Server Logs

```bash
# Look for email success messages
cd backend
npm run dev

# You should see:
# "✅ Server running on http://localhost:5003"
# When email is sent:
# "Email sent successfully to: your-email@gmail.com"
```

---

## 🐛 Troubleshooting

### Issue 1: "Email not configured" message

**Problem**: 
```
Email verification token generated, but SMTP is not configured.
Verification link for user@example.com: http://localhost:5173/verify-email?token=...
```

**Solution**: 
- Check `SMTP_USER` and `SMTP_PASS` are not empty in `.env`
- Make sure you restarted the backend after changing `.env`
- Verify credentials are correct

### Issue 2: "Invalid login" or "Authentication failed"

**Problem**: Email sending fails with authentication error

**Solutions**:
1. **For Gmail**:
   - Make sure you're using App Password (not regular password)
   - App Password must be 16 characters
   - Verify 2-Factor Authentication is enabled
   - Check you copied password correctly (no extra spaces)

2. **For Other Providers**:
   - Verify username/password are correct
   - Check host and port are correct
   - Verify email account is active

### Issue 3: Email arrives in spam folder

**Problem**: Email received but in Spam folder

**Solutions**:
1. Check spam folder first (might be there for testing)
2. Add sender to contacts (marks future emails as trusted)
3. For production: Add SPF, DKIM records to your domain
4. Use reputable provider like SendGrid for production

### Issue 4: Email not arriving at all

**Problem**: No email received after 5 minutes

**Solutions**:

1. **Check logs in backend console**:
   ```
   Look for error messages like:
   - "ENOTFOUND smtp.gmail.com"
   - "550 User not found"
   - "535 Authentication failed"
   ```

2. **Verify SMTP settings**:
   ```env
   # For Gmail - Must be exactly:
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   
   # For SendGrid - Must be exactly:
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=apikey
   SMTP_PASS=SG.your-api-key
   ```

3. **Test connectivity**:
   ```bash
   # Test if SMTP host is reachable
   telnet smtp.gmail.com 587
   # Should connect (Ctrl+C to exit)
   ```

4. **Check firewall**:
   - Ensure port 587 is not blocked
   - Check ISP isn't blocking outbound email
   - Try from different network

### Issue 5: Special characters in password not working

**Problem**: Password contains special characters like `@`, `!`, `&`, etc.

**Solution**: Quote the password in `.env`:
```env
# If password has special characters, quote it:
SMTP_PASS="yourP@ssw0rd!&special"
```

---

## 🔄 Switch Email Providers

### From Gmail to SendGrid

1. Go to https://sendgrid.com and create account
2. Verify sender email: https://sendgrid.com/dynamic-sender-authentication
3. Create API key: https://sendgrid.com/dynamic-sender-authentication
4. Update `.env`:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=UBUMWE RENTAL SYSTEM
```

### From Gmail to Office365

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yourcompany.com
SMTP_PASS=your-password
SMTP_FROM_EMAIL=your-email@yourcompany.com
SMTP_FROM_NAME=UBUMWE RENTAL SYSTEM
```

---

## 📊 Email Logs & Monitoring

### View Email Sending in Real-Time

```bash
# Terminal 1: Start backend with debug logs
cd backend
DEBUG=* npm run dev

# Terminal 2: Trigger email action
# Or from frontend trigger password reset, registration, etc.

# Watch terminal for email delivery logs
```

### Check Database for Email Status

```bash
# Not stored separately, but can check:
# - users table: email_verified column
# - users table: verification_token column (if pending)
```

---

## 🔒 Security Best Practices

### Never commit secrets to Git

```bash
# Good - Secret in .env (ignored by git)
SMTP_PASS=your-password

# Bad - Secret in code
const password = "your-password"

# Verify .env is in .gitignore
cat .gitignore | grep ".env"
```

### Rotate credentials regularly

- Change Gmail app password every 3 months
- Update SendGrid API key if exposed
- Use environment-specific passwords (dev vs prod)

### For Production

```env
# Use strong, unique credentials
# Store in secure environment variable manager:
# - Railway: Project Settings → Variables
# - Render: Environment → Environment Variables
# - Heroku: heroku config:set
# - AWS: Secrets Manager
```

---

## 📞 Provider Support

| Provider | Support | Cost | Best For |
|----------|---------|------|----------|
| Gmail | Free with Google account | Free | Testing, small volume |
| SendGrid | Excellent | Free tier: 100/day | Production, reliable |
| Office365 | Microsoft Support | Included | Business accounts |
| AWS SES | AWS Support | Pay-per-use | High volume |

---

## ✅ Email Validation Checklist

Before going to production, ensure:

```
[ ] SMTP credentials configured and tested
[ ] Test email sent successfully
[ ] Email received in inbox (not spam)
[ ] Email branding shows "UBUMWE RENTAL SYSTEM"
[ ] All links in email work correctly
[ ] Password reset flow works end-to-end
[ ] Email verification flow works end-to-end
[ ] OTP email arrives quickly (< 1 minute)
[ ] No secrets committed to Git
[ ] Production environment has different credentials
[ ] Email retention policy set (delete/archive)
```

---

## 📌 Quick Reference

### SMTP Credentials Format
```env
# REQUIRED
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587                    # Usually 587 or 465
SMTP_USER=your-email@example.com
SMTP_PASS=your-password          # Use app password if provider requires
SMTP_SECURE=false                # false for 587, true for 465

# OPTIONAL but recommended
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=UBUMWE RENTAL SYSTEM
```

### Common SMTP Servers
```
Gmail: smtp.gmail.com:587
SendGrid: smtp.sendgrid.net:587
Office365: smtp.office365.com:587
AWS SES: email-smtp.region.amazonaws.com:587
```

---

## 🎉 You're Ready!

Once emails are working:
- ✅ Users can verify accounts
- ✅ Users can reset passwords
- ✅ Your system is production-ready
- ✅ Professional branding with UBUMWE


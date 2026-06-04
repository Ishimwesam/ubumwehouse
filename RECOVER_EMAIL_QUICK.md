# ⚡ Email Recovery - Quick Action (15 min)

## The Problem You Reported
✅ **FIXED**: Message "If an account exists, recovery instructions have been sent" but NO email arrives

## Root Cause
SMTP credentials not configured in `backend/.env`

---

## DO THIS NOW (3 steps, 15 minutes)

### ✅ Step 1: Get Gmail Credentials (5 min)

Go to: https://myaccount.google.com/apppasswords

```
1. Select "Mail"
2. Select "Windows Computer"
3. Click "Generate"
4. Get 16-character password
5. Copy it somewhere safe
```

### ✅ Step 2: Update backend/.env (2 min)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=paste-your-16-char-password-here
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=UBUMWE RENTAL SYSTEM
```

### ✅ Step 3: Test (3 min)

```bash
# Restart backend
cd backend && npm run dev

# Test in browser
# 1. Go to http://localhost:5173
# 2. Click "Login" → "Forgot Password"
# 3. Enter your email
# 4. Check email for reset link
# 5. Should arrive in < 1 minute
```

---

## 📋 What Changed

| Before | After |
|--------|-------|
| Message shown but NO email | Message + Email arrives |
| Silent failure | Clear error messages |
| No feedback if SMTP missing | Shows devResetLink in dev mode |
| Generic templates | UBUMWE branded emails |

---

## 🧪 How to Know It Works

✅ Check these:
- Email arrives within 1 minute
- Sender shows "UBUMWE RENTAL SYSTEM"
- Reset link opens password reset page
- Can set new password
- Can login with new password

---

## ❌ If It Still Doesn't Work

**Check 1**: Is SMTP_PASS the app password?
- ❌ NOT regular Gmail password
- ✅ YES, 16-character app password from apppasswords page

**Check 2**: Did you restart backend?
```bash
# Kill current: Ctrl+C
# Restart:
npm run dev
```

**Check 3**: Check console logs
```
# Look for one of:
✅ "Email sent successfully"
❌ "Email delivery failed"
❌ "SMTP not configured"
```

---

## 📞 Support

- Full guide: `PASSWORD_RECOVERY_FIX.md`
- Email setup: `EMAIL_SETUP_GUIDE.md`
- System check: `node verify-email.js`

---

## 🎯 Summary

**Your Issue**: No email after "recovery instructions sent"

**Fixed By**: 
1. Proper error handling when SMTP missing
2. Dev mode shows reset link directly
3. Production mode returns clear error

**What You Need**:
- Gmail app password (or other SMTP credentials)
- Update backend/.env
- Restart backend

**Time**: ~15 minutes

👉 Start with Step 1 above!

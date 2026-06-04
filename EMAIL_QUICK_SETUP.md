# 📧 Email System - Quick Setup Card

## 🎯 Your Email System is Ready!

All emails now show as from **"UBUMWE RENTAL SYSTEM"** with professional branding.

---

## ⚡ DO THIS NOW (15 minutes)

### 1️⃣ Get Gmail App Password
```
Go to: https://myaccount.google.com/apppasswords
- Select "Mail" → "Windows Computer"  
- Click Generate
- Copy 16-character password
```

### 2️⃣ Update backend/.env
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ishimwesamuel023@gmail.com
SMTP_PASS=<yaeh tjvf paxf ddup>
SMTP_FROM_EMAIL=ishimwesamuel023@gmail.com
SMTP_FROM_NAME=UBUMWE RENTAL SYSTEM
```

### 3️⃣ Test Email
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2  
cd frontend && npm run dev

# Browser: http://localhost:5173 → Register
# ✅ Check your email for verification link (1 minute)
```

---

## 📋 Configuration Fields

| Field | Value | Example |
|-------|-------|---------|
| SMTP_HOST | Gmail SMTP server | `smtp.gmail.com` |
| SMTP_PORT | Port 587 | `587` |
| SMTP_SECURE | false for 587 | `false` |
| SMTP_USER | Your Gmail | `ishimwesamuel023@gmail.com` |
| SMTP_PASS | 16-char app password | `yaeh tjvf paxf ddup` |
| SMTP_FROM_EMAIL | Reply-to email | `ishimwesamuel023@gmail.com` |
| SMTP_FROM_NAME | Display name | `UBUMWE RENTAL SYSTEM` |

**✅ Result**: Emails show from "UBUMWE RENTAL SYSTEM" <ishimwesamuel023@gmail.com>

---

## 🧪 Test Commands

```bash
# Check email configuration
node verify-email.js

# Check all system features  
node verify-system.js
```

---

## 📚 What Works Now

✅ Verification emails (when registering)  
✅ Password reset emails  
✅ Login OTP emails  
✅ Professional HTML templates  
✅ UBUMWE branding  
✅ SMS support (when Twilio configured)  

---

## 📞 If Issues

**Email not arriving?**
1. Check backend console for errors
2. Check spam folder  
3. Read: `EMAIL_SETUP_GUIDE.md`

**Wrong sender name?**
- Make sure `SMTP_FROM_NAME=UBUMWE RENTAL SYSTEM` is in `.env`
- Restart backend after changing `.env`

**Password wrong?**
- Use app password (not regular password)
- Must be from: https://myaccount.google.com/apppasswords
- Should be 16 characters with spaces

---

## 🔄 Other Email Providers

**SendGrid** (Recommended for production):
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=SG.your-api-key
```

**Office365**:
```env
SMTP_HOST=smtp.office365.com
SMTP_USER=your-email@company.com
```

---

## 📊 Files Modified

- ✅ `backend/.env` - Configuration
- ✅ `backend/src/controllers/authController.js` - Email templates & sending
- ✅ `backend/.env.example` - Reference template
- ✅ `backend/.env.production` - Production template

---

## ✅ Next Steps

1. Get Gmail app password
2. Update `backend/.env`
3. Run `node verify-email.js`
4. Test registration on http://localhost:5173
5. Check email inbox for verification link

**Done!** 🎉 Your email system is ready.

For detailed help: `EMAIL_SETUP_GUIDE.md`

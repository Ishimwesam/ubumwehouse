# 🚀 Complete System Setup Guide

This guide covers all optional and required integrations for the Rental Management System.

---

## ✅ What's Already Implemented

The system includes production-ready implementations for:

1. **Email System** (SMTP)
   - Password reset flows
   - Email verification
   - Account recovery with OTP
   - HTML formatted emails

2. **Database**
   - SQLite with 10 normalized tables
   - Automatic migration on startup
   - Default admin user creation

3. **File Upload System**
   - Receipt file storage
   - Support for: JPG, JPEG, PNG, PDF
   - 10MB file size limit
   - Persistent storage

4. **Authentication**
   - JWT token-based auth
   - Rate limiting on login attempts
   - Password validation
   - Session management

---

## 🔐 Security Setup (Required for Production)

### JWT & Session Secrets

Already generated in development, but **MUST change for production**:

```bash
# Generate new secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Location**: `backend/.env.production`

```env
JWT_SECRET=<your-generated-secret>
SESSION_SECRET=<your-generated-secret>
```

---

## 📧 Email Configuration (SMTP)

### Why It's Important
- Password recovery/reset functionality
- Email verification on account creation
- Account activity notifications

### Supported Providers

#### **Gmail (Free)**
1. Enable 2-Factor Authentication
2. Create App Password: https://myaccount.google.com/apppasswords
3. In `backend/.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-digit-app-password
SMTP_FROM=your-email@gmail.com
```

#### **Office365**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@company.com
SMTP_PASS=your-password
SMTP_FROM=your-email@company.com
```

#### **SendGrid**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

#### **Custom SMTP**
Use your own mail server configuration

### Testing Email Configuration

```bash
# After setting up SMTP, trigger a password reset
# The system will send an email to the configured address
```

---

## 🔑 Google OAuth Setup (Optional - Enables Social Login)

### Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Create new project
3. Enable "Google+ API"

### Step 2: Create OAuth Credentials
1. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
2. Application type: "Web application"
3. Add JavaScript origins:
   ```
   http://localhost:5173
   http://localhost:5003
   https://yourdomain.com
   ```
4. Add authorized redirect URI:
   ```
   http://localhost:5003/api/auth/google/callback
   https://yourdomain.com/api/auth/google/callback
   ```

### Step 3: Configure Backend
In `backend/.env`:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 🤖 AI Assistant (Optional - Enhanced Chat)

### Local Mode (Always Works)
- Built-in knowledge base
- System feature help
- Fallback responses

### Full AI Mode (With OpenAI)

#### Step 1: Get OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Add billing method

#### Step 2: Configure Backend
In `backend/.env`:
```env
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

#### Step 3: Usage
- Chat widget automatically uses API key when configured
- Falls back to local mode if not available
- Supports conversation history

---

## 📱 WhatsApp Reminders (Optional - Tenant Notifications)

### Why Use It
- Automated rent reminder notifications
- Configurable reminder days
- Direct tenant communication

### Setup

#### Step 1: Meta WhatsApp Business API
1. Register at https://www.whatsapp.com/business/
2. Get Business Account ID
3. Create App and generate Access Token
4. Verify phone number

#### Step 2: Configure Backend
In `backend/.env`:
```env
WHATSAPP_REMINDERS_ENABLED=false
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_DEFAULT_COUNTRY_CODE=250
WHATSAPP_REMINDER_DAYS_BEFORE=3
WHATSAPP_REMINDER_INTERVAL_HOURS=24
```

#### Step 3: Enable When Ready
Change to: `WHATSAPP_REMINDERS_ENABLED=true` after testing

---

## 🗄️ Database Setup

### Automatic Setup
The system auto-creates everything on first run:
- All 10 tables with schemas
- Default admin user
- Foreign key relationships

### Database Location
```
backend/rental_management.db
```

### Reset Database (Development)
```bash
rm backend/rental_management.db
npm run migrate
```

### Backup Database (Production)
```bash
# Regular backups
cp backend/rental_management.db backend/rental_management.db.backup
```

---

## 🚀 Development Startup

### Backend
```bash
cd backend
npm install
npm run migrate      # Initialize database
npm run dev          # Start development server
```

Server runs on: **http://localhost:5003**

### Frontend
```bash
cd frontend
npm install
npm run dev          # Start dev server
```

App runs on: **http://localhost:5173**

### Verify Everything Works
1. Backend: http://localhost:5003/health
2. Frontend: http://localhost:5173
3. Create account → Check email validation (if SMTP configured)
4. Login → Try all features

---

## 📦 Environment Variables Checklist

### Critical (Must Have)
- ✅ `NODE_ENV`
- ✅ `JWT_SECRET` (must be unique for production)
- ✅ `SESSION_SECRET` (must be unique for production)

### Important (Recommended)
- ⚠️ `SMTP_HOST` - For account recovery
- ⚠️ `SMTP_USER`
- ⚠️ `SMTP_PASS`

### Optional (Nice to Have)
- ❌ `GOOGLE_CLIENT_ID` - Social login
- ❌ `OPENAI_API_KEY` - Enhanced AI
- ❌ `WHATSAPP_ACCESS_TOKEN` - Automated reminders

---

## 🐛 Troubleshooting

### Email Not Sending
```
Check:
1. SMTP_HOST, SMTP_USER, SMTP_PASS are set
2. App password (not regular password) if using Gmail
3. Backend logs for error messages
4. Firewall/network allows port 587 or 465
```

### Google OAuth Not Working
```
Check:
1. Client ID and Secret are correct
2. Redirect URI exactly matches configuration
3. App is trusted in Google Cloud Console
```

### AI Assistant Not Responding
```
Check:
1. OPENAI_API_KEY is set and valid
2. API has active billing
3. Model name is correct (gpt-4o-mini, gpt-4, etc)
4. No rate limiting (check OpenAI dashboard)
```

### WhatsApp Messages Not Sending
```
Check:
1. Access token is valid
2. Phone number ID is correct
3. Phone number is verified in Meta
4. Message recipients have WhatsApp accounts
```

---

## 📚 Additional Resources

- **Email Setup**: https://nodemailer.com/
- **Google OAuth**: https://developers.google.com/identity/protocols/oauth2
- **OpenAI API**: https://platform.openai.com/docs
- **WhatsApp Business**: https://www.whatsapp.com/business/api/

---

## ✨ Next Steps

1. **Development**: Configure SMTP for local testing
2. **Testing**: Create test account and verify all flows
3. **Production**: Generate new secrets, configure all integrations
4. **Monitoring**: Set up error logging and backup routines


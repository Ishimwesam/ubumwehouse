# 🚀 Production Deployment Guide

Complete checklist and instructions for deploying the Rental Management System to production.

---

## 🔐 Security Configuration

### Generate Production Secrets

```bash
# Generate JWT_SECRET (copy the output)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate SESSION_SECRET (copy the output)  
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Store these securely in your `.env.production` file:
```env
JWT_SECRET=<your-generated-secret-here>
SESSION_SECRET=<your-generated-secret-here>
```

### Update Default Admin Credentials

**CRITICAL**: Change immediately after first login!

```env
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=<strong-password-here>
DEFAULT_ADMIN_EMAIL=<your-admin-email>
```

---

## 📧 Production Email Configuration

### Recommended: SendGrid

1. Sign up: https://sendgrid.com/
2. Verify sender email
3. Create API key
4. Configure `.env.production`:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.your-sendgrid-api-key-here
SMTP_FROM=noreply@yourdomain.com
```

### Alternative: AWS SES

```env
SMTP_HOST=email-smtp.region.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com
```

---

## 🌐 Deployment Options

### Option 1: Railway.io (Recommended - Easy)

1. Push code to GitHub
2. Go to https://railway.app
3. Create new project
4. Connect GitHub repository
5. Railway auto-detects Node.js
6. Set environment variables:
   - Copy all from `.env.production`
   - Go to Project Settings → Variables
7. Deploy

Railway will auto-build and deploy!

### Option 2: Render

1. Push code to GitHub
2. Go to https://render.com
3. Create new Web Service
4. Connect GitHub
5. Build command: `npm install && npm run build`
6. Start command: `node backend/src/index.js`
7. Set environment variables
8. Deploy

### Option 3: Heroku

```bash
heroku create your-app-name
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=<your-secret>
# ... set all other env vars
git push heroku main
```

### Option 4: VPS (DigitalOcean, Linode, AWS)

1. SSH into server
2. Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. Clone repository:
```bash
git clone your-repo.git
cd gad
```

4. Setup environment:
```bash
cd backend
npm install
# Create .env.production with all variables
# Create .env -> .env.production (for production)
```

5. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start src/index.js --name "rental-api" --env production
pm2 startup
pm2 save
```

6. Setup Nginx as reverse proxy:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔒 SSL/HTTPS Configuration

### Using Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d yourdomain.com

# Nginx will auto-update to use SSL
sudo certbot renew --dry-run  # Test auto-renewal
```

---

## 📊 Database Backup Strategy

### Automated Daily Backups

```bash
#!/bin/bash
# Create backup
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
cp /path/to/rental_management.db $BACKUP_DIR/rental_management_$DATE.db

# Keep only last 30 days
find $BACKUP_DIR -mtime +30 -delete
```

### Backup to Cloud Storage

```bash
# With AWS S3
aws s3 cp rental_management.db s3://your-bucket/backups/rental_$(date +%Y%m%d).db

# With Google Cloud Storage
gsutil cp rental_management.db gs://your-bucket/backups/rental_$(date +%Y%m%d).db
```

---

## 🚀 Pre-Deployment Checklist

```
SECURITY
[ ] JWT_SECRET changed and 64+ characters
[ ] SESSION_SECRET changed and 64+ characters
[ ] Admin password changed from default
[ ] No secrets in source code
[ ] NODE_ENV=production

EMAIL/COMMUNICATIONS
[ ] SMTP configured for production provider
[ ] From email verified with provider
[ ] Test email sending works
[ ] Password reset tested

INTEGRATIONS (if enabled)
[ ] Google OAuth: Redirect URI updated for production
[ ] OpenAI: API key valid and billing active
[ ] WhatsApp: Phone number verified in Meta

DATABASE
[ ] Backup strategy in place
[ ] Database path writable by app
[ ] Regular backup schedule configured

FILE UPLOADS
[ ] Upload directory exists and is writable
[ ] Upload directory on persistent storage (not ephemeral)

PERFORMANCE
[ ] Rate limiting enabled
[ ] CORS properly configured for your domain
[ ] SSL/HTTPS enabled
[ ] Compression enabled

MONITORING
[ ] Error logging configured
[ ] Uptime monitoring enabled
[ ] Database backup verification
```

---

## 🔍 Post-Deployment Testing

### Health Check
```bash
curl https://yourdomain.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Backend is running",
  "uptime": 12345,
  "checked_at": "2024-01-01T12:00:00Z"
}
```

### Authentication Test
1. Register new account
2. Verify email (check inbox)
3. Login with credentials
4. Change password

### Features Test
1. Create building
2. Add unit
3. Add tenant
4. Record payment
5. Generate report

### Email Test
1. Request password reset
2. Check email received
3. Reset password successfully

---

## 📈 Production Monitoring

### Monitor These Metrics

- **Uptime**: Should be 99.9%+
- **Response Time**: < 500ms
- **Error Rate**: < 1%
- **Database Size**: Grow naturally, backup regularly
- **Disk Usage**: Alert if > 80%

### Setup Monitoring

```bash
# Using PM2 Plus (free tier available)
pm2 plus

# Using Datadog
# Using New Relic
# Using Sentry (for errors)
```

---

## 🔄 Rollback Plan

If something breaks in production:

1. **Immediate**: Switch to previous version
2. **Database**: Restore from backup
3. **Testing**: Test on staging before re-deploying

```bash
# Rollback on Railway: Just click "Deploy" on previous commit
# Rollback on Render: Select previous deployment
# Rollback on Heroku: heroku releases and heroku rollback
# Rollback on VPS: git checkout previous tag, restart PM2
```

---

## 📱 Mobile Compatibility

The frontend is fully responsive. Test on:
- iPhone (Safari)
- Android (Chrome)
- Tablets

No additional configuration needed.

---

## 📞 Important Contacts

- **SendGrid Support**: support@sendgrid.com
- **Google Support**: cloud.google.com/contact
- **OpenAI Support**: help.openai.com
- **Railway Support**: railway.app/support

---

## 🎉 Deployment Success!

After deployment, you should see:
- ✅ Frontend loads at yourdomain.com
- ✅ Login works with email/password
- ✅ Optional: Google OAuth sign-in
- ✅ Password reset emails sent
- ✅ All CRUD operations work
- ✅ Reports generate correctly
- ✅ File uploads work
- ✅ Optional: Chat responds with AI

---

## 📚 Additional Resources

- Node.js Best Practices: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
- Security Checklist: https://owasp.org/Top10/
- SSL Configuration: https://certbot.eff.org/
- Database Backups: https://www.sqlite.org/backup.html


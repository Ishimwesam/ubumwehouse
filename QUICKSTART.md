# 🚀 Quick Start Guide

Follow these steps to get your Rental Management System up and running.

## Prerequisites
- Node.js v14+ installed
- npm or yarn package manager
- Terminal/Command Prompt access

## Step 1: Backend Setup

### 1.1 Navigate to backend directory
```bash
cd backend
```

### 1.2 Install dependencies
```bash
npm install
```

### 1.3 Set up environment
Copy `.env.example` to `.env` (already done):
```bash
# The .env file is already configured with defaults
# For production, update JWT_SECRET and other sensitive values
```

### 1.4 Initialize database
```bash
npm run migrate
```

This creates the SQLite database and all required tables.

### 1.5 Start backend server
```bash
npm run dev
```

You should see: `✅ Server running on http://localhost:5001`

## Step 2: Frontend Setup

### 2.1 Open new terminal and navigate to frontend
```bash
cd frontend
```

### 2.2 Install dependencies
```bash
npm install
```

### 2.3 Start development server
```bash
npm run dev
```

You should see: `➜  Local:   http://localhost:3000`

## Step 3: Access the Application

Open your browser and go to: **http://localhost:3000**

## Step 4: Create Your First Account

### 4.1 Click "Register here" link
### 4.2 Fill in registration form:
- **Full Name**: Your Name
- **Username**: admin
- **Email**: admin@example.com
- **Password**: password123
- **Confirm Password**: password123

### 4.3 Click Register

You'll be automatically logged in and redirected to the Dashboard.

## Step 5: Start Using the System

### Create a Building
1. Click "🏢 Buildings" in sidebar
2. Click "+ Add Building"
3. Enter building details (name, address, city, country)
4. Click "Create Building"

### Add Units/Rooms
1. Click "🚪 Units / Rooms" in sidebar
2. Click "+ Add Unit"
3. Select the building you created
4. Enter unit number (e.g., "Shop A-101")
5. Choose unit type (shop, office, apartment, etc.)
6. Set monthly rent
7. Click "Create Unit"

### Register Tenants
1. Click "👤 Tenants" in sidebar
2. Click "+ Add Tenant"
3. Fill in tenant details
4. Select a unit to assign
5. Click "Create Tenant"

### Record Payments
1. Click "💰 Payments" in sidebar
2. Click "+ Record Payment"
3. Select tenant
4. Enter payment amount and date
5. Choose payment method
6. (Optional) Upload receipt
7. Click "Record Payment"

### View Reports
1. Click "📊 Reports" in sidebar
2. View occupancy, income, and unpaid tenants reports

### Manage Profile
1. Click "⚙️ Settings" in sidebar
2. Update your profile information
3. Change your password
4. View account details

## Common Issues & Solutions

### Backend won't start
```bash
# Check if port 5001 is in use
lsof -ti:5001 | xargs kill -9
npm run dev
```

### Frontend won't start
```bash
# Check if port 3000 is in use
lsof -ti:3000 | xargs kill -9
npm run dev
```

### Database errors
```bash
# Reset database
cd backend
rm rental_management.db
npm run migrate
```

### CORS errors
Ensure backend is running on port 5001 and frontend on port 3000.

### File upload not working
- Check that `backend/src/uploads/` directory exists
- Verify file size is under 10MB
- Ensure file type is: jpg, jpeg, png, or pdf

## API Health Check

Open your browser and visit:
```
http://localhost:5001/health
```

You should see: `{"status":"Backend is running"}`

## Next Steps

1. ✅ Backend running on http://localhost:5001
2. ✅ Frontend running on http://localhost:3000
3. ✅ Account created and logged in
4. ✅ Buildings and units created
5. ✅ Tenants registered
6. ✅ Payments recorded

You're all set! Enjoy using the Rental Management System.

## Getting Help

- Check the main README.md for API documentation
- Review error messages in browser console
- Check backend terminal for server errors
- Verify environment variables in .env file

---

**Need more help? Check the full documentation in README.md**

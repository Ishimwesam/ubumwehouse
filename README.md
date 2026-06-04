# 🏠 Rental Management System

A full-stack web application for managing rental properties, tenants, payments, and financial reporting with advanced analytics and real-time income tracking.

## ✨ What's New (Latest Update)

### 💳 Enhanced Payment Module (Restructured)
- **Make Payment** - Record new payments with receipt upload
- **Confirm Payment** - Verify pending payments with receipt verification
- **Payment History** - View complete transaction records per tenant
- **Pending Payments** - Focused view of unconfirmed payments
- **Reports Hub** - Quick access to all analytics

### 📊 Advanced Reports Dashboard
- **Overview** - 6 key metrics at a glance
- **Income Analysis** - Monthly breakdown with targets
- **Unpaid Tenants** - Delinquency list with risk levels
- **Building Performance** - Per-building analytics
- **Trends** - Profit growth and payment patterns
- **PDF Export** - Download reports in PDF format

### 📈 Daily Income Summary
- Real-time income tracking
- Daily progress toward targets
- Monthly forecasting
- Auto-refresh every 5 minutes
- Real-time transaction list

### 👥 Payment History Per Tenant
- Searchable tenant list
- Complete payment history
- Filter by status
- Sort by date or amount
- Perfect for dispute resolution

### ✓ Manual Payment Confirmation
- Receipt image upload
- Confirmation notes
- Bulk confirmation capability
- Status tracking

### 🎨 Modern UI/UX Enhancement
- Professional color scheme with gradients
- Enhanced component styling
- Smooth animations and transitions
- Responsive design (mobile, tablet, desktop)
- Professional toast notifications
- Status badges and visual indicators

## 📋 Core Features

### 🏠 Dashboard
- Overview of tenants, units, and income
- Recent payment activity
- Quick statistics

### 👤 Tenant Management
- Add, edit, and delete tenants
- Track tenant details (email, phone, national ID)
- Assign tenants to units
- Monitor tenant status

### 🏢 Buildings Management
- Manage multiple buildings
- Track building locations
- Organize units within buildings

### 🚪 Units/Rooms Management
- Add units to buildings
- Track unit types (shops, offices, apartments)
- Set monthly rent
- Monitor occupancy status

### 💰 Payment Management
- Record rent payments
- Upload payment receipts
- Track payment methods
- Automatic balance calculation

### 📊 Reports & Analytics
- Monthly income reports
- Building occupancy rates
- Unpaid tenants list
- Financial summaries

### ⚙️ Settings
- User profile management
- Password management
- Account settings

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite** - Database
- **JWT** - Authentication
- **Multer** - File uploads

### Frontend
- **React 18** - UI framework
- **React Router** - Navigation
- **Axios** - HTTP client
- **Vite** - Build tool

## 📦 Project Structure

```
gad/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Business logic
│   │   ├── middleware/      # Authentication, uploads
│   │   ├── routes/          # API endpoints
│   │   ├── uploads/         # Receipt storage
│   │   └── index.js         # Server entry point
│   ├── config/
│   │   ├── database.js      # Database connection
│   │   └── migrate.js       # Database setup
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── services/        # API calls
│   │   ├── context/         # Auth context
│   │   ├── styles/          # CSS files
│   │   ├── App.jsx          # Main app
│   │   └── main.jsx         # Entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── docs/
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create database tables
npm run migrate

# Start server
npm run dev
# or
npm start
```

Server will run on `http://localhost:5001`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will run on `http://localhost:3000`

## 🔐 Authentication

### Register New User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "admin",
  "email": "admin@example.com",
  "password": "password123",
  "full_name": "John Doe"
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

Response includes JWT token for authenticated requests.

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Buildings
- `GET /api/buildings` - Get all buildings
- `GET /api/buildings/:id` - Get building by ID
- `POST /api/buildings` - Create building
- `PUT /api/buildings/:id` - Update building
- `DELETE /api/buildings/:id` - Delete building

### Units
- `GET /api/units` - Get all units
- `GET /api/units/:id` - Get unit by ID
- `GET /api/units/building/:buildingId` - Get units by building
- `POST /api/units` - Create unit
- `PUT /api/units/:id` - Update unit
- `DELETE /api/units/:id` - Delete unit

### Tenants
- `GET /api/tenants` - Get all tenants
- `GET /api/tenants/:id` - Get tenant by ID
- `POST /api/tenants` - Create tenant
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Delete tenant

### Payments
- `GET /api/payments` - Get all payments
- `GET /api/payments/:id` - Get payment by ID
- `GET /api/payments/tenant/:tenantId` - Get tenant payments
- `POST /api/payments` - Create payment (with receipt upload)
- `PUT /api/payments/:id` - Update payment
- `DELETE /api/payments/:id` - Delete payment

### Dashboard
- `GET /api/dashboard/summary` - Get dashboard summary
- `GET /api/dashboard/monthly-income` - Get monthly income
- `GET /api/dashboard/unpaid-tenants` - Get unpaid tenants
- `GET /api/dashboard/occupancy` - Get occupancy report

## 💾 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password TEXT,
  full_name TEXT,
  created_at DATETIME,
  updated_at DATETIME
)
```

### Buildings Table
```sql
CREATE TABLE buildings (
  id TEXT PRIMARY KEY,
  name TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  created_at DATETIME,
  updated_at DATETIME
)
```

### Units Table
```sql
CREATE TABLE units (
  id TEXT PRIMARY KEY,
  building_id TEXT,
  unit_number TEXT,
  unit_type TEXT,
  monthly_rent DECIMAL,
  status TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (building_id) REFERENCES buildings(id)
)
```

### Tenants Table
```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  national_id TEXT,
  unit_id TEXT,
  move_in_date DATE,
  move_out_date DATE,
  status TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (unit_id) REFERENCES units(id)
)
```

### Payments Table
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  unit_id TEXT,
  amount DECIMAL,
  payment_date DATE,
  payment_method TEXT,
  receipt_path TEXT,
  notes TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
)
```

### Balances Table
```sql
CREATE TABLE balances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  unit_id TEXT,
  total_owed DECIMAL,
  total_paid DECIMAL,
  balance DECIMAL,
  last_updated DATETIME,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
)
```

## 🔑 Environment Variables

### Backend (.env)
```
PORT=5001
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_change_this_in_production
JWT_EXPIRE=7d
UPLOAD_DIR=./src/uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf
```

### Frontend (vite.config.js proxy)
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:5001',
    changeOrigin: true,
  }
}
```

## 📝 Usage Examples

### 1. Create a Building
```javascript
const response = await fetch('http://localhost:5001/api/buildings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    name: 'Ubumwe Complex',
    address: '123 Main Street',
    city: 'Kigali',
    country: 'Rwanda'
  })
});
```

### 2. Add a Unit
```javascript
const response = await fetch('http://localhost:5001/api/units', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    building_id: 'building_id_here',
    unit_number: 'Shop A-101',
    unit_type: 'shop',
    monthly_rent: 500
  })
});
```

### 3. Record a Payment with Receipt
```javascript
const formData = new FormData();
formData.append('tenant_id', 'tenant_id');
formData.append('unit_id', 'unit_id');
formData.append('amount', 500);
formData.append('payment_date', '2024-04-16');
formData.append('payment_method', 'bank_transfer');
formData.append('receipt', fileInput.files[0]);

const response = await fetch('http://localhost:5001/api/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5001
lsof -ti:5001 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database Issues
```bash
# Reset database
rm rental_management.db
npm run migrate
```

### CORS Issues
Ensure backend has CORS enabled in `src/index.js`:
```javascript
app.use(cors());
```

### File Upload Not Working
- Check uploads directory exists: `backend/src/uploads/`
- Verify file size doesn't exceed MAX_FILE_SIZE
- Check allowed file types in .env

## 📚 Documentation

### Quick Start Guides
The system includes comprehensive documentation for all features:

- **[DOCS_INDEX.md](DOCS_INDEX.md)** - Documentation index (start here!)
- **[QUICK_START.md](QUICK_START.md)** - Quick reference guide
- **[NAVIGATION_MAP.md](NAVIGATION_MAP.md)** - Visual navigation guide
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - Detailed feature documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture & design
- **[FEATURE_MATRIX.md](FEATURE_MATRIX.md)** - Complete feature matrix
- **[VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md)** - QA & deployment checklist
- **[SYSTEM_SUMMARY.md](SYSTEM_SUMMARY.md)** - Complete system overview

### API Documentation
For detailed API documentation, visit:
- Backend: `http://localhost:5001/health`
- Frontend: `http://localhost:3000`

### Key Features Documentation
- **Payment Module** - See [QUICK_START.md](QUICK_START.md#recording-a-payment)
- **Reports & Analytics** - See [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md#advanced-reports-dashboard)
- **Daily Income Tracking** - See [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md#daily-income-summary)
- **Navigation Guide** - See [NAVIGATION_MAP.md](NAVIGATION_MAP.md#main-navigation-menu)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under MIT License.

## 📞 Support

For support, please open an issue or contact the development team.

---

**Built with ❤️ for efficient rental management**

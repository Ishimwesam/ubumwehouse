# 🗺️ System Navigation Map

## Application Structure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    POS/Property Management System               │
│                       (RMS - Rental Management)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
            ┌──────▼─────┐      ┌──────▼──────┐
            │   Sidebar   │      │ Main Content │
            │ Navigation  │      │    Area      │
            └────────────┘      └─────────────┘
```

---

## Main Navigation Menu

```
🏠 HOME
├─ Dashboard (overview of system)
└─ All property stats

👤 TENANTS
├─ Tenant list
├─ Tenant details
├─ Tenant payments
└─ Tenant contact info

🏢 BUILDINGS
├─ Building list
├─ Building details
├─ Unit assignment
└─ Building analytics

🚪 UNITS/ROOMS
├─ Unit list
├─ Unit details
├─ Occupancy status
└─ Unit assignment to tenants

💰 PAYMENTS (NEW - RESTRUCTURED)
│
├─ ➕ MAKE PAYMENT
│  ├─ Record new payment
│  ├─ Tenant selection
│  ├─ Amount entry
│  ├─ Method selection
│  ├─ Receipt upload
│  └─ Save as pending
│
├─ ✓ CONFIRM PAYMENT
│  ├─ View pending list
│  ├─ Receipt upload
│  ├─ Confirmation notes
│  ├─ Bulk confirm
│  └─ Status update
│
├─ 📋 PAYMENT HISTORY
│  ├─ Confirmed payments
│  ├─ Complete records
│  ├─ Edit options
│  └─ Delete options
│
├─ ⏳ PENDING PAYMENTS
│  ├─ Unconfirmed view
│  ├─ Quick actions
│  └─ Status tracking
│
└─ 📊 REPORTS
   ├─ Advanced Analytics
   ├─ Tenant History
   ├─ Daily Summary
   └─ Confirmation Queue

📅 CALENDAR EVENTS
├─ Event list
├─ Event details
├─ Add events
└─ Calendar view

📊 REPORTS & ANALYTICS (NEW)
│
├─ 📊 STANDARD REPORTS
│  ├─ Basic reports view
│  └─ Data export
│
└─ 📈 ADVANCED ANALYTICS
   ├─ OVERVIEW TAB
   │  ├─ Key metrics (6 cards)
   │  ├─ Income summary
   │  ├─ Collection status
   │  └─ Quick stats
   │
   ├─ INCOME TAB
   │  ├─ Monthly breakdown
   │  ├─ Actual vs Expected
   │  ├─ Differences
   │  └─ Collection %
   │
   ├─ UNPAID TENANTS TAB
   │  ├─ Delinquent list
   │  ├─ Contact info
   │  ├─ Outstanding amount
   │  ├─ Months overdue
   │  └─ Risk level
   │
   ├─ BUILDING PERFORMANCE TAB
   │  ├─ Per-building stats
   │  ├─ Income by building
   │  ├─ Collection rate
   │  ├─ Occupancy %
   │  └─ Performance badges
   │
   ├─ TRENDS TAB
   │  ├─ Profit trends
   │  ├─ Monthly growth
   │  ├─ Delayed tenants
   │  └─ Risk assessment
   │
   └─ PDF EXPORT
      └─ Download report

⚙️ SETTINGS
├─ User settings
├─ Preferences
└─ System configuration
```

---

## User Workflows

### Workflow 1: Recording and Confirming a Payment

```
Start
  │
  ├─→ Click "Payments"
  │    │
  │    ├─→ Select "Make Payment" tab
  │    │    │
  │    │    ├─→ Select Tenant
  │    │    ├─→ Enter Amount
  │    │    ├─→ Choose Period
  │    │    ├─→ Set Date
  │    │    ├─→ Select Method
  │    │    ├─→ (Optional) Upload Receipt
  │    │    ├─→ (Optional) Add Notes
  │    │    └─→ Click "Save as Pending"
  │    │        └─→ Toast: "✓ Payment saved as pending"
  │    │
  │    └─→ Status: Payment is PENDING
  │         (waiting for confirmation)
  │
  └─→ Later: Click "Confirm Payment" tab
       │
       ├─→ View pending payment
       ├─→ Click "Confirm & Upload Receipt"
       │   │
       │   ├─→ Modal opens
       │   ├─→ Upload receipt image
       │   ├─→ Add confirmation notes
       │   └─→ Click "Confirm Payment"
       │       └─→ Toast: "✓ Payment confirmed"
       │
       └─→ Status: Payment is CONFIRMED
            (recorded in history)

End
```

### Workflow 2: Viewing Tenant Payment History

```
Start
  │
  ├─→ Click "Payments"
  │    │
  │    └─→ Select "Payment History" tab
  │         │
  │         ├─→ Left Panel: Tenant Selector
  │         │   │
  │         │   ├─→ Search tenant by name/phone
  │         │   └─→ Click tenant to select
  │         │
  │         └─→ Right Panel: Payment Details
  │             │
  │             ├─→ View tenant info
  │             ├─→ See summary stats
  │             │   ├─ Total paid
  │             │   ├─ Confirmed count
  │             │   ├─ Pending count
  │             │   └─ Total transactions
  │             │
  │             ├─→ Filter payments
  │             │   ├─ All
  │             │   ├─ Confirmed
  │             │   └─ Pending
  │             │
  │             ├─→ Sort payments
  │             │   ├─ Date (newest first)
  │             │   ├─ Date (oldest first)
  │             │   ├─ Amount (high to low)
  │             │   └─ Amount (low to high)
  │             │
  │             └─→ View complete history table
  │                 └─ All payment records

End
```

### Workflow 3: Daily Income Tracking

```
Start
  │
  ├─→ Click "Payments"
  │    │
  │    └─→ Select "Daily Summary" tab
  │         │
  │         ├─→ View Large Summary Cards
  │         │   ├─ Today's Income
  │         │   │  ├─ Amount collected
  │         │   │  ├─ Daily target
  │         │   │  └─ Progress bar
  │         │   │
  │         │   ├─ This Month
  │         │   │  ├─ Monthly total
  │         │   │  ├─ Expected amount
  │         │   │  └─ Days remaining
  │         │   │
  │         │   ├─ Total Collected
  │         │   │  └─ All-time total
  │         │   │
  │         │   └─ Outstanding
  │         │      └─ Unpaid balance
  │         │
  │         ├─→ View Quick Metrics (4 cards)
  │         │   ├─ Days in month
  │         │   ├─ Days remaining
  │         │   ├─ Daily target
  │         │   └─ Progress rate
  │         │
  │         ├─→ View Today's Transactions
  │         │   └─ Real-time payment list
  │         │
  │         └─→ View Income Analysis
  │             ├─ Status (good/needs attention)
  │             ├─ Amount needed for target
  │             └─ Monthly forecast

End
(Auto-refreshes every 5 minutes)
```

### Workflow 4: Analyzing Business Performance

```
Start
  │
  ├─→ Click "Reports & Analytics"
  │    │
  │    └─→ Select "Advanced Analytics"
  │         │
  │         ├─→ OVERVIEW Tab
  │         │   └─ 6 key metric cards
  │         │
  │         ├─→ INCOME Tab
  │         │   └─ Monthly breakdown table
  │         │
  │         ├─→ UNPAID TENANTS Tab
  │         │   └─ Delinquent list with risk levels
  │         │
  │         ├─→ BUILDING PERFORMANCE Tab
  │         │   └─ Per-building analytics
  │         │
  │         ├─→ TRENDS Tab
  │         │   ├─ Profit trends
  │         │   └─ Delayed tenant analysis
  │         │
  │         └─→ Export Data
  │             └─ Download as PDF

End
```

### Workflow 5: Confirming Multiple Pending Payments

```
Start
  │
  ├─→ Click "Payments"
  │    │
  │    └─→ Select "Confirm Payment" tab
  │         │
  │         ├─→ View payment cards grid
  │         │   │
  │         │   ├─→ Check checkbox on card 1
  │         │   ├─→ Check checkbox on card 2
  │         │   ├─→ Check checkbox on card 3
  │         │   │
  │         │   └─→ Status updates:
  │         │       ├─ "3 Payments Selected"
  │         │       └─ "Total: XX amount"
  │         │
  │         ├─→ Click "Confirm All Selected"
  │         │   │
  │         │   ├─→ Modal for first payment
  │         │   │   ├─ Upload receipt
  │         │   │   ├─ Add notes
  │         │   │   └─ Confirm
  │         │   │
  │         │   ├─→ Modal for second payment
  │         │   │   ├─ Upload receipt
  │         │   │   ├─ Add notes
  │         │   │   └─ Confirm
  │         │   │
  │         │   ├─→ Modal for third payment
  │         │   │   ├─ Upload receipt
  │         │   │   ├─ Add notes
  │         │   │   └─ Confirm
  │         │   │
  │         │   └─→ Toast: "✓ 3 payments confirmed"
  │         │
  │         └─→ List auto-refreshes
  │             └─ Confirmed payments removed

End
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │            Components / Pages                          │   │
│  │                                                        │   │
│  │  • PaymentsEnhanced.jsx                              │   │
│  │  • AdvancedReports.jsx                               │   │
│  │  • PaymentHistoryPerTenant.jsx                       │   │
│  │  • ManualPaymentConfirmation.jsx                     │   │
│  │  • DailyIncomeSummary.jsx                            │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                          │                                     │
│                          ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │            API Service Layer (Axios)                   │   │
│  │                                                        │   │
│  │  • paymentService                                    │   │
│  │  • dashboardService                                 │   │
│  │  • tenantService                                    │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP Requests
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Express.js)                       │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Route Handlers                            │   │
│  │                                                        │   │
│  │  • paymentRoutes.js                                  │   │
│  │  • dashboardRoutes.js                                │   │
│  │  • buildingRoutes.js                                 │   │
│  │  • tenantRoutes.js                                   │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                          │                                     │
│                          ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │            Controllers / Business Logic                │   │
│  │                                                        │   │
│  │  • paymentController.js                              │   │
│  │  • dashboardController.js                            │   │
│  │  • tenantController.js                               │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                          │                                     │
│                          ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Data Layer (SQLite)                       │   │
│  │                                                        │   │
│  │  • payments table                                    │   │
│  │  • tenants table                                     │   │
│  │  • buildings table                                   │   │
│  │  • units table                                       │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Management Flow

```
┌─────────────────────────────────────┐
│    User Interaction (UI)            │
│   Click button, submit form         │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│    React Component State            │
│   Component local state updates     │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│    API Service Call                 │
│   Axios HTTP request sent           │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│    Backend Processing               │
│   Data validation & storage         │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│    Response to Frontend             │
│   JSON response with updated data   │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│    Toast Notification               │
│   Success/Error message shown       │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│    Component Re-render              │
│   Updated UI displayed              │
└─────────────────────────────────────┘
```

---

## Feature Location Map

| Feature | Location | Component |
|---------|----------|-----------|
| Record Payment | Payments → Make Payment | PaymentsEnhanced |
| Confirm Payment | Payments → Confirm Payment | PaymentsEnhanced |
| View History | Payments → Payment History | PaymentHistoryPerTenant |
| Pending View | Payments → Pending Payments | PaymentsEnhanced |
| Income Overview | Reports & Analytics → Advanced → Overview | AdvancedReports |
| Monthly Income | Reports & Analytics → Advanced → Income | AdvancedReports |
| Unpaid Tenants | Reports & Analytics → Advanced → Unpaid | AdvancedReports |
| Building Stats | Reports & Analytics → Advanced → Buildings | AdvancedReports |
| Trends | Reports & Analytics → Advanced → Trends | AdvancedReports |
| Daily Tracking | Payments → Daily Summary | DailyIncomeSummary |
| Manual Confirm | Payments → Confirm Payment | ManualPaymentConfirmation |

---

## Key Entry Points

### For Property Managers
1. Start at **Dashboard** for daily overview
2. Check **Daily Summary** for income tracking
3. Record payments in **Make Payment**
4. Confirm pending in **Confirm Payment**
5. Run **Advanced Reports** for analysis

### For Admin/Finance
1. Access **Advanced Reports** for detailed analytics
2. Review **Unpaid Tenants** for collections
3. Check **Building Performance** for per-unit analysis
4. View **Payment History per Tenant** for disputes
5. Monitor **Trends** for business insights

### For Operations
1. Check **Dashboard** for system status
2. Manage **Tenants** and **Units**
3. View **Calendar** for events
4. Check **Settings** for configuration

---

## Quick Access Guide

| Task | Navigate to | Tab/Option |
|------|------------|-----------|
| Record a payment | Payments | Make Payment |
| Confirm a payment | Payments | Confirm Payment |
| View tenant payments | Payment History | Search tenant |
| Check daily income | Daily Summary | - |
| See top unpaid | Advanced Reports | Unpaid Tenants |
| Building comparison | Advanced Reports | Building Performance |
| Income trends | Advanced Reports | Trends |
| Edit payment | Confirm Payment | Edit button |
| Delete payment | Payment History | Delete button |
| Export report | Advanced Reports | Export button |

---

## Navigation Tips

✅ **Use Sidebar** for main navigation
✅ **Use Tabs** within pages for organization
✅ **Use Search** for finding tenants
✅ **Use Filter/Sort** for organizing data
✅ **Use Breadcrumbs** (if available) for location
✅ **Use Back Button** to return to previous state
✅ **Check Toast Notifications** for confirmation
✅ **Use Refresh Button** to reload latest data

---

## Error Recovery Path

```
Error Occurs
    │
    ├─→ Check Toast Message
    │    ├─ Connection error?
    │    ├─ Validation error?
    │    └─ Permission error?
    │
    ├─→ Click "Retry" (if available)
    │
    ├─→ Check Internet Connection
    │
    ├─→ Refresh Page (Ctrl+R)
    │
    └─→ Contact Administrator

Success
    │
    └─→ Continue with task
```

---

## System is Ready! 🚀

The navigation structure is now complete and optimized for efficient workflow management and financial analysis.


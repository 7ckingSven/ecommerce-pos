# Triple E & Fiel Collins General Merchandise
### Web-Based E-Commerce & Point of Sale Management System + Mobile App

A capstone project built for **Triple E and Fiel Collins General Merchandise** — a unified platform combining a web-based POS system for staff and a React Native mobile app for customers, powered by Flask and Supabase.

---

## Project Overview

This system serves three types of users:

- **Admin (Web — Desktop)** — Access the system through a web browser on desktop with full control over products, discounts, users, reports, and audit trail.
- **Staff (Web — Desktop)** — Access the system through a web browser on desktop to manage POS, inventory (including branch transfers), discounts, products, users, and sales reports.
- **Customers (Mobile — Android)** — Customers use a React Native Android app to browse products, place orders, manage their cart, and view order history.

A single unified login handles all users. Admin and Staff credentials trigger an additional access code verification before redirecting to their respective dashboard.

---

## Features

### Customer (Mobile App)
- Browse and search product catalog
- Filter products by category
- Add to cart and checkout
- View order history
- User registration

### Admin (Web System)
- **Product Management** — Add, edit, delete products and manage product catalog
- **Inventory Management** — Track stock levels with branch identification (source branch and receiving branch)
- **Discount Management** — Create and manage product discounts
- **User Management** — Manage Admin and Staff user accounts
- **Sales Report** — View and analyze sales data and trends

### Staff (Web System)
- **POS (Sales Management)** — Process customer checkout and manage sales transactions
- **Inventory Management** — View stock levels, manage branch transfers with source/destination tracking
- **Product Management** — View product catalog and stock information
- **Discount Management** — View and apply active discounts
- **User Management** — View and manage staff accounts
- **Sales Report** — View sales summary and transaction history

### System-Wide
- Unified login for all users (customers + admin/staff)
- Admin and Staff access code verification modal
- Role-based dashboard routing
- Supabase PostgreSQL database with Row Level Security (RLS)
- CORS-enabled Flask API for mobile

---

## Tech Stack

| Layer | Technology |
|---|---|
| IDE | Visual Studio Code |
| Backend | Flask (Python 3.11) + flask-cors |
| Web Frontend | HTML + CSS + JavaScript + Jinja2 |
| Mobile Frontend | React Native 0.85 (Android) |
| Database | Supabase (PostgreSQL) |
| Mobile Icons | React Native Vector Icons (Feather) |
| Mobile Navigation | React Navigation v6 (Bottom Tabs + Stack) |
| Version Control | GitHub |
| Containerization | Docker |
| Deployment | Render |

---

## Project Structure

```
ecommerce-pos/
│
├── backend/                          ← Flask web system (Admin & Staff)
│   ├── static/
│   │   ├── css/
│   │   │   ├── style.css             ← main stylesheet (dark green theme)
│   │   │   ├── index.css             ← public product showcase styles
│   │   │   ├── landing.css           ← landing page styles
│   │   │   ├── register.css          ← registration page styles
│   │   │   ├── admin.css             ← admin dashboard styles
│   │   │   └── staff.css             ← staff dashboard styles
│   │   ├── js/
│   │   │   ├── login.js              ← unified login: eye toggle, modals
│   │   │   ├── register.js           ← 3-step registration flow
│   │   │   ├── index.js              ← public showcase interactions
│   │   │   ├── admin.js              ← admin dashboard functionality
│   │   │   └── staff.js              ← staff dashboard functionality
│   │   └── img/
│   │       └── favicon.png           ← TE logo (also used as mobile app icon)
│   │
│   ├── templates/
│   │   ├── base.html                 ← base template
│   │   ├── landing.html              ← public landing page (APK download + Staff Login)
│   │   ├── index.html                ← public product showcase (/home)
│   │   ├── login.html                ← unified login (customers + staff)
│   │   ├── register.html             ← 3-step customer registration
│   │   ├── admin/
│   │   │   └── dashboard.html        ← admin dashboard
│   │   └── staff/
│   │       └── dashboard.html        ← staff dashboard
│   │
│   ├── venv/                         ← Python virtual environment (not committed)
│   ├── app.py                        ← Flask routes + mobile API endpoints
│   ├── vercel.json                   ← Vercel deployment config
│   ├── Dockerfile                    ← Docker container config
│   ├── .env                          ← environment variables (not committed)
│   └── requirements.txt
│
├── mobile/                           ← React Native mobile app (Customer)
│   ├── src/
│   │   ├── assets/
│   │   │   └── logo.png              ← TE logo for login screen
│   │   ├── navigation/
│   │   │   └── AppNavigator.js       ← stack + bottom tab navigation
│   │   ├── screens/
│   │   │   ├── LoginScreen.js        ← unified login with Feather icons
│   │   │   ├── RegisterScreen.js     ← 3-step registration
│   │   │   ├── HomeScreen.js         ← product grid with search + categories
│   │   │   ├── ProductDetailScreen.js ← product details
│   │   │   ├── CartScreen.js         ← shopping cart
│   │   │   ├── CheckOutScreen.js     ← checkout process
│   │   │   ├── OrdersScreen.js       ← order history
│   │   │   └── ProfileScreen.js      ← user profile
│   │   ├── services/
│   │   │   ├── api.js                ← axios instance (base URL config)
│   │   │   ├── authService.js        ← login, register, logout
│   │   │   ├── productService.js     ← product and catalog API calls
│   │   │   ├── cartService.js        ← cart management
│   │   │   └── orderService.js       ← order management
│   │   └── utils/
│   │       └── constants.js          ← colors, spacing, typography, API URL
│   ├── android/                      ← Android build files
│   ├── ios/                          ← iOS build files
│   ├── App.tsx                       ← app entry point
│   ├── package.json
│   ├── app.json
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── tsconfig.json
│   ├── jest.config.js
│   ├── index.js
│   ├── app.js
│   ├── Gemfile
│   └── __tests__/
│       └── App.test.tsx
│
├── .gitignore
└── README.md
```

---

## Routes

### Web Routes (Flask)

| URL | Template | Access |
|---|---|---|
| `/` | `landing.html` | Public — landing page |
| `/home` | `index.html` | Public — product showcase |
| `/login` | `login.html` | All users (unified) |
| `/register` | `register.html` | Anyone |
| `/forgot-password` | `forgot_password.html` | Public — request OTP via email |
| `/verify-otp` | `verify_otp.html` | Public — enter OTP and reset password |
| `/verify-staff-code` | — | Staff (POST — access code check) |
| `/admin/dashboard` | `admin/dashboard.html` | Admin only |
| `/staff/dashboard` | `staff/dashboard.html` | Staff only |
| `/logout` | — | All users |

### Mobile API Routes (Flask)

| URL | Method | Description |
|---|---|---|
| `/api/login` | POST | Customer login |
| `/api/register` | POST | Customer registration |
| `/api/forgot-password` | POST | Request OTP for password reset (email or SMS) |
| `/api/verify-otp-mobile` | POST | Verify OTP and reset password |
| `/api/products` | GET | Get all active products |
| `/api/products/search` | GET | Search products by name |

---

## Login Flow

```
Single /login page
       ↓
User submits credentials
       ↓
Flask checks Customer table → match → Customer Mobile Dashboard
       ↓ no match
Flask checks User table (admin/staff) → match → Access Code Modal
       ↓ correct code
Redirect to role dashboard (Admin / Staff)
```

---

## Database

This project uses **Supabase (PostgreSQL)** with **12 tables** and Row Level Security (RLS) enabled.

### Tables
`branch` → `customer` → `user` → `staff` → `product` → `inventory` → `discount` → `order` → `order_item` → `payment` → `cart` → `sales_transaction`

### Key Business Rules
- Payment methods: **walk-in cash**, **cash on delivery**, or **GCash** (reference number only)
- **Inventory Tracking** — Stock movements tracked by source branch and receiving branch
- User types: **Admin**, **Staff**, **Customer**
- Customers can log in via **email**, **username**, or **phone number**
- System Scope: Product Management, Inventory Management, Discount Management, POS (Sales Management), User Management, Sales Reporting

---

## Authentication & Password Reset

### Login System
- **Unified login** at `/login` for all user types (customers, admin, staff)
- Web users (admin/staff) require an additional **access code verification** modal after login
- Mobile customers authenticate via API tokens

### Password Reset with OTP
The system uses **Supabase Auth's native OTP feature** for secure password recovery:

**Web Users (Admin/Staff):**
1. Click "Forgot Password?" link on login page → `/forgot-password`
2. Enter email address
3. Supabase sends OTP via email
4. Enter OTP + new password → `/verify-otp`
5. Password is securely updated and user redirected to login

**Mobile Users (Customers):**
1. Call `/api/forgot-password` with email/phone and method (email/SMS)
2. Supabase sends OTP via selected method
3. Call `/api/verify-otp-mobile` with OTP and new password
4. Password is updated, user can log in with new credentials

### Security Features
- OTP tokens are time-limited (typically 10 minutes)
- Session-based email/OTP tracking prevents token bypass
- Password hashing with secure algorithms
- Supabase Auth prevents account enumeration (same response for existing/non-existing emails)

---

## Installation & Setup

### Backend (Flask)

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/ecommerce-pos.git
cd ecommerce-pos/backend
```

**2. Create and activate virtual environment**
```bash
python -m venv venv
venv\Scripts\activate
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Set up environment variables**

Create a `.env` file inside `backend/`:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
SECRET_KEY=your_flask_secret_key
STAFF_ACCESS_CODE=your_staff_access_code
```

**5. Run the application**
```bash
python app.py
```
Open: `http://127.0.0.1:5000`

---

### Mobile App (React Native)

**Prerequisites**
- Node.js (LTS)
- Android Studio + Android SDK
- JDK 17 (Eclipse Temurin)
- React Native CLI

**1. Install dependencies**
```bash
cd ecommerce-pos/mobile
npm install
```

**2. Set API base URL**

Open `src/utils/constants.js` and set:
```javascript
// For Android emulator
export const API_BASE_URL = 'http://10.0.2.2:5000/api';

// For physical device (use your PC's local IP)
export const API_BASE_URL = 'http://192.168.x.x:5000/api';
```

**3. Start the emulator** from Android Studio, then run:
```bash
npx react-native run-android
```

---

## Running Both Systems Together

Open **two terminals**:

```bash
# Terminal 1 — Flask backend
cd ecommerce-pos/backend
venv\Scripts\activate
python app.py

# Terminal 2 — React Native
cd ecommerce-pos/mobile
npx react-native run-android
```

---

## Developers

| Name | Role |
|---|---|
| Jorist Dave Agduma | Developer |
| Rhea Jane Mae Almelda | Developer |
| Val Cyril Calixton | Developer |
| Alfrancis Limo | Developer |

- **School:** STI College of Koronadal
- **Course:** Bachelor of Science in Information Technology
- **Capstone Deadline:** December 2026

---

## License
This project is developed for academic purposes only as a capstone research project of STI College of Koronadal.
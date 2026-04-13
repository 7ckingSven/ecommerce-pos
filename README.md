# Triple E & Fiel Collins General Merchandise
### Web-Based E-Commerce & Point of Sale Management System + Mobile App

A capstone project built for **Triple E and Fiel Collins General Merchandise** — a unified platform combining a web-based POS system for staff and a React Native mobile app for customers, powered by Flask and Supabase.

---

## Project Overview

This system serves two types of users:

- **Staff (Web — Desktop)** — Admin, Cashier, and Secretary access the system through a web browser on desktop. Each role has a dedicated dashboard for managing products, inventory, POS, orders, and reports.
- **Customers (Mobile — Android)** — Customers use a React Native Android app to browse products, place orders, manage their cart, and view their membership and credit.

A single unified login handles all users. Staff credentials trigger an additional access code verification before redirecting to the appropriate dashboard.

---

## Features

### Customer (Mobile App)
- Browse and search product catalog
- Filter products by category
- Add to cart and checkout
- View order history
- Member and non-member registration
- Credit (utang) tracking for members
- Exclusive member discounts

### Staff (Web System)
- **Admin** — Product management, discount management, user management, reports, audit trail
- **Cashier** — POS checkout, order processing, sales transactions
- **Secretary** — Inventory management, membership management, credit management

### System-Wide
- Unified login for all users (customers + staff)
- Staff access code verification modal
- Role-based dashboard routing
- Supabase PostgreSQL database with RLS
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
| Deployment (Backend) | Railway |
| Deployment (Frontend) | Vercel |

---

## Project Structure

```
ecommerce-pos/
│
├── backend/                          ← Flask web system (Staff)
│   ├── static/
│   │   ├── css/
│   │   │   ├── style.css             ← main stylesheet (dark green theme)
│   │   │   ├── index.css             ← public product showcase styles
│   │   │   ├── landing.css           ← landing page styles
│   │   │   └── register.css          ← registration page styles
│   │   ├── js/
│   │   │   ├── login.js              ← unified login: eye toggle, modals
│   │   │   ├── register.js           ← 3-step registration flow
│   │   │   └── index.js              ← public showcase interactions
│   │   └── img/
│   │       └── favicon.png           ← TE logo (also used as mobile app icon)
│   │
│   ├── templates/
│   │   ├── landing.html              ← public landing page (APK download + Staff Login)
│   │   ├── index.html                ← public product showcase (/home)
│   │   ├── login.html                ← unified login (customers + staff)
│   │   ├── register.html             ← 3-step customer registration
│   │   ├── admin/
│   │   │   └── dashboard.html        ← admin dashboard (pending)
│   │   ├── cashier/
│   │   │   └── dashboard.html        ← cashier dashboard (pending)
│   │   ├── secretary/
│   │   │   └── dashboard.html        ← secretary dashboard (pending)
│   │   └── customer/
│   │       └── dashboard.html        ← customer web dashboard (pending)
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
│   │   │   └── CartScreen.js         ← shopping cart
│   │   ├── services/
│   │   │   ├── api.js                ← axios instance (base URL config)
│   │   │   ├── authService.js        ← login, register, logout
│   │   │   └── productService.js     ← product and catalog API calls
│   │   └── utils/
│   │       └── constants.js          ← colors, spacing, typography, API URL
│   ├── android/                      ← Android build files
│   ├── ios/                          ← iOS build files
│   ├── App.tsx                       ← app entry point
│   └── package.json
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
| `/verify-staff-code` | — | Staff (POST — access code check) |
| `/admin/dashboard` | `admin/dashboard.html` | Admin only |
| `/cashier/dashboard` | `cashier/dashboard.html` | Cashier only |
| `/secretary/dashboard` | `secretary/dashboard.html` | Secretary only |
| `/customer/dashboard` | `customer/dashboard.html` | Logged-in customers |
| `/logout` | — | All users |

### Mobile API Routes (Flask)

| URL | Method | Description |
|---|---|---|
| `/api/login` | POST | Customer login |
| `/api/register` | POST | Customer registration |
| `/api/products` | GET | Get all active products |
| `/api/products/search` | GET | Search products by name |

---

## Login Flow

```
Single /login page
       ↓
User submits credentials
       ↓
Flask checks Customer table → match → Customer Dashboard
       ↓ no match
Flask checks User table (staff) → match → Access Code Modal
       ↓ correct code
Redirect to role dashboard (Admin / Cashier / Secretary)
```

---

## Database

This project uses **Supabase (PostgreSQL)** with **14 tables** and Row Level Security (RLS) enabled.

### Tables
`customer` → `membership` → `credit` → `staff` → `user` → `product_catalog` → `product` → `inventory` → `price_history` → `discount` → `shopping_cart` → `cart_item` → `order` → `sales_transaction`

### Key Business Rules
- Credits (utang) are for **members only**, due within 1 month
- Special discounts apply to **members only** (`applicable_to` field)
- Payment methods: **walk-in cash**, **cash on delivery**, or **GCash** (reference number only)
- Staff roles: **Admin**, **Cashier**, **Secretary**
- Customers can log in via **email**, **username**, or **phone number**

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
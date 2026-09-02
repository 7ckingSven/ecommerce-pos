# Triple E & Fiel Collins General Merchandise
### Web-Based E-Commerce & Point of Sale Management System + Mobile App

A capstone project built for **Triple E and Fiel Collins General Merchandise** — a unified platform combining a web-based POS system for staff/admin and a React Native mobile app for customers, powered by Flask and Supabase.

---

## Project Overview

This system serves three types of users:

- **Admin (Web — Desktop)** — Full control over products, inventory, discounts, purchase orders, users, sales reports, and audit trail.
- **Staff (Web — Desktop)** — Manages POS checkout, inventory (including branch transfers and stock requests), discounts, and sales reports.
- **Customers (Mobile — Android)** — Browse products, place orders, manage cart, track order status, and view order history.

---

## Features

### Customer (Mobile App)
- Browse and search product catalog with category filters
- Product detail with option groups (size, color, variants)
- **Products sold count** displayed on cards and product detail (Shopee-style)
- **Low stock warnings** on product cards and cart
- Add to cart with selected options; edit options directly from cart
- **PSGC Address Picker** — cascading Region → Province → City → Barangay
- **Shipping fee calculation** (tiered flat + weight-based by zone)
- **Delivery estimate** shown on checkout and order detail
- GCash (13-digit reference number) and cash on delivery payment
- **Shopee-style order progress tracker** (Pending → Processing → Out for Delivery → Completed)
- **Mark as Order Received** button (appears when status is Out for Delivery)
- Order history with full detail: branch, address, selected options, images
- **Auto-refresh every 10 seconds** on Home and Orders screens
- Forgot password via OTP (email)
- 3-step registration with duplicate check (email, username, phone)
- Profile management with PSGC address update

### Admin (Web System)
- **Product Management** — Add, edit, deactivate products with multiple images and option groups (variants). Image upload optional.
- **Inventory Management** — Branch stock summary (side-by-side per branch), stock movement history, add stock, transfer, adjust stock. Low stock alert banner.
- **Discount Management** — Create/edit discounts with start and end dates, countdown status badges, assign to products with branch filter, remove discounts. Products with discounts table.
- **Purchase Order (PO)** — Create POs, mark as Ordered/Received (with branch selector), **digital receipt** generated after creation and after marking received.
- **Orders** — Full order detail modal: product images, selected options, branch name, delivery address, shipping fee. **Pending orders badge** on nav. Auto-refresh every 5 seconds.
- **User Management** — Manage Admin and Staff accounts.
- **Sales Report** — Sales analytics, revenue breakdown, walk-in vs online orders.
- **Stock Requests** — Review and approve staff stock requests.
- **Branch Stock Summary** — Side-by-side grid showing stock per product per branch (Triple E | Fiel Collince).

### Staff (Web System)
- **POS (Sales Management)** — Process walk-in orders, GCash or cash payment, **VAT-inclusive receipt** (12%) with print support. Button disabled while processing.
- **Inventory Management** — View branch-specific stock, submit stock requests to admin.
- **Orders** — View online customer orders with full detail modal (product images, selected options, branch, delivery address). **Pending orders badge** on nav. Auto-refresh every 5 seconds.
- **Sales Summary** — View daily/weekly sales with walk-in and online breakdown.

### System-Wide
- Unified login for all users — specific error messages (user not found vs wrong password)
- Role-based dashboard routing (Admin / Staff / Customer)
- Branch-based product visibility — controlled by branch stock (no `available_at` field)
- Auto-refresh: 5 seconds (web) / 10 seconds (mobile)
- Buttons disabled while processing to prevent duplicate submissions
- Supabase PostgreSQL database

---

## Tech Stack

| Layer | Technology |
|---|---|
| IDE | Visual Studio Code |
| Backend | Flask (Python 3.11) + flask-cors + flask-mail |
| Web Frontend | HTML + CSS + JavaScript + Jinja2 |
| Mobile Frontend | React Native 0.85 (Android) |
| Database | Supabase (PostgreSQL) |
| Mobile Icons | React Native Vector Icons (Feather) |
| Mobile Navigation | React Navigation v7 (Bottom Tabs + Stack) |
| Email | Gmail SMTP via Flask-Mail (OTP delivery) |
| Version Control | GitHub |
| Deployment | Render |

---

## Project Structure

```
ecommerce-pos/
│
├── backend/                          ← Flask web system (Admin & Staff)
│   ├── static/
│   │   ├── css/
│   │   │   ├── style.css             ← main stylesheet (green theme)
│   │   │   ├── landing.css           ← landing page styles
│   │   │   ├── admin.css             ← admin dashboard styles
│   │   │   └── staff.css             ← staff dashboard styles
│   │   ├── js/
│   │   │   ├── login.js              ← login helpers (eye toggle)
│   │   │   ├── admin.js              ← admin dashboard functionality
│   │   │   └── staff.js              ← staff dashboard functionality
│   │   └── img/
│   │       ├── favicon.png           ← store logo
│   │       └── app-qr-code.png       ← QR code for APK download
│   │
│   ├── templates/
│   │   ├── landing.html              ← public landing page (APK download + Staff Login)
│   │   ├── login.html                ← unified login (admin/staff)
│   │   ├── forgot_password.html      ← forgot password (OTP request)
│   │   ├── verify_otp.html           ← OTP verification
│   │   ├── reset_password.html       ← new password entry
│   │   ├── admin/
│   │   │   └── admin_dashboard.html  ← admin dashboard
│   │   └── staff/
│   │       └── staff_dashboard.html  ← staff dashboard
│   │
│   ├── venv/                         ← Python virtual environment (not committed)
│   ├── app.py                        ← Flask routes + mobile API endpoints
│   ├── Dockerfile                    ← Docker container config
│   ├── .env                          ← environment variables (not committed)
│   └── requirements.txt
│
├── mobile/                           ← React Native mobile app (Customer)
│   ├── src/
│   │   ├── assets/
│   │   │   └── logo.png              ← store logo for login screen
│   │   ├── navigation/
│   │   │   └── AppNavigator.js       ← stack + bottom tab navigation with safe area
│   │   ├── screens/
│   │   │   ├── SplashScreen.js       ← app splash screen
│   │   │   ├── LoginScreen.js        ← customer login
│   │   │   ├── RegisterScreen.js     ← 3-step registration with duplicate check
│   │   │   ├── ForgotPasswordScreen.js ← forgot password (request OTP)
│   │   │   ├── VerifyOTPScreen.js    ← 6-box OTP entry with 5min timer
│   │   │   ├── ResetPasswordScreen.js ← new password entry
│   │   │   ├── HomeScreen.js         ← product grid with search, categories, sold count
│   │   │   ├── ProductDetailScreen.js ← product detail with option groups, sold count
│   │   │   ├── CartScreen.js         ← cart with option editing, low stock warnings
│   │   │   ├── CheckoutScreen.js     ← checkout with PSGC address, shipping fee
│   │   │   ├── OrdersScreen.js       ← orders with progress tracker, mark as received
│   │   │   └── ProfileScreen.js      ← user profile with PSGC address update
│   │   ├── components/
│   │   │   └── PSGCAddressPicker.js  ← cascading PSGC address picker
│   │   ├── services/
│   │   │   ├── api.js                ← axios instance (base URL config)
│   │   │   ├── authService.js        ← login, register, logout, OTP
│   │   │   ├── cartService.js        ← cart management with selected options
│   │   │   └── orderService.js       ← order placement and history
│   │   └── utils/
│   │       ├── constants.js          ← colors, spacing, typography, API URL toggle
│   │       └── CartContext.js        ← global cart count context
│   ├── android/                      ← Android build files
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
| `/` | `landing.html` | Public — landing page with APK download |
| `/login` | `login.html` | Admin & Staff login |
| `/forgot-password` | `forgot_password.html` | Public — request OTP |
| `/verify-otp` | `verify_otp.html` | Public — enter OTP |
| `/reset-password` | `reset_password.html` | Public — set new password |
| `/admin/dashboard` | `admin/admin_dashboard.html` | Admin only |
| `/staff/dashboard` | `staff/staff_dashboard.html` | Staff only |
| `/logout` | — | All users |
| `/download-apk` | — | Public — APK file download |

### Mobile API Routes (Flask)

| URL | Method | Description |
|---|---|---|
| `/api/login` | POST | Customer login |
| `/api/register` | POST | Customer registration |
| `/api/auth/check-duplicate` | POST | Check if email/username/phone is taken |
| `/api/forgot-password` | POST | Request OTP for password reset |
| `/api/verify-otp-mobile` | POST | Verify OTP and reset password |
| `/api/products` | GET | Get active products (expanded by branch stock) |
| `/api/products/<id>` | GET | Get single product detail |
| `/api/cart` | GET/POST | Get or add to cart |
| `/api/cart/<id>` | PUT/DELETE | Update or remove cart item |
| `/api/orders` | GET/POST | Get orders or place new order |
| `/api/orders/<id>/received` | POST | Customer marks order as received |
| `/api/profile` | GET/PUT | Get or update customer profile |

---

## Database

This project uses **Supabase (PostgreSQL)**.

### Tables

| Table | Description |
|---|---|
| `branch` | Store branches (Triple E, Fiel Collince) |
| `customer` | Customer accounts and profiles |
| `user` | Admin and Staff accounts |
| `staff` | Staff details and branch assignment |
| `product` | Product catalog with option groups and net weight |
| `branch_stock` | Per-product, per-branch stock quantities |
| `inventory` | Stock movement history (restock, transfer, adjustment) |
| `discount` | Discounts with percentage, start and end dates |
| `order` | Customer orders (online and walk-in) with address and shipping fee |
| `order_item` | Items per order with selected options |
| `payment` | Payment records (GCash ref, cash) |
| `cart` | Customer cart with selected options and branch |
| `stock_request` | Staff stock requests to admin |
| `purchase_order` | Admin purchase orders to suppliers |
| `po_item` | Items per purchase order |
| `otp_codes` | OTP tokens for mobile password reset |

### Key Business Rules
- **Branch stock controls visibility** — products only show on the app if the branch has stock > 0
- **VAT Inclusive (12%)** — applied on POS walk-in receipts
- Payment methods: **GCash** (13-digit reference number) or **walk-in cash**
- Shipping fee: tiered flat + weight-based by zone (Koronadal, South Cotabato, Region XII, outside)
- Order statuses: `pending` → `processing` → `out_for_delivery` → `completed` (set by customer) or `cancelled`
- One review per product per completed order (future feature)

---

## Authentication & Password Reset

### Login System
- **Admin/Staff** — Web login at `/login`, redirected to their respective dashboard
- **Customers** — Mobile API login at `/api/login` using email, username, or phone number
- Specific error messages: "No account found" vs "Incorrect password"

### Password Reset with OTP

**Web (Admin/Staff):**
1. Click "Forgot Password?" → `/forgot-password`
2. Enter email → OTP sent via Gmail SMTP (Flask-Mail)
3. Enter 6-digit OTP → `/verify-otp`
4. Enter new password → `/reset-password`
5. Redirected to login ✅

**Mobile (Customers):**
1. Tap "Forgot Password?" → ForgotPasswordScreen
2. Enter email → OTP sent via Gmail SMTP
3. Enter 6-digit OTP in 6-box input with 5-minute timer → VerifyOTPScreen
4. Enter new password → ResetPasswordScreen
5. Redirected to login ✅

---

## Installation & Setup

### Backend (Flask)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/ecommerce-pos.git
cd ecommerce-pos/backend

# 2. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
source venv/bin/activate    # Mac/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create .env file
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
SECRET_KEY=your_flask_secret_key
STAFF_ACCESS_CODE=your_staff_access_code
MAIL_PASSWORD=your_gmail_app_password

# 5. Run the application
python app.py
# Open: http://127.0.0.1:5000
```

### Mobile App (React Native)

```bash
# Prerequisites: Node.js LTS, Android Studio, JDK 17, React Native CLI

# 1. Install dependencies
cd ecommerce-pos/mobile
npm install

# 2. Set environment in constants.js
const ENV = 'emulator';   # for Android emulator
const ENV = 'render';     # for production (Render deployment)

# 3. Run on emulator
npx react-native run-android

# 4. Build release APK
cd android
.\gradlew.bat assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

### Running Both Together

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

## Deployment

- **Backend** — Render (`https://ecommerce-pos-8rsf.onrender.com`)
- **Mobile** — APK hosted on Google Drive with QR code on landing page
- **Database** — Supabase (hosted PostgreSQL)

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
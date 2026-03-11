# Triple E & Fiel Collins General Merchandise
### Web-Based E-Commerce & Point of Sale Management System

A capstone research project built for **Triple E and Fiel Collins General Merchandise** — a web-based application that combines e-commerce and POS functionality to manage products, inventory, orders, customers, and sales operations in one unified platform.

---

## Project Overview
This system is designed for small business store operations, providing role-based access for Admin, Cashier, and Secretary staff, as well as a customer-facing e-commerce portal. It runs entirely in the browser with no specialized hardware required.

---

## Features
- **Role-Based Access Control** — Separate dashboards for Admin, Cashier, Secretary, and Customer
- **Staff Portal** — Secret access code entry before staff login
- **Product Management** — Add, edit, and manage product catalog with categories and pricing *(Admin)*
- **Inventory Management** — Monitor and manage stock levels, restocking alerts *(Secretary)*
- **Sales & POS Checkout** — Process transactions and record payments *(Cashier)*
- **Customer Management** — Member and non-member customer profiles
- **Order & Credit Management** — Supports walk-in cash, cash on delivery, and credit (utang) for members
- **Discount Management** — Percentage and fixed discounts for members
- **Reports & Analytics** — Sales performance and business insights

---

## Tech Stack

| Layer | Technology |
|---|---|
| IDE | Visual Studio Code |
| Backend | Flask (Python 3.11) |
| Frontend | HTML + CSS + Bootstrap 5 |
| Templating | Jinja2 |
| Database | Supabase (PostgreSQL) |
| Version Control | GitHub |
| Containerization | Docker |
| Deployment (Backend) | Railway |
| Deployment (Frontend) | Vercel |

---

## Project Structure
```
ecommerce-pos/
│
├── static/
│   ├── css/
│   │   ├── style.css          ← main stylesheet (light fresh green theme)
│   │   ├── register.css       ← register page styles
│   │   └── portal.css         ← portal & staff login styles
│   ├── js/
│   │   ├── login.js           ← customer login: eye toggle, forgot modal
│   │   ├── staff_login.js     ← staff login: eye toggle, forgot modal
│   │   ├── portal.js          ← portal: eye toggle
│   │   └── register.js        ← register: eye toggle, steps, strength meter
│   └── img/
│
├── templates/
│   ├── index.html             ← public product showcase
│   ├── login.html             ← customer login
│   ├── register.html          ← 3-step customer registration
│   ├── portal.html            ← staff access code entry
│   ├── staff_login.html       ← staff email & password login
│   ├── admin/
│   │   └── dashboard.html
│   ├── cashier/
│   │   └── dashboard.html
│   ├── secretary/
│   │   └── dashboard.html
│   └── customer/
│       └── dashboard.html
│
├── venv/
├── app.py                     ← Flask application entry point
├── vercel.json                ← Vercel deployment configuration
├── Dockerfile                 ← Docker container configuration
├── .dockerignore
├── .env                       ← environment variables (not committed)
├── .gitignore
├── requirements.txt
└── README.md
```

---

## Routes

| URL | Template | Access |
|---|---|---|
| `/` | `index.html` | Public |
| `/login` | `login.html` | Customers |
| `/register` | `register.html` | Anyone |
| `/portal` | `portal.html` | Staff (secret URL + access code) |
| `/staff-login-page` | `staff_login.html` | Staff (after portal verified) |
| `/admin/dashboard` | `admin/dashboard.html` | Admin only |
| `/cashier/dashboard` | `cashier/dashboard.html` | Cashier only |
| `/secretary/dashboard` | `secretary/dashboard.html` | Secretary only |
| `/customer/dashboard` | `customer/dashboard.html` | Logged-in customers |

---

## Installation and Setup

### Prerequisites
- Python 3.11
- Git
- Docker Desktop
- Supabase account

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/ecommerce-pos.git
cd ecommerce-pos
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

Create a `.env` file in the root folder:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SECRET_KEY=your_secret_key
STAFF_ACCESS_CODE=your_staff_access_code
```

**5. Run the application locally**
```bash
python app.py
```
Then open: `http://127.0.0.1:5000`

**6. Run using Docker**
```bash
docker build -t ecommerce-pos .
docker run -p 5000:5000 --env-file .env ecommerce-pos
```

---

## Database
This project uses **Supabase (PostgreSQL)** as its cloud database. It consists of 9 tables:

`users` → `customers` → `categories` → `discounts` → `products` → `orders` → `order_items` → `credits` → `transactions`

Key business rules:
- Credits (utang) are available to members only, due within 1 month
- Special discounts apply to members only
- Payment methods: walk-in cash or cash on delivery only

---

## Deployment

### Backend — Railway
The Flask application is containerized with Docker and deployed on **Railway**, which supports Docker-based deployments with environment variable configuration.

### Frontend — Vercel
Static assets and frontend delivery are handled via **Vercel** using a `vercel.json` configuration file at the project root.

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
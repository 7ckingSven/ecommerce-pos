# ECommerce POS System
A web-based Point of Sale and E-Commerce management system built as a capstone project.

---

## Project Overview
The ECommerce POS System is a web-based application designed for small business stores to manage their day-to-day sales, inventory, customers, and orders in one unified platform. It combines the functionality of a traditional Point of Sale (POS) system with basic e-commerce management features, making it accessible directly from any browser without the need for specialized hardware or software.

---

## Features
- User Authentication and Management - Secure login and role-based access for admin and staff
- Product and Inventory Management - Add, edit, delete products and track stock levels
- Sales and Checkout (POS) - Process transactions, generate receipts, and record payments
- Customer Management - Store and manage customer profiles and purchase history
- Order Management - View, manage, and track all orders in real-time
- Reports and Analytics Dashboard - Visual sales reports and business performance insights

---

## Tech Stack

| Layer | Technology |
|---|---|
| IDE | Visual Studio Code |
| Backend | Flask (Python) |
| Frontend | HTML, CSS, Bootstrap 5 |
| Templating | Jinja2 (built-in Flask) |
| Database | Supabase (PostgreSQL) |
| Version Control | GitHub |
| Containerization | Docker |

---

## Project Structure
```
ecommerce-pos/
│
├── static/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── script.js
│   └── img/
│
├── templates/
│   ├── base.html
│   └── index.html
│
├── venv/
├── app.py
├── Dockerfile
├── .dockerignore
├── .env
├── .gitignore
├── requirements.txt
└── README.md
```

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
```

**5. Run the application locally**
```bash
python app.py
```

**6. Run using Docker**
```bash
docker build -t ecommerce-pos .
docker run -p 5000:5000 --env-file .env ecommerce-pos
```

**7. Open in browser**
```
http://127.0.0.1:5000
```

---

## Database
This project uses Supabase (PostgreSQL) as its database. Supabase provides a real-time, cloud-hosted PostgreSQL database with a built-in dashboard, authentication, and REST API support.

---

## Deployment
This project is deployed using Railway, a cloud platform that supports containerized Flask applications via Docker, ensuring consistent and reliable access to the system through a public URL.

---

## Developer
- Project Type: Capstone Research Project
- Course: Information Technology
- Year: 2026

---

## License
This project is for academic purposes only.
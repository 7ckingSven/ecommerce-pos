from flask import Flask, render_template, request, redirect, url_for, flash, session
from supabase import create_client
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Initialize Flask
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')

# Initialize Supabase
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)

# ─── LANDING PAGE ─────────────────────────────────────

@app.route('/')
def login():
    return render_template('login.html')

# ─── STAFF LOGIN ───────────────────────────────────────

@app.route('/staff-login', methods=['POST'])
def staff_login():
    email    = request.form.get('email')
    password = request.form.get('password')
    # TODO: Add Supabase authentication logic here
    # TODO: Fetch user role from users table
    # TODO: Redirect based on role

    # Placeholder role detection — replace with real Supabase auth
    # Example: role = supabase.table('users').select('role').eq('email', email).execute()
    role = None  # Will be fetched from Supabase

    if role == 'admin':
        session['user']  = email
        session['role']  = 'admin'
        return redirect(url_for('admin_dashboard'))
    elif role == 'cashier':
        session['user']  = email
        session['role']  = 'cashier'
        return redirect(url_for('cashier_dashboard'))
    elif role == 'secretary':
        session['user']  = email
        session['role']  = 'secretary'
        return redirect(url_for('secretary_dashboard'))
    else:
        flash('Staff login coming soon.', 'success')
        return redirect(url_for('login'))

# ─── CUSTOMER LOGIN ────────────────────────────────────

@app.route('/customer-login', methods=['POST'])
def customer_login():
    email    = request.form.get('email')
    password = request.form.get('password')
    # TODO: Add Supabase authentication logic here
    flash('Customer login coming soon.', 'success')
    return redirect(url_for('login'))

# ─── FORGOT PASSWORD ───────────────────────────────────

@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    reset_email = request.form.get('reset_email')
    # TODO: Add Supabase password reset logic here
    flash('If this email is registered, a reset link has been sent.', 'success')
    return redirect(url_for('login'))

# ─── STAFF DASHBOARDS ─────────────────────────────────

@app.route('/admin/dashboard')
def admin_dashboard():
    # TODO: Add session protection here
    return render_template('admin/dashboard.html')

@app.route('/cashier/dashboard')
def cashier_dashboard():
    # TODO: Add session protection here
    return render_template('cashier/dashboard.html')

@app.route('/secretary/dashboard')
def secretary_dashboard():
    # TODO: Add session protection here
    return render_template('secretary/dashboard.html')

# ─── CUSTOMER DASHBOARD ───────────────────────────────

@app.route('/customer/dashboard')
def customer_dashboard():
    # TODO: Add session protection here
    return render_template('customer/dashboard.html')

# ─── LOGOUT ───────────────────────────────────────────

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ──────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
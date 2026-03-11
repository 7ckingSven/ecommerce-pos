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

# ─── PUBLIC PAGES ─────────────────────────────────────

# Main landing page — public product showcase
@app.route('/')
def index():
    return render_template('index.html')

# Login page
@app.route('/login')
def login():
    return render_template('login.html')

# ─── STAFF PORTAL — Access Code ───────────────────────

@app.route('/portal', methods=['GET', 'POST'])
def portal():
    if request.method == 'POST':
        code = request.form.get('access_code')
        if code == os.getenv('STAFF_ACCESS_CODE'):
            session['portal_verified'] = True
            return redirect(url_for('staff_login_page'))
        else:
            flash('Invalid access code. Please try again.', 'error')
            return redirect(url_for('portal'))
    # Clear portal session on fresh visit
    session.pop('portal_verified', None)
    return render_template('portal.html')

# ─── STAFF LOGIN PAGE ──────────────────────────────────

@app.route('/staff-login-page')
def staff_login_page():
    # Block direct access without portal verification
    if not session.get('portal_verified'):
        flash('Please enter the access code first.', 'error')
        return redirect(url_for('portal'))
    return render_template('staff_login.html')

@app.route('/staff-login', methods=['POST'])
def staff_login():
    # Block direct POST access without portal verification
    if not session.get('portal_verified'):
        return redirect(url_for('portal'))

    email    = request.form.get('email')
    password = request.form.get('password')
    # TODO: Add Supabase authentication logic here
    # TODO: Fetch user role from users table and redirect accordingly

    role = None  # Will be fetched from Supabase

    if role == 'admin':
        session['user'] = email
        session['role'] = 'admin'
        return redirect(url_for('admin_dashboard'))
    elif role == 'cashier':
        session['user'] = email
        session['role'] = 'cashier'
        return redirect(url_for('cashier_dashboard'))
    elif role == 'secretary':
        session['user'] = email
        session['role'] = 'secretary'
        return redirect(url_for('secretary_dashboard'))
    else:
        flash('Staff login coming soon.', 'success')
        return redirect(url_for('staff_login_page'))

# ─── CUSTOMER LOGIN ────────────────────────────────────

@app.route('/customer-login', methods=['POST'])
def customer_login():
    email    = request.form.get('email')
    password = request.form.get('password')
    # TODO: Add Supabase authentication logic here
    flash('Customer login coming soon.', 'success')
    return redirect(url_for('login'))

# ─── CUSTOMER REGISTER ────────────────────────────────────

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        # TODO: Add Supabase registration logic here
        flash('Registration coming soon.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

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
    return redirect(url_for('index'))

# ──────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
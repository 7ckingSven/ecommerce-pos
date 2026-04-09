from flask import Flask, render_template, request, redirect, url_for, flash, session
from supabase import create_client
from dotenv import load_dotenv
from datetime import timedelta
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

# ─── UNIFIED LOGIN PAGE ───────────────────────────────
@app.route('/login', methods=['GET'])
def login():
    # Check if staff access code modal should be shown
    show_modal = session.pop('show_access_code_modal', False)
    staff_token = session.get('staff_verified_token', '')
    return render_template('login.html',
        show_access_code_modal=show_modal,
        staff_token=staff_token
    )

@app.route('/login', methods=['POST'])
def login_post():
    login_input = request.form.get('login_input')
    password    = request.form.get('password')
    remember_me = request.form.get('remember_me') == 'on'

    if remember_me:
        app.permanent_session_lifetime = timedelta(days=30)
        session.permanent = True

    # TODO: Step 1 — Check customer table
    # customer = supabase.table('customer').select('*').or_(
    #     f'email.eq.{login_input},username.eq.{login_input},phone_number.eq.{login_input}'
    # ).single().execute()
    # if customer and check_password(password, customer.data['password']):
    #     session['user_id'] = customer.data['customer_id']
    #     session['role'] = 'customer'
    #     return redirect(url_for('customer_dashboard'))

    # TODO: Step 2 — Check user table (staff)
    # user = supabase.table('user').select('*').eq('username', login_input).single().execute()
    # if user and check_password(password, user.data['password']):
    #     session['staff_verified_token'] = user.data['user_id']
    #     session['show_access_code_modal'] = True
    #     return redirect(url_for('login'))

    flash('Login coming soon.', 'success')
    return redirect(url_for('login'))

# ─── STAFF ACCESS CODE VERIFICATION ───────────────────
@app.route('/verify-staff-code', methods=['POST'])
def verify_staff_code():
    access_code  = request.form.get('access_code')
    staff_token  = request.form.get('staff_verified_token')

    if access_code == os.getenv('STAFF_ACCESS_CODE'):
        # TODO: Fetch staff role from Supabase using staff_token
        # user = supabase.table('user').select('*').eq('user_id', staff_token).single().execute()
        # role = user.data['role']
        role = None  # Will be fetched from Supabase

        if role == 'admin':
            session['user'] = staff_token
            session['role'] = 'admin'
            session.pop('staff_verified_token', None)
            return redirect(url_for('admin_dashboard'))
        elif role == 'cashier':
            session['user'] = staff_token
            session['role'] = 'cashier'
            session.pop('staff_verified_token', None)
            return redirect(url_for('cashier_dashboard'))
        elif role == 'secretary':
            session['user'] = staff_token
            session['role'] = 'secretary'
            session.pop('staff_verified_token', None)
            return redirect(url_for('secretary_dashboard'))
        else:
            flash('Staff verification coming soon.', 'success')
            return redirect(url_for('login'))
    else:
        flash('Invalid access code. Please try again.', 'error')
        session['show_access_code_modal'] = True
        session['staff_verified_token'] = staff_token
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
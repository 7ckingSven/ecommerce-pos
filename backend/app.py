import json
import random
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_file
from flask_cors import CORS
from flask_mail import Mail, Message
from supabase import create_client
from dotenv import load_dotenv
from datetime import timedelta, datetime
from functools import wraps
import bcrypt
import os
import random
import string

# Load .env file
load_dotenv()

# Initialize Flask
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')

# Enable CORS — allows React Native mobile app to call Flask API
CORS(app)

# Initialize Supabase
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)

# Configure Flask-Mail
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', os.getenv('MAIL_USERNAME'))
mail = Mail(app)

# ══════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(plain, hashed):
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def verify_password(plain, hashed):
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def login_required(role=None):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                flash('Please log in to continue.', 'error')
                return redirect(url_for('login'))
            if role and session.get('role') != role:
                flash('You do not have permission to access this page.', 'error')
                return redirect(url_for('login'))
            return f(*args, **kwargs)
        return decorated
    return decorator

def admin_required(f):
    """Decorator to protect admin API routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

def staff_required(f):
    """Decorator to protect staff API routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') not in ('admin', 'staff'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

# ══════════════════════════════════════════════════════
# WEB ROUTES — Staff & Public Pages
# ══════════════════════════════════════════════════════

@app.route('/')
def landing():
    return render_template('landing.html')

# ─── APK DOWNLOAD ─────────────────────────────────────

@app.route('/download-apk')
def download_apk():
    """
    Serve APK file for download.
    APK should be located at: backend/static/apk/app-release.apk
    """
    apk_path = os.path.join(os.path.dirname(__file__), 'static', 'apk', 'app-release.apk')
    
    if not os.path.exists(apk_path):
        flash('APK file not found. Please contact administrator.', 'error')
        return redirect(url_for('landing'))
    
    return send_file(
        apk_path,
        mimetype='application/vnd.android.package-archive',
        as_attachment=True,
        download_name='TripleE-FielCollins-App.apk'
    )

# ─── UNIFIED LOGIN ────────────────────────────────────

@app.route('/login', methods=['GET'])
def login():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login_post():
    login_input = request.form.get('login_input', '').strip()
    password    = request.form.get('password', '')
    remember_me = request.form.get('remember_me') == 'on'

    if not login_input or not password:
        flash('Please fill in all fields.', 'error')
        return redirect(url_for('login'))

    if remember_me:
        app.permanent_session_lifetime = timedelta(days=30)
        session.permanent = True

    try:
        user_res = supabase.table('user').select('*').eq('username', login_input).execute()

        if not user_res.data:
            flash('Invalid credentials. Please try again.', 'error')
            return redirect(url_for('login'))

        user = user_res.data[0]

        if user['status'] != 'active':
            flash('Your account is inactive. Please contact the administrator.', 'error')
            return redirect(url_for('login'))

        if not check_password(password, user['password']):
            flash('Invalid credentials. Please try again.', 'error')
            return redirect(url_for('login'))

        # Web login is for admin and staff ONLY — customers use mobile app
        if user['role'] == 'customer':
            flash('Customers must log in through the mobile app.', 'error')
            return redirect(url_for('login'))
        elif user['role'] in ('admin', 'staff'):
            # Direct login without access code
            staff_res = supabase.table('staff').select('*').eq('user_id', user['user_id']).execute()
            
            if staff_res.data:
                staff = staff_res.data[0]
                session['user_id']  = user['user_id']
                session['staff_id'] = staff['staff_id']
                session['role']     = user['role']
                session['name']     = f"{staff['fname']} {staff['lname']}"
                
                if user['role'] == 'admin':
                    flash('Welcome, Admin!', 'success')
                    return redirect(url_for('admin_dashboard'))
                elif user['role'] == 'staff':
                    flash('Welcome, Staff!', 'success')
                    return redirect(url_for('staff_dashboard'))
            else:
                flash('Staff information not found.', 'error')
                return redirect(url_for('login'))

    except Exception as e:
        print(f"Login error: {e}")
        flash('Something went wrong. Please try again.', 'error')

    return redirect(url_for('login'))

# ─── FORGOT PASSWORD ──────────────────────────────────

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        
        if not email:
            flash('Please enter your email address.', 'error')
            return redirect(url_for('forgot_password'))
        
        try:
            # Check if email exists in staff table (web is for staff/admin only)
            staff_res = supabase.table('staff').select('user_id, email').eq('email', email).execute()
            
            if not staff_res.data:
                # Security: Don't reveal if email exists
                flash('If this email is registered, an OTP has been sent.', 'success')
                return redirect(url_for('forgot_password'))
            
            staff = staff_res.data[0]
            user_id = staff['user_id']
            
            # Generate a 6-digit OTP
            otp = ''.join(random.choices(string.digits, k=6))
            print(f"DEBUG: Generated OTP {otp} for email {email}")
            
            # Store OTP in session (expires on redirect to verify-otp page)
            session['otp_code'] = otp
            session['otp_email'] = email
            session['otp_user_id'] = user_id
            session['otp_sent'] = True
            session['otp_created_at'] = datetime.now().isoformat()
            
            # Send OTP via email
            try:
                msg = Message(
                    subject='Password Reset OTP - Triple E & Fiel Collins',
                    recipients=[email],
                    html=f'''
                    <html>
                        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
                            <div style="max-width: 600px; margin: 0 auto;">
                                <h2>Password Reset Request</h2>
                                <p>You have requested to reset your password for Triple E & Fiel Collins Management System.</p>
                                <p style="font-size: 18px; margin: 20px 0;">Your One-Time Password (OTP) is:</p>
                                <div style="background-color: #f0f0f0; padding: 20px; border-radius: 5px; text-align: center;">
                                    <p style="font-size: 32px; font-weight: bold; letter-spacing: 3px; margin: 0;">{otp}</p>
                                </div>
                                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                                    This OTP will expire in 15 minutes.
                                </p>
                                <p style="color: #999; font-size: 12px; margin-top: 20px;">
                                    If you did not request this password reset, please ignore this email.
                                </p>
                                <hr style="border: none; border-top: 1px solid #ddd; margin-top: 30px;">
                                <p style="color: #999; font-size: 12px; text-align: center;">
                                    Triple E & Fiel Collins General Merchandise<br>
                                    E-Commerce & POS System
                                </p>
                            </div>
                        </body>
                    </html>
                    '''
                )
                mail.send(msg)
                print(f"DEBUG: OTP email sent successfully to {email}")
            except Exception as email_error:
                print(f"WARNING: Failed to send email: {email_error}")
                # Continue even if email fails - user can see OTP in console logs for testing
            
            flash('OTP sent to your email. Check your inbox (and spam folder).', 'success')
            return redirect(url_for('verify_otp'))
            
        except Exception as e:
            print(f"Forgot password error: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            flash('An error occurred. Please try again.', 'error')
            return redirect(url_for('forgot_password'))
    
    return render_template('forgot_password.html')

@app.route('/verify-otp', methods=['GET', 'POST'])
def verify_otp():
    if not session.get('otp_sent'):
        return redirect(url_for('forgot_password'))
    
    if request.method == 'POST':
        otp = request.form.get('otp', '').strip()
        password = request.form.get('password', '')
        password_confirm = request.form.get('password_confirm', '')
        
        if not otp or not password or not password_confirm:
            flash('Please fill in all fields.', 'error')
            return redirect(url_for('verify_otp'))
        
        if password != password_confirm:
            flash('Passwords do not match.', 'error')
            return redirect(url_for('verify_otp'))
        
        try:
            # Check if OTP has expired (15 minutes)
            otp_created_at = session.get('otp_created_at')
            if otp_created_at:
                created = datetime.fromisoformat(otp_created_at)
                if (datetime.now() - created).total_seconds() > 900:  # 15 minutes
                    session.pop('otp_code', None)
                    session.pop('otp_sent', None)
                    flash('OTP has expired. Please request a new one.', 'error')
                    return redirect(url_for('forgot_password'))
            
            # Check if OTP matches
            stored_otp = session.get('otp_code', '')
            if otp != stored_otp:
                flash('Invalid OTP. Please try again.', 'error')
                return redirect(url_for('verify_otp'))
            
            user_id = session.get('otp_user_id')
            email = session.get('otp_email')
            
            if not user_id:
                flash('Session expired. Please try again.', 'error')
                return redirect(url_for('forgot_password'))
            
            # Update password in user table
            hashed = hash_password(password)
            supabase.table('user').update({
                'password': hashed
            }).eq('user_id', user_id).execute()
            
            print(f"DEBUG: Password reset successfully for user_id {user_id} (email: {email})")
            
            # Clear OTP session variables
            session.pop('otp_code', None)
            session.pop('otp_email', None)
            session.pop('otp_user_id', None)
            session.pop('otp_sent', None)
            session.pop('otp_created_at', None)
            
            flash('Password reset successfully! Please log in.', 'success')
            return redirect(url_for('login'))
            
        except Exception as e:
            print(f"OTP verification error: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            flash('An error occurred. Please try again.', 'error')
            return redirect(url_for('verify_otp'))
    
    return render_template('verify_otp.html')


# ─── DASHBOARDS ───────────────────────────────────────

@app.route('/admin/dashboard')
@login_required(role='admin')
def admin_dashboard():
    return render_template('admin/admin_dashboard.html')

@app.route('/staff/dashboard')
@login_required(role='staff')
def staff_dashboard():
    return render_template('staff/staff_dashboard.html')

# ─── LOGOUT ───────────────────────────────────────────

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('landing'))

# ══════════════════════════════════════════════════════
# MOBILE API ROUTES — React Native Customer App
# ══════════════════════════════════════════════════════

# ─── AUTH ─────────────────────────────────────────────

@app.route('/api/login', methods=['POST'])
def api_login():
    data        = request.get_json()
    login_input = data.get('login_input', '').strip()
    password    = data.get('password', '')

    if not login_input or not password:
        return jsonify({'error': 'Please fill in all fields.'}), 400

    try:
        user_res = supabase.table('user').select('*').eq('username', login_input).eq('role', 'customer').execute()

        if not user_res.data:
            customer_res = supabase.table('customer').select('customer_id, user_id').eq('email', login_input).execute()
            if customer_res.data:
                user_res = supabase.table('user').select('*').eq('user_id', customer_res.data[0]['user_id']).execute()

        if not user_res.data:
            customer_res = supabase.table('customer').select('customer_id, user_id').eq('phone_number', login_input).execute()
            if customer_res.data:
                user_res = supabase.table('user').select('*').eq('user_id', customer_res.data[0]['user_id']).execute()

        if not user_res.data:
            return jsonify({'error': 'Invalid credentials.'}), 401

        user = user_res.data[0]

        if user['status'] != 'active':
            return jsonify({'error': 'Account is inactive.'}), 403

        if not check_password(password, user['password']):
            return jsonify({'error': 'Invalid credentials.'}), 401

        if user['role'] not in ('customer',):
            return jsonify({'error': 'Access denied.'}), 403

        customer_res = supabase.table('customer').select('*').eq('user_id', user['user_id']).execute()
        customer     = customer_res.data[0]

        return jsonify({
            'message':  'Login successful',
            'user_id':  user['user_id'],
            'customer': {
                'customer_id':  customer['customer_id'],
                'fname':        customer['fname'],
                'mi':           customer.get('mi', ''),
                'lname':        customer['lname'],
                'email':        customer['email'],
                'phone_number': customer['phone_number'],
                'address':      customer.get('address', ''),
                'dob':          customer.get('dob', ''),
                'gender':       customer.get('gender', ''),
                'username':     user.get('username', ''),
            }
        }), 200

    except Exception as e:
        print(f"API login error: {e}")
        return jsonify({'error': 'Something went wrong.'}), 500

@app.route('/api/register', methods=['POST'])
def api_register():
    data         = request.get_json()
    fname        = data.get('fname', '').strip()
    mi           = data.get('mi', '').strip()
    lname        = data.get('lname', '').strip()
    email        = data.get('email', '').strip()
    username     = data.get('username', '').strip()
    phone_number = data.get('phone_number', '').strip()
    password     = data.get('password', '')
    address      = data.get('address', '').strip()
    dob          = data.get('dob', '')
    gender       = data.get('gender', '')

    if not all([fname, lname, email, username, phone_number, password]):
        return jsonify({'error': 'Please fill in all required fields.'}), 400

    try:
        if supabase.table('user').select('user_id').eq('username', username).execute().data:
            return jsonify({'error': 'Username already taken.'}), 409

        if supabase.table('customer').select('customer_id').eq('email', email).execute().data:
            return jsonify({'error': 'Email already registered.'}), 409

        if supabase.table('customer').select('customer_id').eq('phone_number', phone_number).execute().data:
            return jsonify({'error': 'Phone number already registered.'}), 409

        hashed   = hash_password(password)
        user_res = supabase.table('user').insert({
            'username': username,
            'password': hashed,
            'role':     'customer',
            'status':   'active'
        }).execute()

        user_id      = user_res.data[0]['user_id']
        customer_res = supabase.table('customer').insert({
            'user_id':      user_id,
            'fname':        fname,
            'mi':           mi,
            'lname':        lname,
            'phone_number': phone_number,
            'email':        email,
            'address':      address,
            'dob':          dob if dob else None,
            'gender':       gender if gender else None
        }).execute()

        return jsonify({
            'message':     'Account created successfully.',
            'customer_id': customer_res.data[0]['customer_id']
        }), 201

    except Exception as e:
        print(f"API register error: {e}")
        return jsonify({'error': 'Registration failed.'}), 500

# ─── FORGOT PASSWORD ──────────────────────────────────

@app.route('/api/forgot-password', methods=['POST'])
def api_forgot_password():
    """Request OTP for password reset via email or SMS"""
    data = request.get_json()
    contact = data.get('contact', '').strip()  # email or phone
    method = data.get('method', 'email')  # 'email' or 'sms'
    
    if not contact:
        return jsonify({'error': 'Email or phone number required.'}), 400
    
    try:
        # Check if customer exists
        if method == 'email':
            customer = supabase.table('customer').select('customer_id, email').eq('email', contact).execute()
        else:  # SMS
            customer = supabase.table('customer').select('customer_id, phone_number').eq('phone_number', contact).execute()
        
        if not customer.data:
            # Security: Don't reveal if account exists
            return jsonify({'message': 'If account exists, OTP has been sent.'}), 200
        
        # Send OTP via Supabase Auth
        if method == 'email':
            supabase.auth.sign_in_with_otp({
                'email': contact,
                'options': {'should_create_user': False}
            })
        else:
            # For SMS, use Supabase phone sign-in
            supabase.auth.sign_in_with_phone({
                'phone': contact,
                'options': {'should_create_user': False}
            })
        
        return jsonify({
            'message': f'OTP sent to your {method}.',
            'method': method,
            'contact': contact
        }), 200
        
    except Exception as e:
        print(f"API forgot password error: {e}")
        return jsonify({'error': 'Failed to send OTP.'}), 500

@app.route('/api/verify-otp-mobile', methods=['POST'])
def api_verify_otp():
    """Verify OTP and reset password"""
    data = request.get_json()
    contact = data.get('contact', '').strip()
    otp = data.get('otp', '').strip()
    password = data.get('password', '')
    method = data.get('method', 'email')  # 'email' or 'sms'
    
    if not all([contact, otp, password]):
        return jsonify({'error': 'All fields required.'}), 400
    
    try:
        # Verify OTP with Supabase Auth
        verified = supabase.auth.verify_otp({
            'email' if method == 'email' else 'phone': contact,
            'token': otp,
            'type': method  # 'email' or 'sms'
        })
        
        if verified:
            # Find customer by email or phone
            if method == 'email':
                user_res = supabase.table('user').select('user_id').eq('email', contact).execute()
            else:
                customer = supabase.table('customer').select('user_id').eq('phone_number', contact).execute()
                if customer.data:
                    user_res = supabase.table('user').select('user_id').eq('user_id', customer.data[0]['user_id']).execute()
            
            if user_res.data:
                user_id = user_res.data[0]['user_id']
                hashed = hash_password(password)
                
                # Update password
                supabase.table('user').update({
                    'password': hashed
                }).eq('user_id', user_id).execute()
                
                return jsonify({'message': 'Password reset successfully.'}), 200
            else:
                return jsonify({'error': 'User not found.'}), 404
        else:
            return jsonify({'error': 'Invalid OTP.'}), 401
        
    except Exception as e:
        print(f"API OTP verification error: {e}")
        return jsonify({'error': 'OTP verification failed.'}), 500

# ─── PRODUCTS ─────────────────────────────────────────

@app.route('/api/products', methods=['GET'])
def api_products():
    try:
        category = request.args.get('category', '')
        res      = supabase.table('product').select(
            '*, discount(discount_name, percentage), branch_stock(branch_id, quantity, branch(branch_name)), option_groups, net_weight'
        ).eq('status', 'active')
        if category:
            res = res.eq('category', category)
        res = res.order('created_at', desc=True).execute()

        # Expand products with branch stock — one entry per branch
        expanded = []
        for p in res.data:
            branch_stocks = p.get('branch_stock', [])
            if not branch_stocks:
                # No branch stock — show as single product
                expanded.append(p)
            else:
                # available_at: both → 2 cards; single branch → 1 card
                for bs in branch_stocks:
                    entry = dict(p)
                    entry['branch_id']   = bs['branch_id']
                    entry['branch_name'] = bs.get('branch', {}).get('branch_name', '')
                    entry['quantity']    = bs['quantity']
                    expanded.append(entry)

        return jsonify(expanded), 200
    except Exception as e:
        print(f"API products error: {e}")
        return jsonify({'error': 'Failed to fetch products.'}), 500

@app.route('/api/products/<product_id>', methods=['GET'])
def api_product_detail(product_id):
    try:
        res = supabase.table('product').select('*, discount(discount_name, percentage)').eq('product_id', product_id).execute()
        if not res.data:
            return jsonify({'error': 'Product not found.'}), 404
        return jsonify(res.data[0]), 200
    except Exception as e:
        print(f"API product detail error: {e}")
        return jsonify({'error': 'Failed to fetch product.'}), 500

@app.route('/api/products/search', methods=['GET'])
def api_search():
    query    = request.args.get('q', '').strip()
    category = request.args.get('category', '').strip()
    try:
        res = supabase.table('product').select('*, discount(discount_name, percentage)').eq('status', 'active')
        if query:
            res = res.ilike('product_name', f'%{query}%')
        if category:
            res = res.eq('category', category)
        res = res.execute()
        return jsonify(res.data), 200
    except Exception as e:
        print(f"API search error: {e}")
        return jsonify({'error': 'Search failed.'}), 500

# ─── CART ─────────────────────────────────────────────

@app.route('/api/cart', methods=['GET'])
def api_get_cart():
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        res = supabase.table('cart').select(
            '*, product(product_id, product_name, price, image_url, brand, category, discount(discount_name, percentage))'
        ).eq('customer_id', customer_id).eq('status', 'active').execute()
        return jsonify(res.data), 200
    except Exception as e:
        print(f"API cart error: {e}")
        return jsonify({'error': 'Failed to fetch cart.'}), 500

@app.route('/api/cart', methods=['POST'])
def api_add_to_cart():
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data       = request.get_json()
    product_id = data.get('product_id')
    quantity   = data.get('quantity', 1)

    if not product_id:
        return jsonify({'error': 'Product ID is required.'}), 400

    try:
        existing = supabase.table('cart').select('*').eq('customer_id', customer_id).eq('product_id', product_id).eq('status', 'active').execute()

        if existing.data:
            cart_id      = existing.data[0]['cart_id']
            new_quantity = existing.data[0]['quantity'] + quantity
            res = supabase.table('cart').update({'quantity': new_quantity}).eq('cart_id', cart_id).execute()
        else:
            res = supabase.table('cart').insert({
                'customer_id': customer_id,
                'product_id':  product_id,
                'quantity':    quantity,
                'status':      'active'
            }).execute()

        return jsonify({'message': 'Item added to cart.', 'cart': res.data[0]}), 200

    except Exception as e:
        print(f"API add to cart error: {e}")
        return jsonify({'error': 'Failed to add to cart.'}), 500

@app.route('/api/cart/<cart_id>', methods=['PUT'])
def api_update_cart(cart_id):
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    data     = request.get_json()
    quantity = data.get('quantity', 1)
    try:
        res = supabase.table('cart').update({'quantity': quantity}).eq('cart_id', cart_id).eq('customer_id', customer_id).execute()
        return jsonify({'message': 'Cart updated.', 'cart': res.data[0]}), 200
    except Exception as e:
        print(f"API update cart error: {e}")
        return jsonify({'error': 'Failed to update cart.'}), 500

@app.route('/api/cart/<cart_id>', methods=['DELETE'])
def api_remove_from_cart(cart_id):
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        supabase.table('cart').update({'status': 'abandoned'}).eq('cart_id', cart_id).eq('customer_id', customer_id).execute()
        return jsonify({'message': 'Item removed from cart.'}), 200
    except Exception as e:
        print(f"API remove cart error: {e}")
        return jsonify({'error': 'Failed to remove item.'}), 500

# ─── ORDERS ───────────────────────────────────────────

@app.route('/api/orders', methods=['GET'])
def api_get_orders():
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        res = supabase.table('order').select(
            '*, order_item(order_item_id, product_id, qty, price, product(product_name, image_url, price)), payment(*)'
        ).eq('customer_id', customer_id).order('created_at', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        print(f"API get orders error: {e}")
        return jsonify({'error': 'Failed to fetch orders.'}), 500

@app.route('/api/orders', methods=['POST'])
def api_place_order():
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data           = request.get_json()
    cart_items     = data.get('cart_items', [])
    payment_method = data.get('payment_method', '')
    ref_no         = data.get('ref_no', '')

    if not cart_items or not payment_method:
        return jsonify({'error': 'Cart items and payment method are required.'}), 400

    if payment_method == 'gcash' and not ref_no:
        return jsonify({'error': 'GCash reference number is required.'}), 400

    try:
        total    = sum(item['price'] * item['quantity'] for item in cart_items)
        quantity = sum(item['quantity'] for item in cart_items)

        branch_id = data.get('branch_id')
        order_res = supabase.table('order').insert({
            'customer_id': customer_id,
            'order_type':  'online',
            'quantity':    quantity,
            'total':       total,
            'status':      'pending',
            'branch_id':   branch_id,
        }).execute()

        order_id    = order_res.data[0]['order_id']
        order_items = [{
            'order_id':   order_id,
            'product_id': item['product_id'],
            'qty':        item['quantity'],   # schema uses qty not quantity
            'price':      item['price']
        } for item in cart_items]

        supabase.table('order_item').insert(order_items).execute()

        payment_res = supabase.table('payment').insert({
            'order_id':       order_id,
            'customer_id':    customer_id,
            'payment_method': payment_method,
            'total':          total,
            'ref_no':         ref_no if ref_no else None,  # ref_no lives on payment
            'status':         'paid' if payment_method == 'gcash' else 'pending'
        }).execute()

        for item in cart_items:
            cart_id = item.get('cart_id')
            # Skip if cart_id is missing or 'buy_now' (Buy Now doesn't use cart)
            if cart_id and cart_id != 'buy_now':
                try:
                    supabase.table('cart').update({'status': 'checked_out'}).eq('cart_id', cart_id).execute()
                except Exception:
                    pass  # Non-critical — cart status update failure won't block order

        branch_id = data.get('branch_id')

        for item in cart_items:
            product_id = item['product_id']
            qty        = item['quantity']

            if branch_id:
                # Deduct from branch_stock
                bs_res = supabase.table('branch_stock').select('quantity').eq('product_id', product_id).eq('branch_id', branch_id).execute()
                if bs_res.data:
                    new_qty = max(bs_res.data[0]['quantity'] - qty, 0)
                    supabase.table('branch_stock').update({'quantity': new_qty}).eq('product_id', product_id).eq('branch_id', branch_id).execute()
            else:
                # Fallback — deduct from product quantity
                product_res = supabase.table('product').select('quantity').eq('product_id', product_id).execute()
                if product_res.data:
                    new_qty = max(product_res.data[0]['quantity'] - qty, 0)
                    supabase.table('product').update({'quantity': max(new_qty, 0)}).eq('product_id', product_id).execute()

        return jsonify({
            'message':  'Order placed successfully.',
            'order_id': order_id,
            'total':    total
        }), 201

    except Exception as e:
        print(f"API place order error: {e}")
        return jsonify({'error': 'Failed to place order.'}), 500


# ══════════════════════════════════════════════════════

# ─── CUSTOMER PROFILE ─────────────────────────────────

@app.route('/api/customer/profile', methods=['GET'])
def api_customer_profile():
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        res = supabase.table('customer').select('*').eq('customer_id', customer_id).execute()
        if not res.data:
            return jsonify({'error': 'Customer not found.'}), 404

        customer = res.data[0]

        # Also fetch username from user table
        user_res = supabase.table('user').select('username').eq('user_id', customer['user_id']).execute()
        if user_res.data:
            customer['username'] = user_res.data[0]['username']

        return jsonify(customer), 200
    except Exception as e:
        print(f'Customer profile error: {e}')
        return jsonify({'error': 'Failed to fetch profile.'}), 500


@app.route('/api/customer/profile', methods=['PUT'])
def api_update_customer_profile():
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data    = request.get_json()
        updates = {}

        if 'fname'        in data: updates['fname']        = data['fname'].strip()
        if 'mi'           in data: updates['mi']           = data['mi'].strip()
        if 'lname'        in data: updates['lname']        = data['lname'].strip()
        if 'dob'          in data: updates['dob']          = data['dob'] or None
        if 'gender'       in data: updates['gender']       = data['gender'] or None
        if 'email'        in data: updates['email']        = data['email'].strip()
        if 'phone_number' in data: updates['phone_number'] = data['phone_number'].strip()
        if 'address'      in data: updates['address']      = data['address'].strip()

        if not updates:
            return jsonify({'error': 'No fields to update.'}), 400

        # Update username in user table if provided
        if 'username' in data and data['username'].strip():
            username = data['username'].strip()
            # Check if username is taken by another user
            cust_res = supabase.table('customer').select('user_id').eq('customer_id', customer_id).execute()
            if cust_res.data:
                user_id       = cust_res.data[0]['user_id']
                existing_user = supabase.table('user').select('user_id').eq('username', username).neq('user_id', user_id).execute()
                if existing_user.data:
                    return jsonify({'error': 'Username is already taken.'}), 409
                supabase.table('user').update({'username': username}).eq('user_id', user_id).execute()

        supabase.table('customer').update(updates).eq('customer_id', customer_id).execute()
        return jsonify({'message': 'Profile updated successfully.'}), 200
    except Exception as e:
        print(f'Update profile error: {e}')
        return jsonify({'error': 'Failed to update profile.'}), 500


@app.route('/api/customer/change-password', methods=['PUT'])
def api_change_password():
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data         = request.get_json()
        old_password = data.get('old_password', '')
        new_password = data.get('new_password', '')

        if not old_password or not new_password:
            return jsonify({'error': 'Both old and new passwords are required.'}), 400

        if len(new_password) < 8:
            return jsonify({'error': 'New password must be at least 8 characters.'}), 400

        # Get user_id from customer
        cust_res = supabase.table('customer').select('user_id').eq('customer_id', customer_id).execute()
        if not cust_res.data:
            return jsonify({'error': 'Customer not found.'}), 404

        user_id  = cust_res.data[0]['user_id']
        user_res = supabase.table('user').select('password').eq('user_id', user_id).execute()
        if not user_res.data:
            return jsonify({'error': 'User not found.'}), 404

        stored_hash = user_res.data[0]['password']

        # Verify old password
        if not verify_password(old_password, stored_hash):
            return jsonify({'error': 'Current password is incorrect.'}), 401

        # Hash and save new password
        new_hash = hash_password(new_password)
        supabase.table('user').update({'password': new_hash}).eq('user_id', user_id).execute()

        return jsonify({'message': 'Password changed successfully.'}), 200
    except Exception as e:
        print(f'Change password error: {e}')
        return jsonify({'error': 'Failed to change password.'}), 500





# ══════════════════════════════════════════════════════
# STOCK REQUEST ROUTES
# ══════════════════════════════════════════════════════

# ─── Staff: Submit stock request ─────────────────────
@app.route('/api/staff/stock-requests', methods=['GET'])
@staff_required
def staff_get_stock_requests():
    try:
        staff_id = session.get('staff_id')
        res = supabase.table('stock_request').select(
            '*, product(product_name, quantity), branch(branch_name)'
        ).eq('staff_id', staff_id).order('created_at', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/stock-requests', methods=['POST'])
@staff_required
def staff_create_stock_request():
    try:
        data           = request.get_json()
        staff_id       = session.get('staff_id')
        product_id     = data.get('product_id')
        quantity_needed = int(data.get('quantity_needed', 0))
        note           = data.get('note', '')
        branch_id      = data.get('branch_id')

        if not product_id or quantity_needed <= 0:
            return jsonify({'error': 'Product and quantity are required.'}), 400

        res = supabase.table('stock_request').insert({
            'staff_id':       staff_id,
            'branch_id':      branch_id,
            'product_id':     product_id,
            'quantity_needed': quantity_needed,
            'note':           note,
            'status':         'pending',
        }).execute()
        return jsonify(res.data[0]), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Admin: View all stock requests ──────────────────
@app.route('/api/admin/stock-requests', methods=['GET'])
@admin_required
def admin_get_stock_requests():
    try:
        res = supabase.table('stock_request').select(
            '*, product(product_name, quantity), staff(fname, lname), branch(branch_name)'
        ).order('created_at', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/stock-requests/<request_id>', methods=['PUT'])
@admin_required
def admin_update_stock_request(request_id):
    try:
        data       = request.get_json()
        status     = data.get('status')  # approved | rejected
        admin_note = data.get('admin_note', '')

        supabase.table('stock_request').update({
            'status':     status,
            'admin_note': admin_note,
            'updated_at': 'now()',
        }).eq('request_id', request_id).execute()
        return jsonify({'message': f'Request {status}.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ══════════════════════════════════════════════════════
# PURCHASE ORDER ROUTES
# ══════════════════════════════════════════════════════

@app.route('/api/admin/purchase-orders', methods=['GET'])
@admin_required
def admin_get_purchase_orders():
    try:
        res = supabase.table('purchase_order').select(
            '*, po_item(*, product(product_name, quantity)), created_by:staff!purchase_order_created_by_fkey(fname, lname)'
        ).order('created_at', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/purchase-orders', methods=['POST'])
@admin_required
def admin_create_purchase_order():
    try:
        data     = request.get_json()
        supplier = data.get('supplier', '').strip()
        note     = data.get('note', '')
        items    = data.get('items', [])  # [{product_id, quantity, unit_cost}]
        staff_id = session.get('staff_id')

        if not supplier or not items:
            return jsonify({'error': 'Supplier and items are required.'}), 400

        # Generate PO number
        count   = supabase.table('purchase_order').select('po_id', count='exact').execute()
        po_num  = f"PO-{datetime.now().strftime('%Y%m')}-{str((count.count or 0) + 1).zfill(3)}"

        po_res  = supabase.table('purchase_order').insert({
            'po_number':  po_num,
            'supplier':   supplier,
            'note':       note,
            'status':     'draft',
            'created_by': staff_id,
        }).execute()

        po_id = po_res.data[0]['po_id']

        # Insert PO items
        for item in items:
            supabase.table('po_item').insert({
                'po_id':      po_id,
                'product_id': item['product_id'],
                'quantity':   int(item['quantity']),
                'unit_cost':  float(item.get('unit_cost', 0)),
            }).execute()

        return jsonify({'message': 'Purchase order created.', 'po_id': po_id, 'po_number': po_num}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/purchase-orders/<po_id>', methods=['PUT'])
@admin_required
def admin_update_purchase_order(po_id):
    try:
        data   = request.get_json()
        status = data.get('status')
        updates = {'status': status, 'updated_at': 'now()'}
        if data.get('supplier'): updates['supplier'] = data['supplier']
        if data.get('note'):     updates['note']     = data['note']
        supabase.table('purchase_order').update(updates).eq('po_id', po_id).execute()

        # If received → add stock for each item
        if status == 'received':
            items_res = supabase.table('po_item').select(
                '*, product(quantity)'
            ).eq('po_id', po_id).execute()
            for item in items_res.data:
                product    = item.get('product') or {}
                qty_before = product.get('quantity', 0)
                qty_added  = item['quantity']
                qty_after  = qty_before + qty_added
                supabase.table('product').update({
                    'quantity': qty_after, 'updated_at': 'now()'
                }).eq('product_id', item['product_id']).execute()
                supabase.table('inventory').insert({
                    'product_id':      item['product_id'],
                    'staff_id':        session.get('staff_id'),
                    'quantity_added':  qty_added,
                    'quantity_before': qty_before,
                    'quantity_after':  qty_after,
                    'note':            f'PO received — {data.get("po_number", po_id)}',
                }).execute()

        return jsonify({'message': f'PO status updated to {status}.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500






# ─── Email OTP Helper ─────────────────────────────────
def send_otp_email(recipient_email, otp):
    try:
        msg = Message(
            subject    = 'Your OTP — Triple E & Fiel Collins',
            recipients = [recipient_email],
            body       = f"""Hello,

Your One-Time Password (OTP) for password reset is:

    {otp}

This code expires in 5 minutes.
Do not share this with anyone.

— Triple E & Fiel Collins General Merchandise"""
        )
        mail.send(msg)
        return True
    except Exception as e:
        print(f'Email error: {e}')
        return False

# ══════════════════════════════════════════════════════
# FORGOT PASSWORD — GMAIL OTP ROUTES (Mobile)
# ══════════════════════════════════════════════════════

@app.route('/api/auth/forgot-password', methods=['POST'])
def api_auth_forgot_password():
    try:
        data  = request.get_json()
        email = data.get('email', '').strip().lower()
        if not email:
            return jsonify({'error': 'Email is required.'}), 400

        # Email is in customer table — get user_id from there
        cust_res = supabase.table('customer').select('user_id, email').eq('email', email).execute()
        if not cust_res.data:
            return jsonify({'message': 'If this email exists, an OTP has been sent.'}), 200

        # Generate OTP
        otp        = str(random.randint(100000, 999999))
        expires_at = (datetime.now() + timedelta(minutes=5)).isoformat()

        # Invalidate old OTPs
        supabase.table('otp_codes').update({'used': True}).eq('email', email).eq('used', False).execute()

        # Store new OTP
        supabase.table('otp_codes').insert({
            'email':      email,
            'otp':        otp,
            'expires_at': expires_at,
            'used':       False,
        }).execute()

        # Send email
        sent = send_otp_email(email, otp)
        if not sent:
            return jsonify({'error': 'Failed to send OTP. Please try again.'}), 500

        return jsonify({'message': 'If this email exists, an OTP has been sent.'}), 200
    except Exception as e:
        print(f'Forgot password error: {e}')
        return jsonify({'error': 'Something went wrong.'}), 500


@app.route('/api/auth/verify-otp', methods=['POST'])
def api_auth_verify_otp():
    try:
        data  = request.get_json()
        email = data.get('email', '').strip().lower()
        otp   = data.get('otp', '').strip()
        if not email or not otp:
            return jsonify({'error': 'Email and OTP are required.'}), 400

        res = supabase.table('otp_codes').select('*').eq('email', email).eq('otp', otp).eq('used', False).execute()
        if not res.data:
            return jsonify({'error': 'Invalid OTP. Please try again.'}), 400

        otp_record = res.data[0]
        expires_at = datetime.fromisoformat(otp_record['expires_at'])
        if datetime.now() > expires_at:
            return jsonify({'error': 'OTP has expired. Please request a new one.'}), 400

        supabase.table('otp_codes').update({'used': True}).eq('id', otp_record['id']).execute()
        return jsonify({'message': 'OTP verified.', 'email': email}), 200
    except Exception as e:
        print(f'Verify OTP error: {e}')
        return jsonify({'error': 'Something went wrong.'}), 500


@app.route('/api/auth/reset-password', methods=['POST'])
def api_auth_reset_password():
    try:
        data         = request.get_json()
        email        = data.get('email', '').strip().lower()
        new_password = data.get('new_password', '')
        if not email or not new_password:
            return jsonify({'error': 'Email and new password are required.'}), 400
        if len(new_password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters.'}), 400

        cust_res = supabase.table('customer').select('user_id').eq('email', email).execute()
        if not cust_res.data:
            return jsonify({'error': 'User not found.'}), 404

        new_hash = hash_password(new_password)
        supabase.table('user').update({'password': new_hash}).eq('user_id', cust_res.data[0]['user_id']).execute()
        return jsonify({'message': 'Password reset successfully.'}), 200
    except Exception as e:
        print(f'Reset password error: {e}')
        return jsonify({'error': 'Something went wrong.'}), 500



# ─── Branch Stock API ────────────────────────────────

@app.route('/api/admin/branch-stock', methods=['POST'])
@admin_required
def admin_add_branch_stock():
    try:
        data       = request.get_json()
        product_id = data.get('product_id')
        branch_id  = data.get('branch_id')
        quantity   = int(data.get('quantity', 0))

        if not product_id or not branch_id or quantity <= 0:
            return jsonify({'error': 'Product, branch and quantity are required.'}), 400

        # Upsert branch stock
        existing = supabase.table('branch_stock').select('*').eq('product_id', product_id).eq('branch_id', branch_id).execute()

        if existing.data:
            qty_before = existing.data[0]['quantity']
            new_qty    = qty_before + quantity
            supabase.table('branch_stock').update({
                'quantity':   new_qty,
                'updated_at': 'now()'
            }).eq('product_id', product_id).eq('branch_id', branch_id).execute()
        else:
            qty_before = 0
            new_qty    = quantity
            supabase.table('branch_stock').insert({
                'product_id': product_id,
                'branch_id':  branch_id,
                'quantity':   quantity,
            }).execute()

        # Record in inventory — use branch_stock qty for before/after, NOT product.quantity
        supabase.table('inventory').insert({
            'product_id':      product_id,
            'staff_id':        session.get('staff_id'),
            'quantity_added':  quantity,
            'quantity_before': qty_before,
            'quantity_after':  new_qty,
            'from_branch_id':  None,  # Restock from supplier — no from branch
            'to_branch_id':    branch_id,
            'note':            'Branch stock added — restock',
        }).execute()

        return jsonify({'message': 'Branch stock updated.'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/branch-stock', methods=['GET'])
@admin_required
def admin_get_branch_stock():
    try:
        res = supabase.table('branch_stock').select(
            '*, product(product_name, category), branch(branch_name)'
        ).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ADMIN API ROUTES — Dashboard Data
# ══════════════════════════════════════════════════════

# ─── Branches ─────────────────────────────────────────

@app.route('/api/admin/branches', methods=['GET'])
@admin_required
def admin_get_branches():
    try:
        res = supabase.table('branch').select('*').order('branch_name').execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/branches', methods=['POST'])
@admin_required
def admin_add_branch():
    try:
        data        = request.get_json()
        branch_name = data.get('branch_name', '').strip()
        address     = data.get('address', '').strip()

        if not branch_name:
            return jsonify({'error': 'Branch name is required.'}), 400

        res = supabase.table('branch').insert({
            'branch_name': branch_name,
            'address':     address
        }).execute()

        return jsonify(res.data[0]), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/branches/<branch_id>', methods=['PUT'])
@admin_required
def admin_update_branch(branch_id):
    try:
        data    = request.get_json()
        updates = {}
        if 'branch_name' in data: updates['branch_name'] = data['branch_name']
        if 'address'     in data: updates['address']     = data['address']
        res = supabase.table('branch').update(updates).eq('branch_id', branch_id).execute()
        return jsonify(res.data[0]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/branches/<branch_id>', methods=['DELETE'])
@admin_required
def admin_delete_branch(branch_id):
    try:
        supabase.table('branch').delete().eq('branch_id', branch_id).execute()
        return jsonify({'message': 'Branch deleted.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Discounts ────────────────────────────────────────

@app.route('/api/admin/discounts', methods=['GET'])
@admin_required
def admin_get_discounts():
    try:
        res = supabase.table('discount').select('*').order('created_at', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/discounts', methods=['POST'])
@admin_required
def admin_add_discount():
    try:
        data          = request.get_json()
        discount_name = data.get('discount_name', '').strip()
        percentage    = data.get('percentage')

        if not discount_name or percentage is None:
            return jsonify({'error': 'Discount name and percentage are required.'}), 400

        if not (0 < float(percentage) <= 100):
            return jsonify({'error': 'Percentage must be between 0 and 100.'}), 400

        res = supabase.table('discount').insert({
            'discount_name': discount_name,
            'percentage':    float(percentage)
        }).execute()

        return jsonify(res.data[0]), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/discounts/<discount_id>', methods=['PUT'])
@admin_required
def admin_update_discount(discount_id):
    try:
        data    = request.get_json()
        updates = {'updated_at': 'now()'}
        if 'discount_name' in data: updates['discount_name'] = data['discount_name']
        if 'percentage'    in data:
            if not (0 < float(data['percentage']) <= 100):
                return jsonify({'error': 'Percentage must be between 0 and 100.'}), 400
            updates['percentage'] = float(data['percentage'])

        res = supabase.table('discount').update(updates).eq('discount_id', discount_id).execute()
        return jsonify(res.data[0]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/discounts/<discount_id>', methods=['DELETE'])
@admin_required
def admin_delete_discount(discount_id):
    try:
        # Unlink discount from products before deleting
        supabase.table('product').update({'discount_id': None}).eq('discount_id', discount_id).execute()
        supabase.table('discount').delete().eq('discount_id', discount_id).execute()
        return jsonify({'message': 'Discount deleted.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/discounts/<discount_id>/assign', methods=['POST'])
@admin_required
def admin_assign_discount(discount_id):
    """Assign a discount to one or more products."""
    try:
        data        = request.get_json()
        product_ids = data.get('product_ids', [])

        if not product_ids:
            return jsonify({'error': 'At least one product ID is required.'}), 400

        for pid in product_ids:
            supabase.table('product').update({
                'discount_id': discount_id,
                'updated_at':  'now()'
            }).eq('product_id', pid).execute()

        return jsonify({'message': f'Discount assigned to {len(product_ids)} product(s).'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/discounts/unassign', methods=['POST'])
@admin_required
def admin_unassign_discount():
    """Remove discount from one or more products."""
    try:
        data        = request.get_json()
        product_ids = data.get('product_ids', [])

        if not product_ids:
            return jsonify({'error': 'At least one product ID is required.'}), 400

        for pid in product_ids:
            supabase.table('product').update({
                'discount_id': None,
                'updated_at':  'now()'
            }).eq('product_id', pid).execute()

        return jsonify({'message': f'Discount removed from {len(product_ids)} product(s).'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Products ─────────────────────────────────────────

@app.route('/api/admin/products', methods=['GET'])
@admin_required
def admin_get_products():
    try:
        res = supabase.table('product').select('*, discount(discount_id, discount_name, percentage), branch_stock(branch_id, quantity, branch(branch_name))').order('created_at', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products', methods=['POST'])
@admin_required
def admin_add_product():
    try:
        product_name = request.form.get('product_name', '').strip()
        brand        = request.form.get('brand', '').strip()
        category     = request.form.get('category', '').strip()
        price        = request.form.get('price', 0)
        quantity     = request.form.get('quantity', 0)
        status       = request.form.get('status', 'active')
        description  = request.form.get('description', '').strip()
        discount_id  = request.form.get('discount_id') or None

        if not product_name or not category:
            return jsonify({'error': 'Product name and category are required.'}), 400

        # Handle multiple images
        images    = request.files.getlist('images')
        image_urls = []
        for img in images[:20]:  # max 5
            file_bytes = img.read()
            file_name    = f"products/{product_name.replace(' ', '_')}_{img.filename}"
            content_type = img.content_type or 'image/jpeg'
            supabase.storage.from_('product-images').upload(file_name, file_bytes, {'content-type': str(content_type)})
            url = supabase.storage.from_('product-images').get_public_url(file_name)
            image_urls.append(url)

        # Fallback: single image field
        if not image_urls:
            image = request.files.get('image')
            if image:
                file_bytes = image.read()
                file_name  = f"products/{product_name.replace(' ', '_')}_{image.filename}"
                supabase.storage.from_('product-images').upload(file_name, file_bytes, {'content-type': image.content_type})
                image_urls = [supabase.storage.from_('product-images').get_public_url(file_name)]

        image_url = image_urls[0] if image_urls else None

        available_at = request.form.get('available_at', 'both')
        variants_raw = request.form.get('variants', '[]')
        try:
            variants = json.loads(variants_raw) if variants_raw else []
        except Exception:
            variants = []

        option_groups_raw = request.form.get('option_groups', '[]')
        try:
            option_groups = json.loads(option_groups_raw) if option_groups_raw else []
        except Exception:
            option_groups = []

        net_weight      = float(request.form.get('net_weight', 0) or 0)
        net_weight_unit = request.form.get('net_weight_unit', 'kg')

        res = supabase.table('product').insert({
            'staff_id':      session.get('staff_id'),
            'discount_id':   discount_id,
            'product_name':  product_name,
            'brand':         brand,
            'category':      category,
            'price':         float(price),
            'quantity':      int(quantity),
            'status':        status,
            'description':   description,
            'image_url':     image_url,
            'image_urls':    image_urls,
            'available_at':  available_at,
            'variants':      variants,
            'option_groups': option_groups,
            'net_weight':      net_weight,
            'net_weight_unit': net_weight_unit,
        }).execute()

        return jsonify(res.data[0]), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products/<product_id>', methods=['PUT'])
@admin_required
def admin_update_product(product_id):
    try:
        discount_id = request.form.get('discount_id') or None
        variants_raw = request.form.get('variants', '[]')
        try:
            variants = json.loads(variants_raw) if variants_raw else []
        except Exception:
            variants = []

        option_groups_raw = request.form.get('option_groups', '[]')
        try:
            option_groups = json.loads(option_groups_raw) if option_groups_raw else []
        except Exception:
            option_groups = []

        net_weight      = float(request.form.get('net_weight', 0) or 0)
        net_weight_unit = request.form.get('net_weight_unit', 'kg')

        updates = {
            'product_name': request.form.get('product_name'),
            'brand':        request.form.get('brand'),
            'category':     request.form.get('category'),
            'price':        float(request.form.get('price', 0)),
            'quantity':     int(request.form.get('quantity', 0)),
            'status':       request.form.get('status'),
            'description':  request.form.get('description'),
            'discount_id':  discount_id,
            'available_at':  request.form.get('available_at', 'both'),
            'option_groups': option_groups,
            'net_weight':      net_weight,
            'net_weight_unit': net_weight_unit,
            'variants':        variants,
            'updated_at':   'now()',
        }

        # Handle multiple images
        images = request.files.getlist('images')
        existing_raw = request.form.get('existing_images', '[]')
        try:
            existing_urls = json.loads(existing_raw)
        except Exception:
            existing_urls = []

        new_urls = []
        for img in images[:20]:
            if not img or not img.filename:
                continue
            file_bytes   = img.read()
            file_name    = f"products/{product_id}_{img.filename}"
            content_type = img.content_type or 'image/jpeg'
            supabase.storage.from_('product-images').upload(file_name, file_bytes, {'content-type': str(content_type), 'upsert': True})
            url = supabase.storage.from_('product-images').get_public_url(file_name)
            new_urls.append(url)

        all_urls = existing_urls + new_urls
        if all_urls:
            updates['image_url']  = all_urls[0]
            updates['image_urls'] = all_urls

        res = supabase.table('product').update(updates).eq('product_id', product_id).execute()
        return jsonify(res.data[0]), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"PUT product error: {type(e).__name__}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products/<product_id>', methods=['DELETE'])
@admin_required
def admin_delete_product(product_id):
    try:
        supabase.table('product').update({'status': 'inactive'}).eq('product_id', product_id).execute()
        return jsonify({'message': 'Product deactivated.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Inventory ────────────────────────────────────────

@app.route('/api/admin/inventory', methods=['GET'])
@admin_required
def admin_get_inventory():
    try:
        res = supabase.table('inventory').select(
            '*, product(product_name, category), staff(fname, lname), from_branch:branch!from_branch_id(branch_name), to_branch:branch!to_branch_id(branch_name)'
        ).order('date', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/inventory', methods=['POST'])
@admin_required
def admin_add_inventory():
    try:
        data           = request.get_json()
        product_id     = data.get('product_id')
        qty_change     = int(data.get('quantity', 0))
        from_branch_id = data.get('from_branch_id')
        to_branch_id   = data.get('to_branch_id')
        note           = data.get('note', '')
        inv_type       = data.get('type', 'restock')  # restock | transfer | adjustment

        if not product_id or qty_change == 0:
            return jsonify({'error': 'Product and quantity are required.'}), 400

        if inv_type == 'transfer' and from_branch_id:
            # ── Transfer: move stock from source branch to destination branch ──
            src = supabase.table('branch_stock').select('quantity').eq('product_id', product_id).eq('branch_id', from_branch_id).execute()
            if not src.data or src.data[0]['quantity'] < qty_change:
                available = src.data[0]['quantity'] if src.data else 0
                return jsonify({'error': f'Insufficient stock in source branch. Only {available} unit(s) available.'}), 400

            qty_before = src.data[0]['quantity']
            qty_after  = qty_before - qty_change

            # Deduct from source branch
            supabase.table('branch_stock').update({
                'quantity':   qty_after,
                'updated_at': 'now()'
            }).eq('product_id', product_id).eq('branch_id', from_branch_id).execute()

            # Add to destination branch
            if to_branch_id:
                dst = supabase.table('branch_stock').select('quantity').eq('product_id', product_id).eq('branch_id', to_branch_id).execute()
                if dst.data:
                    supabase.table('branch_stock').update({
                        'quantity':   dst.data[0]['quantity'] + qty_change,
                        'updated_at': 'now()'
                    }).eq('product_id', product_id).eq('branch_id', to_branch_id).execute()
                else:
                    supabase.table('branch_stock').insert({
                        'product_id': product_id,
                        'branch_id':  to_branch_id,
                        'quantity':   qty_change,
                    }).execute()

        else:
            # ── Restock or adjustment: update to_branch stock only ──
            if not to_branch_id:
                return jsonify({'error': 'Destination branch is required for restock/adjustment.'}), 400

            dst = supabase.table('branch_stock').select('quantity').eq('product_id', product_id).eq('branch_id', to_branch_id).execute()
            qty_before = dst.data[0]['quantity'] if dst.data else 0
            qty_after  = qty_before + qty_change

            if qty_after < 0:
                return jsonify({'error': f'Insufficient stock. Only {qty_before} unit(s) available.'}), 400

            if dst.data:
                supabase.table('branch_stock').update({
                    'quantity':   qty_after,
                    'updated_at': 'now()'
                }).eq('product_id', product_id).eq('branch_id', to_branch_id).execute()
            else:
                supabase.table('branch_stock').insert({
                    'product_id': product_id,
                    'branch_id':  to_branch_id,
                    'quantity':   qty_change,
                }).execute()

            qty_before_log = qty_before
            qty_after_log  = qty_after

        # Log to inventory table
        supabase.table('inventory').insert({
            'product_id':      product_id,
            'staff_id':        session.get('staff_id'),
            'quantity_added':  qty_change,
            'quantity_before': qty_before if inv_type == 'transfer' else qty_before_log,
            'quantity_after':  qty_after  if inv_type == 'transfer' else qty_after_log,
            'from_branch_id':  from_branch_id,
            'to_branch_id':    to_branch_id,
            'note':            note,
        }).execute()

        return jsonify({'message': 'Stock updated.'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── ORDERS ───────────────────────────────────────────

@app.route('/api/admin/orders', methods=['GET'])
@admin_required
def admin_get_orders():
    try:
        limit = request.args.get('limit', default=50, type=int)
        if limit <= 0:
            limit = 50
        if limit > 500:
            limit = 500

        res = supabase.table('order').select(
            'order_id, total, status, order_type, date, created_at, branch_id, customer(fname, lname), staff(fname, lname), order_item(order_item_id, product_id, qty, price, product(product_name)), payment(payment_method, total, status, ref_no)'
        ).order('created_at', desc=True).limit(limit).execute()

        # Flatten payment array → single object
        for o in res.data:
            if isinstance(o.get('payment'), list):
                o['payment'] = o['payment'][0] if o['payment'] else None

        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/orders/<order_id>', methods=['PUT'])
@admin_required
def admin_update_order(order_id):
    try:
        data   = request.get_json()
        status = data.get('status')
        supabase.table('order').update({'status': status}).eq('order_id', order_id).execute()
        return jsonify({'message': 'Order status updated.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Sales Transactions ───────────────────────────────

@app.route('/api/admin/transactions', methods=['GET'])
@admin_required
def admin_get_transactions():
    try:
        res = supabase.table('sales_transaction').select(
            '*, order(*), staff(fname, lname), branch(branch_name), payment(payment_method, total, status)'
        ).order('transaction_date', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Payments ─────────────────────────────────────────

@app.route('/api/admin/payments', methods=['GET'])
@admin_required
def admin_get_payments():
    try:
        res = supabase.table('payment').select('*').order('date', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Users ────────────────────────────────────────────

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_get_users():
    try:
        res = supabase.table('user').select(
            '*, staff(fname, mi, lname, email, phone_number), customer(fname, lname, email)'
        ).order('created_at', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['POST'])
@admin_required
def admin_add_user():
    try:
        data      = request.get_json()
        fname     = data.get('fname', '').strip()
        mi        = data.get('mi', '').strip()
        lname     = data.get('lname', '').strip()
        email     = data.get('email', '').strip()
        phone     = data.get('phone', '').strip()
        username  = data.get('username', '').strip()
        role      = data.get('role', 'staff')
        password  = data.get('password', '')
        branch_id = data.get('branch_id') or None

        if not all([fname, lname, email, username, password]):
            return jsonify({'error': 'All required fields must be filled.'}), 400

        if supabase.table('user').select('user_id').eq('username', username).execute().data:
            return jsonify({'error': 'Username already taken.'}), 409

        hashed   = hash_password(password)
        user_res = supabase.table('user').insert({
            'username': username,
            'password': hashed,
            'role':     role,
            'status':   'active',
        }).execute()

        user_id = user_res.data[0]['user_id']
        supabase.table('staff').insert({
            'user_id':      user_id,
            'branch_id':    branch_id,
            'fname':        fname,
            'mi':           mi,
            'lname':        lname,
            'email':        email,
            'phone_number': phone,
            'position':     role,
        }).execute()

        return jsonify({'message': 'Staff added successfully.'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>', methods=['PUT'])
@admin_required
def admin_update_user(user_id):
    try:
        data    = request.get_json()
        updates = {}
        if 'status' in data: updates['status'] = data['status']
        if 'role'   in data: updates['role']   = data['role']
        supabase.table('user').update(updates).eq('user_id', user_id).execute()

        staff_updates = {}
        if 'fname'     in data: staff_updates['fname']        = data['fname']
        if 'lname'     in data: staff_updates['lname']        = data['lname']
        if 'email'     in data: staff_updates['email']        = data['email']
        if 'phone'     in data: staff_updates['phone_number'] = data['phone']
        if 'branch_id' in data: staff_updates['branch_id']   = data['branch_id']
        if staff_updates:
            supabase.table('staff').update(staff_updates).eq('user_id', user_id).execute()

        return jsonify({'message': 'User updated.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Customers ────────────────────────────────────────

@app.route('/api/admin/customers', methods=['GET'])
@admin_required
def admin_get_customers():
    try:
        res = supabase.table('customer').select('*').execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════
# STAFF API ROUTES — Dashboard Data
# ══════════════════════════════════════════════════════

# ─── Staff Branches (read-only) ───────────────────────

@app.route('/api/staff/branches', methods=['GET'])
@staff_required
def staff_get_branches():
    try:
        res = supabase.table('branch').select('*').order('branch_name').execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Staff My Branch ──────────────────────────────────

@app.route('/api/staff/my-branch', methods=['GET'])
@staff_required
def staff_my_branch():
    try:
        staff_id = session.get('staff_id')
        if not staff_id:
            return jsonify({'error': 'Staff not found in session.'}), 401

        res = supabase.table('staff').select(
            'branch_id, branch(branch_id, branch_name, address)'
        ).eq('staff_id', staff_id).execute()

        if not res.data or not res.data[0].get('branch_id'):
            return jsonify({'branch_id': None, 'branch_name': 'No Branch Assigned'}), 200

        branch = res.data[0].get('branch')
        if isinstance(branch, list):
            branch = branch[0] if branch else {}

        return jsonify({
            'branch_id':   branch.get('branch_id'),
            'branch_name': branch.get('branch_name'),
            'address':     branch.get('address'),
        }), 200
    except Exception as e:
        print(f"Staff my-branch error: {e}")
        return jsonify({'error': str(e)}), 500

# ─── Staff Orders ─────────────────────────────────────

@app.route('/api/staff/orders', methods=['GET'])
@staff_required
def staff_get_orders():
    try:
        limit = request.args.get('limit', default=50, type=int)
        if limit <= 0:
            limit = 50
        if limit > 200:
            limit = 200

        staff_id = session.get('staff_id')

        # Get staff's assigned branch
        staff_res = supabase.table('staff').select('branch_id').eq('staff_id', staff_id).execute()
        branch_id = staff_res.data[0]['branch_id'] if staff_res.data else None

        query = supabase.table('order').select(
            'order_id, total, status, order_type, date, created_at, branch_id, customer(fname, lname), staff(fname, lname), order_item(order_item_id, product_id, qty, price, product(product_name)), payment(payment_method)'
        ).order('created_at', desc=True).limit(limit)

        # Filter to this branch's orders only
        if branch_id:
            query = query.eq('branch_id', branch_id)

        res = query.execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/orders', methods=['POST'])
@staff_required
def staff_place_order():
    try:
        data           = request.get_json()
        cart_items     = data.get('cart_items', [])
        payment_method = data.get('payment_method', '')
        ref_no         = data.get('ref_no', '')
        order_type     = data.get('order_type', 'walk_in')
        quantity       = data.get('quantity', 0)
        total          = data.get('total', 0)
        branch_id      = data.get('branch_id')  # which branch processed this sale

        if not cart_items or not payment_method:
            return jsonify({'error': 'Cart items and payment method are required.'}), 400

        if payment_method == 'gcash' and not ref_no:
            return jsonify({'error': 'GCash reference number is required.'}), 400

        # ── Create order ──────────────────────────────
        order_res = supabase.table('order').insert({
            'staff_id':   session.get('staff_id'),
            'order_type': order_type,
            'quantity':   quantity,
            'total':      total,
            'status':     'completed',
        }).execute()

        order_id = order_res.data[0]['order_id']

        # ── Create order items ────────────────────────
        supabase.table('order_item').insert([{
            'order_id':   order_id,
            'product_id': item['product_id'],
            'qty':        item['quantity'],   # schema uses qty not quantity
            'price':      item['price'],
        } for item in cart_items]).execute()

        # ── Create payment ────────────────────────────
        payment_res = supabase.table('payment').insert({
            'order_id':       order_id,
            'payment_method': payment_method,
            'total':          total,
            'ref_no':         ref_no if ref_no else None,  # ref_no lives on payment
            'status':         'paid',
        }).execute()

        payment_id = payment_res.data[0]['payment_id']

        # ── Create sales transaction ──────────────────
        supabase.table('sales_transaction').insert({
            'order_id':        order_id,
            'staff_id':        session.get('staff_id'),
            'branch_id':       branch_id,
            'payment_id':      payment_id,
            'total_amount':    total,
            'transaction_date': 'now()',
        }).execute()

        # ── Deduct stock ──────────────────────────────
        for item in cart_items:
            product_id = item['product_id']
            qty        = item['quantity']

            # Deduct from branch_stock
            if branch_id:
                bs_res = supabase.table('branch_stock').select('quantity').eq('product_id', product_id).eq('branch_id', branch_id).execute()
                if bs_res.data:
                    new_branch_qty = max(bs_res.data[0]['quantity'] - qty, 0)
                    supabase.table('branch_stock').update({
                        'quantity': new_branch_qty, 'updated_at': 'now()'
                    }).eq('product_id', product_id).eq('branch_id', branch_id).execute()

            # Also deduct from product total quantity
            prod = supabase.table('product').select('quantity').eq('product_id', product_id).execute()
            if prod.data:
                new_qty = max(prod.data[0]['quantity'] - qty, 0)
                supabase.table('product').update({
                    'quantity':   new_qty,
                    'updated_at': 'now()'
                }).eq('product_id', product_id).execute()

        return jsonify({
            'message':  'Order processed successfully.',
            'order_id': order_id,
            'total':    total,
        }), 201

    except Exception as e:
        print(f"Staff place order error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/orders/<order_id>', methods=['PUT'])
@staff_required
def staff_update_order(order_id):
    try:
        data   = request.get_json()
        status = data.get('status')
        supabase.table('order').update({'status': status}).eq('order_id', order_id).execute()
        return jsonify({'message': 'Order updated.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Staff Inventory ──────────────────────────────────

@app.route('/api/staff/inventory', methods=['GET'])
@staff_required
def staff_get_inventory():
    try:
        staff_id = session.get('staff_id')

        # Get staff's assigned branch
        staff_res = supabase.table('staff').select('branch_id').eq('staff_id', staff_id).execute()
        branch_id = staff_res.data[0]['branch_id'] if staff_res.data else None

        query = supabase.table('inventory').select(
            '*, product(product_name, category), from_branch:branch!from_branch_id(branch_name), to_branch:branch!to_branch_id(branch_name)'
        )

        # Filter to records involving this branch (as source or destination)
        if branch_id:
            query = query.or_(f'to_branch_id.eq.{branch_id},from_branch_id.eq.{branch_id}')

        res = query.order('date', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/inventory', methods=['POST'])
@staff_required
def staff_add_inventory():
    try:
        data           = request.get_json()
        product_id     = data.get('product_id')
        qty_added      = int(data.get('quantity', 0))
        from_branch_id = data.get('from_branch_id')
        to_branch_id   = data.get('to_branch_id')
        note           = data.get('note', '')

        if not product_id or qty_added <= 0:
            return jsonify({'error': 'Product and quantity are required.'}), 400

        if not to_branch_id:
            return jsonify({'error': 'Destination branch is required.'}), 400

        # Read current branch_stock for the destination branch
        dst = supabase.table('branch_stock').select('quantity').eq('product_id', product_id).eq('branch_id', to_branch_id).execute()
        qty_before = dst.data[0]['quantity'] if dst.data else 0
        qty_after  = qty_before + qty_added

        # Update destination branch_stock
        if dst.data:
            supabase.table('branch_stock').update({
                'quantity':   qty_after,
                'updated_at': 'now()'
            }).eq('product_id', product_id).eq('branch_id', to_branch_id).execute()
        else:
            supabase.table('branch_stock').insert({
                'product_id': product_id,
                'branch_id':  to_branch_id,
                'quantity':   qty_added,
            }).execute()

        # Log to inventory table
        supabase.table('inventory').insert({
            'product_id':      product_id,
            'staff_id':        session.get('staff_id'),
            'quantity_added':  qty_added,
            'quantity_before': qty_before,
            'quantity_after':  qty_after,
            'from_branch_id':  from_branch_id,
            'to_branch_id':    to_branch_id,
            'note':            note,
        }).execute()

        return jsonify({'message': 'Stock updated.', 'quantity_after': qty_after}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ──────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
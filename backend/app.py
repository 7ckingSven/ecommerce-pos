from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from flask_cors import CORS
from supabase import create_client
from dotenv import load_dotenv
from datetime import timedelta
from functools import wraps
import bcrypt
import os

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

# ══════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(plain, hashed):
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

# ══════════════════════════════════════════════════════
# WEB ROUTES — Staff & Public Pages
# ══════════════════════════════════════════════════════

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/home')
def index():
    return render_template('index.html')

# ─── UNIFIED LOGIN ────────────────────────────────────

@app.route('/login', methods=['GET'])
def login():
    show_modal  = session.pop('show_access_code_modal', False)
    staff_token = session.get('staff_verified_token', '')
    return render_template('login.html',
        show_access_code_modal=show_modal,
        staff_token=staff_token
    )

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
        # Check user table by username
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

        if user['role'] == 'customer':
            customer_res = supabase.table('customer').select('*').eq('user_id', user['user_id']).execute()
            if customer_res.data:
                customer = customer_res.data[0]
                session['user_id']     = user['user_id']
                session['customer_id'] = customer['customer_id']
                session['role']        = 'customer'
                session['name']        = f"{customer['fname']} {customer['lname']}"
                return redirect(url_for('customer_dashboard'))
        elif user['role'] in ('admin', 'staff'):
            session['staff_verified_token']   = user['user_id']
            session['show_access_code_modal'] = True
            return redirect(url_for('login'))

    except Exception as e:
        print(f"Login error: {e}")
        flash('Something went wrong. Please try again.', 'error')

    return redirect(url_for('login'))

# ─── STAFF ACCESS CODE VERIFICATION ──────────────────

@app.route('/verify-staff-code', methods=['POST'])
def verify_staff_code():
    access_code = request.form.get('access_code', '')
    staff_token = request.form.get('staff_verified_token', '')

    if access_code == os.getenv('STAFF_ACCESS_CODE'):
        try:
            user_res = supabase.table('user').select('*').eq('user_id', staff_token).execute()
            if not user_res.data:
                flash('Invalid staff credentials.', 'error')
                return redirect(url_for('login'))

            user      = user_res.data[0]
            staff_res = supabase.table('staff').select('*').eq('user_id', staff_token).execute()

            if staff_res.data:
                staff = staff_res.data[0]
                session['user_id']  = user['user_id']
                session['staff_id'] = staff['staff_id']
                session['role']     = user['role']
                session['name']     = f"{staff['fname']} {staff['lname']}"
                session.pop('staff_verified_token', None)

                if user['role'] == 'admin':
                    return redirect(url_for('admin_dashboard'))
                elif user['role'] == 'staff':
                    return redirect(url_for('staff_dashboard'))

        except Exception as e:
            print(f"Staff verification error: {e}")
            flash('Something went wrong. Please try again.', 'error')
            return redirect(url_for('login'))
    else:
        flash('Invalid access code. Please try again.', 'error')
        session['show_access_code_modal'] = True
        session['staff_verified_token']   = staff_token

    return redirect(url_for('login'))

# ─── REGISTER ─────────────────────────────────────────

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        fname        = request.form.get('fname', '').strip()
        mi           = request.form.get('mi', '').strip()
        lname        = request.form.get('lname', '').strip()
        email        = request.form.get('email', '').strip()
        username     = request.form.get('username', '').strip()
        phone_number = request.form.get('phone_number', '').strip()
        password     = request.form.get('password', '')
        address      = request.form.get('address', '').strip()
        dob          = request.form.get('dob', '')
        gender       = request.form.get('gender', '')

        if not all([fname, lname, email, username, phone_number, password]):
            flash('Please fill in all required fields.', 'error')
            return redirect(url_for('register'))

        try:
            if supabase.table('user').select('user_id').eq('username', username).execute().data:
                flash('Username already taken. Please choose another.', 'error')
                return redirect(url_for('register'))

            if supabase.table('customer').select('customer_id').eq('email', email).execute().data:
                flash('Email already registered.', 'error')
                return redirect(url_for('register'))

            if supabase.table('customer').select('customer_id').eq('phone_number', phone_number).execute().data:
                flash('Phone number already registered.', 'error')
                return redirect(url_for('register'))

            hashed   = hash_password(password)
            user_res = supabase.table('user').insert({
                'username': username,
                'password': hashed,
                'role':     'customer',
                'status':   'active'
            }).execute()

            user_id = user_res.data[0]['user_id']

            supabase.table('customer').insert({
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

            flash('Account created successfully! Please log in.', 'success')
            return redirect(url_for('login'))

        except Exception as e:
            print(f"Registration error: {e}")
            flash('Registration failed. Please try again.', 'error')
            return redirect(url_for('register'))

    return render_template('register.html')

# ─── FORGOT PASSWORD ──────────────────────────────────

@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    flash('If this email is registered, a reset link has been sent.', 'success')
    return redirect(url_for('login'))

# ─── STAFF DASHBOARDS ─────────────────────────────────

@app.route('/admin/dashboard')
@login_required(role='admin')
def admin_dashboard():
    return render_template('admin/dashboard.html')

@app.route('/staff/dashboard')
@login_required(role='staff')
def staff_dashboard():
    return render_template('staff/dashboard.html')

@app.route('/admin/dashboard')
@login_required(role='admin')
def admin_dashboard_page():
    return render_template('admin/dashboard.html')

@app.route('/customer/dashboard')
@login_required(role='customer')
def customer_dashboard():
    return render_template('customer/dashboard.html')

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
                'lname':        customer['lname'],
                'email':        customer['email'],
                'phone_number': customer['phone_number'],
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

# ─── PRODUCTS ─────────────────────────────────────────

@app.route('/api/products', methods=['GET'])
def api_products():
    try:
        category = request.args.get('category', '')
        res      = supabase.table('product').select('*').eq('status', 'active')
        if category:
            res = res.eq('category', category)
        res = res.order('created_at', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        print(f"API products error: {e}")
        return jsonify({'error': 'Failed to fetch products.'}), 500

@app.route('/api/products/<product_id>', methods=['GET'])
def api_product_detail(product_id):
    try:
        res = supabase.table('product').select('*').eq('product_id', product_id).execute()
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
        res = supabase.table('product').select('*').eq('status', 'active')
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
            '*, product(product_id, product_name, price, image_url, brand, category)'
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
            '*, order_item(*, product(product_name, image_url, price)), payment(*)'
        ).eq('customer_id', customer_id).order('date', desc=True).execute()
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

        order_res = supabase.table('order').insert({
            'customer_id': customer_id,
            'order_type':  'online',
            'quantity':    quantity,
            'total':       total,
            'ref_no':      ref_no if ref_no else None,
            'status':      'pending'
        }).execute()

        order_id   = order_res.data[0]['order_id']
        order_items = [{
            'order_id':   order_id,
            'product_id': item['product_id'],
            'quantity':   item['quantity'],
            'price':      item['price']
        } for item in cart_items]

        supabase.table('order_item').insert(order_items).execute()

        supabase.table('payment').insert({
            'order_id':       order_id,
            'customer_id':    customer_id,
            'payment_method': payment_method,
            'total':          total,
            'ref_no':         ref_no if ref_no else None,
            'status':         'paid' if payment_method == 'gcash' else 'pending'
        }).execute()

        for item in cart_items:
            if item.get('cart_id'):
                supabase.table('cart').update({'status': 'checked_out'}).eq('cart_id', item['cart_id']).execute()

        for item in cart_items:
            product_res = supabase.table('product').select('quantity').eq('product_id', item['product_id']).execute()
            if product_res.data:
                new_qty = product_res.data[0]['quantity'] - item['quantity']
                supabase.table('product').update({'quantity': max(new_qty, 0)}).eq('product_id', item['product_id']).execute()

        return jsonify({
            'message':  'Order placed successfully.',
            'order_id': order_id,
            'total':    total
        }), 201

    except Exception as e:
        print(f"API place order error: {e}")
        return jsonify({'error': 'Failed to place order.'}), 500


# ══════════════════════════════════════════════════════
# ADMIN API ROUTES — Dashboard Data
# ══════════════════════════════════════════════════════

def admin_required(f):
    """Decorator to protect admin API routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

# ─── Products ─────────────────────────────────────────

@app.route('/api/admin/products', methods=['GET'])
@admin_required
def admin_get_products():
    try:
        res = supabase.table('product').select('*').order('created_at', desc=True).execute()
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

        if not product_name or not category:
            return jsonify({'error': 'Product name and category are required.'}), 400

        image_url = None
        image     = request.files.get('image')
        if image:
            # Upload to Supabase Storage
            file_bytes = image.read()
            file_name  = f"products/{product_name.replace(' ', '_')}_{image.filename}"
            supabase.storage.from_('product-images').upload(file_name, file_bytes, {'content-type': image.content_type})
            image_url = supabase.storage.from_('product-images').get_public_url(file_name)

        res = supabase.table('product').insert({
            'staff_id':     session.get('staff_id'),
            'product_name': product_name,
            'brand':        brand,
            'category':     category,
            'price':        float(price),
            'quantity':     int(quantity),
            'status':       status,
            'description':  description,
            'image_url':    image_url,
        }).execute()

        return jsonify(res.data[0]), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products/<product_id>', methods=['PUT'])
@admin_required
def admin_update_product(product_id):
    try:
        updates = {
            'product_name': request.form.get('product_name'),
            'brand':        request.form.get('brand'),
            'category':     request.form.get('category'),
            'price':        float(request.form.get('price', 0)),
            'quantity':     int(request.form.get('quantity', 0)),
            'status':       request.form.get('status'),
            'description':  request.form.get('description'),
            'updated_at':   'now()',
        }

        image = request.files.get('image')
        if image:
            file_bytes = image.read()
            file_name  = f"products/{product_id}_{image.filename}"
            supabase.storage.from_('product-images').upload(file_name, file_bytes, {'content-type': image.content_type, 'upsert': True})
            updates['image_url'] = supabase.storage.from_('product-images').get_public_url(file_name)

        res = supabase.table('product').update(updates).eq('product_id', product_id).execute()
        return jsonify(res.data[0]), 200
    except Exception as e:
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
            '*, product(product_name, category), staff(fname, lname)'
        ).order('date', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/inventory', methods=['POST'])
@admin_required
def admin_add_inventory():
    try:
        data       = request.get_json()
        product_id = data.get('product_id')
        qty_added  = int(data.get('quantity', 0))
        from_branch = data.get('from_branch')
        to_branch   = data.get('to_branch')
        note        = data.get('note', '')

        if not product_id or qty_added <= 0:
            return jsonify({'error': 'Product and quantity are required.'}), 400

        # Get current quantity
        prod_res    = supabase.table('product').select('quantity').eq('product_id', product_id).execute()
        qty_before  = prod_res.data[0]['quantity'] if prod_res.data else 0
        qty_after   = qty_before + qty_added

        # Insert inventory record
        supabase.table('inventory').insert({
            'product_id':      product_id,
            'staff_id':        session.get('staff_id'),
            'quantity_added':  qty_added,
            'quantity_before': qty_before,
            'quantity_after':  qty_after,
            'from_branch':     from_branch,
            'to_branch':       to_branch,
            'note':            note,
        }).execute()

        # Update product quantity
        supabase.table('product').update({
            'quantity':   qty_after,
            'updated_at': 'now()'
        }).eq('product_id', product_id).execute()

        return jsonify({'message': 'Stock updated.', 'quantity_after': qty_after}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Orders ───────────────────────────────────────────

@app.route('/api/admin/orders', methods=['GET'])
@admin_required
def admin_get_orders():
    try:
        res = supabase.table('order').select(
            '*, customer(fname, lname), staff(fname, lname), order_item(*, product(product_name)), payment(*)'
        ).order('date', desc=True).execute()
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
        data     = request.get_json()
        fname    = data.get('fname', '').strip()
        mi       = data.get('mi', '').strip()
        lname    = data.get('lname', '').strip()
        email    = data.get('email', '').strip()
        phone    = data.get('phone', '').strip()
        username = data.get('username', '').strip()
        role     = data.get('role', 'staff')
        password = data.get('password', '')

        if not all([fname, lname, email, username, password]):
            return jsonify({'error': 'All required fields must be filled.'}), 400

        # Safety: admin role can only be added via SQL — never via the dashboard
        if role == 'admin':
            return jsonify({'error': 'Admin accounts can only be created via SQL. Please assign the staff role.'}), 403

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

        # Update staff record if name/email changed
        staff_updates = {}
        if 'fname' in data: staff_updates['fname'] = data['fname']
        if 'lname' in data: staff_updates['lname'] = data['lname']
        if 'email' in data: staff_updates['email'] = data['email']
        if 'phone' in data: staff_updates['phone_number'] = data['phone']
        if staff_updates:
            supabase.table('staff').update(staff_updates).eq('user_id', user_id).execute()

        return jsonify({'message': 'User updated.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Customers (for sales report) ─────────────────────

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

def staff_required(f):
    """Decorator to protect staff API routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') not in ('admin', 'staff'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

# ─── Staff Orders ─────────────────────────────────────

@app.route('/api/staff/orders', methods=['GET'])
@staff_required
def staff_get_orders():
    try:
        res = supabase.table('order').select(
            '*, customer(fname, lname), staff(fname, lname), order_item(*, product(product_name)), payment(*)'
        ).order('date', desc=True).execute()
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

        if not cart_items or not payment_method:
            return jsonify({'error': 'Cart items and payment method are required.'}), 400

        if payment_method == 'gcash' and not ref_no:
            return jsonify({'error': 'GCash reference number is required.'}), 400

        # Create order
        order_res = supabase.table('order').insert({
            'staff_id':   session.get('staff_id'),
            'order_type': order_type,
            'quantity':   quantity,
            'total':      total,
            'ref_no':     ref_no if ref_no else None,
            'status':     'completed',
        }).execute()

        order_id = order_res.data[0]['order_id']

        # Create order items
        supabase.table('order_item').insert([{
            'order_id':   order_id,
            'product_id': item['product_id'],
            'quantity':   item['quantity'],
            'price':      item['price'],
        } for item in cart_items]).execute()

        # Create payment
        supabase.table('payment').insert({
            'order_id':       order_id,
            'payment_method': payment_method,
            'total':          total,
            'ref_no':         ref_no if ref_no else None,
            'status':         'paid',
        }).execute()

        # Deduct stock
        for item in cart_items:
            prod = supabase.table('product').select('quantity').eq('product_id', item['product_id']).execute()
            if prod.data:
                new_qty = max(prod.data[0]['quantity'] - item['quantity'], 0)
                supabase.table('product').update({
                    'quantity':   new_qty,
                    'updated_at': 'now()'
                }).eq('product_id', item['product_id']).execute()

        return jsonify({
            'message':  'Order processed successfully.',
            'order_id': order_id,
            'total':    total,
        }), 201

    except Exception as e:
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
        res = supabase.table('inventory').select(
            '*, product(product_name, category)'
        ).order('date', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/inventory', methods=['POST'])
@staff_required
def staff_add_inventory():
    try:
        data        = request.get_json()
        product_id  = data.get('product_id')
        qty_added   = int(data.get('quantity', 0))
        from_branch = data.get('from_branch')
        to_branch   = data.get('to_branch')
        note        = data.get('note', '')

        if not product_id or qty_added <= 0:
            return jsonify({'error': 'Product and quantity are required.'}), 400

        prod_res   = supabase.table('product').select('quantity').eq('product_id', product_id).execute()
        qty_before = prod_res.data[0]['quantity'] if prod_res.data else 0
        qty_after  = qty_before + qty_added

        supabase.table('inventory').insert({
            'product_id':      product_id,
            'staff_id':        session.get('staff_id'),
            'quantity_added':  qty_added,
            'quantity_before': qty_before,
            'quantity_after':  qty_after,
            'from_branch':     from_branch,
            'to_branch':       to_branch,
            'note':            note,
        }).execute()

        supabase.table('product').update({
            'quantity':   qty_after,
            'updated_at': 'now()'
        }).eq('product_id', product_id).execute()

        return jsonify({'message': 'Stock updated.', 'quantity_after': qty_after}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ──────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
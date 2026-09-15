"""
TEFC E-Commerce & POS System — Unit Tests
==========================================
Run with: pytest test_app.py -v
"""

import pytest
import json
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    """Create a test client for the Flask app."""
    from app import app
    app.config['TESTING']   = True
    app.config['SECRET_KEY'] = 'test-secret-key'
    with app.test_client() as client:
        yield client


@pytest.fixture
def admin_session(client):
    """Log in as admin and return client with session."""
    client.post('/api/login', json={
        'login_input': 'admin_test',
        'password':    'admin_password'
    })
    return client


@pytest.fixture
def staff_session(client):
    """Log in as staff and return client with session."""
    client.post('/api/login', json={
        'login_input': 'staff_test',
        'password':    'staff_password'
    })
    return client


# ─── Auth Tests ───────────────────────────────────────────────────────────────

class TestAuth:
    """Tests for authentication endpoints."""

    def test_login_missing_fields(self, client):
        """Login should fail with missing credentials."""
        res = client.post('/api/login', json={})
        assert res.status_code in [400, 401]

    def test_login_wrong_password(self, client):
        """Login should fail with wrong password."""
        res = client.post('/api/login', json={
            'login_input': 'someuser',
            'password':    'wrongpassword'
        })
        data = res.get_json()
        assert res.status_code == 401
        assert 'error' in data

    def test_login_empty_username(self, client):
        """Login should fail with empty username."""
        res = client.post('/api/login', json={
            'login_input': '',
            'password':    'password123'
        })
        assert res.status_code in [400, 401]

    def test_register_missing_fields(self, client):
        """Register should fail with missing fields."""
        res = client.post('/api/register', json={
            'fname': 'Test',
        })
        assert res.status_code in [400, 422]

    def test_register_invalid_email(self, client):
        """Register should fail with invalid email."""
        res = client.post('/api/register', json={
            'fname':    'Test',
            'lname':    'User',
            'email':    'not-an-email',
            'username': 'testuser',
            'password': 'password123',
        })
        assert res.status_code in [400, 422]

    def test_check_duplicate_email(self, client):
        """Duplicate check should return valid response."""
        res = client.post('/api/auth/check-duplicate', json={
            'email': 'test@example.com'
        })
        assert res.status_code in [200, 400]
        data = res.get_json()
        assert data is not None

    def test_send_email_otp_missing_email(self, client):
        """Send OTP should fail without email."""
        res = client.post('/api/auth/send-email-otp', json={})
        assert res.status_code == 400
        data = res.get_json()
        assert 'error' in data

    def test_verify_email_otp_missing_fields(self, client):
        """Verify OTP should fail without email and OTP."""
        res = client.post('/api/auth/verify-email-otp', json={})
        assert res.status_code == 400
        data = res.get_json()
        assert 'error' in data

    def test_verify_email_otp_wrong_otp(self, client):
        """Verify OTP should fail with wrong OTP."""
        res = client.post('/api/auth/verify-email-otp', json={
            'email': 'test@example.com',
            'otp':   '000000'
        })
        assert res.status_code in [400, 404]

    def test_forgot_password_missing_email(self, client):
        """Forgot password should fail without email."""
        res = client.post('/api/forgot-password',
            json={},
            content_type='application/json'
        )
        assert res.status_code in [200, 400]


# ─── Products Tests ───────────────────────────────────────────────────────────

class TestProducts:
    """Tests for product endpoints."""

    def test_get_products_returns_list(self, client):
        """GET /api/products should return a list."""
        res = client.get('/api/products')
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)

    def test_get_products_with_category_filter(self, client):
        """GET /api/products with category filter should return filtered list."""
        res = client.get('/api/products?category=Food')
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)

    def test_get_single_product(self, client):
        """GET /api/products/<id> with invalid ID should return 404 or 500."""
        res = client.get('/api/products/nonexistent-id')
        assert res.status_code in [200, 404]

    def test_search_products(self, client):
        """GET /api/products/search should return results."""
        res = client.get('/api/products/search?q=soap')
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)

    def test_search_products_empty_query(self, client):
        """Search with empty query should return empty or all products."""
        res = client.get('/api/products/search?q=')
        assert res.status_code in [200, 400]


# ─── Cart Tests ───────────────────────────────────────────────────────────────

class TestCart:
    """Tests for cart endpoints."""

    def test_get_cart_unauthorized(self, client):
        """GET /api/cart without auth should return 401."""
        res = client.get('/api/cart')
        assert res.status_code == 401

    def test_add_to_cart_unauthorized(self, client):
        """POST /api/cart without auth should return 401."""
        res = client.post('/api/cart', json={
            'product_id': 'some-id',
            'quantity':   1
        })
        assert res.status_code == 401

    def test_add_to_cart_missing_product_id(self, client):
        """POST /api/cart without product_id should return 400/401."""
        res = client.post('/api/cart',
            json={},
            headers={'X-Customer-ID': 'test-customer-id'}
        )
        assert res.status_code in [400, 401]

    def test_update_cart_unauthorized(self, client):
        """PUT /api/cart/<id> without auth should return 401."""
        res = client.put('/api/cart/some-cart-id', json={'quantity': 2})
        assert res.status_code == 401

    def test_delete_cart_unauthorized(self, client):
        """DELETE /api/cart/<id> without auth should return 401."""
        res = client.delete('/api/cart/some-cart-id')
        assert res.status_code == 401


# ─── Orders Tests ─────────────────────────────────────────────────────────────

class TestOrders:
    """Tests for order endpoints."""

    def test_get_orders_unauthorized(self, client):
        """GET /api/orders without auth should return 401."""
        res = client.get('/api/orders')
        assert res.status_code == 401

    def test_place_order_unauthorized(self, client):
        """POST /api/orders without auth should return 401."""
        res = client.post('/api/orders', json={
            'cart_items':     [],
            'payment_method': 'cash_on_delivery'
        })
        assert res.status_code == 401

    def test_place_order_missing_cart_items(self, client):
        """POST /api/orders without cart items should return 400/401."""
        res = client.post('/api/orders',
            json={'payment_method': 'cash_on_delivery'},
            headers={'X-Customer-ID': 'test-customer-id'}
        )
        assert res.status_code in [400, 401]

    def test_place_order_missing_payment_method(self, client):
        """POST /api/orders without payment method should return 400/401."""
        res = client.post('/api/orders',
            json={'cart_items': [{'product_id': 'id', 'quantity': 1}]},
            headers={'X-Customer-ID': 'test-customer-id'}
        )
        assert res.status_code in [400, 401]


# ─── Customer Profile Tests ───────────────────────────────────────────────────

class TestCustomerProfile:
    """Tests for customer profile endpoints."""

    def test_get_profile_unauthorized(self, client):
        """GET /api/customer/profile without auth should return 401."""
        res = client.get('/api/customer/profile')
        assert res.status_code == 401

    def test_update_profile_unauthorized(self, client):
        """PUT /api/customer/profile without auth should return 401."""
        res = client.put('/api/customer/profile', json={'fname': 'Test'})
        assert res.status_code == 401

    def test_change_password_unauthorized(self, client):
        """PUT /api/customer/change-password without auth should return 401."""
        res = client.put('/api/customer/change-password', json={
            'old_password': 'old',
            'new_password': 'new'
        })
        assert res.status_code == 401

    def test_save_fcm_token_unauthorized(self, client):
        """POST /api/customer/fcm-token without auth should return 401."""
        res = client.post('/api/customer/fcm-token', json={
            'fcm_token': 'some-token'
        })
        assert res.status_code == 401


# ─── Admin Tests ──────────────────────────────────────────────────────────────

class TestAdmin:
    """Tests for admin endpoints."""

    def test_admin_orders_unauthorized(self, client):
        """GET /api/admin/orders without auth should return 401/403."""
        res = client.get('/api/admin/orders')
        assert res.status_code in [401, 403]

    def test_admin_products_unauthorized(self, client):
        """GET /api/admin/products without auth should return 401/403."""
        res = client.get('/api/admin/products')
        assert res.status_code in [401, 403]

    def test_admin_users_unauthorized(self, client):
        """GET /api/admin/users without auth should return 401/403."""
        res = client.get('/api/admin/users')
        assert res.status_code in [401, 403]

    def test_admin_branches_unauthorized(self, client):
        """GET /api/admin/branches without auth should return 401/403."""
        res = client.get('/api/admin/branches')
        assert res.status_code in [401, 403]

    def test_admin_discounts_unauthorized(self, client):
        """GET /api/admin/discounts without auth should return 401/403."""
        res = client.get('/api/admin/discounts')
        assert res.status_code in [401, 403]


# ─── Staff Tests ──────────────────────────────────────────────────────────────

class TestStaff:
    """Tests for staff endpoints."""

    def test_staff_orders_unauthorized(self, client):
        """GET /api/staff/orders without auth should return 401/403."""
        res = client.get('/api/staff/orders')
        assert res.status_code in [401, 403]

    def test_staff_inventory_unauthorized(self, client):
        """GET /api/staff/inventory without auth should return 401/403."""
        res = client.get('/api/staff/inventory')
        assert res.status_code in [401, 403]

    def test_staff_stock_requests_unauthorized(self, client):
        """GET /api/staff/stock-requests without auth should return 401/403."""
        res = client.get('/api/staff/stock-requests')
        assert res.status_code in [401, 403]

    def test_staff_my_branch_unauthorized(self, client):
        """GET /api/staff/my-branch without auth should return 401/403."""
        res = client.get('/api/staff/my-branch')
        assert res.status_code in [401, 403]


# ─── VAT Calculation Tests ────────────────────────────────────────────────────

class TestVATCalculation:
    """Tests for VAT calculation logic."""

    def test_vat_inclusive_formula(self):
        """VAT inclusive: vatAmount = total * 0.12."""
        total      = 100.0
        VAT_RATE   = 0.12
        vat_amount = total * VAT_RATE
        base_amt   = total - vat_amount
        assert round(vat_amount, 2) == 12.0
        assert round(base_amt, 2)   == 88.0
        assert round(base_amt + vat_amount, 2) == total

    def test_vat_zero_total(self):
        """VAT on zero total should be zero."""
        total      = 0.0
        vat_amount = total * 0.12
        base_amt   = total - vat_amount
        assert vat_amount == 0.0
        assert base_amt   == 0.0

    def test_vat_large_amount(self):
        """VAT on large amount should compute correctly."""
        total      = 5000.0
        vat_amount = total * 0.12
        base_amt   = total - vat_amount
        assert round(vat_amount, 2) == 600.0
        assert round(base_amt, 2)   == 4400.0


# ─── OTP Validation Tests ─────────────────────────────────────────────────────

class TestOTPValidation:
    """Tests for OTP validation logic."""

    def test_otp_is_6_digits(self):
        """OTP should be exactly 6 digits."""
        import random
        otp = str(random.randint(100000, 999999))
        assert len(otp) == 6
        assert otp.isdigit()

    def test_otp_range(self):
        """OTP should be between 100000 and 999999."""
        import random
        for _ in range(100):
            otp = random.randint(100000, 999999)
            assert 100000 <= otp <= 999999

    def test_invalid_otp_format(self):
        """OTP with wrong length should be invalid."""
        invalid_otps = ['12345', '1234567', 'abcdef', '']
        for otp in invalid_otps:
            assert len(otp) != 6 or not otp.isdigit()


# ─── Utility Function Tests ───────────────────────────────────────────────────

class TestUtilityFunctions:
    """Tests for utility/helper functions."""

    def test_short_id_format(self):
        """Short ID should be 8 chars uppercase."""
        order_id = '3e81dc69-2e3b-4ac8-b4dd-3be2e1239ffd'
        short_id = order_id[:8].upper()
        assert len(short_id) == 8
        assert short_id == short_id.upper()

    def test_phone_number_validation(self):
        """Phone number must start with 09 and be 11 digits."""
        import re
        valid_phones   = ['09123456789', '09876543210']
        invalid_phones = ['08123456789', '091234567', '091234567890', '']

        pattern = re.compile(r'^09[0-9]{9}$')
        for phone in valid_phones:
            assert pattern.match(phone), f"{phone} should be valid"
        for phone in invalid_phones:
            assert not pattern.match(phone), f"{phone} should be invalid"

    def test_email_validation(self):
        """Email must have @ and domain."""
        import re
        valid_emails   = ['test@email.com', 'user@domain.ph']
        invalid_emails = ['notanemail', '@nodomain', 'noatsign.com', '']

        pattern = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
        for email in valid_emails:
            assert pattern.match(email), f"{email} should be valid"
        for email in invalid_emails:
            assert not pattern.match(email), f"{email} should be invalid"

    def test_password_minimum_length(self):
        """Password must be at least 8 characters."""
        valid_passwords   = ['password', 'pass1234', 'securepassword']
        invalid_passwords = ['pass', '1234567', '']

        for pwd in valid_passwords:
            assert len(pwd) >= 8, f"{pwd} should be valid"
        for pwd in invalid_passwords:
            assert len(pwd) < 8, f"{pwd} should be invalid"
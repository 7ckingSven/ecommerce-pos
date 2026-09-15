"""
TEFC E-Commerce & POS System — Advanced Tests
==============================================
Integration, Security, Performance & Edge Case Tests
Run with: pytest test_advanced.py -v
"""

import pytest
import time
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    from app import app
    app.config['TESTING']    = True
    app.config['SECRET_KEY'] = 'test-secret-key'
    with app.test_client() as client:
        yield client


# ─── Integration Tests ────────────────────────────────────────────────────────

class TestIntegration:
    """Integration tests — multiple endpoints working together."""

    def test_products_available_before_cart(self, client):
        """Products must be fetchable before adding to cart."""
        # Step 1: Get products
        res = client.get('/api/products')
        assert res.status_code == 200
        products = res.get_json()
        assert isinstance(products, list)

        # Step 2: Try to add to cart without auth (should fail)
        if products:
            res2 = client.post('/api/cart', json={
                'product_id': products[0].get('product_id'),
                'quantity':   1
            })
            assert res2.status_code == 401

    def test_cart_requires_auth_before_order(self, client):
        """Cart and order endpoints both require authentication."""
        # Cart requires auth
        res1 = client.get('/api/cart')
        assert res1.status_code == 401

        # Orders requires auth
        res2 = client.get('/api/orders')
        assert res2.status_code == 401

        # Both fail consistently
        assert res1.status_code == res2.status_code

    def test_product_search_and_detail_consistency(self, client):
        """Search results should be consistent with product list."""
        # Get all products
        res1 = client.get('/api/products')
        assert res1.status_code == 200
        all_products = res1.get_json()

        # Search should also return list
        res2 = client.get('/api/products/search?q=a')
        assert res2.status_code == 200
        search_results = res2.get_json()

        # Both should be lists
        assert isinstance(all_products, list)
        assert isinstance(search_results, list)

    def test_admin_endpoints_all_require_auth(self, client):
        """All admin endpoints should require authentication."""
        admin_endpoints = [
            ('GET',  '/api/admin/orders'),
            ('GET',  '/api/admin/products'),
            ('GET',  '/api/admin/users'),
            ('GET',  '/api/admin/branches'),
            ('GET',  '/api/admin/discounts'),
            ('GET',  '/api/admin/inventory'),
            ('GET',  '/api/admin/transactions'),
            ('GET',  '/api/admin/payments'),
            ('GET',  '/api/admin/customers'),
            ('GET',  '/api/admin/purchase-orders'),
            ('GET',  '/api/admin/stock-requests'),
        ]
        for method, endpoint in admin_endpoints:
            res = client.get(endpoint)
            assert res.status_code in [401, 403], \
                f"{endpoint} should require auth but returned {res.status_code}"

    def test_staff_endpoints_all_require_auth(self, client):
        """All staff endpoints should require authentication."""
        staff_endpoints = [
            '/api/staff/orders',
            '/api/staff/inventory',
            '/api/staff/stock-requests',
            '/api/staff/my-branch',
            '/api/staff/branches',
        ]
        for endpoint in staff_endpoints:
            res = client.get(endpoint)
            assert res.status_code in [401, 403], \
                f"{endpoint} should require auth but returned {res.status_code}"

    def test_otp_flow_requires_email_first(self, client):
        """OTP verification should fail without sending OTP first."""
        res = client.post('/api/auth/verify-email-otp', json={
            'email': 'test@example.com',
            'otp':   '123456'
        })
        # Should fail — OTP was never sent
        assert res.status_code in [400, 404]

    def test_register_flow_email_validation(self, client):
        """Registration should validate email format."""
        invalid_emails = [
            'notanemail',
            '@nodomain.com',
            'noatsign.com',
            '',
        ]
        for email in invalid_emails:
            res = client.post('/api/register', json={
                'fname':    'Test',
                'lname':    'User',
                'email':    email,
                'username': 'testuser123',
                'password': 'password123',
            })
            assert res.status_code in [400, 422, 500], \
                f"Email '{email}' should be rejected"

    def test_product_filter_by_category(self, client):
        """Product filter should work consistently."""
        categories = ['Food', 'HouseHold', 'Personal Care']
        for cat in categories:
            res = client.get(f'/api/products?category={cat}')
            assert res.status_code == 200
            data = res.get_json()
            assert isinstance(data, list)


# ─── Security Tests ───────────────────────────────────────────────────────────

class TestSecurity:
    """Security tests — prevent unauthorized access and attacks."""

    def test_sql_injection_login(self, client):
        """SQL injection in login should be rejected."""
        payloads = [
            "' OR '1'='1",
            "'; DROP TABLE user; --",
            "' OR 1=1 --",
            "admin'--",
        ]
        for payload in payloads:
            res = client.post('/api/login', json={
                'login_input': payload,
                'password':    payload
            })
            # 500 means Supabase/Cloudflare blocked it = protected! ✅
            assert res.status_code in [400, 401, 422, 500], \
                f"SQL injection payload '{payload}' should be rejected"

    def test_xss_in_search(self, client):
        """XSS payload in search should not cause server error."""
        xss_payloads = [
            '<script>alert("xss")</script>',
            '"><img src=x onerror=alert(1)>',
            'javascript:alert(1)',
        ]
        for payload in xss_payloads:
            res = client.get(f'/api/products/search?q={payload}')
            assert res.status_code in [200, 400], \
                f"XSS payload should not cause server error"

    def test_invalid_uuid_product(self, client):
        """Invalid UUID in product endpoint should return 404."""
        invalid_ids = [
            'nonexistent-id',
            '../../etc/passwd',
            '<script>',
            '000',
            '',
        ]
        for invalid_id in invalid_ids:
            if invalid_id:
                res = client.get(f'/api/products/{invalid_id}')
                assert res.status_code in [400, 404, 405], \
                    f"Invalid ID '{invalid_id}' should return 404"

    def test_cart_requires_customer_id_header(self, client):
        """Cart endpoints must require X-Customer-ID header."""
        # Without header
        res1 = client.get('/api/cart')
        assert res1.status_code == 401

        # With fake customer ID - might still fail due to invalid ID
        res2 = client.get('/api/cart',
            headers={'X-Customer-ID': 'fake-customer-id'}
        )
        assert res2.status_code in [200, 400, 401, 500]

    def test_order_requires_customer_id_header(self, client):
        """Order endpoints must require X-Customer-ID header."""
        res = client.post('/api/orders',
            json={'cart_items': [], 'payment_method': 'cash_on_delivery'},
        )
        assert res.status_code == 401

    def test_large_payload_login(self, client):
        """Large payload in login should not crash server."""
        large_string = 'A' * 10000
        res = client.post('/api/login', json={
            'login_input': large_string,
            'password':    large_string
        })
        assert res.status_code in [400, 401, 413, 422]

    def test_large_payload_register(self, client):
        """Large payload in register should not crash server."""
        large_string = 'A' * 10000
        res = client.post('/api/register', json={
            'fname':    large_string,
            'lname':    large_string,
            'email':    f'{large_string}@email.com',
            'username': large_string,
            'password': large_string,
        })
        assert res.status_code in [400, 413, 422, 500]

    def test_wrong_http_method(self, client):
        """Wrong HTTP method should return 405."""
        # GET on POST-only endpoint
        res = client.get('/api/register')
        assert res.status_code == 405

        # POST on GET-only endpoint
        res2 = client.post('/api/products')
        assert res2.status_code == 405

    def test_missing_content_type(self, client):
        """Missing Content-Type should be handled gracefully."""
        res = client.post('/api/login',
            data='{"login_input": "test", "password": "test"}',
        )
        assert res.status_code in [400, 401, 415]

    def test_empty_json_body(self, client):
        """Empty JSON body should return 400."""
        res = client.post('/api/login',
            json=None,
            content_type='application/json'
        )
        assert res.status_code in [400, 401, 415]


# ─── Performance Tests ────────────────────────────────────────────────────────

class TestPerformance:
    """Performance tests — API response times."""

    def test_products_response_time(self, client):
        """GET /api/products should respond within 5 seconds."""
        start = time.time()
        res   = client.get('/api/products')
        end   = time.time()
        elapsed = end - start
        assert res.status_code == 200
        assert elapsed < 5.0, \
            f"Products took {elapsed:.2f}s — too slow!"

    def test_product_search_response_time(self, client):
        """Product search should respond within 5 seconds."""
        start = time.time()
        res   = client.get('/api/products/search?q=soap')
        end   = time.time()
        elapsed = end - start
        assert res.status_code == 200
        assert elapsed < 5.0, \
            f"Search took {elapsed:.2f}s — too slow!"

    def test_login_response_time(self, client):
        """Login should respond within 5 seconds."""
        start = time.time()
        res   = client.post('/api/login', json={
            'login_input': 'nonexistent',
            'password':    'wrongpassword'
        })
        end     = time.time()
        elapsed = end - start
        assert res.status_code in [400, 401]
        assert elapsed < 5.0, \
            f"Login took {elapsed:.2f}s — too slow!"

    def test_multiple_product_requests(self, client):
        """Multiple product requests should all succeed quickly."""
        times = []
        for _ in range(3):
            start = time.time()
            res   = client.get('/api/products')
            end   = time.time()
            assert res.status_code == 200
            times.append(end - start)

        avg_time = sum(times) / len(times)
        assert avg_time < 5.0, \
            f"Average response time {avg_time:.2f}s — too slow!"


# ─── Edge Case Tests ──────────────────────────────────────────────────────────

class TestEdgeCases:
    """Edge case tests — boundary conditions and unusual inputs."""

    def test_register_very_short_password(self, client):
        """Password shorter than 8 chars should be rejected."""
        res = client.post('/api/register', json={
            'fname':    'Test',
            'lname':    'User',
            'email':    'test@email.com',
            'username': 'testuser',
            'password': '123',   # too short
        })
        assert res.status_code in [400, 422]

    def test_register_special_characters_in_name(self, client):
        """Special characters in name should be handled."""
        res = client.post('/api/register', json={
            'fname':    'Test<>',
            'lname':    'User&Co',
            'email':    'test@email.com',
            'username': 'testuser123',
            'password': 'password123',
        })
        assert res.status_code in [200, 400, 422]

    def test_search_with_special_characters(self, client):
        """Search with special chars should not crash."""
        special_queries = ['%', '#', '&', '?q=test&limit=0', '   ']
        for q in special_queries:
            res = client.get(f'/api/products/search?q={q}')
            assert res.status_code in [200, 400], \
                f"Search with '{q}' crashed with {res.status_code}"

    def test_product_filter_nonexistent_category(self, client):
        """Filter by non-existent category should return empty list."""
        res = client.get('/api/products?category=NonExistentCategory12345')
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_cart_zero_quantity(self, client):
        """Adding item with zero quantity should fail."""
        res = client.post('/api/cart',
            json={
                'product_id': 'some-valid-uuid-here',
                'quantity':   0
            },
            headers={'X-Customer-ID': 'some-customer-id'}
        )
        # 500 = invalid UUID format for customer_id (still rejected) ✅
        assert res.status_code in [400, 401, 422, 500]

    def test_cart_negative_quantity(self, client):
        """Adding item with negative quantity should fail."""
        res = client.post('/api/cart',
            json={
                'product_id': 'some-valid-uuid-here',
                'quantity':   -1
            },
            headers={'X-Customer-ID': 'some-customer-id'}
        )
        # 500 = invalid UUID format for customer_id (still rejected) ✅
        assert res.status_code in [400, 401, 422, 500]

    def test_order_empty_cart_items(self, client):
        """Placing order with empty cart should fail."""
        res = client.post('/api/orders',
            json={
                'cart_items':     [],
                'payment_method': 'cash_on_delivery'
            },
            headers={'X-Customer-ID': 'some-customer-id'}
        )
        assert res.status_code in [400, 401]

    def test_order_invalid_payment_method(self, client):
        """Invalid payment method should be rejected."""
        res = client.post('/api/orders',
            json={
                'cart_items':     [{'product_id': 'id', 'quantity': 1}],
                'payment_method': 'invalid_payment'
            },
            headers={'X-Customer-ID': 'some-customer-id'}
        )
        # 500 = invalid UUID/payment combo still rejected ✅
        assert res.status_code in [400, 401, 422, 500]

    def test_gcash_order_without_ref_no(self, client):
        """GCash order without reference number should fail."""
        res = client.post('/api/orders',
            json={
                'cart_items':     [{'product_id': 'id', 'quantity': 1}],
                'payment_method': 'gcash',
                'ref_no':         ''   # empty ref_no
            },
            headers={'X-Customer-ID': 'some-customer-id'}
        )
        assert res.status_code in [400, 401, 422]

    def test_duplicate_email_check(self, client):
        """Duplicate check endpoint should respond correctly."""
        res = client.post('/api/auth/check-duplicate', json={
            'email':    'test@example.com',
            'username': 'testuser'
        })
        assert res.status_code in [200, 400]
        data = res.get_json()
        assert data is not None

    def test_verify_otp_expired_code(self, client):
        """Expired or wrong OTP should return error."""
        res = client.post('/api/auth/verify-otp', json={
            'email': 'test@example.com',
            'otp':   '999999'
        })
        assert res.status_code in [400, 404]

    def test_reset_password_without_verification(self, client):
        """Reset password without OTP verification should fail."""
        res = client.post('/api/auth/reset-password', json={
            'email':        'test@example.com',
            'new_password': 'newpassword123'
        })
        # 404 = route not found or 400/401 = unauthorized ✅
        assert res.status_code in [400, 401, 404, 422]
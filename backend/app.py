import json
import math
import random
import secrets
import traceback
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_file, make_response, Response, stream_with_context
from flask_cors import CORS
# Resend email API (replaces Flask-Mail)
import requests as resend_requests
from supabase import create_client
from dotenv import load_dotenv
from datetime import timedelta, datetime, timezone
from functools import wraps
import bcrypt
import os
import glob
import random
import string
import jwt

# Load .env file
load_dotenv()

# Supabase Legacy JWT Secret — used to mint Supabase-compatible tokens for
# customer logins, so Realtime/RLS can recognize auth.uid() == customer_id
# without a separate Supabase Auth account. Server-side only, never sent
# to any client.
SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET')

# PayMongo — secret key used for Basic Auth (as username, empty password)
# against the PayMongo API. Server-side only, never sent to any client.
PAYMONGO_SECRET_KEY = os.getenv('PAYMONGO_SECRET_KEY')

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


# ─── Supabase Retry Helper (WinError 10054/10035 fix) ──
import time as _time

def supabase_retry(fn, retries=3, delay=0.3):
    """Retry a Supabase call on Windows socket errors."""
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            if attempt < retries - 1:
                _time.sleep(delay)
                continue
            raise e

# Brevo (Sendinblue) Email Config
BREVO_API_KEY    = os.getenv('BREVO_API_KEY', '')
BREVO_FROM_EMAIL = os.getenv('BREVO_FROM_EMAIL', 'noreply@tefcecommerce.com')
BREVO_FROM_NAME  = os.getenv('BREVO_FROM_NAME', 'TEFC E-Commerce')

def send_email_resend(to_email, subject, html_body, attachments=None):
    """Send email using Brevo API.

    attachments (optional): list of {'content': <base64 str>, 'name': <filename>}
    dicts, per Brevo's 'attachment' field — used for the e-receipt PDF.
    """
    try:
        payload = {
            'sender':      { 'name': BREVO_FROM_NAME, 'email': BREVO_FROM_EMAIL },
            'to':          [{ 'email': to_email }],
            'subject':     subject,
            'htmlContent': html_body,
        }
        if attachments:
            payload['attachment'] = attachments
        response = resend_requests.post(
            'https://api.brevo.com/v3/smtp/email',
            headers={
                'api-key':      BREVO_API_KEY,
                'Content-Type': 'application/json',
            },
            json=payload,
            timeout=20
        )
        print(f'Brevo response: {response.status_code} {response.text}')
        return response.status_code in [200, 201]
    except Exception as e:
        print(f'Brevo error: {e}')
        return False

# ══════════════════════════════════════════════════════
# PAYMONGO — GCash e-wallet payments (POS Staff web walk-in)
# ══════════════════════════════════════════════════════
import base64 as _b64

PAYMONGO_API_BASE = 'https://api.paymongo.com/v1'

class PayMongoError(Exception):
    pass

def _paymongo_request(method, path, json_body=None):
    """Thin wrapper around the PayMongo REST API. Auth is HTTP Basic with
    the secret key as username and an empty password — PayMongo's own
    convention, nothing we invented."""
    if not PAYMONGO_SECRET_KEY:
        raise PayMongoError('PAYMONGO_SECRET_KEY is not configured on the server.')

    auth_token = _b64.b64encode(f'{PAYMONGO_SECRET_KEY}:'.encode('utf-8')).decode('utf-8')
    headers = {
        'Authorization': f'Basic {auth_token}',
        'Content-Type':  'application/json',
    }
    url = f'{PAYMONGO_API_BASE}{path}'
    try:
        resp = resend_requests.request(method, url, headers=headers, json=json_body, timeout=20)
    except Exception as e:
        raise PayMongoError(f'Could not reach PayMongo: {e}')

    try:
        body = resp.json()
    except Exception:
        body = {}

    if resp.status_code >= 400:
        detail = ''
        try:
            detail = body.get('errors', [{}])[0].get('detail', '')
        except Exception:
            pass
        raise PayMongoError(detail or f'PayMongo request failed ({resp.status_code}).')

    return body

def paymongo_create_gcash_intent(amount_pesos, return_url, description=''):
    """Creates a Payment Intent, a GCash Payment Method, and attaches them —
    returns (payment_intent_id, redirect_url). The staff screen renders
    redirect_url as a QR code; the customer scans it with their own phone to
    open GCash's authorization page and approve the payment there."""
    amount_centavos = int(round(float(amount_pesos) * 100))

    intent_body = {
        'data': {
            'attributes': {
                'amount':                 amount_centavos,
                'payment_method_allowed': ['gcash'],
                'payment_method_options': {'gcash': {'request_three_d_secure': 'any'}},
                'currency':               'PHP',
                'capture_type':           'automatic',
                'description':            description or 'TEFC E-Commerce — POS walk-in order',
            }
        }
    }
    intent_res = _paymongo_request('POST', '/payment_intents', intent_body)
    intent_data       = intent_res['data']
    payment_intent_id = intent_data['id']
    client_key        = intent_data['attributes']['client_key']

    method_body = {'data': {'attributes': {'type': 'gcash'}}}
    method_res  = _paymongo_request('POST', '/payment_methods', method_body)
    payment_method_id = method_res['data']['id']

    attach_body = {
        'data': {
            'attributes': {
                'payment_method': payment_method_id,
                'client_key':     client_key,
                'return_url':     return_url,
            }
        }
    }
    attach_res = _paymongo_request('POST', f'/payment_intents/{payment_intent_id}/attach', attach_body)

    redirect_url = None
    try:
        redirect_url = attach_res['data']['attributes']['next_action']['redirect']['url']
    except (KeyError, TypeError):
        pass

    if not redirect_url:
        raise PayMongoError('PayMongo did not return a GCash authorization link.')

    return payment_intent_id, redirect_url

def paymongo_get_intent_status(payment_intent_id):
    """Returns the current status string of a Payment Intent
    ('awaiting_payment_method', 'processing', 'succeeded', etc.)."""
    res = _paymongo_request('GET', f'/payment_intents/{payment_intent_id}')
    return res['data']['attributes']['status']

# ══════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(plain, hashed):
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def verify_password(plain, hashed):
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def make_supabase_token(customer_id, expires_in=3600):
    """Mints a Supabase-compatible JWT so Realtime/RLS can recognize this
    customer as auth.uid() == customer_id, without a separate Supabase Auth
    account. Signed with the project's Legacy JWT Secret."""
    now = int(_time.time())
    payload = {
        'sub':  str(customer_id),
        'role': 'authenticated',
        'aud':  'authenticated',
        'iat':  now,
        'exp':  now + expires_in,
    }
    return jwt.encode(payload, SUPABASE_JWT_SECRET, algorithm='HS256')

def _session_token_valid():
    """One-session-per-user check.

    Returns True only if this browser session's token still matches the
    token on file for this user in the database — i.e. no newer login
    (from another device/browser) has taken over this account since this
    session started. Fails OPEN on a transient DB error so a brief
    Supabase hiccup never force-logs-out everyone.
    """
    user_id = session.get('user_id')
    token   = session.get('session_token')
    if not user_id or not token:
        return False
    try:
        res = supabase.table('user').select('active_session_token').eq('user_id', user_id).execute()
        if not res.data:
            return False
        return res.data[0].get('active_session_token') == token
    except Exception as e:
        print(f"Session check error: {e}")
        return True

def _finalize_login(user, staff):
    """Completes a login by granting the full session — shared by the
    trusted-device path (login_post) and the post-MFA path
    (verify_mfa). One-session-per-user: issues a fresh token for THIS
    login and records it as the only valid one for this account."""
    new_session_token = secrets.token_hex(32)
    supabase.table('user').update(
        {'active_session_token': new_session_token}
    ).eq('user_id', user['user_id']).execute()

    session['user_id']       = user['user_id']
    session['staff_id']      = staff['staff_id']
    session['role']          = user['role']
    session['name']          = f"{staff['fname']} {staff['lname']}"
    session['session_token'] = new_session_token

    _record_login_session(user['user_id'], user['role'], staff['staff_id'], staff.get('branch_id'))
    return new_session_token

def _clear_pending_login():
    for key in ('pending_login_user_id', 'pending_login_staff_id', 'pending_login_role',
                'pending_login_name', 'pending_login_branch_id', 'mfa_otp_code', 'mfa_otp_sent',
                'mfa_otp_created_at'):
        session.pop(key, None)

# ══════════════════════════════════════════════════════
# LOGIN / LOGOUT AUDIT TRAIL — login_sessions table
# Admin + Staff dashboard logins only (customers use the mobile app's
# separate token flow, not this session-cookie login). Purely additive —
# no existing table is touched.
# ══════════════════════════════════════════════════════
LOGIN_SESSION_ACTIVE_WINDOW_SECONDS = 15 * 60  # no ping within this window => treated as Ended even without an explicit logout

def _client_ip():
    """Best-effort real client IP behind Render's reverse proxy."""
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or ''

def _record_login_session(user_id, role, staff_id=None, branch_id=None):
    """Inserts one login_sessions row for this login and stashes its id in
    the Flask session so /logout and the last-seen 'touch' can find it
    again. Best-effort — a failure here must never block an actual login."""
    # Admin is never branch-scoped — enforce this here rather than trusting
    # staff.branch_id to be null for every admin row (some admin accounts
    # carry a stale/leftover branch_id from how they were originally
    # created, before admin/staff were split on branch assignment).
    if role == 'admin':
        branch_id = None
    try:
        now_iso = datetime.now().isoformat()
        res = supabase.table('login_sessions').insert({
            'user_id':      user_id,
            'staff_id':     staff_id,
            'role':         role,
            'branch_id':    branch_id,
            'login_at':     now_iso,
            'last_seen_at': now_iso,
            'ip_address':   _client_ip(),
            'user_agent':   request.headers.get('User-Agent', '')[:255],
        }).execute()
        if res.data:
            session['login_session_id'] = res.data[0]['id']
    except Exception as e:
        print(f"login_sessions insert error: {e}")

_LAST_SEEN_TOUCH_CACHE   = {}   # login_session_id -> last write (epoch seconds) — in-memory, best-effort throttle
_LAST_SEEN_TOUCH_SECONDS = 60   # don't write last_seen_at more than once a minute per session

def _touch_login_session():
    """Refreshes last_seen_at on the current login_sessions row so the
    audit trail's Active/Ended status reflects real usage. Called from
    admin_required/staff_required, which fire on every dashboard API call
    (the dashboard is a single-page app, so page-load routes alone would
    barely update). Throttled in-memory so this doesn't turn into a DB
    write on every single API call."""
    login_session_id = session.get('login_session_id')
    if not login_session_id:
        return
    now = _time.time()
    if now - _LAST_SEEN_TOUCH_CACHE.get(login_session_id, 0) < _LAST_SEEN_TOUCH_SECONDS:
        return
    _LAST_SEEN_TOUCH_CACHE[login_session_id] = now
    try:
        supabase.table('login_sessions').update(
            {'last_seen_at': datetime.now().isoformat()}
        ).eq('id', login_session_id).execute()
    except Exception as e:
        print(f"last_seen_at update error: {e}")

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
            if not _session_token_valid():
                return redirect(url_for('logout', reason='session_superseded'))

            # Back/forward-after-logout protection: tell the browser never
            # to cache this page (disk cache AND, in most browsers, the
            # back/forward "bfcache") so that pressing Back after logging
            # out can't silently show a stale, already-logged-out copy of
            # a dashboard page. While still logged in, Back/Forward keeps
            # working normally — this only stops a STALE copy being shown.
            response = make_response(f(*args, **kwargs))
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        return decorated
    return decorator

def admin_required(f):
    """Decorator to protect admin API routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized'}), 401
        if not _session_token_valid():
            return jsonify({'error': 'Session expired - signed in elsewhere', 'reason': 'session_superseded'}), 401
        _touch_login_session()
        return f(*args, **kwargs)
    return decorated

def staff_required(f):
    """Decorator to protect staff API routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') not in ('admin', 'staff'):
            return jsonify({'error': 'Unauthorized'}), 401
        if not _session_token_valid():
            return jsonify({'error': 'Session expired - signed in elsewhere', 'reason': 'session_superseded'}), 401
        _touch_login_session()
        return f(*args, **kwargs)
    return decorated

# ══════════════════════════════════════════════════════
# LIVE UPDATES — Server-Sent Events (SSE)
# ══════════════════════════════════════════════════════
# Panel-requested revision: admin/staff dashboards should reflect changes
# (new/updated orders, stock movements, product edits) across open browser
# tabs/devices without a manual refresh.
#
# Design note: this is Postgres LISTEN/NOTIFY, not Supabase Realtime
# subscribed from the browser. Every table currently has RLS *enabled* but
# with a single "enable_all" policy (USING true, for ALL commands) — i.e.
# no real row-level restriction exists yet. Handing a Supabase key to the
# browser for client-side Realtime would expose the entire database
# (including the `user` table's password hashes, and every branch's orders)
# to anyone who opens the dashboard. Retrofitting correct per-table RLS is
# real work and not something to rush before a defense.
#
# Instead: a SQL trigger calls pg_notify() on change, one background thread
# in Flask LISTENs for it, and that thread fans the event out to every
# connected browser over SSE. The SSE payload only ever says
# `{"table": "order"}` (etc.) — never actual row data — so each browser
# just re-fetches through the EXISTING authenticated REST endpoints, which
# already enforce the correct admin/staff/branch scoping. No new attack
# surface, no RLS changes required.
#
# Note on the single-session enforcement above (_session_token_valid /
# _touch_login_session): that check only runs once, when the SSE connection
# is first opened — not on every message. If a session gets superseded
# (signed in elsewhere) while a tab's SSE stream is already open, that
# stream keeps running until the browser's own reconnect cycle hits it.
# Not a data risk (the channel never carries row data, and every REST
# endpoint it triggers a re-fetch against still re-checks the session
# normally) — just means a superseded session's tab may keep "nudging"
# itself to refresh for a little while after being logged out elsewhere.
#
# Setup required (one-time, see supabase_realtime_triggers.sql):
#   1. Run that SQL in the Supabase SQL editor (trigger function + triggers
#      on order/inventory/product).
#   2. Add DATABASE_URL to .env — the *direct* Postgres connection string
#      from Supabase: Settings → Database → Connection string →
#      "Direct connection" (NOT the Transaction pooler; pgbouncer in
#      transaction mode does not reliably deliver LISTEN/NOTIFY).
# Without DATABASE_URL set, the app runs exactly as before — live updates
# just stay silently disabled (see _pg_listen_loop below).

import threading
import queue
import select
import psycopg2

DATABASE_URL = os.getenv('DATABASE_URL')

# One Queue per currently-connected browser SSE stream (one per open tab).
# Protected by _sse_lock since the listener thread and each request thread
# touch this concurrently.
_sse_clients = set()
_sse_lock = threading.Lock()

def _sse_broadcast(payload):
    """Push `payload` (a small dict, e.g. {"table": "order"}) to every
    currently-connected SSE client."""
    with _sse_lock:
        clients = list(_sse_clients)
    for client_q in clients:
        try:
            client_q.put_nowait(payload)
        except queue.Full:
            pass  # a slow/stuck client shouldn't block the others

def _pg_listen_loop():
    """Runs forever in a background daemon thread. Holds one LISTEN
    connection to Postgres and re-broadcasts every notification to all
    connected SSE clients. Reconnects automatically if the connection
    drops (e.g. Supabase restarting the DB)."""
    if not DATABASE_URL:
        print('DATABASE_URL not set — live updates (SSE) disabled.')
        return
    while True:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute('LISTEN data_changes;')
            print('Live updates: listening for data_changes notifications.')
            while True:
                if select.select([conn], [], [], 30) == ([], [], []):
                    continue  # just an idle timeout, loop and keep waiting
                conn.poll()
                while conn.notifies:
                    notify = conn.notifies.pop(0)
                    try:
                        payload = json.loads(notify.payload)
                    except Exception:
                        continue
                    _sse_broadcast(payload)
        except Exception as e:
            print(f'Live updates listener error, reconnecting in 5s: {e}')
            _time.sleep(5)

threading.Thread(target=_pg_listen_loop, daemon=True).start()

@app.route('/api/events')
@staff_required
def sse_events():
    """SSE stream for live dashboard updates. Pushes {"table": "..."}
    whenever order/inventory/product change — carries no row data, so there
    is nothing here that needs branch/role filtering. The browser maps the
    table name to the section(s) it affects and re-fetches through the
    normal, already-authorized REST endpoints (see admin.js/staff.js)."""
    def gen():
        client_q = queue.Queue(maxsize=50)
        with _sse_lock:
            _sse_clients.add(client_q)
        try:
            yield 'retry: 3000\n\n'
            while True:
                try:
                    payload = client_q.get(timeout=20)
                    yield f'data: {json.dumps(payload)}\n\n'
                except queue.Empty:
                    yield ': keepalive\n\n'  # keeps proxies from closing the connection
        finally:
            with _sse_lock:
                _sse_clients.discard(client_q)
    return Response(stream_with_context(gen()), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
    })

# ══════════════════════════════════════════════════════
# WEB ROUTES — Staff & Public Pages
# ══════════════════════════════════════════════════════


# ─── Shared HTML Email Template ────────────────────────────────────────────
def build_otp_email(otp_code, title='Verification Code', purpose='verify your email address'):
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#14532d,#16a34a);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">TEFC E-Commerce</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Triple E &amp; Fiel Collince General Merchandise</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#111827;">Hello!</p>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
              You requested to {purpose} for your <strong>TEFC E-Commerce</strong> account.
              Use the code below to continue.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 24px;">
                <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr><td align="center" style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:20px 40px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#16a34a;font-weight:600;letter-spacing:1px;text-transform:uppercase;">{title}</p>
                    <p style="margin:0;font-size:36px;font-weight:700;color:#14532d;letter-spacing:8px;text-align:center;">{otp_code}</p>
                  </td></tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-align:center;">&#9201; This code expires in <strong>5 minutes</strong>.</p>
            <p style="margin:0 0 24px;font-size:13px;color:#6b7280;text-align:center;">If you did not request this, please ignore this email.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              This email was sent by TEFC E-Commerce &mdash; Triple E &amp; Fiel Collince General Merchandise<br/>
              Koronadal City, South Cotabato
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">&copy; 2026 Triple E &amp; Fiel Collince General Merchandise. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ─── E-Receipt (Online Orders — COD & GCash) ───────────────────────────────
# Sent right when an online order is placed (api_place_order), for both
# payment methods, as an HTML email with a PDF receipt attached. Entirely
# best-effort: any failure here is swallowed so it never blocks the order
# placement response itself (see send_order_receipt_email).

def build_receipt_pdf(order_info):
    """Builds a one-page PDF receipt as bytes using fpdf2 (pure-Python,
    no system dependencies — safe on Render). Uses 'PHP' instead of the
    peso sign since core PDF fonts don't support non-latin-1 characters.
    """
    from fpdf import FPDF

    pdf = FPDF(format='A4')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(22, 101, 52)
    pdf.cell(0, 10, 'TEFC E-Commerce', ln=True)
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, 'Triple E & Fiel Collince General Merchandise', ln=True)
    pdf.ln(4)

    pdf.set_text_color(17, 24, 39)
    pdf.set_font('Helvetica', 'B', 13)
    pdf.cell(0, 8, f"Order Receipt #{order_info['order_id'][:8].upper()}", ln=True)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, f"Date: {order_info['date']}", ln=True)
    pdf.cell(0, 6, f"Branch: {order_info['branch_name']}", ln=True)
    pdf.cell(0, 6, f"Payment Method: {order_info['payment_method_label']}", ln=True)
    if order_info.get('address'):
        pdf.multi_cell(0, 6, f"Delivery Address: {order_info['address']}")
    pdf.ln(4)

    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_fill_color(240, 253, 244)
    pdf.cell(90, 8, 'Item', border=1, fill=True)
    pdf.cell(20, 8, 'Qty', border=1, fill=True, align='C')
    pdf.cell(35, 8, 'Price', border=1, fill=True, align='R')
    pdf.cell(35, 8, 'Subtotal', border=1, fill=True, align='R')
    pdf.ln()
    pdf.set_font('Helvetica', '', 10)
    for it in order_info['items']:
        name = it['name']
        if len(name) > 38:
            name = name[:35] + '...'
        subtotal = it['qty'] * it['price']
        pdf.cell(90, 8, name, border=1)
        pdf.cell(20, 8, str(it['qty']), border=1, align='C')
        pdf.cell(35, 8, f"PHP {it['price']:.2f}", border=1, align='R')
        pdf.cell(35, 8, f"PHP {subtotal:.2f}", border=1, align='R')
        pdf.ln()

    pdf.ln(2)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(145, 7, 'Subtotal', align='R')
    pdf.cell(35, 7, f"PHP {order_info['subtotal']:.2f}", align='R', ln=True)
    pdf.cell(145, 7, 'Shipping Fee', align='R')
    pdf.cell(35, 7, f"PHP {order_info['shipping_fee']:.2f}", align='R', ln=True)
    pdf.cell(145, 6, 'VATable Sales', align='R')
    pdf.cell(35, 6, f"PHP {order_info['vatable_sales']:.2f}", align='R', ln=True)
    pdf.cell(145, 6, 'VAT Amount (12%)', align='R')
    pdf.cell(35, 6, f"PHP {order_info['vat_amount']:.2f}", align='R', ln=True)
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(145, 8, 'Total Sales (VAT Inc.)', align='R')
    pdf.cell(35, 8, f"PHP {order_info['grand_total']:.2f}", align='R', ln=True)

    pdf.ln(6)
    pdf.set_font('Helvetica', '', 9)
    pdf.set_text_color(150, 150, 150)
    pdf.multi_cell(0, 5, 'Thank you for shopping with us! This is your official e-receipt. Keep this for your records.')

    out = pdf.output()
    return bytes(out)


def build_receipt_email(order_info):
    """HTML e-receipt email body, styled to match build_otp_email()."""
    items_rows = ''.join(f"""
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">{it['name']}</td>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;">{it['qty']}</td>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:right;">PHP {it['qty'] * it['price']:.2f}</td>
              </tr>""" for it in order_info['items'])

    address_block = (
        f'<p style="margin:20px 0 0;font-size:13px;color:#6b7280;"><strong>Delivery Address:</strong><br/>{order_info["address"]}</p>'
        if order_info.get('address') else ''
    )

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#14532d,#16a34a);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">TEFC E-Commerce</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Triple E &amp; Fiel Collince General Merchandise</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 4px;font-size:16px;color:#111827;font-weight:700;">Order Confirmed!</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Hi {order_info['customer_name']}, thanks for your order. Here's your e-receipt.</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;font-size:13px;color:#374151;">
              <tr><td style="padding:3px 0;">Order ID</td><td style="text-align:right;font-weight:600;">#{order_info['order_id'][:8].upper()}</td></tr>
              <tr><td style="padding:3px 0;">Date</td><td style="text-align:right;">{order_info['date']}</td></tr>
              <tr><td style="padding:3px 0;">Branch</td><td style="text-align:right;">{order_info['branch_name']}</td></tr>
              <tr><td style="padding:3px 0;">Payment Method</td><td style="text-align:right;">{order_info['payment_method_label']}</td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px;">
              <tr>
                <td style="padding-bottom:8px;border-bottom:2px solid #16a34a;font-size:12px;color:#16a34a;font-weight:700;text-transform:uppercase;">Item</td>
                <td style="padding-bottom:8px;border-bottom:2px solid #16a34a;font-size:12px;color:#16a34a;font-weight:700;text-align:center;">Qty</td>
                <td style="padding-bottom:8px;border-bottom:2px solid #16a34a;font-size:12px;color:#16a34a;font-weight:700;text-align:right;">Amount</td>
              </tr>{items_rows}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;margin-top:12px;">
              <tr><td style="padding:3px 0;">Subtotal</td><td style="text-align:right;">PHP {order_info['subtotal']:.2f}</td></tr>
              <tr><td style="padding:3px 0;">Shipping Fee</td><td style="text-align:right;">PHP {order_info['shipping_fee']:.2f}</td></tr>
              <tr><td style="padding:3px 0;">VATable Sales</td><td style="text-align:right;">PHP {order_info['vatable_sales']:.2f}</td></tr>
              <tr><td style="padding:3px 0;">VAT Amount (12%)</td><td style="text-align:right;">PHP {order_info['vat_amount']:.2f}</td></tr>
              <tr><td style="padding:8px 0 0;font-size:15px;font-weight:700;color:#111827;">Total Sales (VAT Inc.)</td><td style="padding:8px 0 0;text-align:right;font-size:15px;font-weight:700;color:#16a34a;">PHP {order_info['grand_total']:.2f}</td></tr>
            </table>
            {address_block}
            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">A PDF copy of this receipt is attached to this email.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              Thank you for shopping with TEFC E-Commerce!<br/>
              Koronadal City, South Cotabato
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">&copy; 2026 Triple E &amp; Fiel Collince General Merchandise. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_order_receipt_email(order_id, customer_id, payment_method, shipping_fee, total, address, branch_id):
    """Best-effort e-receipt for an online order (COD or GCash), sent right
    at order placement. Must never raise — a failure here (missing PDF lib,
    Brevo outage, bad data) must not block the order itself from succeeding.
    """
    try:
        customer_res = supabase.table('customer').select('fname, lname, email').eq('customer_id', customer_id).execute()
        if not customer_res.data or not customer_res.data[0].get('email'):
            return
        customer = customer_res.data[0]

        items_res = supabase.table('order_item').select(
            'qty, price, product(product_name)'
        ).eq('order_id', order_id).execute()
        items = [{
            'name':  (i.get('product') or {}).get('product_name', 'Item'),
            'qty':   i['qty'],
            'price': float(i['price']),
        } for i in (items_res.data or [])]

        branch_name = 'N/A'
        if branch_id:
            b_res = supabase.table('branch').select('branch_name').eq('branch_id', branch_id).execute()
            if b_res.data:
                branch_name = b_res.data[0]['branch_name']

        # 'total' (the order's stored total) is the items subtotal only —
        # shipping is tracked separately on the order — so the actual
        # amount due is subtotal + shipping. VAT here is the standard PH
        # 12% rate, computed as already included in that amount (BIR-style
        # VAT-inclusive breakdown: VATable Sales = amount / 1.12, VAT =
        # amount - VATable Sales), not an extra charge on top.
        subtotal     = float(total or 0)
        shipping     = float(shipping_fee or 0)
        grand_total  = subtotal + shipping
        vatable_sales = grand_total / 1.12
        vat_amount    = grand_total - vatable_sales

        method_labels = {'gcash': 'GCash', 'cash_on_delivery': 'Cash on Delivery'}
        order_info = {
            'order_id':             order_id,
            'date':                 datetime.now().strftime('%B %d, %Y %I:%M %p'),
            'branch_name':          branch_name,
            'payment_method_label': method_labels.get(payment_method, payment_method),
            'customer_name':        customer.get('fname') or 'Customer',
            'items':                items,
            'subtotal':             subtotal,
            'shipping_fee':         shipping,
            'grand_total':          grand_total,
            'vatable_sales':        vatable_sales,
            'vat_amount':           vat_amount,
            'address':              address or '',
        }

        pdf_bytes = build_receipt_pdf(order_info)
        pdf_b64   = _b64.b64encode(pdf_bytes).decode('utf-8')

        send_email_resend(
            to_email    = customer['email'],
            subject     = f"TEFC E-Commerce — Order Receipt #{order_id[:8].upper()}",
            html_body   = build_receipt_email(order_info),
            attachments = [{'content': pdf_b64, 'name': f"Receipt-{order_id[:8].upper()}.pdf"}]
        )
    except Exception as e:
        print(f'Order receipt email error: {e}')


# ─── Firebase FCM Push Notification (Admin SDK v1) ─────────────────────────
import firebase_admin
from firebase_admin import credentials, messaging as fcm_messaging

# Initialize Firebase Admin SDK once
_firebase_initialized = False

def init_firebase():
    global _firebase_initialized
    if not _firebase_initialized:
        try:
            import os, json as _json
            service_account_path = os.path.join(
                os.path.dirname(__file__),
                'tefc-ecommerce-firebase-adminsdk-fbsvc-4a0351865e.json'
            )
            if os.path.exists(service_account_path):
                # Local development — use file
                cred = credentials.Certificate(service_account_path)
            else:
                # Render — use environment variable JSON content
                sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON', '')
                if sa_json:
                    sa_dict = _json.loads(sa_json)
                    cred    = credentials.Certificate(sa_dict)
                else:
                    print('Firebase init error: No service account file or env var found')
                    return
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            print('Firebase initialized successfully!')
        except Exception as e:
            print(f'Firebase init error: {e}')

def send_push_notification(fcm_token, title, body, data=None):
    """Send FCM push notification using Firebase Admin SDK."""
    try:
        if not fcm_token:
            return
        init_firebase()
        message = fcm_messaging.Message(
            notification=fcm_messaging.Notification(
                title=title,
                body=body,
            ),
            data={k: str(v) for k, v in (data or {}).items()},
            token=fcm_token,
            android=fcm_messaging.AndroidConfig(
                priority='high',
                notification=fcm_messaging.AndroidNotification(
                    sound='default',
                ),
            ),
        )
        response = fcm_messaging.send(message)
        print(f'FCM sent: {response}')
    except Exception as e:
        print(f'FCM error: {e}')


# Notification messages per status
ORDER_STATUS_MESSAGES = {
    'processing':       ('Order Update 📦',  'Your order is now being prepared!'),
    'out_for_delivery': ('On the Way! 🚚',   'Your order is out for delivery!'),
    'completed':        ('Order Delivered ✅','Your order has been delivered. Thank you!'),
    'cancelled':        ('Order Cancelled',   'Your order has been cancelled.'),
    'returned_failed':  ('Delivery Unsuccessful', 'We were unable to deliver your order after multiple attempts. It has been returned.'),
}

# Daily cap on how many pending orders can be moved into processing in one
# day (shop's hard delivery capacity limit per the mock-defense revision).
DAILY_PROCESSING_CAP = 30

# Same "critical stock" threshold already used everywhere in the admin/staff
# Inventory dashboards (≤5 units — see hasAnyBranchCritical / staffStockInfo
# in admin.js/staff.js) — reused here as the cutoff below which a product or
# variant stops being offered for sale (mobile app + POS), so the shop keeps
# a small reserve buffer instead of selling all the way down to zero.
CRITICAL_STOCK_LEVEL = 5

def _auto_advance_processing_orders():
    """Lazy/opportunistic check for the automatic Processing -> Out for
    Delivery transition. No background scheduler exists anywhere in this
    app, so this runs inline whenever admin or staff orders are fetched:
    any order that has been 'processing' for >=24h gets flipped to
    'out_for_delivery' right here, before the caller's query runs. Cheap
    (one UPDATE, no-op when nothing qualifies) and keeps the lists callers
    already fetch (admin_get_orders / staff_get_orders) self-correcting
    without a separate endpoint or cron job."""
    try:
        cutoff = (datetime.utcnow() - timedelta(days=1)).isoformat()
        stale = supabase.table('order').select('order_id').eq('status', 'processing').lte('processing_started_at', cutoff).execute()
        ids = [o['order_id'] for o in (stale.data or [])]
        if ids:
            supabase.table('order').update({'status': 'out_for_delivery'}).in_('order_id', ids).execute()
    except Exception as e:
        print(f'Auto-advance (processing -> out_for_delivery) warning: {e}')


@app.route('/')
def landing():
    return render_template('landing.html')

# ─── APK DOWNLOAD ─────────────────────────────────────

@app.route('/download-apk')
def download_apk():
    """
    Serve the latest APK file for download.
    APKs are dropped into backend/static/apk/ with an incrementing version
    in the filename (e.g. TEFC-ECommerce_v8.5.apk) — rather than expecting
    a fixed filename, this always serves whichever .apk file in that folder
    was modified most recently, so shipping a new version is just "add the
    new file" with no code change needed. Old versions can be left in place
    or removed; either way the newest one wins.
    """
    apk_dir   = os.path.join(os.path.dirname(__file__), 'static', 'apk')
    apk_files = glob.glob(os.path.join(apk_dir, '*.apk'))

    if not apk_files:
        flash('APK file not found. Please contact administrator.', 'error')
        return redirect(url_for('landing'))

    latest_apk = max(apk_files, key=os.path.getmtime)

    return send_file(
        latest_apk,
        mimetype='application/vnd.android.package-archive',
        as_attachment=True,
        download_name='TEFC-ECommerce-App.apk'
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
        flash('Please fill in all fields.', 'login_error')
        return redirect(url_for('login'))

    if remember_me:
        app.permanent_session_lifetime = timedelta(days=30)
        session.permanent = True

    try:
        user_res = supabase.table('user').select('*').eq('username', login_input).execute()

        if not user_res.data:
            flash('No account found with that username.', 'login_error')
            return redirect(url_for('login'))

        user = user_res.data[0]

        if user['status'] != 'active':
            flash('Your account is inactive. Please contact the administrator.', 'login_error')
            return redirect(url_for('login'))

        if not check_password(password, user['password']):
            flash('Incorrect password. Please try again.', 'login_error')
            return redirect(url_for('login'))

        # Web login is for admin and staff ONLY — customers use mobile app
        if user['role'] == 'customer':
            flash('Customers must log in through the mobile app.', 'login_error')
            return redirect(url_for('login'))
        elif user['role'] in ('admin', 'staff'):
            # Direct login without access code
            staff_res = supabase.table('staff').select('*').eq('user_id', user['user_id']).execute()
            
            if staff_res.data:
                staff = staff_res.data[0]

                # MFA check: does this browser already carry an MFA-trust
                # cookie that's on file for THIS account?
                mfa_token   = request.cookies.get('tefc_mfa_token')
                mfa_trusted = False
                if mfa_token:
                    try:
                        td_res = supabase.table('mfa_device').select('id') \
                            .eq('user_id', user['user_id']) \
                            .eq('mfa_token', mfa_token).execute()
                        if td_res.data:
                            mfa_trusted = True
                            supabase.table('mfa_device').update(
                                {'last_used_at': datetime.now().isoformat()}
                            ).eq('id', td_res.data[0]['id']).execute()
                    except Exception as e:
                        print(f"MFA trust check error: {e}")

                if mfa_trusted:
                    _finalize_login(user, staff)
                    if user['role'] == 'admin':
                        flash('Welcome, Admin!', 'success')
                        return redirect(url_for('admin_dashboard'))
                    else:
                        flash('Welcome, Staff!', 'success')
                        return redirect(url_for('staff_dashboard'))

                # Unrecognized browser/device — hold off on granting access
                # and require an MFA email code first. No 'user_id' is set
                # in the session yet, so login_required() still blocks
                # every protected page until this verification succeeds.
                session['pending_login_user_id']   = user['user_id']
                session['pending_login_staff_id']  = staff['staff_id']
                session['pending_login_role']      = user['role']
                session['pending_login_name']      = f"{staff['fname']} {staff['lname']}"
                session['pending_login_branch_id'] = staff.get('branch_id')

                otp = ''.join(random.choices(string.digits, k=6))
                session['mfa_otp_code']       = otp
                session['mfa_otp_sent']       = True
                session['mfa_otp_created_at'] = datetime.now().isoformat()

                try:
                    send_email_resend(
                        to_email  = staff.get('email'),
                        subject   = 'TEFC E-Commerce — Multi-Factor Authentication Code',
                        html_body = build_otp_email(
                            otp,
                            title='Multi-Factor Authentication',
                            purpose='verify this login before signing in'
                        )
                    )
                except Exception as email_error:
                    print(f"WARNING: Failed to send MFA email: {email_error}")

                flash("We don't recognize this browser. Enter the code we emailed you to continue.", 'success')
                return redirect(url_for('verify_mfa'))
            else:
                flash('Staff information not found.', 'login_error')
                return redirect(url_for('login'))

    except Exception as e:
        print(f"Login error: {e}")
        flash('Something went wrong. Please try again.', 'login_error')

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
            
            # Store OTP in session (expires on redirect to verify-otp page)
            session['otp_code'] = otp
            session['otp_email'] = email
            session['otp_user_id'] = user_id
            session['otp_sent'] = True
            session['otp_created_at'] = datetime.now().isoformat()
            
            # Send OTP via email
            try:
                send_email_resend(
                    to_email  = email,
                    subject   = 'TEFC E-Commerce — Password Reset OTP',
                    html_body = build_otp_email(otp, title='Password Reset Code', purpose='reset your password')
                )
            except Exception as email_error:
                print(f"WARNING: Failed to send email: {email_error}")
                # Continue even if email fails - user can see OTP in console logs for testing
            
            flash('OTP sent successfully.', 'success')
            return redirect(url_for('verify_otp'))
            
        except Exception as e:
            print(f"Forgot password error: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            flash('An error occurred. Please try again.', 'error')
            return redirect(url_for('forgot_password'))
    
    return render_template('forgot_password.html')


# ─── RESEND OTP ───────────────────────────────────────

@app.route('/resend-otp', methods=['POST'])
def resend_otp():
    if not session.get('otp_sent'):
        return jsonify({'ok': False, 'error': 'No active OTP session. Please start over.'}), 400

    email = session.get('otp_email')
    if not email:
        return jsonify({'ok': False, 'error': 'Session expired. Please start over.'}), 400

    try:
        # Generate a fresh 6-digit OTP
        otp = ''.join(random.choices(string.digits, k=6))

        # Overwrite session with new OTP + reset timestamp
        session['otp_code']       = otp
        session['otp_created_at'] = datetime.now().isoformat()
        session['otp_sent']       = True
        session.pop('otp_verified', None)   # clear any stale verified flag

        # Send email
        try:
            send_email_resend(
                to_email  = email,
                subject   = 'TEFC E-Commerce — Password Reset OTP (Resent)',
                html_body = build_otp_email(otp, title='Password Reset Code', purpose='reset your password')
            )
        except Exception as email_err:
            print(f"WARNING: Resend email failed: {email_err}")

        return jsonify({'ok': True}), 200

    except Exception as e:
        print(f"Resend OTP error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'ok': False, 'error': 'An error occurred. Please try again.'}), 500


# ─── VERIFY OTP ───────────────────────────────────────

@app.route('/verify-otp', methods=['GET', 'POST'])
def verify_otp():
    if not session.get('otp_sent'):
        return redirect(url_for('forgot_password'))

    if request.method == 'POST':
        otp = request.form.get('otp', '').strip()

        if not otp:
            flash('Please enter the OTP.', 'error')
            return redirect(url_for('verify_otp'))

        try:
            # Check if OTP has expired (5 minutes — matches the frontend countdown)
            otp_created_at = session.get('otp_created_at')
            if otp_created_at:
                created = datetime.fromisoformat(otp_created_at)
                if (datetime.now() - created).total_seconds() > 300:  # 5 minutes
                    session.pop('otp_code', None)
                    session.pop('otp_sent', None)
                    flash('OTP has expired. Please request a new one.', 'error')
                    return redirect(url_for('forgot_password'))

            # Check if OTP matches
            stored_otp = session.get('otp_code', '')
            if otp != stored_otp:
                flash('Invalid OTP. Please try again.', 'error')
                return redirect(url_for('verify_otp'))

            # OTP is valid — mark as verified, clear the code, go to reset page
            session['otp_verified'] = True
            session.pop('otp_code', None)
            return redirect(url_for('reset_password'))

        except Exception as e:
            print(f"OTP verification error: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            flash('An error occurred. Please try again.', 'error')
            return redirect(url_for('verify_otp'))

    return render_template('verify_otp.html')


# ─── MULTI-FACTOR AUTHENTICATION (login-time verification) ───────────

@app.route('/verify-mfa', methods=['GET', 'POST'])
def verify_mfa():
    if not session.get('mfa_otp_sent') or not session.get('pending_login_user_id'):
        return redirect(url_for('login'))

    if request.method == 'POST':
        otp = request.form.get('otp', '').strip()

        if not otp:
            flash('Please enter the code.', 'error')
            return redirect(url_for('verify_mfa'))

        try:
            # Code expires after 5 minutes — matches the frontend countdown
            otp_created_at = session.get('mfa_otp_created_at')
            if otp_created_at:
                created = datetime.fromisoformat(otp_created_at)
                if (datetime.now() - created).total_seconds() > 300:
                    _clear_pending_login()
                    flash('Code has expired. Please log in again.', 'error')
                    return redirect(url_for('login'))

            stored_otp = session.get('mfa_otp_code', '')
            if otp != stored_otp:
                flash('Invalid code. Please try again.', 'error')
                return redirect(url_for('verify_mfa'))

            # Correct code — finalize the pending login (same one-session-
            # per-user token issuance as a normal trusted-device login).
            user_id  = session.get('pending_login_user_id')
            staff_id = session.get('pending_login_staff_id')
            role     = session.get('pending_login_role')
            name     = session.get('pending_login_name')

            new_session_token = secrets.token_hex(32)
            supabase.table('user').update(
                {'active_session_token': new_session_token}
            ).eq('user_id', user_id).execute()

            session['user_id']       = user_id
            session['staff_id']      = staff_id
            session['role']          = role
            session['name']          = name
            session['session_token'] = new_session_token

            _record_login_session(user_id, role, staff_id, session.get('pending_login_branch_id'))

            # ...and remember this browser/device from now on (trusted
            # forever, until its cookie is cleared or a different browser
            # is used).
            new_mfa_token = secrets.token_hex(32)
            supabase.table('mfa_device').insert({
                'user_id':    user_id,
                'mfa_token':  new_mfa_token,
                'user_agent': request.headers.get('User-Agent', '')[:255],
            }).execute()

            _clear_pending_login()

            resp = redirect(url_for('admin_dashboard') if role == 'admin' else url_for('staff_dashboard'))
            resp.set_cookie(
                'tefc_mfa_token', new_mfa_token,
                max_age=60 * 60 * 24 * 365 * 5,  # effectively permanent
                httponly=True, secure=True, samesite='Lax'
            )
            flash(f"Welcome, {'Admin' if role == 'admin' else 'Staff'}!", 'success')
            return resp

        except Exception as e:
            print(f"MFA verification error: {type(e).__name__}: {str(e)}")
            traceback.print_exc()
            flash('Something went wrong. Please try again.', 'error')
            return redirect(url_for('verify_mfa'))

    return render_template('verify_mfa.html')


@app.route('/resend-mfa-otp', methods=['POST'])
def resend_mfa_otp():
    if not session.get('mfa_otp_sent') or not session.get('pending_login_user_id'):
        return jsonify({'ok': False, 'error': 'No active verification session. Please log in again.'}), 400

    try:
        user_id = session.get('pending_login_user_id')
        staff_res = supabase.table('staff').select('email').eq('user_id', user_id).execute()
        email = staff_res.data[0]['email'] if staff_res.data else None
        if not email:
            return jsonify({'ok': False, 'error': 'Could not find an email on file.'}), 400

        otp = ''.join(random.choices(string.digits, k=6))
        session['mfa_otp_code']       = otp
        session['mfa_otp_created_at'] = datetime.now().isoformat()
        session['mfa_otp_sent']       = True

        try:
            send_email_resend(
                to_email  = email,
                subject   = 'TEFC E-Commerce — Multi-Factor Authentication Code (Resent)',
                html_body = build_otp_email(
                    otp,
                    title='Multi-Factor Authentication',
                    purpose='verify this login before signing in'
                )
            )
        except Exception as email_err:
            print(f"WARNING: Resend MFA-otp email failed: {email_err}")

        return jsonify({'ok': True}), 200

    except Exception as e:
        print(f"Resend MFA OTP error: {type(e).__name__}: {str(e)}")
        traceback.print_exc()
        return jsonify({'ok': False, 'error': 'An error occurred. Please try again.'}), 500


# ─── RESET PASSWORD ───────────────────────────────────

@app.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    # Must have gone through OTP verification first
    if not session.get('otp_verified'):
        flash('Please verify your OTP first.', 'error')
        return redirect(url_for('forgot_password'))

    if request.method == 'POST':
        password         = request.form.get('password', '')
        password_confirm = request.form.get('password_confirm', '')

        if not password or not password_confirm:
            flash('Please fill in both password fields.', 'error')
            return redirect(url_for('reset_password'))

        if len(password) < 8:
            flash('Password must be at least 8 characters.', 'error')
            return redirect(url_for('reset_password'))

        if password != password_confirm:
            flash('Passwords do not match.', 'error')
            return redirect(url_for('reset_password'))

        try:
            user_id = session.get('otp_user_id')
            if not user_id:
                flash('Session expired. Please start over.', 'error')
                return redirect(url_for('forgot_password'))

            # Update password in user table
            hashed = hash_password(password)
            supabase.table('user').update({
                'password': hashed
            }).eq('user_id', user_id).execute()

            # Clear all OTP-related session variables
            for key in ('otp_code', 'otp_email', 'otp_user_id',
                        'otp_sent', 'otp_created_at', 'otp_verified'):
                session.pop(key, None)

            flash('Password reset successfully! Please log in.', 'success')
            return redirect(url_for('login'))

        except Exception as e:
            print(f"Reset password error: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            flash('An error occurred. Please try again.', 'error')
            return redirect(url_for('reset_password'))

    return render_template('reset_password.html')


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
    reason            = request.args.get('reason')
    user_id           = session.get('user_id')
    token             = session.get('session_token')
    login_session_id  = session.get('login_session_id')

    # Clear the account's active-session token on a normal/idle logout —
    # but NOT when this session is the one being superseded, since the DB
    # token already belongs to the newer login and must not be wiped.
    if reason != 'session_superseded' and user_id and token:
        try:
            current = supabase.table('user').select('active_session_token').eq('user_id', user_id).execute()
            if current.data and current.data[0].get('active_session_token') == token:
                supabase.table('user').update({'active_session_token': None}).eq('user_id', user_id).execute()
        except Exception as e:
            print(f"Logout token-clear error: {e}")

    # Close out this device's audit-trail row regardless of reason — even
    # a superseded session is genuinely ending from this browser's side.
    if login_session_id:
        try:
            supabase.table('login_sessions').update(
                {'logout_at': datetime.now().isoformat()}
            ).eq('id', login_session_id).execute()
        except Exception as e:
            print(f"login_sessions logout-time update error: {e}")

    session.clear()

    if reason == 'idle':
        flash('You were logged out due to inactivity.', 'error')
    elif reason == 'session_superseded':
        flash('You were logged out because your account was signed in on another device or browser.', 'error')
    elif reason == 'invalid_action':
        flash('Please log in to continue.', 'error')

    return redirect(url_for('login'))

# ─── SESSION CHECK (polled by security.js) ────────────
@app.route('/api/session/check')
def api_session_check():
    if 'user_id' not in session:
        return jsonify({'valid': False}), 401
    if not _session_token_valid():
        return jsonify({'valid': False, 'reason': 'session_superseded'}), 401
    return jsonify({'valid': True}), 200

# ─── PING (network banner health check) ───────────────
@app.route('/ping')
def ping():
    return '', 204

# ─── Staff POS offline app-shell service worker ───────
# Served from the site root (not /static/js/sw.js) so its default scope
# covers the whole origin — a service worker's scope is otherwise limited
# to the directory it's served from.
@app.route('/sw.js')
def staff_service_worker():
    response = send_file(os.path.join(app.static_folder, 'js', 'sw.js'))
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control']          = 'no-cache'
    return response

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
            return jsonify({'error': 'No account found with that username, email or phone number.'}), 401

        user = user_res.data[0]

        if user['status'] != 'active':
            return jsonify({'error': 'Account is inactive. Please contact support.'}), 403

        if not check_password(password, user['password']):
            return jsonify({'error': 'Incorrect password. Please try again.'}), 401

        if user['role'] not in ('customer',):
            return jsonify({'error': 'Access denied.'}), 403

        customer_res = supabase.table('customer').select('*').eq('user_id', user['user_id']).execute()
        customer     = customer_res.data[0]

        return jsonify({
            'message':  'Login successful',
            'user_id':  user['user_id'],
            'supabase_token': make_supabase_token(customer['customer_id']),
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
        traceback.print_exc()
        return jsonify({'error': 'Something went wrong.'}), 500


@app.route('/api/auth/check-duplicate', methods=['POST'])
def api_check_duplicate():
    try:
        data         = request.get_json()
        email        = data.get('email', '').strip().lower()
        username     = data.get('username', '').strip()
        phone_number = data.get('phone_number', '').strip()

        # Check username
        if username:
            res = supabase.table('user').select('user_id').eq('username', username).execute()
            if res.data:
                return jsonify({'error': f'Username "{username}" is already taken. Please choose another.'}), 400

        # Check email
        if email:
            res = supabase.table('customer').select('customer_id').eq('email', email).execute()
            if res.data:
                return jsonify({'error': f'Email "{email}" is already registered. Please use another.'}), 400

        # Check phone number
        if phone_number:
            res = supabase.table('customer').select('customer_id').eq('phone_number', phone_number).execute()
            if res.data:
                return jsonify({'error': f'Phone number "{phone_number}" is already registered. Please use another.'}), 400

        return jsonify({'message': 'All details are available.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Email Verification OTP ────────────────────────────────────────────────

@app.route('/api/auth/send-email-otp', methods=['POST'])
def api_auth_send_email_otp():
    try:
        data  = request.get_json()
        email = data.get('email', '').strip().lower()
        if not email:
            return jsonify({'error': 'Email is required.'}), 400

        # Check if email already registered
        existing = supabase.table('customer').select('email').eq('email', email).execute()
        if existing.data:
            return jsonify({'error': 'This email is already registered. Please log in.'}), 400

        # Generate 6-digit OTP
        import random
        otp_code = str(random.randint(100000, 999999))

        # Delete existing OTPs for this email
        supabase.table('otp_codes').delete().eq('email', email).execute()

        # Save OTP
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        supabase.table('otp_codes').insert({
            'email':      email,
            'otp':        otp_code,
            'expires_at': expires_at,
            'used':       False,
        }).execute()

        # Send email via Resend
        send_email_resend(
            to_email  = email,
            subject   = 'TEFC E-Commerce — Email Verification Code',
            html_body = build_otp_email(otp_code, title='Verification Code', purpose='verify your email address')
        )

        return jsonify({'message': 'OTP sent successfully.'}), 200
    except Exception as e:
        print(f'Send email OTP error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/verify-email-otp', methods=['POST'])
def api_auth_verify_email_otp():
    try:
        data     = request.get_json()
        email    = data.get('email', '').strip().lower()
        otp_code = data.get('otp', '').strip()

        if not email or not otp_code:
            return jsonify({'error': 'Email and OTP are required.'}), 400

        from datetime import datetime
        res = supabase.table('otp_codes').select('*').eq('email', email).eq('otp', otp_code).eq('used', False).execute()
        if not res.data:
            return jsonify({'error': 'Invalid OTP code. Please try again.'}), 400

        otp_record = res.data[0]
        expires_at = otp_record.get('expires_at', '')
        now        = datetime.now(timezone.utc).isoformat()

        if now > expires_at:
            return jsonify({'error': 'OTP has expired. Please request a new one.'}), 400

        # Mark OTP as used
        supabase.table('otp_codes').update({'used': True}).eq('email', email).execute()

        return jsonify({'message': 'Email verified successfully.', 'verified': True}), 200
    except Exception as e:
        print(f'Verify email OTP error: {e}')
        return jsonify({'error': str(e)}), 500


# ─── Save FCM Token ────────────────────────────────────────────────────────
@app.route('/api/customer/fcm-token', methods=['POST'])
def save_fcm_token():
    try:
        data        = request.get_json()
        fcm_token   = data.get('fcm_token', '').strip()
        customer_id = request.headers.get('X-Customer-ID')
        if not customer_id:
            return jsonify({'error': 'Unauthorized'}), 401
        if not fcm_token:
            return jsonify({'error': 'FCM token required'}), 400

        supabase.table('customer').update(
            {'fcm_token': fcm_token}
        ).eq('customer_id', customer_id).execute()

        return jsonify({'message': 'FCM token saved.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
        category  = request.args.get('category', '')
        branch_id = request.args.get('branch_id', '')  # optional — scopes "Sold" to this branch
        query    = supabase.table('product').select(
            '*, discount(discount_name, percentage), branch_stock(branch_id, quantity, branch(branch_name)), variant_stock(branch_id, quantity, options), option_groups, net_weight'
        ).eq('status', 'active')
        if category:
            query = query.eq('category', category)
        # Wrapped in supabase_retry — this call goes out to Supabase over
        # HTTPS/HTTP2 and was failing outright on a transient connection
        # drop (e.g. "EOF occurred in violation of protocol", a Windows/
        # flaky-network socket blip), which this route's except then masked
        # as a generic 500. Every other route with a Supabase call already
        # uses this helper; this one just hadn't been updated to match.
        res = supabase_retry(lambda: query.order('created_at', desc=True).execute())

        # Get total sold per product from completed orders — scoped to the
        # customer's selected branch when one is passed (?branch_id=...), so
        # the "Sold" badge reflects what actually sold at that branch rather
        # than a store-wide total that reads identical no matter which
        # branch's catalog is being browsed.
        completed_query = supabase.table('order').select('order_id').eq('status', 'completed')
        if branch_id:
            completed_query = completed_query.eq('branch_id', branch_id)
        completed_orders    = supabase_retry(lambda: completed_query.execute())
        completed_order_ids = [o['order_id'] for o in (completed_orders.data or [])]
        sold_map = {}
        if completed_order_ids:
            items_res = supabase_retry(lambda: supabase.table('order_item').select('product_id, qty').in_('order_id', completed_order_ids).execute())
            for oi in (items_res.data or []):
                pid = oi['product_id']
                sold_map[pid] = sold_map.get(pid, 0) + int(oi.get('qty') or 0)

        # Return products with branch_stock array intact (not expanded per branch)
        result = []
        for p in res.data:
            entry = dict(p)
            entry['total_sold'] = sold_map.get(p['product_id'], 0)
            # Keep total quantity as sum of all branch stocks — guard against a
            # null quantity on any branch_stock row (was crashing sum() with a
            # TypeError, which this route's except then masked as a generic
            # 500 "Failed to fetch products." with no indication of why).
            branch_stocks = p.get('branch_stock') or []
            entry['quantity'] = sum(int(bs.get('quantity') or 0) for bs in branch_stocks)

            # Hide a product from the branch's shelf once it's down to its
            # critical reserve level — keeps a buffer instead of selling all
            # the way to zero. Only applied when a specific branch_id was
            # requested (the customer's selected branch, or the POS screen's
            # own branch) — a caller that didn't scope to a branch (e.g. the
            # admin/staff Inventory dashboard, which hits a different
            # endpoint anyway, or any store-wide listing) sees everything,
            # critical or not, since that view exists precisely to show low
            # stock so staff know to restock it.
            if branch_id:
                bs_here = next((bs for bs in branch_stocks if str(bs.get('branch_id')) == str(branch_id)), None)
                base_qty = int(bs_here.get('quantity') or 0) if bs_here else 0
                variant_stocks = [v for v in (p.get('variant_stock') or []) if str(v.get('branch_id')) == str(branch_id)]
                if variant_stocks:
                    # Variant product — available if AT LEAST ONE variant combo
                    # is still above critical (still sellable via that option),
                    # even if other variants or the base row are critically low.
                    best_available = max(int(v.get('quantity') or 0) for v in variant_stocks)
                else:
                    best_available = base_qty
                if best_available <= CRITICAL_STOCK_LEVEL:
                    continue  # skip — critical or out of stock at this branch

            result.append(entry)

        return jsonify(result), 200
    except Exception as e:
        print(f"API products error: {e}")
        traceback.print_exc()  # full stack trace in the server console — pinpoints the failing line next time
        return jsonify({'error': 'Failed to fetch products.'}), 500

@app.route('/api/products/<product_id>', methods=['GET'])
def api_product_detail(product_id):
    try:
        import uuid as _uuid
        try:
            _uuid.UUID(product_id)
        except ValueError:
            return jsonify({'error': 'Invalid product ID.'}), 404
        res = supabase.table('product').select(
            '*, discount(discount_name, percentage), branch_stock(branch_id, quantity, branch(branch_name)), option_groups, net_weight, net_weight_unit'
        ).eq('product_id', product_id).execute()
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
        # branch_stock/variant_stock are included so the app can enforce the
        # real stock cap on the quantity stepper — without them, every
        # product's stock limit silently reads as undefined and the +
        # button never disables no matter how high the quantity goes
        # (branch-level AND per-variant).
        res = supabase_retry(lambda: supabase.table('cart').select(
            '*, branch_id, product(product_id, product_name, price, image_url, image_urls, brand, category, net_weight, net_weight_unit, option_groups, variant_overrides, discount(discount_name, percentage), branch_stock(branch_id, quantity), variant_stock(branch_id, quantity, options))'
        ).eq('customer_id', customer_id).eq('status', 'active').execute())
        return jsonify(res.data), 200
    except Exception as e:
        print(f"API cart error: {e}")
        return jsonify({'error': 'Failed to fetch cart.'}), 500

@app.route('/api/cart', methods=['POST'])
def api_add_to_cart():
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data             = request.get_json()
    product_id       = data.get('product_id')
    quantity         = data.get('quantity', 1)
    branch_id        = data.get('branch_id')
    selected_options = data.get('selected_options', {})

    if not product_id:
        return jsonify({'error': 'Product ID is required.'}), 400

    try:
        existing = supabase.table('cart').select('*').eq('customer_id', customer_id).eq('product_id', product_id).eq('status', 'active').execute()

        # Find a row whose selected_options exactly match — different variants are separate cart items
        matched = next(
            (row for row in (existing.data or []) if (row.get('selected_options') or {}) == (selected_options or {})),
            None
        )

        if matched:
            new_quantity = matched['quantity'] + quantity
            res = supabase.table('cart').update({
                'quantity':  new_quantity,
                'branch_id': branch_id,
            }).eq('cart_id', matched['cart_id']).execute()
        else:
            res = supabase.table('cart').insert({
                'customer_id':      customer_id,
                'product_id':       product_id,
                'quantity':         quantity,
                'branch_id':        branch_id,
                'selected_options': selected_options,
                'status':           'active'
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
    updates  = {'quantity': quantity}
    if 'selected_options' in data:
        updates['selected_options'] = data['selected_options']
    try:
        res = supabase.table('cart').update(updates).eq('cart_id', cart_id).eq('customer_id', customer_id).execute()
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
        res = supabase_retry(lambda: supabase.table('order').select(
            '*, order_item(order_item_id, product_id, qty, price, selected_options, product(product_name, image_url, image_urls, price, option_groups, variant_overrides)), payment(*), branch(branch_name)'
        ).eq('customer_id', customer_id).order('created_at', desc=True).execute())
        return jsonify(res.data), 200
    except Exception as e:
        print(f"API get orders error: {e}")
        return jsonify({'error': 'Failed to fetch orders.'}), 500


@app.route('/api/orders/<order_id>/received', methods=['POST'])
def api_mark_order_received(order_id):
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        # Verify order belongs to customer and is out_for_delivery
        order_res = supabase.table('order').select('order_id, status, customer_id').eq('order_id', order_id).execute()
        if not order_res.data:
            return jsonify({'error': 'Order not found.'}), 404
        order = order_res.data[0]
        if str(order.get('customer_id')) != str(customer_id):
            return jsonify({'error': 'Unauthorized.'}), 403
        if order.get('status') != 'out_for_delivery':
            return jsonify({'error': 'Order is not out for delivery.'}), 400

        supabase.table('order').update({'status': 'completed'}).eq('order_id', order_id).execute()
        return jsonify({'message': 'Order marked as received!'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Customer self-cancel: only while status is still 'pending' and within a 2-hour
# window from when the order was placed (enforced server-side, not just on the
# button's visibility on mobile). Reason is optional. Mirrors the stock-return
# logic used by admin/staff cancellation so branch/variant/product quantities
# stay accurate either way.
CUSTOMER_CANCEL_WINDOW_HOURS = 2

@app.route('/api/orders/<order_id>/cancel', methods=['POST'])
def api_cancel_order(order_id):
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data   = request.get_json() or {}
        reason = (data.get('reason') or '').strip()

        order_res = supabase.table('order').select(
            'order_id, status, customer_id, created_at, branch_id, order_item(product_id, qty, selected_options)'
        ).eq('order_id', order_id).execute()
        if not order_res.data:
            return jsonify({'error': 'Order not found.'}), 404
        order = order_res.data[0]
        if str(order.get('customer_id')) != str(customer_id):
            return jsonify({'error': 'Unauthorized.'}), 403
        if order.get('status') != 'pending':
            return jsonify({'error': 'This order can no longer be cancelled.'}), 400

        # Enforce the 2-hour window server-side (the mobile button hiding is UX only)
        created_raw = order.get('created_at')
        if created_raw:
            from datetime import datetime, timezone
            normalized = str(created_raw).replace(' ', 'T')
            if not (normalized.endswith('Z') or '+' in normalized[10:]):
                normalized += '+00:00'
            else:
                normalized = normalized.replace('Z', '+00:00')
            try:
                created_dt = datetime.fromisoformat(normalized)
                if created_dt.tzinfo is None:
                    created_dt = created_dt.replace(tzinfo=timezone.utc)
                elapsed_hours = (datetime.now(timezone.utc) - created_dt).total_seconds() / 3600
                if elapsed_hours > CUSTOMER_CANCEL_WINDOW_HOURS:
                    return jsonify({'error': 'The 2-hour cancellation window has passed.'}), 400
            except Exception as parse_err:
                print(f'Cancel window parse warning: {parse_err}')

        supabase.table('order').update({
            'status':         'cancelled',
            'cancel_reason':  reason or None,
            'cancelled_by':   'customer',
        }).eq('order_id', order_id).execute()

        # No stock restore here — this endpoint only ever cancels a still-
        # 'pending' order (enforced above), and stock is no longer deducted
        # at checkout, only once an order reaches 'processing'. A pending
        # order never took stock off the shelf, so there's nothing to give
        # back.

        return jsonify({'message': 'Order cancelled.'}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/upload/gcash-receipt', methods=['POST'])
def upload_gcash_receipt():
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        import base64
        data         = request.get_json()
        image_base64 = data.get('image_base64', '')
        file_name    = data.get('file_name', 'receipt.jpg')
        content_type = data.get('content_type', 'image/jpeg')

        image_bytes  = base64.b64decode(image_base64)
        storage_path = f'receipts/{customer_id}_{file_name}'

        supabase.storage.from_('gcash-receipts').upload(
            storage_path, image_bytes, {'content-type': content_type}
        )
        url = supabase.storage.from_('gcash-receipts').get_public_url(storage_path)
        return jsonify({'url': url}), 200
    except Exception as e:
        print(f'Receipt upload error: {e}')
        return jsonify({'error': str(e)}), 500


# ─── VARIANT STOCK ────────────────────────────────────

@app.route('/api/variant-stock/<product_id>', methods=['GET'])
def get_variant_stock(product_id):
    """Get all variant stocks for a product (optionally filtered by branch)"""
    try:
        branch_id = request.args.get('branch_id')
        query = supabase.table('variant_stock').select('*').eq('product_id', product_id)
        if branch_id:
            query = query.eq('branch_id', branch_id)
        res = query.execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/variant-stock', methods=['POST'])
def set_variant_stock():
    """Set/update variant stock (admin) """
    try:
        data       = request.get_json()
        product_id = data.get('product_id')
        branch_id  = data.get('branch_id')
        options    = data.get('options', {})
        quantity   = int(data.get('quantity', 0))

        if not product_id or not branch_id or not options:
            return jsonify({'error': 'product_id, branch_id and options are required'}), 400

        # Upsert variant stock
        all_vs = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', product_id).eq('branch_id', branch_id).execute()
        match = [v for v in (all_vs.data or []) if v.get('options') == options]
        if match:
            supabase.table('variant_stock').update({'quantity': quantity, 'updated_at': 'now()'}).eq('id', match[0]['id']).execute()
        else:
            supabase.table('variant_stock').insert({'product_id': product_id, 'branch_id': branch_id, 'options': options, 'quantity': quantity}).execute()

        # Auto-activate product if total branch_stock >= 1
        try:
            all_vs = supabase.table('variant_stock').select('quantity').eq('product_id', product_id).execute()
            total = sum(v['quantity'] for v in (all_vs.data or []))
            if total >= 1:
                supabase.table('product').update({'status': 'active'}).eq('product_id', product_id).execute()
        except: pass

        return jsonify({'message': 'Variant stock updated.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/variant-stock/check', methods=['POST'])
def check_variant_stock():
    """Check stock for a specific variant combo (mobile)"""
    try:
        data       = request.get_json()
        product_id = data.get('product_id')
        branch_id  = data.get('branch_id')
        options    = data.get('options', {})

        if not product_id or not options:
            return jsonify({'quantity': 0}), 200

        query = supabase.table('variant_stock').select('quantity, options').eq('product_id', product_id)
        if branch_id:
            query = query.eq('branch_id', branch_id)
        res = query.execute()
        total = sum(v['quantity'] for v in (res.data or []) if v.get('options') == options)
        return jsonify({'quantity': total}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── VARIANT STOCK ────────────────────────────────────


# ─── Shipping / Payment Method eligibility (online orders) ───────────
# Mirrors the mobile app's CheckoutScreen.js isWithinSouthCotabato(): the
# address is stored pipe-delimited (Street|Barangay|City|Province|Region|
# Zip), and we scan every part for a "South Cotabato" mention rather than
# trusting a fixed index, to tolerate addresses with a missing field.
def _is_within_south_cotabato(address):
    parts = (address or '').lower().split('|')
    return any('south cotabato' in p or 'southcotabato' in p for p in parts)


def _compute_shipping_fee(address, cart_items):
    """Recomputes the shipping fee from scratch server-side — never trusts
    the client-sent amount — mirroring the mobile app's CheckoutScreen.js
    calculateShipping() zone + weight formula exactly. Four zones, modeled
    on real courier (J&T) pricing — same-region cheapest, same-island
    mid-tier, inter-island priciest — plus a light-item bracket under 500g
    so a small item isn't charged the same as something near 5kg:
      - Within South Cotabato: always free, any weight.
      - Region XII (SOCCSKSARGEN) otherwise: PHP 70 flat under 500g,
        else PHP 120 base +PHP 30/kg over 5kg.
      - Rest of Mindanao mainland (Region IX/X/XI, CARAGA, BARMM): PHP 90
        flat under 500g, else PHP 150 base +PHP 32/kg over 5kg.
      - Luzon/Visayas (inter-island): PHP 120 flat under 500g, else
        PHP 200 base +PHP 35/kg over 5kg.
    """
    product_ids = list({item.get('product_id') for item in cart_items if item.get('product_id')})
    weight_by_id = {}
    if product_ids:
        prod_res = supabase.table('product').select('product_id, net_weight, net_weight_unit').in_('product_id', product_ids).execute()
        for p in (prod_res.data or []):
            weight_by_id[p['product_id']] = (p.get('net_weight') or 0, (p.get('net_weight_unit') or 'kg').lower())

    total_weight = 0.0
    for item in cart_items:
        w, unit = weight_by_id.get(item.get('product_id'), (0, 'kg'))
        w = float(w or 0)
        # Same unit handling as the mobile app: gram/mL -> /1000, else 1:1.
        w_kg = (w / 1000) if unit in ('gram', 'ml') else w
        total_weight += w_kg * float(item.get('quantity', 1) or 1)

    parts  = (address or '').lower().split('|')
    in_sc  = any('south cotabato' in p or 'southcotabato' in p for p in parts)
    in_r12 = any(('xii' in p) or ('soccsksargen' in p) or ('region 12' in p) or ('region xii' in p) for p in parts)
    # Rest of Mindanao mainland — Region IX (Zamboanga Peninsula), Region X
    # (Northern Mindanao), Region XI (Davao Region), CARAGA, BARMM. Checked
    # only after in_sc/in_r12 have already been ruled out above, so a loose
    # 'mindanao' catch-all here can't misfire on a South Cotabato/Region XII
    # address even though those are geographically part of Mindanao too.
    in_mindanao = any(
        ('mindanao' in p) or ('region ix' in p) or ('region 9' in p) or ('zamboanga' in p) or
        ('region x' in p) or ('region 10' in p) or ('davao' in p) or ('caraga' in p) or
        ('region xiii' in p) or ('region 13' in p) or ('barmm' in p) or ('bangsamoro' in p) or
        ('armm' in p)
        for p in parts
    )

    if in_sc:
        return 0.0
    if in_r12:
        light, base, over_kg, rate = 70, 120, 5, 30
    elif in_mindanao:
        light, base, over_kg, rate = 90, 150, 5, 32
    else:
        light, base, over_kg, rate = 120, 200, 5, 35

    if total_weight <= 0.5:
        return float(light)

    extra = math.ceil((total_weight - over_kg) * rate) if total_weight > over_kg else 0
    return float(base + extra)


@app.route('/api/orders', methods=['POST'])
def api_place_order():
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401

    # ── Prevent duplicate orders within 10 seconds ──────────────────────────
    try:
        from datetime import datetime, timezone, timedelta
        recent = supabase.table('order').select('order_id, created_at').eq('customer_id', customer_id).order('created_at', desc=True).limit(1).execute()
        if recent.data:
            raw_ts    = recent.data[0]['created_at']
            # Normalize: trim microseconds to 3 decimals, ensure UTC offset
            raw_ts    = raw_ts[:23] if len(raw_ts) > 23 and '.' in raw_ts else raw_ts
            if not raw_ts.endswith('Z') and '+' not in raw_ts[10:]:
                raw_ts += '+00:00'
            raw_ts    = raw_ts.replace('Z', '+00:00')
            last_time = datetime.fromisoformat(raw_ts)
            if datetime.now(timezone.utc) - last_time < timedelta(seconds=10):
                return jsonify({'error': 'Duplicate order detected. Please wait a moment.'}), 429
    except Exception as dup_err:
        print(f'Duplicate check warning: {dup_err}')

    data               = request.get_json()
    cart_items         = data.get('cart_items', [])
    payment_method     = data.get('payment_method', '')
    payment_intent_id  = data.get('payment_intent_id', '')
    address            = data.get('address', '')
    ref_no             = ''

    if not cart_items or not payment_method:
        return jsonify({'error': 'Cart items and payment method are required.'}), 400

    # Cash on Delivery is only offered within South Cotabato — everywhere
    # else is Online Payment (GCash) only. The mobile app already hides
    # COD outside South Cotabato, but this is re-checked here too so a
    # direct API call can't force COD for an out-of-area address.
    if payment_method == 'cash_on_delivery' and not _is_within_south_cotabato(address):
        return jsonify({'error': 'Cash on Delivery is only available within South Cotabato. Please choose Online Payment (GCash) for this address.'}), 400

    # GCash is verified-only — the mobile app completes payment via the
    # PayMongo WebView flow first, then submits the order with the
    # resulting payment_intent_id. We independently re-check with
    # PayMongo here (never trusting the client) before accepting the
    # order; this is the same server-side pattern used for the staff POS.
    if payment_method == 'gcash':
        if not payment_intent_id:
            return jsonify({'error': 'A verified GCash payment is required.'}), 400
        try:
            status = paymongo_get_intent_status(payment_intent_id)
        except PayMongoError as e:
            return jsonify({'error': f'Could not verify GCash payment: {e}'}), 502
        if status != 'succeeded':
            return jsonify({'error': f'GCash payment has not succeeded yet (status: {status}).'}), 400
        ref_no = payment_intent_id

    try:
        total    = sum(item['price'] * item['quantity'] for item in cart_items)
        quantity = sum(item['quantity'] for item in cart_items)

        branch_id    = data.get('branch_id')
        # Never trust the client-sent shipping_fee — recompute it here from
        # the address + each item's product weight, so the amount can't be
        # tampered with via a direct API call (e.g. sending 0 for an
        # out-of-South-Cotabato address to dodge the fee).
        shipping_fee = _compute_shipping_fee(address, cart_items)
        address_note = data.get('address_note', '')
        order_res = supabase.table('order').insert({
            'customer_id':  customer_id,
            'order_type':   'online',
            'quantity':     quantity,
            'total':        total,
            'status':       'pending',
            'branch_id':    branch_id,
            'shipping_fee': shipping_fee,
            'address':      address,
            'address_note': address_note,
            'date':         'now()',
        }).execute()

        order_id    = order_res.data[0]['order_id']
        order_items = [{
            'order_id':        order_id,
            'product_id':      item['product_id'],
            'qty':             item['quantity'],
            'price':           item['price'],
            'selected_options': item.get('selected_options', {})
        } for item in cart_items]

        # Stock is NOT deducted here at checkout anymore — an order only
        # actually takes stock off the shelf once it's moved into
        # 'processing' (see _deduct_order_item_stock, called from
        # admin_update_order / staff_update_order / the batch-process
        # endpoints). A still-'pending' order is a reservation request only;
        # this keeps the customer cancel window (pending-only) simple — no
        # stock to restore — and matches the inventory not being committed
        # until a staff member actually starts working the order.
        supabase.table('order_item').insert(order_items).execute()

        payment_res = supabase.table('payment').insert({
            'order_id':          order_id,
            'customer_id':       customer_id,
            'payment_method':    payment_method,
            'total':             total,
            # GCash: ref_no is the PayMongo payment_intent_id, already
            # verified 'succeeded' with PayMongo above. sender_number /
            # receipt_image_url are no longer collected for GCash — that
            # manual honor-system path has been fully replaced.
            'ref_no':            ref_no if ref_no else None,
            'sender_number':     None,
            'receipt_image_url': None,
            'status':            'paid' if payment_method == 'gcash' else 'pending'
        }).execute()

        for item in cart_items:
            cart_id = item.get('cart_id')
            # Skip if cart_id is missing or 'buy_now' (Buy Now doesn't use cart)
            if cart_id and cart_id != 'buy_now':
                try:
                    supabase.table('cart').update({'status': 'checked_out'}).eq('cart_id', cart_id).execute()
                except Exception:
                    pass  # Non-critical — cart status update failure won't block order

        # (No stock deduction here either — see note above. Stock is taken
        # off the shelf only when the order enters 'processing'.)

        # E-receipt (COD & GCash alike) — sent right now, at order placement.
        # Best-effort and non-blocking: send_order_receipt_email() swallows
        # its own errors, so a failed/slow email never fails the order.
        send_order_receipt_email(
            order_id, customer_id, payment_method, shipping_fee, total, address, branch_id
        )

        return jsonify({
            'message':  'Order placed successfully.',
            'order_id': order_id,
            'total':    total
        }), 201

    except Exception as e:
        print(f"API place order error: {e}")
        return jsonify({'error': 'Failed to place order.'}), 500


@app.route('/api/orders/paymongo/gcash/create', methods=['POST'])
def api_orders_paymongo_gcash_create():
    """Starts a GCash payment for a mobile-app checkout. Returns a
    payment_intent_id (to poll and to send back with the order) and a
    redirect_url the app opens in an in-app WebView for the customer to
    complete the GCash authorization themselves."""
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data   = request.get_json() or {}
        amount = data.get('amount')
        if not amount or float(amount) <= 0:
            return jsonify({'error': 'A valid amount is required.'}), 400

        return_url = request.url_root.rstrip('/') + '/paymongo/gcash-return'

        payment_intent_id, redirect_url = paymongo_create_gcash_intent(
            amount_pesos = amount,
            return_url   = return_url,
            description  = 'TEFC E-Commerce — Online order',
        )
        return jsonify({
            'payment_intent_id': payment_intent_id,
            'redirect_url':      redirect_url,
        }), 200
    except PayMongoError as e:
        print(f'PayMongo create error: {e}')
        return jsonify({'error': str(e)}), 502
    except Exception as e:
        print(f'Mobile PayMongo create error: {e}')
        return jsonify({'error': 'Could not start GCash payment.'}), 500


@app.route('/api/orders/paymongo/gcash/status/<payment_intent_id>', methods=['GET'])
def api_orders_paymongo_gcash_status(payment_intent_id):
    """Polled by the mobile app every few seconds while the GCash WebView
    is open."""
    customer_id = request.headers.get('X-Customer-ID')
    if not customer_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        status = paymongo_get_intent_status(payment_intent_id)
        return jsonify({'status': status}), 200
    except PayMongoError as e:
        print(f'PayMongo status error: {e}')
        return jsonify({'error': str(e)}), 502
    except Exception as e:
        print(f'Mobile PayMongo status error: {e}')
        return jsonify({'error': 'Could not check GCash payment status.'}), 500


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
# PROFILE ROUTES (Admin & Staff)
# ══════════════════════════════════════════════════════

# ─── GET current user profile ────────────────────────
@app.route('/auth/profile', methods=['GET'])
@staff_required
def get_profile():
    try:
        user_id  = session.get('user_id')
        staff_id = session.get('staff_id')

        user_res = supabase_retry(lambda: supabase.table('user')
            .select('username')
            .eq('user_id', user_id)
            .single()
            .execute())
        staff_res = supabase_retry(lambda: supabase.table('staff')
            .select('fname, lname, mi, email, phone_number')
            .eq('staff_id', staff_id)
            .single()
            .execute())

        if not user_res.data or not staff_res.data:
            return jsonify({'error': 'Profile not found.'}), 404

        return jsonify({
            'username':     user_res.data['username'],
            'fname':        staff_res.data['fname'],
            'lname':        staff_res.data['lname'],
            'mi':           staff_res.data['mi'] or '',
            'email':        staff_res.data['email'],
            'phone_number': staff_res.data['phone_number'] or '',
        }), 200
    except Exception as e:
        print(f'GET profile error: {e}')
        return jsonify({'error': 'Failed to load profile.'}), 500


# ─── PATCH update profile / change password ──────────
@app.route('/auth/profile', methods=['PATCH'])
@staff_required
def update_profile():
    try:
        data     = request.get_json()
        action   = data.get('action', 'info')  # 'info' or 'password'
        user_id  = session.get('user_id')
        staff_id = session.get('staff_id')

        if action == 'password':
            current_pw  = data.get('current_password', '').strip()
            new_pw      = data.get('new_password', '').strip()
            confirm_pw  = data.get('confirm_password', '').strip()

            if not current_pw or not new_pw or not confirm_pw:
                return jsonify({'error': 'All password fields are required.'}), 400
            if new_pw != confirm_pw:
                return jsonify({'error': 'New passwords do not match.'}), 400
            if len(new_pw) < 8:
                return jsonify({'error': 'New password must be at least 8 characters.'}), 400

            user_res = supabase_retry(lambda: supabase.table('user')
                .select('password')
                .eq('user_id', user_id)
                .single()
                .execute())
            if not user_res.data:
                return jsonify({'error': 'User not found.'}), 404

            if not verify_password(current_pw, user_res.data['password']):
                return jsonify({'error': 'Current password is incorrect.'}), 401

            new_hash = hash_password(new_pw)
            supabase_retry(lambda: supabase.table('user')
                .update({'password': new_hash})
                .eq('user_id', user_id)
                .execute())

            return jsonify({'message': 'Password changed successfully.'}), 200

        else:
            # Update personal info
            fname    = data.get('fname', '').strip()
            lname    = data.get('lname', '').strip()
            mi       = data.get('mi', '').strip()
            email    = data.get('email', '').strip()
            phone    = data.get('phone_number', '').strip()
            username = data.get('username', '').strip()

            if not fname or not lname or not email or not username:
                return jsonify({'error': 'First name, last name, email, and username are required.'}), 400

            # Check username uniqueness (exclude current user)
            uname_res = supabase_retry(lambda: supabase.table('user')
                .select('user_id')
                .eq('username', username)
                .neq('user_id', user_id)
                .execute())
            if uname_res.data:
                return jsonify({'error': 'Username is already taken.'}), 409

            supabase_retry(lambda: supabase.table('staff')
                .update({'fname': fname, 'lname': lname, 'mi': mi,
                         'email': email, 'phone_number': phone})
                .eq('staff_id', staff_id)
                .execute())
            supabase_retry(lambda: supabase.table('user')
                .update({'username': username})
                .eq('user_id', user_id)
                .execute())

            # Refresh session name
            session['name'] = fname + ' ' + lname

            return jsonify({'message': 'Profile updated successfully.'}), 200

    except Exception as e:
        print(f'PATCH profile error: {e}')
        return jsonify({'error': 'Failed to update profile.'}), 500


# ══════════════════════════════════════════════════════
# STOCK REQUEST ROUTES
# ══════════════════════════════════════════════════════

# ─── Staff: Submit stock request ─────────────────────
@app.route('/api/staff/stock-requests', methods=['GET'])
@staff_required
def staff_get_stock_requests():
    try:
        staff_id = session.get('staff_id')
        # variant_stock + branch_stock are pulled in so the request history
        # can show the CURRENT stock of the actual variant/branch the staff
        # member requested, instead of the product's bare (non-variant,
        # non-branch) quantity field.
        res = supabase.table('stock_request').select(
            '*, product(product_name, quantity, '
            'variant_stock(branch_id, options, quantity), '
            'branch_stock(branch_id, quantity)), '
            'branch(branch_name)'
        ).eq('staff_id', staff_id).order('created_at', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/stock-requests', methods=['POST'])
@staff_required
def staff_create_stock_request():
    try:
        data            = request.get_json()
        staff_id        = session.get('staff_id')
        product_id      = data.get('product_id')
        quantity_needed = int(data.get('quantity_needed', 0))
        note            = data.get('note', '')
        branch_id       = data.get('branch_id')
        variant_options = data.get('variant_options') or None
        # Shared by every item a staff member submits together in one
        # "Generate Stock Request" batch (the frontend generates one id and
        # sends it with each item) — lets admin's Stock Requests table group
        # them into a single row and approve/reject the whole batch at once.
        # Absent/None for an older client or a genuine single-item request.
        batch_id        = data.get('batch_id') or None

        if not product_id or quantity_needed <= 0:
            return jsonify({'error': 'Product and quantity are required.'}), 400

        res = supabase.table('stock_request').insert({
            'staff_id':        staff_id,
            'branch_id':       branch_id,
            'product_id':      product_id,
            'quantity_needed': quantity_needed,
            'note':            note,
            'status':          'pending',
            'variant_options': variant_options,
            'batch_id':        batch_id,
        }).execute()
        return jsonify(res.data[0]), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Admin: View all stock requests ──────────────────
@app.route('/api/admin/stock-requests', methods=['GET'])
@admin_required
def admin_get_stock_requests():
    try:
        # variant_stock is pulled in alongside branch_stock so the Stock
        # Requests table/review modal can show the CURRENT stock of the
        # actual variant requested, not just the branch's aggregate total.
        res = supabase.table('stock_request').select(
            '*, product(product_name, quantity, '
            'branch_stock(branch_id, quantity, branch(branch_name)), '
            'variant_stock(branch_id, options, quantity)), '
            'staff(fname, lname), branch(branch_name)'
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
        data              = request.get_json()
        supplier          = data.get('supplier', '').strip()
        note              = data.get('note', '')
        items             = data.get('items', [])  # [{product_id, quantity, unit_cost}]
        # Approved stock requests this PO was built from (via the admin's
        # "Use Approved Requests" picker) — best-effort marked converted_to_po
        # below so they drop off that list and don't get pulled into a
        # second PO by mistake. Empty/absent for a normally-typed PO.
        stock_request_ids = data.get('stock_request_ids', []) or []
        staff_id          = session.get('staff_id')

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
                'po_id':             po_id,
                'product_id':        item['product_id'],
                'quantity':          int(item['quantity']),
                'unit_cost':         float(item.get('unit_cost', 0)),
                'variant_options':   item.get('variant_options') or None,
                'received_quantity': 0,
            }).execute()

        # Mark any approved stock requests pulled into this PO so they drop
        # out of the "Use Approved Requests" picker and aren't ordered twice.
        # Best-effort — a failure here shouldn't undo the PO already created.
        if stock_request_ids:
            try:
                for req_id in stock_request_ids:
                    supabase.table('stock_request').update(
                        {'converted_to_po': True}
                    ).eq('request_id', req_id).execute()
            except Exception as mark_err:
                print(f'Stock request conversion-mark warning: {mark_err}')

        return jsonify({'message': 'Purchase order created.', 'po_id': po_id, 'po_number': po_num}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _po_add_branch_stock(supabase, session, product_id, branch_id, qty_added, variant_options, po_label):
    """Add qty_added to branch_stock (upsert), log to inventory, update variant_stock, auto-activate product."""
    import time as _t
    # Upsert branch_stock
    bs_res = supabase.table('branch_stock').select('quantity').eq('product_id', product_id).eq('branch_id', branch_id).execute()
    if bs_res.data:
        qty_before = bs_res.data[0]['quantity']
        qty_after  = qty_before + qty_added
        supabase.table('branch_stock').update({'quantity': qty_after, 'updated_at': 'now()'}).eq('product_id', product_id).eq('branch_id', branch_id).execute()
    else:
        qty_before = 0
        qty_after  = qty_added
        supabase.table('branch_stock').insert({'product_id': product_id, 'branch_id': branch_id, 'quantity': qty_added}).execute()

    # Log to inventory
    supabase.table('inventory').insert({
        'product_id':      product_id,
        'staff_id':        session.get('staff_id'),
        'quantity_added':  qty_added,
        'quantity_before': qty_before,
        'quantity_after':  qty_after,
        'to_branch_id':    branch_id,
        'variant_options': variant_options if variant_options else None,
        'note':            f'PO received — {po_label}',
    }).execute()

    # Update variant_stock if item has variant_options
    if variant_options and branch_id:
        try:
            _t.sleep(0.05)
            all_vs = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', product_id).eq('branch_id', branch_id).execute()
            match  = [v for v in (all_vs.data or []) if v.get('options') == variant_options]
            if match:
                supabase.table('variant_stock').update({'quantity': match[0]['quantity'] + qty_added, 'updated_at': 'now()'}).eq('id', match[0]['id']).execute()
            else:
                supabase.table('variant_stock').insert({'product_id': product_id, 'branch_id': branch_id, 'options': variant_options, 'quantity': qty_added}).execute()
        except Exception as vs_err:
            print(f'Variant stock PO update warning: {vs_err}')

    # Auto-activate product if total branch stock >= 1
    try:
        _t.sleep(0.1)
        all_bs = supabase.table('branch_stock').select('quantity').eq('product_id', product_id).execute()
        if all_bs.data and sum(bs['quantity'] for bs in all_bs.data) >= 1:
            _t.sleep(0.1)
            supabase.table('product').update({'status': 'active'}).eq('product_id', product_id).execute()
    except Exception as act_err:
        print(f'Auto-activate warning: {act_err}')


@app.route('/api/admin/purchase-orders/<po_id>', methods=['PUT'])
@admin_required
def admin_update_purchase_order(po_id):
    try:
        data   = request.get_json()
        status = data.get('status')

        # A "received" request is a RECEIVING ACTION, not necessarily the
        # PO's final state — the supplier may have shorted the order (e.g.
        # ordered 30, only 20 showed up), so this may only partially fill
        # it. purchase_order.status is computed from the items' cumulative
        # received_quantity after applying this batch (see below), instead
        # of being set to 'received' up front like the other statuses.
        if status != 'received':
            updates = {'status': status, 'updated_at': 'now()'}
            if data.get('supplier'): updates['supplier'] = data['supplier']
            if data.get('note'):     updates['note']     = data['note']
            supabase.table('purchase_order').update(updates).eq('po_id', po_id).execute()
            return jsonify({'message': f'PO status updated to {status}.'}), 200

        # ─── Receiving action ──────────────────────────────
        import time
        items_payload = data.get('items', [])  # [{po_item_id, product_id, received_quantity, branches:[{branch_id,quantity}]}]
        # received_quantity here is the amount arriving THIS batch, not the
        # cumulative total — a PO can be received across several batches
        # until every item's running total reaches what was ordered.

        # Fallback: legacy single-branch or flat branches payload — fully
        # receives every item in one shot (no partial tracking), same as
        # the original behavior.
        if not items_payload:
            po_branch_id = data.get('branch_id')
            branches     = data.get('branches', [])
            items_res = supabase.table('po_item').select(
                '*, product(quantity), variant_options'
            ).eq('po_id', po_id).execute()

            if branches:
                branch_list = [(b['branch_id'], int(b['quantity'])) for b in branches if b.get('branch_id') and int(b.get('quantity', 0)) > 0]
            elif po_branch_id:
                branch_list = [(po_branch_id, None)]
            else:
                branch_list = []

            for item in items_res.data:
                variant_options = item.get('variant_options')
                item_qty        = item['quantity']
                for (b_id, b_qty) in branch_list:
                    qty_added = b_qty if b_qty is not None else item_qty
                    _po_add_branch_stock(supabase, session, item['product_id'], b_id, qty_added, variant_options, data.get('po_number', po_id))
                supabase.table('po_item').update({'received_quantity': item_qty}).eq('po_item_id', item['po_item_id']).execute()

            updates = {'status': 'received', 'updated_at': 'now()'}
            if data.get('supplier'): updates['supplier'] = data['supplier']
            if data.get('note'):     updates['note']     = data['note']
            supabase.table('purchase_order').update(updates).eq('po_id', po_id).execute()
            return jsonify({'message': 'PO status updated to received.'}), 200

        # New per-item payload from the receive modal.
        # Fetch EVERY item on this PO (not just the ones in this batch) —
        # we need each one's ordered qty + already-received qty to know
        # whether this batch completes the whole PO or leaves it partial.
        all_items_res = supabase.table('po_item').select(
            'po_item_id, product_id, quantity, received_quantity, variant_options'
        ).eq('po_id', po_id).execute()
        all_items   = all_items_res.data or []
        # received_quantity can come back NULL from the DB (e.g. for rows
        # inserted before this column was being tracked) — dict.get(key, 0)
        # does NOT protect against that, since the key IS present, just with
        # value None, and 0 + None / quantity - None raises a TypeError.
        # Normalize to 0 right away so every downstream calc is safe.
        for i in all_items:
            i['received_quantity'] = i.get('received_quantity') or 0
        items_by_id = {i['po_item_id']: i for i in all_items}

        # Validate BEFORE writing anything:
        #  - the amount arriving this batch can't exceed what's still
        #    outstanding for that item (ordered minus already received)
        #  - branch distribution must add up EXACTLY to the amount arriving
        #    this batch — a partial split (e.g. 20 arriving, only 10
        #    distributed) would silently lose track of the other 10
        for item_entry in items_payload:
            po_item = items_by_id.get(item_entry.get('po_item_id'))
            if not po_item:
                continue
            this_batch = int(item_entry.get('received_quantity', 0))
            if this_batch <= 0:
                continue  # not receiving this item in this batch — fine
            outstanding = po_item['quantity'] - po_item['received_quantity']
            if this_batch > outstanding:
                return jsonify({
                    'error': f"Quantity arriving ({this_batch}) exceeds what's still outstanding ({outstanding}) for one or more items."
                }), 400
            dist_total = sum(int(b.get('quantity', 0)) for b in item_entry.get('branches', []))
            if dist_total != this_batch:
                return jsonify({
                    'error': f'Branch distribution ({dist_total}) must equal the quantity arriving this batch ({this_batch}) for one or more items.'
                }), 400

        # Each item's write is now isolated in its own try/except. Before
        # this, one item throwing partway through (a transient Supabase
        # error, etc.) aborted the ENTIRE request with a 500 — but any
        # items already written earlier in the same loop had already been
        # committed to the database. Since the PO's own status update sits
        # after this loop, that 500 meant the admin's screen showed a
        # failure, the modal never closed, and the status silently stayed
        # "Ordered" — while the database quietly already had a partial
        # receive sitting underneath it, invisible until a hard refresh.
        # Continuing past a single item's failure (instead of letting it
        # kill the whole batch) means whatever DID save gets reflected in
        # the final status, and the response tells the frontend exactly
        # which item(s), if any, still need to be retried.
        item_errors   = []
        any_succeeded = False
        for item_entry in items_payload:
            po_item = items_by_id.get(item_entry.get('po_item_id'))
            if not po_item:
                continue
            this_batch      = int(item_entry.get('received_quantity', 0))
            if this_batch <= 0:
                continue
            try:
                product_id      = item_entry.get('product_id') or po_item['product_id']
                branch_dist     = item_entry.get('branches', [])  # [{branch_id, quantity}]
                variant_options = po_item.get('variant_options')

                for b in branch_dist:
                    b_id  = b.get('branch_id')
                    b_qty = int(b.get('quantity', 0))
                    if not b_id or b_qty <= 0:
                        continue
                    _po_add_branch_stock(supabase, session, product_id, b_id, b_qty, variant_options, data.get('po_number', po_id))

                new_received = po_item['received_quantity'] + this_batch
                supabase.table('po_item').update({'received_quantity': new_received}).eq('po_item_id', po_item['po_item_id']).execute()
                po_item['received_quantity'] = new_received  # keep local copy in sync for the completeness check below
                any_succeeded = True
            except Exception as item_err:
                item_errors.append({'po_item_id': po_item['po_item_id'], 'error': str(item_err)})

        # The whole PO only becomes 'received' once every line item's
        # running total has reached its ordered quantity — otherwise it
        # stays 'partially_received' so it can be opened again later for
        # whatever the supplier still owes. Computed from whatever actually
        # got written above, so a partial-batch failure still leaves the
        # status accurate instead of stuck on the pre-batch value.
        all_complete = all(i['received_quantity'] >= i['quantity'] for i in all_items)
        final_status = 'received' if all_complete else 'partially_received'

        updates = {'status': final_status, 'updated_at': 'now()'}
        if data.get('supplier'): updates['supplier'] = data['supplier']
        if data.get('note'):     updates['note']     = data['note']
        supabase.table('purchase_order').update(updates).eq('po_id', po_id).execute()

        if item_errors:
            # 207: some items saved, some didn't — tell the frontend which,
            # so it can close the modal / refresh / show a receipt for what
            # DID save, instead of a blanket failure that hides it.
            # If NOTHING saved this batch, fall back to a plain 500 so the
            # frontend keeps its existing all-failed behavior.
            status_code = 207 if any_succeeded else 500
            return jsonify({
                'message':     f'PO status updated to {final_status}, but {len(item_errors)} item(s) failed to save this batch.',
                'status':      final_status,
                'item_errors': item_errors,
            }), status_code

        return jsonify({'message': f'PO status updated to {final_status}.', 'status': final_status}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500






# ─── Email OTP Helper ─────────────────────────────────
def send_otp_email(recipient_email, otp):
    import time
    html_body = build_otp_email(otp, title='Password Reset Code', purpose='reset your password')
    for attempt in range(3):
        try:
            success = send_email_resend(
                to_email  = recipient_email,
                subject   = 'TEFC E-Commerce — Password Reset OTP',
                html_body = html_body
            )
            if success:
                return True
            raise Exception('Resend API failed')
        except Exception as e:
            print(f'Email error (attempt {attempt+1}): {e}')
            if attempt < 2:
                time.sleep(1)
            continue
    return False

# ══════════════════════════════════════════════════════
# FORGOT PASSWORD — GMAIL OTP ROUTES (Mobile)
# ══════════════════════════════════════════════════════

@app.route('/api/auth/forgot-password', methods=['POST'])
def api_auth_forgot_password():
    try:
        data  = request.get_json()
        email = data.get('email', '').strip().lower()
        print(f'[forgot-password] received email: "{email}"')
        if not email:
            return jsonify({'error': 'Email is required.'}), 400

        # Look up customer by email
        cust_res = supabase.table('customer').select('user_id, email').eq('email', email).execute()
        print(f'[forgot-password] customer lookup result: {cust_res.data}')
        if not cust_res.data:
            print(f'[forgot-password] email not found in customer table: {email}')
            return jsonify({'message': 'If this email exists, an OTP has been sent.'}), 200

        # Generate OTP
        otp        = str(random.randint(100000, 999999))
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        print(f'[forgot-password] generated OTP for {email}')

        # Invalidate old OTPs
        try:
            supabase.table('otp_codes').update({'used': True}).eq('email', email).eq('used', False).execute()
        except Exception as inv_err:
            print(f'[forgot-password] WARNING: could not invalidate old OTPs: {inv_err}')

        # Store new OTP — if this fails, return error immediately
        try:
            supabase.table('otp_codes').insert({
                'email':      email,
                'otp':        otp,
                'expires_at': expires_at,
                'used':       False,
            }).execute()
            print(f'[forgot-password] OTP saved to otp_codes for {email}')
        except Exception as ins_err:
            print(f'[forgot-password] ERROR: failed to insert OTP: {ins_err}')
            return jsonify({'error': 'Failed to generate OTP. Please try again.'}), 500

        # Send email — warn but don't hard-fail if email delivery fails
        try:
            sent = send_otp_email(email, otp)
            if not sent:
                print(f'[forgot-password] WARNING: email send returned False for {email}')
        except Exception as email_err:
            print(f'[forgot-password] WARNING: email send exception: {email_err}')
            sent = False

        if not sent:
            return jsonify({'error': 'OTP was generated but email delivery failed. Please try again.'}), 500

        return jsonify({'message': 'If this email exists, an OTP has been sent.'}), 200
    except Exception as e:
        import traceback
        print(f'[forgot-password] UNHANDLED ERROR: {type(e).__name__}: {e}')
        traceback.print_exc()
        return jsonify({'error': f'Something went wrong: {str(e)}'}), 500


@app.route('/api/auth/verify-otp', methods=['POST'])
def api_auth_verify_otp():
    try:
        data  = request.get_json()
        email = data.get('email', '').strip().lower()
        otp   = data.get('otp', '').strip()
        print(f'[verify-otp] email="{email}" otp="{otp}"')

        if not email or not otp:
            return jsonify({'error': 'Email and OTP are required.'}), 400

        res = supabase.table('otp_codes').select('*').eq('email', email).eq('otp', otp).eq('used', False).execute()
        print(f'[verify-otp] otp_codes lookup: {res.data}')

        if not res.data:
            # Log all OTPs for this email to help diagnose issues
            any_res = supabase.table('otp_codes').select('otp, used').eq('email', email).execute()
            print(f'[verify-otp] all OTPs for email: {any_res.data}')
            return jsonify({'error': 'Invalid OTP. Please try again.'}), 400

        otp_record     = res.data[0]
        expires_at_str = otp_record['expires_at']
        # Supabase may return with or without 'Z' / offset — normalise to UTC-aware
        if expires_at_str.endswith('Z'):
            expires_at_str = expires_at_str[:-1] + '+00:00'
        expires_at = datetime.fromisoformat(expires_at_str)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        print(f'[verify-otp] expires_at={expires_at} now={now} expired={now > expires_at}')

        if now > expires_at:
            return jsonify({'error': 'OTP has expired. Please request a new one.'}), 400

        supabase.table('otp_codes').update({'used': True}).eq('id', otp_record['id']).execute()
        print(f'[verify-otp] OTP verified and marked used for {email}')
        return jsonify({'message': 'OTP verified.', 'email': email}), 200
    except Exception as e:
        import traceback
        print(f'[verify-otp] UNHANDLED ERROR: {type(e).__name__}: {e}')
        traceback.print_exc()
        return jsonify({'error': f'Verification failed: {str(e)}'}), 500


@app.route('/api/auth/reset-password', methods=['POST'])
def api_auth_reset_password():
    try:
        data         = request.get_json()
        email        = data.get('email', '').strip().lower()
        new_password = data.get('new_password', '')
        print(f'[reset-password] email="{email}"')

        if not email or not new_password:
            return jsonify({'error': 'Email and new password are required.'}), 400
        if len(new_password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters.'}), 400

        cust_res = supabase.table('customer').select('user_id').eq('email', email).execute()
        print(f'[reset-password] customer lookup: {cust_res.data}')
        if not cust_res.data:
            return jsonify({'error': 'No account found with that email.'}), 404

        new_hash = hash_password(new_password)
        supabase.table('user').update({'password': new_hash}).eq('user_id', cust_res.data[0]['user_id']).execute()
        print(f'[reset-password] password updated for {email}')
        return jsonify({'message': 'Password reset successfully.'}), 200
    except Exception as e:
        import traceback
        print(f'[reset-password] UNHANDLED ERROR: {type(e).__name__}: {e}')
        traceback.print_exc()
        return jsonify({'error': f'Reset failed: {str(e)}'}), 500



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

        # Keep product.quantity in sync with the real branch_stock total —
        # this restock changes the aggregate, same fix as admin_add_inventory.
        try:
            prod = supabase.table('product').select('quantity').eq('product_id', product_id).execute()
            if prod.data:
                supabase.table('product').update({
                    'quantity': prod.data[0]['quantity'] + quantity
                }).eq('product_id', product_id).execute()
        except Exception as prod_err:
            print(f'product.quantity sync warning: {prod_err}')

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

@app.route('/api/staff/discounts', methods=['GET'])
@staff_required
def staff_get_discounts():
    """Read-only discount list for POS order-level discount dropdown."""
    try:
        res = supabase.table('discount').select('discount_id,discount_name,percentage,starts_at,ends_at').order('discount_name').execute()
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

        starts_at = data.get('starts_at') or None
        ends_at   = data.get('ends_at')   or None

        res = supabase.table('discount').insert({
            'discount_name': discount_name,
            'percentage':    float(percentage),
            'starts_at':     starts_at,
            'ends_at':       ends_at,
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
        if 'starts_at' in data: updates['starts_at'] = data.get('starts_at') or None
        if 'ends_at'   in data: updates['ends_at']   = data.get('ends_at')   or None

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
        res = supabase.table('product').select(
            '*, discount(discount_id, discount_name, percentage), branch_stock(branch_id, quantity, branch(branch_name)), variant_stock(branch_id, quantity, options), option_groups'
        ).order('created_at', desc=True).execute()

        # Get sold counts from completed orders
        sold_map = {}
        try:
            completed_orders    = supabase.table('order').select('order_id').eq('status', 'completed').execute()
            completed_order_ids = [o['order_id'] for o in (completed_orders.data or [])]
            if completed_order_ids:
                items_res = supabase.table('order_item').select('product_id, qty').in_('order_id', completed_order_ids).execute()
                for oi in (items_res.data or []):
                    pid = oi['product_id']
                    sold_map[pid] = sold_map.get(pid, 0) + int(oi.get('qty') or 0)
        except Exception as sold_err:
            print(f'Admin products sold count warning: {sold_err}')

        # Add total_sold to each product
        for p in res.data:
            p['total_sold'] = sold_map.get(p['product_id'], 0)

        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _generate_unique_barcode():
    """Generates a 12-digit numeric code (prints fine as Code128/EAN-13 via
    JsBarcode on the label), unique across EVERY barcode in the system — the
    product-level barcode column, every option_groups choice's own barcode,
    and every variant_overrides combo's own barcode — since POS scanning
    (handleBarcodeScan in staff.js) matches a scanned code against all three
    levels across the whole catalog, not just one product. Not a registered
    GS1 prefix — an internal store code, not meant for real retail
    distribution."""
    res = supabase.table('product').select('barcode, option_groups, variant_overrides').execute()
    existing = set()
    for p in (res.data or []):
        if p.get('barcode'):
            existing.add(p['barcode'])
        for g in (p.get('option_groups') or []):
            for c in (g.get('choices') or []):
                if isinstance(c, dict) and c.get('barcode'):
                    existing.add(c['barcode'])
        for o in (p.get('variant_overrides') or []):
            if isinstance(o, dict) and o.get('barcode'):
                existing.add(o['barcode'])

    for _ in range(12):
        candidate = ''.join(str(random.randint(0, 9)) for _ in range(12))
        if candidate not in existing:
            return candidate
    raise Exception('Could not generate a unique barcode after 12 attempts.')

@app.route('/api/admin/products/generate-barcodes', methods=['POST'])
@staff_required
def admin_bulk_generate_barcodes():
    """Backfills a BASE (no-variant) barcode for every existing product that
    doesn't have one yet — run once right after the barcode column is added
    (or any time products were imported/created before this feature
    existed). Products that already have a barcode are left untouched. Does
    not touch per-choice/per-combo variant barcodes — those are generated
    one at a time from the Barcode modal, same as price/image overrides are
    set one at a time, since each one is a deliberate per-variant action.
    Open to staff as well as admin — same reasoning as POS scanning itself
    being a staff-facing feature."""
    try:
        res = supabase.table('product').select('product_id').or_('barcode.is.null,barcode.eq.').execute()
        missing = res.data or []
        updated = 0
        for p in missing:
            barcode = _generate_unique_barcode()
            supabase.table('product').update({'barcode': barcode}).eq('product_id', p['product_id']).execute()
            updated += 1
        return jsonify({'updated': updated, 'total_checked': len(missing)}), 200
    except Exception as e:
        print(f"Bulk generate barcodes error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products/<product_id>/generate-barcode', methods=['POST'])
@staff_required
def admin_generate_product_barcode(product_id):
    """Assigns a fresh barcode to one product — or to one specific variant
    of it, chosen by JSON body:
      {}                                                — base/no-variant barcode (product.barcode)
      {"scope":"choice","group_index":0,"choice_value":"Red"}  — one option_groups choice's own barcode
      {"scope":"combo","options":{"Color":"Red","Size":"M"}}   — one variant_overrides combination's own barcode
    Works both for a variant still missing a code and to deliberately
    replace an existing one (e.g. a mis-printed label). Open to staff as
    well as admin, so a variant/label can be (re)printed from Inventory
    without needing an admin on hand."""
    try:
        body  = request.get_json(silent=True) or {}
        scope = body.get('scope', 'product')

        res = supabase.table('product').select('barcode, option_groups, variant_overrides').eq('product_id', product_id).execute()
        if not res.data:
            return jsonify({'error': 'Product not found.'}), 404
        option_groups     = res.data[0].get('option_groups') or []
        variant_overrides = res.data[0].get('variant_overrides') or []

        barcode = _generate_unique_barcode()

        if scope == 'product':
            upd = supabase.table('product').update({'barcode': barcode}).eq('product_id', product_id).execute()
            if not upd.data:
                return jsonify({'error': 'Product not found.'}), 404

        elif scope == 'choice':
            group_index  = body.get('group_index')
            choice_value = body.get('choice_value')
            if group_index is None or not (0 <= group_index < len(option_groups)):
                return jsonify({'error': 'Invalid option group.'}), 400
            choices = option_groups[group_index].get('choices') or []
            target  = next((c for c in choices if isinstance(c, dict) and c.get('value') == choice_value), None)
            if target is None:
                return jsonify({'error': 'Choice not found.'}), 400
            target['barcode'] = barcode
            supabase.table('product').update({'option_groups': option_groups}).eq('product_id', product_id).execute()

        elif scope == 'combo':
            options = body.get('options') or {}
            if not options:
                return jsonify({'error': 'Missing combination options.'}), 400
            entry = next((o for o in variant_overrides if isinstance(o, dict) and o.get('options') == options), None)
            if entry is None:
                entry = {'options': options, 'price': '', 'image': '', 'barcode': barcode}
                variant_overrides.append(entry)
            else:
                entry['barcode'] = barcode
            supabase.table('product').update({'variant_overrides': variant_overrides}).eq('product_id', product_id).execute()

        else:
            return jsonify({'error': 'Invalid scope.'}), 400

        return jsonify({'barcode': barcode}), 200
    except Exception as e:
        print(f"Generate product barcode error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products', methods=['POST'])
@admin_required
def admin_add_product():
    try:
        product_name = request.form.get('product_name', '').strip()
        brand        = request.form.get('brand', '').strip()
        category     = request.form.get('category', '').strip()
        sub_category = request.form.get('sub_category', '').strip() or None
        price        = request.form.get('price', 0)
        base_price_raw = request.form.get('base_price', '').strip()
        base_price   = float(base_price_raw) if base_price_raw else None
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

        # variant_overrides — per-combination price/image overrides (Option B).
        # Resale price only; never touches base_price/cost. See variant_overrides
        # resolution helper (resolveVariantPricing) in admin.js / staff.js.
        variant_overrides_raw = request.form.get('variant_overrides', '[]')
        try:
            variant_overrides = json.loads(variant_overrides_raw) if variant_overrides_raw else []
        except Exception:
            variant_overrides = []

        net_weight      = float(request.form.get('net_weight', 0) or 0)
        net_weight_unit = request.form.get('net_weight_unit', 'kg')

        # Barcode — auto-generated unless the admin typed one in manually.
        barcode_raw = request.form.get('barcode', '').strip()
        barcode     = barcode_raw if barcode_raw else _generate_unique_barcode()

        res = supabase.table('product').insert({
            'staff_id':      session.get('staff_id'),
            'discount_id':   discount_id,
            'product_name':  product_name,
            'brand':         brand,
            'category':      category,
            'sub_category':  sub_category,
            'price':         float(price),
            'base_price':    base_price,
            'quantity':      int(quantity),
            'status':        status,
            'description':   description,
            'image_url':     image_url,
            'image_urls':    image_urls,
            'variants':      variants,
            'option_groups': option_groups,
            'variant_overrides': variant_overrides,
            'net_weight':      net_weight,
            'net_weight_unit': net_weight_unit,
            'barcode':         barcode,
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

        # variant_overrides — per-combination price/image overrides (Option B).
        # Resale price only; never touches base_price/cost. See variant_overrides
        # resolution helper (resolveVariantPricing) in admin.js / staff.js.
        variant_overrides_raw = request.form.get('variant_overrides', '[]')
        try:
            variant_overrides = json.loads(variant_overrides_raw) if variant_overrides_raw else []
        except Exception:
            variant_overrides = []

        net_weight      = float(request.form.get('net_weight', 0) or 0)
        net_weight_unit = request.form.get('net_weight_unit', 'kg')

        base_price_raw = request.form.get('base_price', '').strip()
        base_price     = float(base_price_raw) if base_price_raw else None

        # Price-history logging — only when the resale price actually changes.
        new_price = float(request.form.get('price', 0))
        try:
            existing_res = supabase.table('product').select('price').eq('product_id', product_id).execute()
            old_price = existing_res.data[0]['price'] if existing_res.data else None
        except Exception:
            old_price = None
        if old_price is not None and float(old_price) != new_price:
            try:
                supabase.table('price_history').insert({
                    'product_id':      product_id,
                    'old_price':       old_price,
                    'new_price':       new_price,
                    'changed_by':      session.get('staff_id'),
                    'changed_by_role': session.get('role', 'admin'),
                }).execute()
            except Exception as e:
                print(f'price_history insert failed: {e}')

        updates = {
            'product_name': request.form.get('product_name'),
            'brand':        request.form.get('brand'),
            'category':     request.form.get('category'),
            'sub_category': request.form.get('sub_category', '').strip() or None,
            'price':        new_price,
            'base_price':   base_price,
            'quantity':     int(request.form.get('quantity', 0)),
            'status':       request.form.get('status'),
            'description':  request.form.get('description'),
            'discount_id':  discount_id,
            'option_groups': option_groups,
            'variant_overrides': variant_overrides,
            'net_weight':      net_weight,
            'net_weight_unit': net_weight_unit,
            'variants':        variants,
            'updated_at':   'now()',
        }

        # Barcode — manual override only. Left blank, the product's existing
        # barcode (auto-generated at creation, or backfilled) is untouched;
        # typed in, it replaces it. Generating a fresh one for a product
        # that's missing it is a separate action (the "Generate" button),
        # not something a routine product-details save should trigger.
        barcode_raw = request.form.get('barcode', '').strip()
        if barcode_raw:
            updates['barcode'] = barcode_raw

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
            supabase.storage.from_('product-images').upload(file_name, file_bytes, {'content-type': str(content_type), 'upsert': 'true'})
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

@app.route('/api/admin/price-history', methods=['GET'])
@admin_required
def admin_get_price_history():
    """Read path for the price_history rows admin_update_product() has been
    writing on every resale-price change. Optional ?product_id=... filters
    to one product (used by the per-row "Price History" button); omitted,
    it returns the most recent changes across every product (the Products
    page header's "Price History" button).
    Enriches each row with the product name and the staff member's name by
    hand (two follow-up lookups) instead of a PostgREST embed, since
    price_history's FK relationships to product/staff weren't part of the
    original migration and an embed hint would 400 if they're not present.
    """
    try:
        product_id = request.args.get('product_id')
        limit = request.args.get('limit', default=200, type=int)
        if limit <= 0:
            limit = 200
        if limit > 500:
            limit = 500

        query = supabase.table('price_history').select('*').order('created_at', desc=True).limit(limit)
        if product_id:
            query = query.eq('product_id', product_id)
        rows = query.execute().data or []

        product_ids = list({r['product_id'] for r in rows if r.get('product_id')})
        staff_ids   = list({r['changed_by'] for r in rows if r.get('changed_by')})

        product_map = {}
        if product_ids:
            p_res = supabase.table('product').select('product_id, product_name').in_('product_id', product_ids).execute()
            product_map = {p['product_id']: p['product_name'] for p in (p_res.data or [])}

        staff_map = {}
        if staff_ids:
            s_res = supabase.table('staff').select('staff_id, fname, lname').in_('staff_id', staff_ids).execute()
            staff_map = {s['staff_id']: f"{s['fname']} {s['lname']}" for s in (s_res.data or [])}

        for r in rows:
            r['product_name']   = product_map.get(r.get('product_id'), '—')
            r['changed_by_name'] = staff_map.get(r.get('changed_by'), '—')

        return jsonify(rows), 200
    except Exception as e:
        print(f"Admin get price history error: {e}")
        return jsonify({'error': 'Failed to fetch price history.'}), 500

@app.route('/api/admin/products/<product_id>', methods=['DELETE'])
@admin_required
def admin_delete_product(product_id):
    try:
        supabase.table('product').update({'status': 'inactive'}).eq('product_id', product_id).execute()
        return jsonify({'message': 'Product deactivated.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/products/<product_id>/status', methods=['PATCH'])
@admin_required
def admin_update_product_status(product_id):
    try:
        data   = request.get_json()
        status = data.get('status', '').strip()
        if status not in ('active', 'inactive'):
            return jsonify({'error': 'Invalid status. Must be "active" or "inactive".'}), 400
        supabase.table('product').update({'status': status}).eq('product_id', product_id).execute()
        return jsonify({'message': f'Product {status}.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Inventory ────────────────────────────────────────

@app.route('/api/admin/inventory', methods=['GET'])
@admin_required
def admin_get_inventory():
    try:
        res = supabase.table('inventory').select(
            '*, variant_options, product(product_name, category), staff(fname, lname), from_branch:branch!from_branch_id(branch_name), to_branch:branch!to_branch_id(branch_name)'
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
            variant_options_check = data.get('variant_options') or None

            # Check variant stock if variant selected
            if variant_options_check:
                vs_src = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', product_id).eq('branch_id', from_branch_id).execute()
                match_check = [v for v in (vs_src.data or []) if v.get('options') == variant_options_check]
                if not match_check or match_check[0]['quantity'] < qty_change:
                    available = match_check[0]['quantity'] if match_check else 0
                    opts_label = ', '.join(f'{k}: {v}' for k,v in variant_options_check.items())
                    return jsonify({'error': f'Insufficient variant stock ({opts_label}). Only {available} unit(s) available.'}), 400

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

        # Keep product.quantity (the aggregate figure shown on the product
        # list / low-stock checks) in sync with the real branch_stock total.
        # A transfer just moves stock between branches — net change across
        # all branches is zero, so product.quantity is left alone. A
        # restock/adjustment actually changes the total, so it's applied here
        # too; sale/cancel paths already do this, this endpoint previously
        # didn't, which let product.quantity drift out of sync after manual
        # stock changes.
        if inv_type != 'transfer':
            try:
                prod = supabase.table('product').select('quantity').eq('product_id', product_id).execute()
                if prod.data:
                    new_prod_qty = max(0, prod.data[0]['quantity'] + qty_change)
                    supabase.table('product').update({'quantity': new_prod_qty}).eq('product_id', product_id).execute()
            except Exception as prod_err:
                print(f'product.quantity sync warning: {prod_err}')

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

        # Auto-activate product if total branch stock >= 1
        try:
            all_bs = supabase.table('branch_stock').select('quantity').eq('product_id', product_id).execute()
            total_stock = sum(bs['quantity'] for bs in (all_bs.data or []))
            if total_stock >= 1:
                supabase.table('product').update({'status': 'active'}).eq('product_id', product_id).execute()
                print(f'Product {product_id} auto-activated after stock update.')
        except Exception as act_err:
            print(f'Auto-activate warning: {act_err}')

        # Update variant_stock if variant_options provided
        variant_options = data.get('variant_options') or None
        if variant_options:
            import time as _inv_time
            try:
                if inv_type == 'transfer' and from_branch_id:
                    # Deduct from source branch variant stock
                    all_vs_src = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', product_id).eq('branch_id', from_branch_id).execute()
                    match_src  = [v for v in (all_vs_src.data or []) if v.get('options') == variant_options]
                    if match_src:
                        new_src_qty = max(0, match_src[0]['quantity'] - qty_change)
                        supabase.table('variant_stock').update({'quantity': new_src_qty, 'updated_at': 'now()'}).eq('id', match_src[0]['id']).execute()
                    _inv_time.sleep(0.05)
                    # Add to destination branch variant stock
                    if to_branch_id:
                        all_vs_dst = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', product_id).eq('branch_id', to_branch_id).execute()
                        match_dst  = [v for v in (all_vs_dst.data or []) if v.get('options') == variant_options]
                        if match_dst:
                            supabase.table('variant_stock').update({'quantity': match_dst[0]['quantity'] + qty_change, 'updated_at': 'now()'}).eq('id', match_dst[0]['id']).execute()
                        else:
                            supabase.table('variant_stock').insert({'product_id': product_id, 'branch_id': to_branch_id, 'options': variant_options, 'quantity': qty_change}).execute()
                elif to_branch_id:
                    # Restock or adjustment
                    all_vs_inv = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', product_id).eq('branch_id', to_branch_id).execute()
                    match_inv  = [v for v in (all_vs_inv.data or []) if v.get('options') == variant_options]
                    if match_inv:
                        new_vs_qty = max(0, match_inv[0]['quantity'] + qty_change)
                        supabase.table('variant_stock').update({'quantity': new_vs_qty, 'updated_at': 'now()'}).eq('id', match_inv[0]['id']).execute()
                    else:
                        supabase.table('variant_stock').insert({'product_id': product_id, 'branch_id': to_branch_id, 'options': variant_options, 'quantity': max(0, qty_change)}).execute()
            except Exception as vs_err:
                print(f'Variant stock update warning: {vs_err}')

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

        _auto_advance_processing_orders()

        res = supabase.table('order').select(
            'order_id, total, status, order_type, is_offline_sync, date, created_at, branch_id, shipping_fee, address, address_note, processing_started_at, dispatch_date, delivery_attempts, branch(branch_name), customer(fname, lname, email, phone_number), staff:staff_id(fname, lname), order_item(order_item_id, product_id, qty, price, returned_qty, selected_options, product(product_name, image_url, image_urls, option_groups, variant_overrides)), payment(payment_method, total, status, ref_no, sender_number, receipt_image_url)'
        ).order('created_at', desc=True).limit(limit).execute()

        # Get branch lookup
        branches_res = supabase.table('branch').select('branch_id, branch_name').execute()
        branch_map   = {b['branch_id']: b['branch_name'] for b in (branches_res.data or [])}

        # Flatten payment + add branch_name
        for o in res.data:
            if isinstance(o.get('payment'), list):
                o['payment'] = o['payment'][0] if o['payment'] else None
            o['branch_name'] = branch_map.get(o.get('branch_id'), '')

        return jsonify(res.data), 200
    except Exception as e:
        print(f'Admin orders error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/orders/batch-process', methods=['POST'])
@admin_required
def admin_batch_process_orders():
    """Move the oldest pending orders into 'processing', capped at
    DAILY_PROCESSING_CAP per day (shop's delivery capacity limit). Counts
    how many orders have already been moved into processing today (by
    processing_started_at date) and only takes up to the remaining slots."""
    try:
        today_start = datetime.utcnow().strftime('%Y-%m-%dT00:00:00')
        today_end   = datetime.utcnow().strftime('%Y-%m-%dT23:59:59.999999')

        already_today = supabase.table('order').select('order_id') \
            .gte('processing_started_at', today_start) \
            .lte('processing_started_at', today_end).execute()
        used_today = len(already_today.data or [])
        remaining  = DAILY_PROCESSING_CAP - used_today

        if remaining <= 0:
            return jsonify({
                'moved': 0,
                'used_today': used_today,
                'cap': DAILY_PROCESSING_CAP,
                'message': f'Daily processing cap of {DAILY_PROCESSING_CAP} already reached today.'
            }), 200

        # Fetch every pending order (not just `remaining` of them) so a
        # skip due to insufficient stock doesn't shrink the batch below the
        # cap — we keep pulling from the oldest-first queue until we've
        # filled `remaining` slots or run out of candidates.
        pending_res = supabase.table('order').select(
            'order_id, branch_id, order_item(product_id, qty, selected_options, product(product_name))'
        ).eq('status', 'pending').order('created_at', desc=False).execute()
        pending_orders = pending_res.data or []

        if not pending_orders:
            return jsonify({
                'moved': 0,
                'used_today': used_today,
                'cap': DAILY_PROCESSING_CAP,
                'message': 'No pending orders to move.'
            }), 200

        # Stock is taken off the shelf right here — the moment each order
        # actually enters 'processing' — not at checkout. An order whose
        # stock has since run out is skipped (not force-moved), so the
        # batch never oversells.
        moved_ids = []
        skipped   = []
        for o in pending_orders:
            if len(moved_ids) >= remaining:
                break
            ok, err = _deduct_order_item_stock(o['order_id'], o.get('branch_id'), o.get('order_item') or [])
            if ok:
                moved_ids.append(o['order_id'])
            else:
                skipped.append({'order_id': o['order_id'], 'reason': err})

        if not moved_ids:
            return jsonify({
                'moved': 0,
                'used_today': used_today,
                'cap': DAILY_PROCESSING_CAP,
                'skipped': skipped,
                'message': 'No pending orders could be moved' + (' — all candidates are out of stock.' if skipped else '.')
            }), 200

        now_iso = datetime.utcnow().isoformat()
        supabase.table('order').update({
            'status': 'processing',
            'processing_started_at': now_iso
        }).in_('order_id', moved_ids).execute()

        # Notify affected customers (best-effort, same pattern as admin_update_order)
        try:
            notif_res = supabase.table('order').select(
                'order_id, customer(fcm_token, fname)'
            ).in_('order_id', moved_ids).execute()
            notif_title, notif_body = ORDER_STATUS_MESSAGES['processing']
            for o in (notif_res.data or []):
                customer = o.get('customer')
                if isinstance(customer, list): customer = customer[0] if customer else {}
                fcm_token = customer.get('fcm_token') if customer else None
                if fcm_token:
                    send_push_notification(fcm_token, notif_title, notif_body, {'order_id': o['order_id'], 'status': 'processing'})
        except Exception as notif_err:
            print(f'Batch-process notification error: {notif_err}')

        return jsonify({
            'moved': len(moved_ids),
            'used_today': used_today + len(moved_ids),
            'cap': DAILY_PROCESSING_CAP,
            'order_ids': moved_ids,
            'skipped': skipped
        }), 200
    except Exception as e:
        print(f'Admin batch-process error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/orders/<order_id>', methods=['PUT'])
@admin_required
def admin_update_order(order_id):
    try:
        data       = request.get_json()
        status     = data.get('status')
        valid_statuses = ['pending', 'processing', 'out_for_delivery', 'completed', 'cancelled', 'returned_failed']
        if status not in valid_statuses:
            return jsonify({'error': 'Invalid status.'}), 400

        # Fetch the order's current state once — needed to decide whether
        # this transition actually takes stock off the shelf (pending ->
        # processing, for the first time) or gives it back (an order that
        # already reached processing -> cancelled/returned_failed).
        order_res = supabase.table('order').select(
            'branch_id, processing_started_at, order_item(product_id, qty, selected_options, product(product_name))'
        ).eq('order_id', order_id).execute()
        if not order_res.data:
            return jsonify({'error': 'Order not found.'}), 404
        order_row         = order_res.data[0]
        branch_id         = order_row.get('branch_id')
        already_processed = bool(order_row.get('processing_started_at'))
        order_items       = order_row.get('order_item') or []

        # Enforce the same daily processing cap here as the batch action —
        # this single-order dropdown is still a valid way into 'processing',
        # so it must respect the 30/day limit too, not just the batch button.
        if status == 'processing':
            today_start = datetime.utcnow().strftime('%Y-%m-%dT00:00:00')
            today_end   = datetime.utcnow().strftime('%Y-%m-%dT23:59:59.999999')
            used_today_res = supabase.table('order').select('order_id') \
                .gte('processing_started_at', today_start) \
                .lte('processing_started_at', today_end).execute()
            if len(used_today_res.data or []) >= DAILY_PROCESSING_CAP:
                return jsonify({'error': f'Daily processing cap of {DAILY_PROCESSING_CAP} already reached today.'}), 400

            # Stock is reserved only once an order actually enters
            # 'processing' (not at checkout) — this is the moment it's
            # actually taken off the shelf. Skip if it already reached
            # processing before (re-selecting 'Processing' shouldn't deduct
            # twice), and block the transition entirely if stock has since
            # run out, rather than silently flooring at zero.
            if not already_processed:
                ok, stock_err = _deduct_order_item_stock(order_id, branch_id, order_items)
                if not ok:
                    return jsonify({'error': stock_err}), 400

        # Update status and assign staff_id if not already set
        update_data = {'status': status}
        # Set staff_id to the admin/staff who updated the order
        staff_id = session.get('staff_id')
        if staff_id:
            # Only set if order doesn't already have a staff_id
            existing = supabase.table('order').select('staff_id').eq('order_id', order_id).execute()
            if existing.data and not existing.data[0].get('staff_id'):
                update_data['staff_id'] = staff_id

        # Drives the lazy auto-advance to out_for_delivery after 1 day —
        # start the clock whenever an order (re-)enters processing, whether
        # via this manual single-order path or the capped batch action below.
        if status == 'processing':
            update_data['processing_started_at'] = datetime.utcnow().isoformat()

        supabase.table('order').update(update_data).eq('order_id', order_id).execute()

        # Send push notification to customer
        try:
            order_res = supabase.table('order').select(
                'customer_id, customer(fcm_token, fname)'
            ).eq('order_id', order_id).execute()
            if order_res.data:
                order_data = order_res.data[0]
                customer   = order_res.data[0].get('customer')
                if isinstance(customer, list): customer = customer[0] if customer else {}
                fcm_token  = customer.get('fcm_token') if customer else None
                fname      = customer.get('fname', 'Customer') if customer else 'Customer'
                if fcm_token and status in ORDER_STATUS_MESSAGES:
                    notif_title, notif_body = ORDER_STATUS_MESSAGES[status]
                    send_push_notification(
                        fcm_token,
                        notif_title,
                        notif_body,
                        {'order_id': order_id, 'status': status}
                    )
        except Exception as notif_err:
            print(f'Notification error: {notif_err}')

        # If cancelled or returned/failed delivery — return stock to branch,
        # but ONLY if this order actually reached 'processing' at some point
        # (already_processed, fetched above). A still-pending order was
        # never deducted, so cancelling it must NOT add stock back — that
        # would inflate inventory for stock that was never taken.
        # (returned_failed here is a safety net for the generic PUT route;
        # the dedicated not-delivered endpoint below is the normal path and
        # already does its own restore, so this is a no-op in that case
        # since the order will already be past 'processing'.)
        if status in ('cancelled', 'returned_failed') and already_processed:
            _restore_order_item_stock(
                order_id,
                {'branch_id': branch_id, 'order_item': order_items},
                'Cancelled' if status == 'cancelled' else 'Returned — failed delivery'
            )

        return jsonify({'message': f'Order status updated to {status}.'}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Panelist-requested movement type: a customer/staff return AFTER an order is
# already completed — distinct from "cancelled" above, which only applies
# before an order ships/completes. Restores stock per-item (isolated writes,
# same pattern as PO receiving) and tags the inventory log 'Return' so the
# Stock Movement History table can filter/classify it separately from Sales
# and Cancellations.
@app.route('/api/admin/orders/<order_id>/return', methods=['POST'])
@admin_required
def admin_return_order_items(order_id):
    try:
        data   = request.get_json()
        items  = data.get('items', [])  # [{order_item_id, qty}]
        reason = (data.get('reason') or '').strip()

        if not items:
            return jsonify({'error': 'At least one item and quantity are required.'}), 400

        order_res = supabase.table('order').select(
            'order_id, status, branch_id, order_item(order_item_id, product_id, qty, returned_qty, selected_options)'
        ).eq('order_id', order_id).execute()
        if not order_res.data:
            return jsonify({'error': 'Order not found.'}), 404

        order_data = order_res.data[0]
        if order_data.get('status') != 'completed':
            return jsonify({'error': 'Only completed orders can be returned.'}), 400

        br_id    = order_data.get('branch_id')
        item_map = {i['order_item_id']: i for i in (order_data.get('order_item') or [])}

        results, item_errors, any_success = [], [], False

        for req_item in items:
            oi_id = req_item.get('order_item_id')
            try:
                qty = int(req_item.get('qty', 0))
            except (TypeError, ValueError):
                qty = 0
            oi = item_map.get(oi_id)
            if not oi or qty <= 0:
                item_errors.append({'order_item_id': oi_id, 'error': 'Invalid item or quantity.'})
                continue

            already_returned = int(oi.get('returned_qty') or 0)
            remaining = oi['qty'] - already_returned
            if qty > remaining:
                item_errors.append({'order_item_id': oi_id, 'error': f'Only {remaining} unit(s) left to return.'})
                continue

            # Each item's write is isolated (its own try/except) so one
            # item's failure can't roll back or hide a sibling's success —
            # same lesson learned from the partial PO-receive bug.
            try:
                pid  = oi.get('product_id')
                opts = oi.get('selected_options') or {}

                qty_before = 0
                qty_after  = qty
                if br_id:
                    bs = supabase.table('branch_stock').select('quantity').eq('product_id', pid).eq('branch_id', br_id).execute()
                    if bs.data:
                        qty_before = bs.data[0]['quantity']
                        qty_after  = qty_before + qty
                        supabase.table('branch_stock').update({
                            'quantity': qty_after, 'updated_at': 'now()'
                        }).eq('product_id', pid).eq('branch_id', br_id).execute()
                    else:
                        supabase.table('branch_stock').insert({
                            'product_id': pid, 'branch_id': br_id, 'quantity': qty
                        }).execute()

                if opts and br_id:
                    try:
                        all_vs = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', pid).eq('branch_id', br_id).execute()
                        match  = [v for v in (all_vs.data or []) if v.get('options') == opts]
                        if match:
                            supabase.table('variant_stock').update({
                                'quantity': match[0]['quantity'] + qty, 'updated_at': 'now()'
                            }).eq('id', match[0]['id']).execute()
                    except Exception as vs_err:
                        print(f'Return variant stock warning: {vs_err}')

                pr = supabase.table('product').select('quantity').eq('product_id', pid).execute()
                if pr.data:
                    supabase.table('product').update({
                        'quantity': pr.data[0]['quantity'] + qty
                    }).eq('product_id', pid).execute()

                supabase.table('order_item').update({
                    'returned_qty': already_returned + qty
                }).eq('order_item_id', oi_id).execute()

                reason_text = f' — Reason: {reason}' if reason else ''
                supabase.table('inventory').insert({
                    'product_id':      pid,
                    'staff_id':        session.get('staff_id'),
                    'quantity_added':  qty,
                    'quantity_before': qty_before,
                    'quantity_after':  qty_after,
                    'to_branch_id':    br_id,
                    'variant_options': opts if opts else None,
                    'note':            f'Return — Order #{order_id[:8].upper()}{reason_text}',
                }).execute()

                results.append({'order_item_id': oi_id, 'returned': qty})
                any_success = True
            except Exception as item_err:
                print(f'Return item error ({oi_id}): {item_err}')
                item_errors.append({'order_item_id': oi_id, 'error': str(item_err)})

        if not any_success:
            return jsonify({'error': 'Return failed.', 'item_errors': item_errors}), 400

        status_code = 200 if not item_errors else 207
        return jsonify({'message': 'Return processed.', 'returned': results, 'item_errors': item_errors}), status_code
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ─── Deliveries for Today ──────────────────────────────
# Three-step flow for out_for_delivery orders, agreed with the panel:
#   1. Dispatch  — admin/staff picks today's run from the Available list.
#   2. Delivered — GCash orders complete immediately; COD orders need a
#      remittance confirmation first (cash hasn't been handed in yet).
#   3. Not Delivered — up to 3 attempts; the 3rd marks the order
#      'returned_failed' and restores stock exactly like a cancellation.

def _deduct_order_item_stock(order_id, branch_id, order_items):
    """Shared per-item stock-deduction helper, called exactly once — the
    moment an order actually enters 'processing' (not at checkout; see
    api_place_order). Checks every item has enough stock BEFORE deducting
    anything; if any item is short, nothing is deducted and an error string
    is returned so the caller can block the transition instead of silently
    flooring stock at zero and overselling.

    order_items: list of {product_id, qty, selected_options, product:{product_name}}
    Returns (ok: bool, error_message_or_None).
    """
    # Pass 1 — verify availability for every item before touching anything.
    shortages = []
    checked = []
    for item in order_items:
        pid  = item.get('product_id')
        qty  = int(item.get('qty', 0))
        opts = item.get('selected_options') or {}
        if not pid or not qty:
            continue
        available = 0
        try:
            if opts and branch_id:
                all_vs = supabase.table('variant_stock').select('quantity, options').eq('product_id', pid).eq('branch_id', branch_id).execute()
                match  = [v for v in (all_vs.data or []) if v.get('options') == opts]
                available = match[0]['quantity'] if match else 0
            elif branch_id:
                bs = supabase.table('branch_stock').select('quantity').eq('product_id', pid).eq('branch_id', branch_id).execute()
                available = bs.data[0]['quantity'] if bs.data else 0
            else:
                pr = supabase.table('product').select('quantity').eq('product_id', pid).execute()
                available = pr.data[0]['quantity'] if pr.data else 0
        except Exception as check_err:
            print(f'Stock availability check warning ({pid}): {check_err}')
        checked.append((item, pid, qty, opts))
        if available < qty:
            pname = (item.get('product') or {}).get('product_name') or pid[:8]
            shortages.append(f'{pname} (need {qty}, have {available})')

    if shortages:
        return False, 'Insufficient stock — ' + '; '.join(shortages)

    # Pass 2 — all items confirmed available; now actually deduct.
    for item, pid, qty, opts in checked:
        try:
            qty_before = 0
            qty_after  = 0
            if branch_id:
                bs = supabase.table('branch_stock').select('quantity').eq('product_id', pid).eq('branch_id', branch_id).execute()
                if bs.data:
                    qty_before = bs.data[0]['quantity']
                    qty_after  = max(qty_before - qty, 0)
                    supabase.table('branch_stock').update({
                        'quantity': qty_after, 'updated_at': 'now()'
                    }).eq('product_id', pid).eq('branch_id', branch_id).execute()
            if opts and branch_id:
                try:
                    all_vs = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', pid).eq('branch_id', branch_id).execute()
                    match  = [v for v in (all_vs.data or []) if v.get('options') == opts]
                    if match:
                        supabase.table('variant_stock').update({
                            'quantity': max(match[0]['quantity'] - qty, 0), 'updated_at': 'now()'
                        }).eq('id', match[0]['id']).execute()
                except Exception as vs_err:
                    print(f'Processing stock deduct (variant) warning ({pid}): {vs_err}')
            pr = supabase.table('product').select('quantity').eq('product_id', pid).execute()
            if pr.data:
                supabase.table('product').update({
                    'quantity': max(pr.data[0]['quantity'] - qty, 0)
                }).eq('product_id', pid).execute()
            supabase.table('inventory').insert({
                'product_id':      pid,
                'staff_id':        session.get('staff_id'),
                'quantity_added':  -qty,
                'quantity_before': qty_before,
                'quantity_after':  qty_after,
                'to_branch_id':    branch_id,
                'variant_options': opts if opts else None,
                'note':            f'Sale — Order #{order_id[:8].upper()}',
            }).execute()
        except Exception as item_err:
            print(f'Processing stock deduct warning ({pid}): {item_err}')
    return True, None

def _restore_order_item_stock(order_id, items, note_label):
    """Shared per-item stock-restore helper for a whole order's worth of
    items — same isolated-write pattern as the completed-order Return
    endpoint above, reused here for a returned_failed delivery."""
    br_id = items.get('branch_id')
    for item in items.get('order_item', []):
        pid  = item.get('product_id')
        qty  = int(item.get('qty', 0))
        opts = item.get('selected_options') or {}
        if not pid or not qty:
            continue
        try:
            qty_before = 0
            qty_after  = qty
            if br_id:
                bs = supabase.table('branch_stock').select('quantity').eq('product_id', pid).eq('branch_id', br_id).execute()
                if bs.data:
                    qty_before = bs.data[0]['quantity']
                    qty_after  = qty_before + qty
                    supabase.table('branch_stock').update({
                        'quantity': qty_after, 'updated_at': 'now()'
                    }).eq('product_id', pid).eq('branch_id', br_id).execute()
                else:
                    supabase.table('branch_stock').insert({
                        'product_id': pid, 'branch_id': br_id, 'quantity': qty
                    }).execute()
            if opts and br_id:
                try:
                    all_vs = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', pid).eq('branch_id', br_id).execute()
                    match  = [v for v in (all_vs.data or []) if v.get('options') == opts]
                    if match:
                        supabase.table('variant_stock').update({
                            'quantity': match[0]['quantity'] + qty, 'updated_at': 'now()'
                        }).eq('id', match[0]['id']).execute()
                except Exception as vs_err:
                    print(f'Returned-failed variant stock warning: {vs_err}')
            pr = supabase.table('product').select('quantity').eq('product_id', pid).execute()
            if pr.data:
                supabase.table('product').update({
                    'quantity': pr.data[0]['quantity'] + qty
                }).eq('product_id', pid).execute()
            supabase.table('inventory').insert({
                'product_id':      pid,
                'staff_id':        session.get('staff_id'),
                'quantity_added':  qty,
                'quantity_before': qty_before,
                'quantity_after':  qty_after,
                'to_branch_id':    br_id,
                'variant_options': opts if opts else None,
                'note':            f'{note_label} — Order #{order_id[:8].upper()}',
            }).execute()
        except Exception as item_err:
            print(f'Returned-failed stock restore warning ({pid}): {item_err}')

@app.route('/api/admin/orders/dispatch', methods=['POST'])
@admin_required
def admin_dispatch_orders():
    """Set dispatch_date = today for the selected out_for_delivery orders —
    this is what moves them from 'Available' into "Today's Batch" on the
    Deliveries for Today screen."""
    try:
        data       = request.get_json()
        order_ids  = data.get('order_ids', [])
        if not order_ids:
            return jsonify({'error': 'At least one order_id is required.'}), 400

        today = datetime.utcnow().strftime('%Y-%m-%d')
        res = supabase.table('order').select('order_id, status').in_('order_id', order_ids).execute()
        eligible = [o['order_id'] for o in (res.data or []) if o.get('status') == 'out_for_delivery']
        if not eligible:
            return jsonify({'error': 'No eligible out-for-delivery orders in the selection.'}), 400

        supabase.table('order').update({'dispatch_date': today}).in_('order_id', eligible).execute()
        return jsonify({'dispatched': len(eligible), 'order_ids': eligible, 'dispatch_date': today}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/orders/<order_id>/delivered', methods=['POST'])
@admin_required
def admin_mark_delivered(order_id):
    """Delivered action from today's dispatch batch. GCash orders are
    already paid (verified via PayMongo at order time), so they complete
    immediately. COD orders are only completed once staff confirm they
    actually collected/remitted the cash — pass {"confirm_remittance": true}
    for those; without it the order is left as-is and a 409 explains why."""
    try:
        data = request.get_json(silent=True) or {}
        order_res = supabase.table('order').select(
            'order_id, status, payment(payment_method, status)'
        ).eq('order_id', order_id).execute()
        if not order_res.data:
            return jsonify({'error': 'Order not found.'}), 404

        order_data = order_res.data[0]
        if order_data.get('status') != 'out_for_delivery':
            return jsonify({'error': 'Only out-for-delivery orders can be marked delivered.'}), 400

        payment = order_data.get('payment')
        if isinstance(payment, list):
            payment = payment[0] if payment else None
        payment_method = (payment or {}).get('payment_method')
        payment_status = (payment or {}).get('payment_status') or (payment or {}).get('status')

        if payment_status != 'paid':
            if not data.get('confirm_remittance'):
                return jsonify({
                    'error': 'This is a Cash on Delivery order — confirm remittance to complete it.',
                    'requires_remittance_confirmation': True,
                    'payment_method': payment_method
                }), 409
            supabase.table('payment').update({'status': 'paid'}).eq('order_id', order_id).execute()

        supabase.table('order').update({'status': 'completed'}).eq('order_id', order_id).execute()
        return jsonify({'message': 'Order marked delivered.', 'order_id': order_id}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/orders/<order_id>/not-delivered', methods=['POST'])
@admin_required
def admin_mark_not_delivered(order_id):
    """Not Delivered action. Attempts 1-2: order stays out_for_delivery,
    dispatch_date is cleared so it drops back into "Available" for a later
    run. Attempt 3: order is marked returned_failed and its stock is
    restored, same as a cancellation."""
    try:
        order_res = supabase.table('order').select(
            'order_id, status, branch_id, delivery_attempts, order_item(product_id, qty, selected_options)'
        ).eq('order_id', order_id).execute()
        if not order_res.data:
            return jsonify({'error': 'Order not found.'}), 404

        order_data = order_res.data[0]
        if order_data.get('status') != 'out_for_delivery':
            return jsonify({'error': 'Only out-for-delivery orders can be marked not delivered.'}), 400

        attempts = int(order_data.get('delivery_attempts') or 0) + 1

        if attempts >= 3:
            supabase.table('order').update({
                'status': 'returned_failed',
                'delivery_attempts': attempts
            }).eq('order_id', order_id).execute()
            _restore_order_item_stock(order_id, order_data, 'Returned — failed delivery')
            return jsonify({'message': 'Order returned after 3 failed delivery attempts.', 'delivery_attempts': attempts, 'final': True}), 200
        else:
            supabase.table('order').update({
                'delivery_attempts': attempts,
                'dispatch_date': None
            }).eq('order_id', order_id).execute()
            return jsonify({'message': f'Delivery attempt {attempts} of 3 recorded. Order returned to Available for another try.', 'delivery_attempts': attempts, 'final': False}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
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
        # branch_id was missing from this select — the Edit Staff modal reads
        # it to pre-select the branch dropdown, so without it every edit
        # opened showing "Select branch" even when a branch WAS already
        # saved, and saving from there silently wiped it back to null.
        res = supabase.table('user').select(
            '*, staff(fname, mi, lname, email, phone_number, branch_id), customer(fname, lname, email)'
        ).order('created_at', desc=True).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── LOGIN ACTIVITY (audit trail) ───────────────────────
@app.route('/api/admin/login-sessions', methods=['GET'])
@admin_required
def admin_get_login_sessions():
    """Login/logout audit trail for admin + staff dashboard accounts —
    does NOT cover customer logins (mobile app uses a separate token
    flow). Returns the full history; filtering (role/branch/status/date)
    is done client-side in admin.js, same as Users and Sales Report.
    'is_active' is derived here rather than stored: a row with no
    logout_at whose last_seen_at was refreshed within
    LOGIN_SESSION_ACTIVE_WINDOW_SECONDS."""
    try:
        rows = supabase.table('login_sessions').select('*') \
            .order('login_at', desc=True).execute().data or []

        now = datetime.now()
        for r in rows:
            last_seen = r.get('last_seen_at')
            is_active = False
            if not r.get('logout_at') and last_seen:
                try:
                    # Supabase returns timestamptz values with a timezone
                    # offset (e.g. '...+00:00'); strip it since this app
                    # stores/compares these as naive server-local
                    # datetimes, same as login_at/last_seen_at on insert.
                    naive = last_seen.split('+')[0].split('Z')[0]
                    last_seen_dt = datetime.fromisoformat(naive)
                    is_active = (now - last_seen_dt).total_seconds() <= LOGIN_SESSION_ACTIVE_WINDOW_SECONDS
                except Exception:
                    is_active = False
            r['is_active'] = is_active

        return jsonify(rows), 200
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
            'fname, mi, lname, branch_id, branch(branch_id, branch_name, address)'
        ).eq('staff_id', staff_id).execute()

        if not res.data or not res.data[0].get('branch_id'):
            return jsonify({'branch_id': None, 'branch_name': 'No Branch Assigned'}), 200

        branch = res.data[0].get('branch')
        if isinstance(branch, list):
            branch = branch[0] if branch else {}

        staff_data = res.data[0]
        return jsonify({
            'branch_id':   branch.get('branch_id'),
            'branch_name': branch.get('branch_name'),
            'address':     branch.get('address'),
            'fname':       staff_data.get('fname', ''),
            'mi':          staff_data.get('mi', ''),
            'lname':       staff_data.get('lname', ''),
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
        if limit > 1000:
            limit = 1000

        staff_id = session.get('staff_id')

        _auto_advance_processing_orders()

        # Get staff's assigned branch
        staff_res = supabase.table('staff').select('branch_id').eq('staff_id', staff_id).execute()
        branch_id = staff_res.data[0]['branch_id'] if staff_res.data else None

        # A staff account with no branch assigned must see NO orders, not
        # every branch's orders. Previously this fell through silently
        # (missing .eq filter = unfiltered query = everything), which is how
        # an unassigned test staff account ended up seeing both branches'
        # orders during the mock defense. Fail safe instead of fail open.
        if not branch_id:
            print(f'Staff orders warning: staff_id={staff_id} has no branch_id assigned — returning empty list instead of all branches.')
            return jsonify([]), 200

        query = supabase.table('order').select(
            'order_id, total, status, order_type, is_offline_sync, date, created_at, branch_id, shipping_fee, address, address_note, processing_started_at, dispatch_date, delivery_attempts, branch(branch_name), customer(fname, lname, email, phone_number), staff:staff_id(fname, lname), order_item(order_item_id, product_id, qty, price, returned_qty, selected_options, product(product_name, image_url, image_urls, option_groups, variant_overrides)), payment(payment_method, status, ref_no, sender_number, receipt_image_url)'
        ).order('created_at', desc=True).limit(limit).eq('branch_id', branch_id)

        import time
        # Retry on Windows socket error
        for attempt in range(3):
            try:
                res = query.execute()
                break
            except Exception as sock_err:
                if attempt < 2:
                    time.sleep(0.5)
                    continue
                raise sock_err

        # Add branch_name + flatten payment (sequential to avoid WinError 10035)
        time.sleep(0.1)
        branches_res = supabase.table('branch').select('branch_id, branch_name').execute()
        branch_map   = {b['branch_id']: b['branch_name'] for b in (branches_res.data or [])}
        for o in res.data:
            o['branch_name'] = branch_map.get(o.get('branch_id'), '')
            if isinstance(o.get('payment'), list):
                o['payment'] = o['payment'][0] if o['payment'] else None

        return jsonify(res.data), 200
    except Exception as e:
        print(f'Staff orders error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/orders/batch-process', methods=['POST'])
@staff_required
def staff_batch_process_orders():
    """Same capped batch move as the admin endpoint, scoped to the staff
    member's own branch — but counted against the one store-wide daily cap
    (per the business rule: 30/day total, regardless of who triggered which
    batch), not a separate per-branch allowance."""
    try:
        staff_id  = session.get('staff_id')
        staff_res = supabase.table('staff').select('branch_id').eq('staff_id', staff_id).execute()
        branch_id = staff_res.data[0]['branch_id'] if staff_res.data else None

        # Fail safe, not fail open — an unassigned staff account must not be
        # able to move another branch's pending orders into processing.
        if not branch_id:
            return jsonify({'error': 'Your account has no branch assigned — contact an admin.'}), 403

        today_start = datetime.utcnow().strftime('%Y-%m-%dT00:00:00')
        today_end   = datetime.utcnow().strftime('%Y-%m-%dT23:59:59.999999')

        already_today = supabase.table('order').select('order_id') \
            .gte('processing_started_at', today_start) \
            .lte('processing_started_at', today_end).execute()
        used_today = len(already_today.data or [])
        remaining  = DAILY_PROCESSING_CAP - used_today

        if remaining <= 0:
            return jsonify({
                'moved': 0,
                'used_today': used_today,
                'cap': DAILY_PROCESSING_CAP,
                'message': f'Daily processing cap of {DAILY_PROCESSING_CAP} already reached today.'
            }), 200

        pending_query = supabase.table('order').select(
            'order_id, branch_id, order_item(product_id, qty, selected_options, product(product_name))'
        ).eq('status', 'pending').eq('branch_id', branch_id)
        pending_res = pending_query.order('created_at', desc=False).execute()
        pending_orders = pending_res.data or []

        if not pending_orders:
            return jsonify({
                'moved': 0,
                'used_today': used_today,
                'cap': DAILY_PROCESSING_CAP,
                'message': 'No pending orders to move.'
            }), 200

        # Stock is taken off the shelf right here — the moment each order
        # actually enters 'processing' — not at checkout. Same skip-on-
        # shortage behavior as the admin batch route.
        moved_ids = []
        skipped   = []
        for o in pending_orders:
            if len(moved_ids) >= remaining:
                break
            ok, err = _deduct_order_item_stock(o['order_id'], o.get('branch_id'), o.get('order_item') or [])
            if ok:
                moved_ids.append(o['order_id'])
            else:
                skipped.append({'order_id': o['order_id'], 'reason': err})

        if not moved_ids:
            return jsonify({
                'moved': 0,
                'used_today': used_today,
                'cap': DAILY_PROCESSING_CAP,
                'skipped': skipped,
                'message': 'No pending orders could be moved' + (' — all candidates are out of stock.' if skipped else '.')
            }), 200

        now_iso = datetime.utcnow().isoformat()
        supabase.table('order').update({
            'status': 'processing',
            'processing_started_at': now_iso
        }).in_('order_id', moved_ids).execute()

        try:
            notif_res = supabase.table('order').select(
                'order_id, customer(fcm_token, fname)'
            ).in_('order_id', moved_ids).execute()
            notif_title, notif_body = ORDER_STATUS_MESSAGES['processing']
            for o in (notif_res.data or []):
                customer = o.get('customer')
                if isinstance(customer, list): customer = customer[0] if customer else {}
                fcm_token = customer.get('fcm_token') if customer else None
                if fcm_token:
                    send_push_notification(fcm_token, notif_title, notif_body, {'order_id': o['order_id'], 'status': 'processing'})
        except Exception as notif_err:
            print(f'Staff batch-process notification error: {notif_err}')

        return jsonify({
            'moved': len(moved_ids),
            'used_today': used_today + len(moved_ids),
            'cap': DAILY_PROCESSING_CAP,
            'order_ids': moved_ids,
            'skipped': skipped
        }), 200
    except Exception as e:
        print(f'Staff batch-process error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/paymongo/gcash/create', methods=['POST'])
@staff_required
def staff_paymongo_gcash_create():
    """Starts a GCash payment for the current POS sale. Returns a
    payment_intent_id (to poll and to send back with the order) and a
    redirect_url the staff screen renders as a QR code for the customer
    to scan with their own GCash app."""
    try:
        data   = request.get_json() or {}
        amount = data.get('amount')
        if not amount or float(amount) <= 0:
            return jsonify({'error': 'A valid amount is required.'}), 400

        # Reflects whatever host this request actually arrived on — works
        # locally and in production without guessing the deployed URL.
        return_url = request.url_root.rstrip('/') + '/paymongo/gcash-return'

        payment_intent_id, redirect_url = paymongo_create_gcash_intent(
            amount_pesos = amount,
            return_url   = return_url,
            description  = 'TEFC E-Commerce — POS walk-in order',
        )
        return jsonify({
            'payment_intent_id': payment_intent_id,
            'redirect_url':      redirect_url,
        }), 200
    except PayMongoError as e:
        print(f'PayMongo create error: {e}')
        return jsonify({'error': str(e)}), 502
    except Exception as e:
        print(f'Staff PayMongo create error: {e}')
        return jsonify({'error': 'Could not start GCash payment.'}), 500

@app.route('/api/staff/paymongo/gcash/status/<payment_intent_id>', methods=['GET'])
@staff_required
def staff_paymongo_gcash_status(payment_intent_id):
    """Polled by the staff screen every few seconds while the QR is shown."""
    try:
        status = paymongo_get_intent_status(payment_intent_id)
        return jsonify({'status': status}), 200
    except PayMongoError as e:
        print(f'PayMongo status error: {e}')
        return jsonify({'error': str(e)}), 502
    except Exception as e:
        print(f'Staff PayMongo status error: {e}')
        return jsonify({'error': 'Could not check GCash payment status.'}), 500

@app.route('/paymongo/gcash-return')
def paymongo_gcash_return():
    """Landing page the customer's browser is sent to after approving (or
    cancelling) payment in GCash. The staff screen is the source of truth —
    it's already polling for the result — so this page just tells the
    customer they can close the tab and hand the phone back."""
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>TEFC E-Commerce</title>
  <style>
    body { margin:0; font-family:'Segoe UI',Arial,sans-serif; background:#f0fdf4;
           display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#fff; border-radius:16px; padding:36px 28px; max-width:360px;
            text-align:center; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    h1 { color:#14532d; font-size:20px; margin:0 0 8px; }
    p  { color:#6b7280; font-size:14px; margin:0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You&rsquo;re all set!</h1>
    <p>You can close this tab now and return the phone to the cashier.</p>
  </div>
</body>
</html>"""

@app.route('/api/staff/orders', methods=['POST'])
@staff_required
def staff_place_order():
    try:
        data              = request.get_json()
        cart_items        = data.get('cart_items', [])
        payment_method    = data.get('payment_method', '')
        ref_no            = data.get('ref_no', '')
        payment_intent_id = data.get('payment_intent_id', '')
        order_type        = data.get('order_type', 'walk_in')
        quantity          = data.get('quantity', 0)
        total             = data.get('total', 0)
        branch_id         = data.get('branch_id')  # which branch processed this sale
        is_offline_sync = bool(data.get('is_offline_sync', False))  # True when this sale was made during a connection outage and is only now reaching the server

        if not cart_items or not payment_method:
            return jsonify({'error': 'Cart items and payment method are required.'}), 400

        if payment_method == 'gcash' and not is_offline_sync:
            # The GCash QR flow is online-only — verify the actual payment
            # status with PayMongo rather than trusting anything the client
            # claims. A manually-typed ref_no is only accepted as a legacy
            # fallback when no payment_intent_id was sent.
            if payment_intent_id:
                try:
                    status = paymongo_get_intent_status(payment_intent_id)
                except PayMongoError as e:
                    return jsonify({'error': f'Could not verify GCash payment: {e}'}), 502
                if status != 'succeeded':
                    return jsonify({'error': f'GCash payment has not succeeded yet (status: {status}).'}), 400
                ref_no = ref_no or payment_intent_id
            elif not ref_no:
                return jsonify({'error': 'GCash reference number is required.'}), 400

        # ── Create order ──────────────────────────────
        order_res = supabase.table('order').insert({
            'staff_id':        session.get('staff_id'),
            'branch_id':       branch_id,
            'order_type':      order_type,
            'quantity':        quantity,
            'total':           total,
            'status':          'completed',
            'is_offline_sync': is_offline_sync,
        }).execute()

        order_id = order_res.data[0]['order_id']

        # ── Create order items ────────────────────────
        supabase.table('order_item').insert([{
            'order_id':        order_id,
            'product_id':      item['product_id'],
            'qty':             item['quantity'],
            'price':           item['price'],
            'selected_options': item.get('selected_options', {}),
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
        import time as _st
        for item in cart_items:
            product_id       = item['product_id']
            qty              = item['quantity']
            selected_options = item.get('selected_options', {})

            # Deduct from branch_stock
            qty_before = 0
            qty_after  = 0
            if branch_id:
                bs_res = supabase.table('branch_stock').select('quantity').eq('product_id', product_id).eq('branch_id', branch_id).execute()
                if bs_res.data:
                    qty_before     = bs_res.data[0]['quantity']
                    new_branch_qty = max(qty_before - qty, 0)
                    qty_after      = new_branch_qty
                    supabase.table('branch_stock').update({
                        'quantity': new_branch_qty, 'updated_at': 'now()'
                    }).eq('product_id', product_id).eq('branch_id', branch_id).execute()

            # Deduct variant stock if selected_options present
            if selected_options and branch_id:
                try:
                    _st.sleep(0.05)
                    all_vs = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', product_id).eq('branch_id', branch_id).execute()
                    match = [v for v in (all_vs.data or []) if v.get('options') == selected_options]
                    if match:
                        new_vs_qty = max(match[0]['quantity'] - qty, 0)
                        supabase.table('variant_stock').update({'quantity': new_vs_qty, 'updated_at': 'now()'}).eq('id', match[0]['id']).execute()
                except Exception as vs_err:
                    print(f'Variant stock deduct warning: {vs_err}')

            # Log stock movement (OUT) for inventory history
            try:
                _st.sleep(0.05)
                supabase.table('inventory').insert({
                    'product_id':      product_id,
                    'staff_id':        session.get('staff_id'),
                    'quantity_added':  -qty,
                    'quantity_before': qty_before,
                    'quantity_after':  qty_after,
                    'to_branch_id':    branch_id,
                    'variant_options': selected_options if selected_options else None,
                    'note':            f'Sale — Order #{order_id[:8].upper()}',
                }).execute()
            except Exception as log_err:
                print(f'Inventory log warning: {log_err}')

            # Deduct from product total quantity
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
        import traceback
        print(f"Staff place order error: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/orders/<order_id>', methods=['PUT'])
@staff_required
def staff_update_order(order_id):
    try:
        data       = request.get_json()
        status     = data.get('status')
        valid_statuses = ['pending', 'processing', 'out_for_delivery', 'completed', 'cancelled', 'returned_failed']
        if status not in valid_statuses:
            return jsonify({'error': 'Invalid status.'}), 400

        # Fetch the order's current state once — same purpose as the admin
        # route: deciding whether this transition takes stock off the shelf
        # (pending -> processing, for the first time) or gives it back (an
        # order that already reached processing -> cancelled/returned_failed).
        order_res = supabase.table('order').select(
            'branch_id, processing_started_at, order_item(product_id, qty, selected_options, product(product_name))'
        ).eq('order_id', order_id).execute()
        if not order_res.data:
            return jsonify({'error': 'Order not found.'}), 404
        order_row         = order_res.data[0]
        branch_id         = order_row.get('branch_id')
        already_processed = bool(order_row.get('processing_started_at'))
        order_items       = order_row.get('order_item') or []

        # Same daily processing cap enforced here as admin's route/the batch action.
        if status == 'processing':
            today_start = datetime.utcnow().strftime('%Y-%m-%dT00:00:00')
            today_end   = datetime.utcnow().strftime('%Y-%m-%dT23:59:59.999999')
            used_today_res = supabase.table('order').select('order_id') \
                .gte('processing_started_at', today_start) \
                .lte('processing_started_at', today_end).execute()
            if len(used_today_res.data or []) >= DAILY_PROCESSING_CAP:
                return jsonify({'error': f'Daily processing cap of {DAILY_PROCESSING_CAP} already reached today.'}), 400

            # Stock is reserved only once an order actually enters
            # 'processing' — see the matching comment in admin_update_order.
            if not already_processed:
                ok, stock_err = _deduct_order_item_stock(order_id, branch_id, order_items)
                if not ok:
                    return jsonify({'error': stock_err}), 400

        # Update status and assign staff_id if not already set
        update_data = {'status': status}
        staff_id = session.get('staff_id')
        if staff_id:
            existing = supabase.table('order').select('staff_id').eq('order_id', order_id).execute()
            if existing.data and not existing.data[0].get('staff_id'):
                update_data['staff_id'] = staff_id

        # Same auto-advance timer start as the admin route — keeps the lazy
        # Processing -> Out for Delivery check accurate regardless of which
        # role moved the order into processing.
        if status == 'processing':
            update_data['processing_started_at'] = datetime.utcnow().isoformat()

        supabase.table('order').update(update_data).eq('order_id', order_id).execute()

        # Send push notification to customer
        try:
            order_res = supabase.table('order').select(
                'customer_id, customer(fcm_token, fname)'
            ).eq('order_id', order_id).execute()
            if order_res.data:
                order_data = order_res.data[0]
                customer   = order_res.data[0].get('customer')
                if isinstance(customer, list): customer = customer[0] if customer else {}
                fcm_token  = customer.get('fcm_token') if customer else None
                fname      = customer.get('fname', 'Customer') if customer else 'Customer'
                if fcm_token and status in ORDER_STATUS_MESSAGES:
                    notif_title, notif_body = ORDER_STATUS_MESSAGES[status]
                    send_push_notification(
                        fcm_token,
                        notif_title,
                        notif_body,
                        {'order_id': order_id, 'status': status}
                    )
        except Exception as notif_err:
            print(f'Notification error: {notif_err}')

        # If cancelled or returned/failed delivery — return stock to branch,
        # but ONLY if this order actually reached 'processing' at some point
        # (already_processed, fetched above). A still-pending order was
        # never deducted, so cancelling it must NOT add stock back.
        # (returned_failed here is a safety net for the generic PUT route;
        # the dedicated not-delivered endpoint below is the normal path and
        # already does its own restore, so this is a no-op in that case
        # since the order will already be past 'processing'.)
        if status in ('cancelled', 'returned_failed') and already_processed:
            _restore_order_item_stock(
                order_id,
                {'branch_id': branch_id, 'order_item': order_items},
                'Cancelled' if status == 'cancelled' else 'Returned — failed delivery'
            )

        return jsonify({'message': f'Order status updated to {status}.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Staff-side version of the admin return route above — same per-item
# isolated-write pattern, scoped to orders placed at the staff's own branch.
@app.route('/api/staff/orders/<order_id>/return', methods=['POST'])
@staff_required
def staff_return_order_items(order_id):
    try:
        data   = request.get_json()
        items  = data.get('items', [])  # [{order_item_id, qty}]
        reason = (data.get('reason') or '').strip()

        if not items:
            return jsonify({'error': 'At least one item and quantity are required.'}), 400

        staff_id  = session.get('staff_id')
        staff_res = supabase.table('staff').select('branch_id').eq('staff_id', staff_id).execute()
        my_branch = staff_res.data[0]['branch_id'] if staff_res.data else None

        order_res = supabase.table('order').select(
            'order_id, status, branch_id, order_item(order_item_id, product_id, qty, returned_qty, selected_options)'
        ).eq('order_id', order_id).execute()
        if not order_res.data:
            return jsonify({'error': 'Order not found.'}), 404

        order_data = order_res.data[0]
        if order_data.get('status') != 'completed':
            return jsonify({'error': 'Only completed orders can be returned.'}), 400
        if my_branch and order_data.get('branch_id') and order_data.get('branch_id') != my_branch:
            return jsonify({'error': 'This order belongs to a different branch.'}), 403

        br_id    = order_data.get('branch_id')
        item_map = {i['order_item_id']: i for i in (order_data.get('order_item') or [])}

        results, item_errors, any_success = [], [], False

        for req_item in items:
            oi_id = req_item.get('order_item_id')
            try:
                qty = int(req_item.get('qty', 0))
            except (TypeError, ValueError):
                qty = 0
            oi = item_map.get(oi_id)
            if not oi or qty <= 0:
                item_errors.append({'order_item_id': oi_id, 'error': 'Invalid item or quantity.'})
                continue

            already_returned = int(oi.get('returned_qty') or 0)
            remaining = oi['qty'] - already_returned
            if qty > remaining:
                item_errors.append({'order_item_id': oi_id, 'error': f'Only {remaining} unit(s) left to return.'})
                continue

            try:
                pid  = oi.get('product_id')
                opts = oi.get('selected_options') or {}

                qty_before = 0
                qty_after  = qty
                if br_id:
                    bs = supabase.table('branch_stock').select('quantity').eq('product_id', pid).eq('branch_id', br_id).execute()
                    if bs.data:
                        qty_before = bs.data[0]['quantity']
                        qty_after  = qty_before + qty
                        supabase.table('branch_stock').update({
                            'quantity': qty_after, 'updated_at': 'now()'
                        }).eq('product_id', pid).eq('branch_id', br_id).execute()
                    else:
                        supabase.table('branch_stock').insert({
                            'product_id': pid, 'branch_id': br_id, 'quantity': qty
                        }).execute()

                if opts and br_id:
                    try:
                        all_vs = supabase.table('variant_stock').select('id, quantity, options').eq('product_id', pid).eq('branch_id', br_id).execute()
                        match  = [v for v in (all_vs.data or []) if v.get('options') == opts]
                        if match:
                            supabase.table('variant_stock').update({
                                'quantity': match[0]['quantity'] + qty, 'updated_at': 'now()'
                            }).eq('id', match[0]['id']).execute()
                    except Exception as vs_err:
                        print(f'Return variant stock warning: {vs_err}')

                pr = supabase.table('product').select('quantity').eq('product_id', pid).execute()
                if pr.data:
                    supabase.table('product').update({
                        'quantity': pr.data[0]['quantity'] + qty
                    }).eq('product_id', pid).execute()

                supabase.table('order_item').update({
                    'returned_qty': already_returned + qty
                }).eq('order_item_id', oi_id).execute()

                reason_text = f' — Reason: {reason}' if reason else ''
                supabase.table('inventory').insert({
                    'product_id':      pid,
                    'staff_id':        staff_id,
                    'quantity_added':  qty,
                    'quantity_before': qty_before,
                    'quantity_after':  qty_after,
                    'to_branch_id':    br_id,
                    'variant_options': opts if opts else None,
                    'note':            f'Return — Order #{order_id[:8].upper()}{reason_text}',
                }).execute()

                results.append({'order_item_id': oi_id, 'returned': qty})
                any_success = True
            except Exception as item_err:
                print(f'Return item error ({oi_id}): {item_err}')
                item_errors.append({'order_item_id': oi_id, 'error': str(item_err)})

        if not any_success:
            return jsonify({'error': 'Return failed.', 'item_errors': item_errors}), 400

        status_code = 200 if not item_errors else 207
        return jsonify({'message': 'Return processed.', 'returned': results, 'item_errors': item_errors}), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Deliveries for Today (staff) ──────────────────────
# Branch-scoped mirror of the admin endpoints above — a staff member only
# ever dispatches/acts on their own branch's orders.

@app.route('/api/staff/orders/dispatch', methods=['POST'])
@staff_required
def staff_dispatch_orders():
    try:
        data      = request.get_json()
        order_ids = data.get('order_ids', [])
        if not order_ids:
            return jsonify({'error': 'At least one order_id is required.'}), 400

        staff_id  = session.get('staff_id')
        staff_res = supabase.table('staff').select('branch_id').eq('staff_id', staff_id).execute()
        branch_id = staff_res.data[0]['branch_id'] if staff_res.data else None

        if not branch_id:
            return jsonify({'error': 'Your account has no branch assigned — contact an admin.'}), 403

        today = datetime.utcnow().strftime('%Y-%m-%d')
        res = supabase.table('order').select('order_id, status, branch_id').in_('order_id', order_ids).execute()
        eligible = [
            o['order_id'] for o in (res.data or [])
            if o.get('status') == 'out_for_delivery' and o.get('branch_id') == branch_id
        ]
        if not eligible:
            return jsonify({'error': 'No eligible out-for-delivery orders in the selection.'}), 400

        supabase.table('order').update({'dispatch_date': today}).in_('order_id', eligible).execute()
        return jsonify({'dispatched': len(eligible), 'order_ids': eligible, 'dispatch_date': today}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/orders/<order_id>/delivered', methods=['POST'])
@staff_required
def staff_mark_delivered(order_id):
    try:
        data = request.get_json(silent=True) or {}
        order_res = supabase.table('order').select(
            'order_id, status, payment(payment_method, status)'
        ).eq('order_id', order_id).execute()
        if not order_res.data:
            return jsonify({'error': 'Order not found.'}), 404

        order_data = order_res.data[0]
        if order_data.get('status') != 'out_for_delivery':
            return jsonify({'error': 'Only out-for-delivery orders can be marked delivered.'}), 400

        payment = order_data.get('payment')
        if isinstance(payment, list):
            payment = payment[0] if payment else None
        payment_method = (payment or {}).get('payment_method')
        payment_status = (payment or {}).get('status')

        if payment_status != 'paid':
            if not data.get('confirm_remittance'):
                return jsonify({
                    'error': 'This is a Cash on Delivery order — confirm remittance to complete it.',
                    'requires_remittance_confirmation': True,
                    'payment_method': payment_method
                }), 409
            supabase.table('payment').update({'status': 'paid'}).eq('order_id', order_id).execute()

        supabase.table('order').update({'status': 'completed'}).eq('order_id', order_id).execute()
        return jsonify({'message': 'Order marked delivered.', 'order_id': order_id}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/staff/orders/<order_id>/not-delivered', methods=['POST'])
@staff_required
def staff_mark_not_delivered(order_id):
    try:
        order_res = supabase.table('order').select(
            'order_id, status, branch_id, delivery_attempts, order_item(product_id, qty, selected_options)'
        ).eq('order_id', order_id).execute()
        if not order_res.data:
            return jsonify({'error': 'Order not found.'}), 404

        order_data = order_res.data[0]
        if order_data.get('status') != 'out_for_delivery':
            return jsonify({'error': 'Only out-for-delivery orders can be marked not delivered.'}), 400

        attempts = int(order_data.get('delivery_attempts') or 0) + 1

        if attempts >= 3:
            supabase.table('order').update({
                'status': 'returned_failed',
                'delivery_attempts': attempts
            }).eq('order_id', order_id).execute()
            _restore_order_item_stock(order_id, order_data, 'Returned — failed delivery')
            return jsonify({'message': 'Order returned after 3 failed delivery attempts.', 'delivery_attempts': attempts, 'final': True}), 200
        else:
            supabase.table('order').update({
                'delivery_attempts': attempts,
                'dispatch_date': None
            }).eq('order_id', order_id).execute()
            return jsonify({'message': f'Delivery attempt {attempts} of 3 recorded. Order returned to Available for another try.', 'delivery_attempts': attempts, 'final': False}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
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
            '*, product(product_name, category), variant_options, from_branch:branch!from_branch_id(branch_name), to_branch:branch!to_branch_id(branch_name)'
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

        # Keep product.quantity in sync with the real branch_stock total —
        # same fix applied to the admin-side restock endpoints.
        try:
            prod = supabase.table('product').select('quantity').eq('product_id', product_id).execute()
            if prod.data:
                supabase.table('product').update({
                    'quantity': prod.data[0]['quantity'] + qty_added
                }).eq('product_id', product_id).execute()
        except Exception as prod_err:
            print(f'product.quantity sync warning: {prod_err}')

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
    import os
    port = int(os.environ.get('PORT', 5000))
    # threaded=True is required for the /api/events SSE stream: each open
    # SSE connection blocks for as long as the tab stays open, so without
    # threading the single-worker dev server would stall every other
    # request the moment one browser tab connects.
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
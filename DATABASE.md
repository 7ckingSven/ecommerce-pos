# Triple E & Fiel Collins — Database Documentation
**Database:** Supabase (PostgreSQL)

---

## Entity Relationship Overview

```
branch ──────────────────────────────────────────────────────────────────┐
  │                                                                       │
  ├──< branch_stock >── product ──< order_item >── order ──< payment     │
  ├──< variant_stock >── product         │            │  │               │
  │                        │             │            │  └──< sales_transaction
  │                    discount        customer      staff ──────────────┘
  │                    option_groups                                      
  │                    net_weight / sub_category / base_price             
  │                                                                       
  ├──< inventory (from_branch / to_branch)
  ├──< stock_request >── staff
  ├──< stock_transfer (from_branch / to_branch) >── staff (requested_by / resolved_by)
  └──< purchase_order >──< po_item (supplier, requesting_branch_id per line item) >── product

user ──< staff
user ──< customer (role-shared: `user.role` is admin / staff / customer)
user ──< mfa_device

customer ──< cart >── product
customer ──< order >──< order_item >── product
otp_codes (keyed by email — no FK to customer)

price_history (product_id, changed_by — no declared FK, joined by hand)
login_sessions ──< user / staff / branch (Admin + Staff login audit trail)
```

> **Source of truth note:** this document was reconciled against a live `pg_dump`-style export of the actual Supabase schema. A few tables and columns existed in production but weren't previously documented here — those are now included below (`sales_transaction`, `variant_stock`, `stock_transfer`, and several columns on `order`, `product`, `payment`, `customer`, `user`, `po_item`). Anywhere this doc previously described something incorrectly (e.g. `otp_codes` keying, `cart.status` values), it's been corrected to match what the database actually enforces. **This latest reconciliation pass (Oct 26 2026) also surfaced a real, unfixed production bug — see the ⚠️ warning under the `order` table below.**

---

## Tables

---

### 1. `branch`
Stores the two physical branches of the store.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `branch_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique branch identifier |
| `branch_name` | VARCHAR | NOT NULL, UNIQUE | Branch name (e.g. Triple E, Fiel Collince) |
| `address` | VARCHAR | | Physical address of branch |

---

### 2. `user`
Stores login credentials shared by **all three** account types — Admin, Staff, and Customer (not just Admin/Staff).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique user identifier |
| `username` | VARCHAR | NOT NULL, UNIQUE | Login username |
| `password` | VARCHAR | NOT NULL | Bcrypt hashed password |
| `role` | VARCHAR | NOT NULL, CHECK | `admin`, `staff`, or `customer` |
| `status` | VARCHAR | NOT NULL, DEFAULT 'active', CHECK | `active`, `inactive`, or `suspended` |
| `active_session_token` | TEXT | NULLABLE | Current valid session token for the one-session-per-user enforcement — a login that doesn't match this token (e.g. a newer login from elsewhere) is treated as superseded and logged out |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT now() | Date created |

---

### 3. `staff`
Stores staff profile details, linked to a user account and assigned branch.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `staff_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique staff identifier |
| `user_id` | UUID | NOT NULL, **FK** → user.user_id | Login credentials |
| `branch_id` | UUID | NULLABLE, **FK** → branch.branch_id | Assigned branch |
| `fname` | VARCHAR | NOT NULL | First name |
| `mi` | CHAR | NULLABLE | Middle initial (single character) |
| `lname` | VARCHAR | NOT NULL | Last name |
| `email` | VARCHAR | NOT NULL, UNIQUE | Staff email |
| `phone_number` | VARCHAR | NULLABLE | Contact number |
| `position` | VARCHAR | NOT NULL, CHECK | `admin` or `staff` — separate from `user.role`, used for display/permission checks specific to the staff profile |

---

### 4. `customer`
Stores customer accounts registered via the mobile app.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `customer_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique customer identifier |
| `user_id` | UUID | NOT NULL, **FK** → user.user_id | Login credentials |
| `fname` | VARCHAR | NOT NULL | First name |
| `mi` | CHAR | NULLABLE | Middle initial (single character) |
| `lname` | VARCHAR | NOT NULL | Last name |
| `phone_number` | VARCHAR | NOT NULL, UNIQUE | Mobile number (11 digits, starts with 09) |
| `email` | VARCHAR | NOT NULL, UNIQUE | Customer email |
| `address` | TEXT | NULLABLE | PSGC address (pipe-separated: Street\|Barangay\|City\|Province\|Region\|Zip) |
| `address_note` | TEXT | DEFAULT '' | Free-text delivery note/landmark attached to the address |
| `dob` | DATE | NULLABLE | Date of birth |
| `gender` | VARCHAR | NULLABLE, CHECK | `male`, `female`, or `prefer_not_to_say` |
| `fcm_token` | TEXT | NULLABLE | Firebase Cloud Messaging device token, used to push order-status notifications to the mobile app |

---

### 5. `product`
Stores the product catalog with variants, weight, and pricing.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `product_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique product identifier |
| `staff_id` | UUID | NOT NULL, **FK** → staff.staff_id | Staff member who created/owns the product listing |
| `discount_id` | UUID | NULLABLE, **FK** → discount.discount_id | Assigned discount |
| `product_name` | VARCHAR | NOT NULL | Product name |
| `brand` | VARCHAR | NULLABLE | Brand name |
| `category` | VARCHAR | NOT NULL | Product category |
| `sub_category` | VARCHAR | NULLABLE | Optional sub-category under `category` (e.g. Category "Beverages" → Sub-category "Soft Drinks") |
| `description` | TEXT | NULLABLE | Product description |
| `price` | DECIMAL(10,2) | NOT NULL, DEFAULT 0.00 | **Resale Price** — what the customer pays |
| `base_price` | DECIMAL(10,2) | NULLABLE | **Base Price (cost)** — what the business pays its supplier; auto-fills Unit Cost when the product is added to a Purchase Order |
| `quantity` | INT | NOT NULL, DEFAULT 0 | Legacy total stock field (`branch_stock` is the real source of truth; see below) |
| `image_url` | VARCHAR | NULLABLE | Main product image URL (Supabase Storage) |
| `image_urls` | TEXT[] | DEFAULT '{}' | Array of additional product image URLs |
| `option_groups` | JSONB | DEFAULT '[]' | Variants: `[{"label":"Size","choices":[...]}]`. A choice can be a plain string (`"S"`) or, once it has an image, a price override, or its own barcode set, an object: `{"value":"Red","image":"<url>","priceOverride":199.00,"barcode":"123456789012"}` — all three extra fields are optional and added in place, no separate column |
| `variants` | TEXT[] | DEFAULT '{}' | Legacy flat variant list, predates `option_groups`; not used by the current UI |
| `variant_overrides` | JSONB | DEFAULT '[]' | Per-**combination** overrides (Option B — for a product with 2+ option groups, e.g. Color+Size together): `[{"options":{"Color":"Red","Size":"M"},"price":"199.00","image":"<url>","barcode":"123456789012"}]`. `price`/`image`/`barcode` are each optional per entry. Resale price only — never touches `base_price`/cost |
| `barcode` | TEXT | UNIQUE, NULLABLE | Auto-generated 12-digit numeric code (internal store code, not a registered GS1 prefix) for the base/no-variant product — printable as Code128/EAN-13 and scannable in POS. Per-choice and per-combo variants get their own codes stored inline on `option_groups`/`variant_overrides` above instead of a separate column |
| `available_at` | VARCHAR | DEFAULT 'both', CHECK | `triple_e`, `fiel_collins`, or `both` — a legacy manual branch-availability flag. **Not used for actual visibility anymore** — `branch_stock.quantity > 0` is what controls whether a product shows on the mobile app (see `branch_stock` below). Column still exists in the schema but the application no longer reads it for that purpose |
| `net_weight` | DECIMAL(10,2) | DEFAULT 0 | Product weight/volume for shipping |
| `net_weight_unit` | VARCHAR(10) | DEFAULT 'kg' | Unit: `kg`, `gram`, `mL`, `L` |
| `status` | VARCHAR | NOT NULL, DEFAULT 'active', CHECK | `active` or `inactive` |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT now() | Date created |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT now() | Last updated |

---

### 6. `branch_stock`
Tracks per-product, per-branch stock quantity. This is the **primary source of truth** for stock and product visibility.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique record identifier |
| `product_id` | UUID | NULLABLE, **FK** → product.product_id | Product |
| `branch_id` | UUID | NULLABLE, **FK** → branch.branch_id | Branch |
| `quantity` | INT | DEFAULT 0 | Current stock at this branch |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last updated |

> **Note:** A product only appears on the mobile app if its `branch_stock.quantity > 0` for that branch. Products with zero stock across all branches are hidden.

---

### 7. `variant_stock`
Tracks per-**variant**, per-branch stock quantity — the variant-level counterpart to `branch_stock` (which only tracks whole-product totals). This table existed in production but was missing from earlier versions of this document.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | **PK**, DEFAULT gen_random_uuid() | Unique record identifier |
| `product_id` | UUID | NULLABLE, **FK** → product.product_id | Product |
| `branch_id` | UUID | NULLABLE, **FK** → branch.branch_id | Branch |
| `options` | JSONB | NOT NULL | The specific variant combination, e.g. `{"Size":"M","Color":"Blue"}` |
| `quantity` | INT | DEFAULT 0 | Current stock of this exact variant at this branch |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last updated |

> **Note:** For a product with `option_groups` set (i.e. it has variants), the POS/mobile app checks `variant_stock` rather than `branch_stock` for availability and the editable-quantity/barcode-scanner stock clamp.

---

### 8. `discount`
Stores discount records with optional date ranges.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `discount_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique discount identifier |
| `discount_name` | VARCHAR | NOT NULL | Display name (e.g. "Summer Sale") |
| `percentage` | DECIMAL(5,2) | NOT NULL, CHECK (0–100) | Discount percentage |
| `starts_at` | TIMESTAMP | NULLABLE | When discount becomes active (optional) |
| `ends_at` | TIMESTAMP | NULLABLE | When discount expires (optional) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT now() | Date created |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT now() | Last updated |

> **Status logic:** Active if now is between `starts_at` and `ends_at`. If no dates set, always active.

---

### 9. `inventory`
Logs all stock movement history (restocks, transfers, adjustments, PO receives, sales deductions, cancellations, returns).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `inventory_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique record identifier |
| `product_id` | UUID | NOT NULL, **FK** → product.product_id | Product |
| `staff_id` | UUID | NULLABLE, **FK** → staff.staff_id | Staff who made the movement (null for system-driven entries, e.g. a cancelled online order) |
| `from_branch_id` | UUID | NULLABLE, **FK** → branch.branch_id | Source branch (for transfers) |
| `to_branch_id` | UUID | NULLABLE, **FK** → branch.branch_id | Destination branch |
| `quantity_added` | INT | NOT NULL, DEFAULT 0 | Units added (positive) or deducted (negative) |
| `quantity_before` | INT | NOT NULL, DEFAULT 0 | Stock before the movement |
| `quantity_after` | INT | NOT NULL, DEFAULT 0 | Stock after the movement |
| `variant_options` | JSONB | NULLABLE | Which variant this movement affected, e.g. `{"Size":"M","Color":"Blue"}` — null for a non-variant product |
| `date` | **TIMESTAMPTZ** | NOT NULL, DEFAULT now() | **Changed from `DATE` to `TIMESTAMPTZ`** so the Stock Movement History table can show both the date and time of a movement, not just the date (per panelist feedback). Rows logged before this migration only ever stored a bare date and display as midnight (`12:00 AM`) — there's no way to recover their real time since it was never captured |
| `note` | TEXT | NULLABLE | Reason (e.g. "loss", "stolen", "PO received — PO-202608-001", "Sale — Order #ABC123", "[CANCELLED] Order #ABC123 — Cancelled by customer") |

---

### 10. `order`
Stores all customer orders (online via mobile and walk-in via POS).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `order_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique order identifier |
| `customer_id` | UUID | NULLABLE, **FK** → customer.customer_id | Customer (null for walk-in) |
| `staff_id` | UUID | NULLABLE, **FK** → staff.staff_id | Staff who processed (walk-in) |
| `cart_id` | UUID | NULLABLE, **FK** → cart.cart_id | The cart this order was placed from, if any |
| `branch_id` | UUID | NULLABLE, **FK** → branch.branch_id | Branch where order was placed |
| `order_type` | VARCHAR | NOT NULL, DEFAULT 'walk_in', CHECK | `online` or `walk_in` |
| `quantity` | INT | NOT NULL, DEFAULT 1 | Total item count across the order |
| `total` | DECIMAL(10,2) | NOT NULL, DEFAULT 0.00 | Grand total (including shipping) |
| `ref_no` | VARCHAR | NULLABLE | Cached copy of the related `payment.ref_no` on the order itself |
| `shipping_fee` | DECIMAL(10,2) | DEFAULT 0 | Shipping fee for online orders |
| `address` | TEXT | NULLABLE | Delivery address (pipe-separated PSGC format) |
| `address_note` | TEXT | DEFAULT '' | Free-text delivery note/landmark |
| `status` | VARCHAR | NOT NULL, DEFAULT 'pending', CHECK ⚠️ | `pending`, `processing`, `out_for_delivery`, `not_remitted`, `completed`, `cancelled`, `returned_failed` — **see the ⚠️ constraint warning below the table** |
| `cancel_reason` | TEXT | NULLABLE | Why the order was cancelled, when applicable |
| `cancelled_by` | TEXT | NULLABLE | Who cancelled it (customer vs staff/admin) |
| `is_offline_sync` | BOOLEAN | NOT NULL, DEFAULT false | True if this order was created by the POS's offline sale queue syncing back up after a connectivity outage, rather than placed live |
| `processing_started_at` | TIMESTAMPTZ | NULLABLE | When the order entered `processing` — the stock-deduction-on-Processing business rule reads this to determine whether stock has already been taken for this order |
| `dispatch_date` | DATE | NULLABLE | Which day's delivery batch this order belongs to. Also doubles as the retry-reschedule date: a non-final failed delivery attempt (1st/2nd of 3) sets this to **tomorrow's** date rather than clearing it, so the order surfaces in the "Scheduled for Retry" tab and reappears in "Out for Deliveries" on its own once that date arrives — no separate retry-queue table |
| `delivery_attempts` | INT | NOT NULL, DEFAULT 0 | Count of failed delivery attempts; after 3 the order auto-flips to `returned_failed` and stock is restored |
| `completed_at` | TIMESTAMPTZ | NULLABLE | Stamped the moment a Remit (single or bulk) succeeds and the order moves to `completed` — drives the "Delivered Today" tab and the Remittance summary's Actual/Remitted figures |
| `last_attempt_at` | TIMESTAMPTZ | NULLABLE | Stamped on every Not-Delivered click (final or not) — the only timestamp recorded for a non-final failed attempt, since a retry reschedules `dispatch_date` rather than marking completion. Drives the "Failed Attempts Today" tab |
| `date` | DATE | NOT NULL, DEFAULT CURRENT_DATE | Order date |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT now() | Precise timestamp for sorting |

> ⚠️ **`status` CHECK constraint is out of date on the live database — found via this revision's live-schema audit, not yet fixed.** The live `pg_dump` export shows the constraint still only allows `'pending', 'processing', 'out_for_delivery', 'completed', 'cancelled'` — it was never widened for `'returned_failed'` (added in an earlier round, the delivery-retry logic) or `'not_remitted'` (added this round, the 5pm closing-hour auto-flag). This is the exact same class of bug as the `purchase_order.status` gap fixed earlier in this document (see the SQL section below) — any write of `returned_failed` or `not_remitted` is likely 500ing at the database level right now, even though the application code has been computing and sending both values. **This needs the same `DROP CONSTRAINT` / `ADD CONSTRAINT` fix run against the live Supabase project — see the SQL block below — before relying on the 3rd-failed-attempt or 5pm-closing-hour behavior in the live demo.**

---

### 11. `order_item`
Stores individual items within each order.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `order_item_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique item identifier |
| `order_id` | UUID | NOT NULL, **FK** → order.order_id | Parent order |
| `product_id` | UUID | NOT NULL, **FK** → product.product_id | Product ordered |
| `qty` | INT | NOT NULL, DEFAULT 1 | Quantity ordered |
| `price` | DECIMAL(10,2) | NOT NULL | Price at time of order |
| `selected_options` | JSONB | DEFAULT '{}' | Customer's selected variants: `{"Size":"M","Color":"Blue"}` |
| `returned_qty` | INT | NOT NULL, DEFAULT 0 | How many units of this line item have been returned so far (via the admin/staff "Process Return" action on a `completed` order). Capped at `qty` — the return endpoint rejects any request that would push it past `qty` |

---

### 12. `payment`
Stores payment records for each order.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `payment_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique payment identifier |
| `order_id` | UUID | NOT NULL, **FK** → order.order_id | Associated order |
| `customer_id` | UUID | NULLABLE, **FK** → customer.customer_id | Customer (nullable for walk-in) |
| `payment_method` | VARCHAR | NOT NULL, CHECK | `walk_in_cash`, `cash_on_delivery`, or `gcash` |
| `total` | DECIMAL(10,2) | NOT NULL, DEFAULT 0.00 | Amount paid |
| `ref_no` | VARCHAR | NULLABLE | For `gcash`: the server-verified PayMongo Payment Intent ID (e.g. `pi_...`), set only after PayMongo reports the payment `succeeded` |
| `status` | VARCHAR | NOT NULL, DEFAULT 'pending', CHECK | `paid`, `pending`, or `failed` |
| `sender_number` | VARCHAR | NULLABLE | Legacy — GCash sender's mobile number from the old manual-entry flow. Always `null` on new orders (both staff POS and mobile checkout now go through PayMongo verification instead) |
| `receipt_image_url` | TEXT | NULLABLE | Legacy — uploaded GCash receipt screenshot URL from the old manual-entry flow. Always `null` on new orders |
| `date` | DATE | NOT NULL, DEFAULT CURRENT_DATE | Payment date |

---

### 13. `sales_transaction`
A per-branch sales-ledger record created alongside a completed order/payment — distinct from `order` + `order_item` (which describe *what* was bought) and from `inventory` (which logs *stock movement*). This table existed in production but was missing from earlier versions of this document.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `transaction_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique transaction identifier |
| `order_id` | UUID | NOT NULL, **FK** → order.order_id | The order this transaction represents |
| `staff_id` | UUID | NOT NULL, **FK** → staff.staff_id | Staff who processed the sale |
| `branch_id` | UUID | NOT NULL, **FK** → branch.branch_id | Branch the sale happened at |
| `payment_id` | UUID | NOT NULL, **FK** → payment.payment_id | The payment that settled this sale |
| `total_amount` | DECIMAL(10,2) | NOT NULL | Transaction total |
| `transaction_date` | TIMESTAMP | NOT NULL, DEFAULT now() | When the transaction was recorded |

---

### 14. `cart`
Stores active cart items for customers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `cart_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique cart item identifier |
| `customer_id` | UUID | NOT NULL, **FK** → customer.customer_id | Cart owner |
| `product_id` | UUID | NOT NULL, **FK** → product.product_id | Product in cart |
| `branch_id` | UUID | NULLABLE, **FK** → branch.branch_id | Branch the product is from |
| `quantity` | INT | NOT NULL, DEFAULT 1 | Quantity in cart |
| `selected_options` | JSONB | DEFAULT '{}' | Selected variants: `{"Size":"M","Color":"Blue"}` |
| `status` | VARCHAR | NOT NULL, DEFAULT 'active', CHECK | `active`, `checked_out`, or `abandoned` |
| `added_at` | TIMESTAMP | NOT NULL, DEFAULT now() | When added to cart |

---

### 15. `stock_request`
Staff submits stock requests to admin when inventory is low (per-variant, auto-filled from critical/out-of-stock levels in the Inventory module).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `request_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique request identifier |
| `staff_id` | UUID | NULLABLE, **FK** → staff.staff_id | Staff who submitted |
| `branch_id` | UUID | NULLABLE, **FK** → branch.branch_id | Branch requesting stock |
| `product_id` | UUID | NULLABLE, **FK** → product.product_id | Requested product |
| `quantity_needed` | INT | NOT NULL | Units requested |
| `variant_options` | JSONB | NULLABLE | Which variant is low, e.g. `{"Color":"Black","Size":"42"}` — null for a non-variant product |
| `batch_id` | UUID | NULLABLE | Shared by every item a staff member submits together in one "Generate Stock Request" batch (one id generated client-side per submission, attached to each item's row). Lets admin's Stock Requests table group them into a single row with one "Review" action that batch-approves/rejects the whole submission at once. Null for requests submitted before this column existed, or a genuine single-item request — those just render as a group of one, same as before |
| `status` | VARCHAR | DEFAULT 'pending', CHECK | `pending`, `approved`, `rejected` |
| `note` | TEXT | NULLABLE | Staff's note on the request |
| `admin_note` | TEXT | NULLABLE | Admin's note when approving/rejecting |
| `converted_to_po` | BOOLEAN | NOT NULL, DEFAULT false | Set true (best-effort) once an approved request has been pulled into a Create PO draft via "Use Approved Requests", so it isn't shown as available to pull in again |
| `created_at` | TIMESTAMP | DEFAULT now() | Date submitted |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last updated |

---

### 16. `purchase_order`
Admin creates POs for restocking from suppliers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `po_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique PO identifier |
| `po_number` | VARCHAR | UNIQUE | PO number (e.g. PO-202608-001) |
| `status` | VARCHAR | DEFAULT 'draft', CHECK | `draft`, `ordered`, `partially_received`, `received`, `cancelled` — **note:** `partially_received` was added to the database's `CHECK` constraint via a migration run after a production bug was found (see below); earlier database snapshots would reject that value |
| `supplier` | VARCHAR | NULLABLE, **legacy/unused** | Supplier name — originally set once per whole PO at creation time. **No longer written to** as of the "PO Unit Cost & Supplier moved to receive time" revision: a single PO can now contain items from different suppliers, so Supplier is tracked per line item instead (see `po_item.supplier` below). Column kept in the schema for backward compatibility with old PO rows; new POs leave it `NULL` |
| `note` | TEXT | NULLABLE | PO notes |
| `created_by` | UUID | NULLABLE, **FK** → staff.staff_id | Admin who created PO |
| `created_at` | TIMESTAMP | DEFAULT now() | Date created |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last updated |

---

### 17. `po_item`
Individual items within each purchase order.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `po_item_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique item identifier |
| `po_id` | UUID | NULLABLE, **FK** → purchase_order.po_id | Parent PO |
| `product_id` | UUID | NULLABLE, **FK** → product.product_id | Product |
| `quantity` | INT | NOT NULL | Units ordered from supplier |
| `unit_cost` | DECIMAL(10,2) | DEFAULT 0 | Cost per unit — entered at **Receive & Distribute** time (not at PO creation); `0` until received |
| `variant_options` | JSONB | NULLABLE | Which variant this line item is for, if the product has variants |
| `received_quantity` | INT | NOT NULL, DEFAULT 0 | Cumulative units actually received so far (may be < quantity if the supplier shorted the order — PO stays `partially_received` until this reaches `quantity`) |
| `requesting_branch_id` | UUID | NULLABLE, **FK** → branch.branch_id | Which branch this line item is being restocked for — auto-fills the Receive & Distribute split so that branch gets its share by default; set from a stock request's branch when a PO item originates from "Use Approved Requests," otherwise left `NULL` and filled manually |
| `supplier` | TEXT | NULLABLE | Supplier name for **this line item specifically** — entered at Receive & Distribute time (datalist-backed, sourced from `GET /api/admin/suppliers`). Different items on the same PO can have different suppliers; this is what replaced the old per-PO `purchase_order.supplier` field above |

---

### 18. `otp_codes`
Stores OTP tokens for email verification and password reset (mobile).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique OTP record |
| `email` | VARCHAR | NOT NULL | The email address the OTP was sent to — **not** a foreign key to `customer`; matched by plain text equality, which also lets it cover registration email-verification OTPs for people who don't have a customer account yet |
| `otp` | VARCHAR | NOT NULL | 6-digit OTP |
| `expires_at` | TIMESTAMP | NOT NULL | OTP expiry (5 minutes from creation) |
| `used` | BOOLEAN | DEFAULT false | Whether OTP has been used |
| `created_at` | TIMESTAMP | DEFAULT now() | When OTP was generated |

---

### 19. `mfa_device`
Stores trusted browsers for web (admin/staff) login — once a browser passes email OTP verification, it's remembered here so it's not re-challenged on future logins from that same browser.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | **PK**, DEFAULT gen_random_uuid() | Unique record identifier |
| `user_id` | UUID | NOT NULL, **FK** → user.user_id ON DELETE CASCADE | The admin/staff account this trusted browser belongs to |
| `mfa_token` | TEXT | NOT NULL | Opaque token stored in the `tefc_mfa_token` browser cookie; matched against this table on login to skip the OTP challenge |
| `user_agent` | TEXT | NULLABLE | Browser user-agent string at time of trust, for reference |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When this browser was first trusted |
| `last_used_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last login from this browser |

> **Note:** Trust is per-browser, not per-device — the same physical device logging in from a different browser (or after clearing cookies) is untrusted and must re-verify via email OTP. Trust persists indefinitely (5-year cookie `max_age`) until cookies are cleared.

---

### 20. `price_history`
Logs every change to a product's resale `price` — one row per edit, written automatically whenever `admin_update_product()` saves a different `price` than what was there before. Added 2026-10-22.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | **PK**, DEFAULT gen_random_uuid() | Unique record identifier |
| `product_id` | UUID | NOT NULL | The product whose price changed — not a declared FK; `product_id`/`product_name` are joined back by hand in the read endpoint instead of a PostgREST embed |
| `old_price` | DECIMAL(10,2) | NOT NULL | Resale price before the edit |
| `new_price` | DECIMAL(10,2) | NOT NULL | Resale price after the edit |
| `changed_by` | UUID | NULLABLE | `staff.staff_id` who made the edit — not a declared FK, same reason as `product_id` |
| `changed_by_role` | VARCHAR | NULLABLE | `admin` or `staff`, from the session at the time of the edit |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT now() | When the price change was logged |

> **Note on this table's SQL below:** reconstructed from how `app.py` writes/reads it (no `product`/`staff` FK, `created_at` ordering) — the original `CREATE TABLE` text from when it was run isn't preserved in this session, so double-check column types against your actual schema if anything here looks off.

---

### 21. `login_sessions`
Login/logout audit trail for Admin + Staff web accounts (not customers). Added 2026-10-21.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | **PK**, DEFAULT gen_random_uuid() | Unique record identifier |
| `user_id` | UUID | NOT NULL, **FK** → user.user_id | The account that logged in |
| `staff_id` | UUID | NULLABLE, **FK** → staff.staff_id | Staff profile, if applicable |
| `role` | TEXT | NOT NULL | `admin` or `staff` |
| `branch_id` | UUID | NULLABLE, **FK** → branch.branch_id | Assigned branch — null for admin |
| `login_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When this session started |
| `logout_at` | TIMESTAMPTZ | NULLABLE | When this session ended — null while still open |
| `last_seen_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last activity heartbeat for this session |
| `ip_address` | TEXT | NULLABLE | Client IP at login |
| `user_agent` | TEXT | NULLABLE | Browser user-agent at login |

> **Note:** purely additive — no existing table was altered to add this. Surfaced in Admin → User Management as a "Login Activity" view (`GET /api/admin/login-sessions`).

---

### 22. `stock_transfer`
Staff-initiated branch-to-branch stock transfer request, requiring the **destination** branch to approve before stock actually moves. Distinct from Admin's own "Transfer Stock" action (instant, no approval needed — uses `inventory` directly, doesn't touch this table). This table existed in production but was missing from earlier versions of this document.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `transfer_id` | UUID | **PK**, DEFAULT gen_random_uuid() | Unique transfer identifier |
| `product_id` | UUID | NOT NULL, **FK** → product.product_id | Product being transferred |
| `variant_options` | JSONB | NULLABLE | Which variant, if the product has variants — null for a non-variant product |
| `from_branch_id` | UUID | NOT NULL, **FK** → branch.branch_id | Source branch — always the requesting staff member's own branch, read server-side from session, never trusted from the request body |
| `to_branch_id` | UUID | NOT NULL, **FK** → branch.branch_id | Destination branch |
| `quantity` | INT | NOT NULL | Units requested |
| `status` | TEXT | NOT NULL, DEFAULT 'pending' | `pending`, `approved`, `rejected`, `cancelled` |
| `requested_by` | UUID | NULLABLE, **FK** → staff.staff_id | Staff who filed the request (source branch) |
| `requested_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When filed |
| `resolved_by` | UUID | NULLABLE, **FK** → staff.staff_id | Staff who approved/rejected (destination branch) — null while still `pending` |
| `resolved_at` | TIMESTAMPTZ | NULLABLE | When approved/rejected — null while still `pending` |
| `rejection_note` | TEXT | NULLABLE | Optional note from the destination branch when rejecting |

> **Note on stock timing:** stock numbers stay untouched at the source branch while a transfer is `pending` — they only move at the moment of approval (re-validated against the source branch's *current* stock at that moment, not just at request time). One `inventory` row is logged per approved transfer (`from_branch_id`/`to_branch_id` both set on the same row), matching Admin's own instant-transfer logging convention. The source branch can cancel its own request while still `pending`; the destination branch is the only one who can approve/reject.

---

## SQL — All Schema Changes Applied

```sql
-- branch_stock table (new)
CREATE TABLE IF NOT EXISTS branch_stock (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES product(product_id) ON DELETE CASCADE,
  branch_id  UUID REFERENCES branch(branch_id) ON DELETE CASCADE,
  quantity   INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, branch_id)
);

-- product — new columns
ALTER TABLE product ADD COLUMN IF NOT EXISTS option_groups    JSONB        DEFAULT '[]';
ALTER TABLE product ADD COLUMN IF NOT EXISTS net_weight       DECIMAL(10,2) DEFAULT 0;
ALTER TABLE product ADD COLUMN IF NOT EXISTS net_weight_unit  VARCHAR(10)  DEFAULT 'kg';

-- product — Feature #3: sub-category + base/resale price split
ALTER TABLE product ADD COLUMN IF NOT EXISTS sub_category VARCHAR;
ALTER TABLE product ADD COLUMN IF NOT EXISTS base_price   DECIMAL(10,2);
-- NOTE: `price` is kept as-is (no rename) and is now treated as "Resale
-- Price" in the UI/docs only, so nothing else that reads product.price
-- (POS, cart, discount calc, order_item.price) needed to change.

-- order — new columns
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS address      TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS branch_id    UUID REFERENCES branch(branch_id);

-- order_item — new column
ALTER TABLE order_item ADD COLUMN IF NOT EXISTS selected_options JSONB DEFAULT '{}';

-- cart — new columns
ALTER TABLE cart ADD COLUMN IF NOT EXISTS selected_options JSONB DEFAULT '{}';
ALTER TABLE cart ADD COLUMN IF NOT EXISTS branch_id        UUID REFERENCES branch(branch_id);

-- discount — new columns
ALTER TABLE discount ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP;
ALTER TABLE discount ADD COLUMN IF NOT EXISTS ends_at   TIMESTAMP;

-- inventory — make from_branch_id nullable
ALTER TABLE inventory ALTER COLUMN from_branch_id DROP NOT NULL;
ALTER TABLE inventory ALTER COLUMN to_branch_id   DROP NOT NULL;

-- customer — FCM push notification token
ALTER TABLE customer ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- payment — legacy manual-GCash-entry columns (now always null; retained
-- for historical orders placed before the PayMongo-verified flow)
ALTER TABLE payment ADD COLUMN IF NOT EXISTS sender_number     VARCHAR;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;

-- mfa_device table (new) — trusted-browser store for web login MFA
CREATE TABLE IF NOT EXISTS mfa_device (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES "user"(user_id) ON DELETE CASCADE,
  mfa_token     TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ DEFAULT NOW()
);

-- stock_request — batch grouping for multi-item "Generate Stock Request"
-- submissions (Inventory → auto-fill stock requests revision)
ALTER TABLE stock_request ADD COLUMN IF NOT EXISTS batch_id UUID;
-- Nullable, no default: existing rows stay NULL and render as their own
-- single-item group, identical to prior behavior.

-- inventory — date column widened to capture time, not just date
-- (panelist-requested revision: Stock Movement History must show both)
ALTER TABLE inventory ALTER COLUMN date TYPE TIMESTAMPTZ USING date::timestamptz;
ALTER TABLE inventory ALTER COLUMN date SET DEFAULT now();
-- Rows inserted before this migration only ever stored a bare date, so they
-- display as midnight (00:00:00) once shown with time — the actual time of
-- those older movements was never recorded and can't be recovered.

-- order_item — track returns per line item (inventory-logging audit found
-- "Return" was missing as a movement type: only pre-fulfillment Cancel
-- existed before)
ALTER TABLE order_item ADD COLUMN IF NOT EXISTS returned_qty INTEGER NOT NULL DEFAULT 0;

-- purchase_order — widen the status CHECK constraint to allow
-- 'partially_received'. The partial-PO-receive feature (see po_item
-- .received_quantity) had been computing and writing this status since it
-- was built, but the constraint itself was never updated to allow it — any
-- short receive silently 500'd at the database level even though the
-- stock/branch distribution for that batch had already committed. Found via
-- a live-schema audit and fixed below.
ALTER TABLE public.purchase_order DROP CONSTRAINT purchase_order_status_check;
ALTER TABLE public.purchase_order
  ADD CONSTRAINT purchase_order_status_check
  CHECK (status::text = ANY (ARRAY[
    'draft'::character varying,
    'ordered'::character varying,
    'partially_received'::character varying,
    'received'::character varying,
    'cancelled'::character varying
  ]::text[]));

-- login_sessions table (new, 2026-10-21) — login/logout audit trail for
-- Admin + Staff web accounts. Purely additive; no existing table touched.
CREATE TABLE public.login_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public."user"(user_id),
  staff_id      UUID REFERENCES public.staff(staff_id),
  role          TEXT NOT NULL,                 -- 'admin' | 'staff'
  branch_id     UUID REFERENCES public.branch(branch_id),  -- null for admin
  login_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_at     TIMESTAMPTZ,                   -- null while the session is open
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    TEXT,
  user_agent    TEXT
);
CREATE INDEX idx_login_sessions_login_at ON public.login_sessions (login_at DESC);
-- As of Oct 30, 2026 Supabase stopped auto-granting Data API (PostgREST)
-- access to new tables on existing projects — without this grant the
-- Flask app's supabase-py client gets a permission-denied error:
GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_sessions TO anon, authenticated, service_role;

-- product — barcode generation (2026-10-22)
ALTER TABLE product ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_product_barcode ON product (barcode);
-- Per-choice/per-combo barcodes (v2) need no further schema change — they
-- live inline on the existing option_groups/variant_overrides JSONB below.

-- product — per-choice/per-combo price + image overrides (Option B),
-- and price-history logging (2026-10-22). Column type/default reconstructed
-- from app.py's usage; the original migration text wasn't preserved in
-- this session, so verify against the actual schema if unsure.
ALTER TABLE product ADD COLUMN IF NOT EXISTS variant_overrides JSONB DEFAULT '[]';

-- price_history table (new, 2026-10-22) — one row per resale-price edit.
-- No FK to product/staff: both are joined back by hand in the read
-- endpoint instead, so an embed hint can't 400 if the FK isn't present.
CREATE TABLE price_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL,
  old_price        DECIMAL(10,2) NOT NULL,
  new_price        DECIMAL(10,2) NOT NULL,
  changed_by       UUID,
  changed_by_role  VARCHAR,
  created_at       TIMESTAMP NOT NULL DEFAULT now()
);

-- po_item — requesting branch, for the Receive & Distribute auto-fill
-- (After-Consultation batch). Confirmed run on the live project.
ALTER TABLE po_item ADD COLUMN IF NOT EXISTS requesting_branch_id UUID REFERENCES branch(branch_id);

-- stock_transfer table (new) — staff-initiated branch-to-branch transfer,
-- requiring the destination branch to approve before stock moves. Confirmed
-- run on the live project.
CREATE TABLE IF NOT EXISTS stock_transfer (
  transfer_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES product(product_id),
  variant_options JSONB,
  from_branch_id  UUID NOT NULL REFERENCES branch(branch_id),
  to_branch_id    UUID NOT NULL REFERENCES branch(branch_id),
  quantity        INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | cancelled
  requested_by    UUID REFERENCES staff(staff_id),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by     UUID REFERENCES staff(staff_id),
  resolved_at     TIMESTAMPTZ,
  rejection_note  TEXT
);

-- order — Remittance-summary timestamps (Today's Remittance summary
-- feature). Confirmed run on the live project.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- po_item — per-line-item supplier (PO Unit Cost & Supplier moved to
-- receive time, third adviser-feedback round, 2026-10-26). Supplier is no
-- longer a single per-PO value — different items on the same PO can come
-- from different suppliers — so it moved from purchase_order.supplier
-- (left in place, now unused/legacy) down to po_item.supplier.
ALTER TABLE po_item ADD COLUMN IF NOT EXISTS supplier TEXT;

-- order — widen the status CHECK constraint to allow 'returned_failed' and
-- 'not_remitted'. Both values have been computed and written by the
-- application for some time (returned_failed since the delivery-retry
-- feature; not_remitted since the 5pm-closing-hour auto-flag added this
-- round), but — same class of bug as the purchase_order fix above — the
-- constraint itself was never updated to allow them. Found via this
-- revision's live-schema audit. NOT YET RUN against the live Supabase
-- project — this is the urgent one; until this runs, any order that
-- reaches its 3rd failed delivery attempt or crosses the 5pm closing-hour
-- cutoff while still out for delivery will 500 at the database level.
-- Constraint name assumed from Postgres's default <table>_<column>_check
-- auto-naming (same convention the purchase_order fix above already relies
-- on) since it's inline/unnamed in the schema dump — if this DROP errors
-- with "constraint does not exist", look up the real name first:
--   SELECT conname FROM pg_constraint WHERE conrelid = '"order"'::regclass AND contype = 'c';
ALTER TABLE public."order" DROP CONSTRAINT order_status_check;
ALTER TABLE public."order"
  ADD CONSTRAINT order_status_check
  CHECK (status::text = ANY (ARRAY[
    'pending'::character varying,
    'processing'::character varying,
    'out_for_delivery'::character varying,
    'not_remitted'::character varying,
    'completed'::character varying,
    'cancelled'::character varying,
    'returned_failed'::character varying
  ]::text[]));
```

> **Note on completeness:** the tables/columns documented above that aren't reflected in the migration log — `sales_transaction`, `variant_stock`, `product.staff_id`/`available_at`/`variants`, `order.cart_id`/`ref_no`/`address_note`/`cancel_reason`/`cancelled_by`/`is_offline_sync`/`processing_started_at`/`dispatch_date`/`delivery_attempts`, `payment`'s `cash_on_delivery` method, `customer.address_note`, `user.active_session_token`, `staff.position` — were already present in production before this changelog started being kept during the panel-revision work this term. Their original creation SQL isn't tracked here; they're documented above purely from the live schema audit.

---

## Key Business Rules

| Rule | Description |
|---|---|
| **Branch visibility** | Products only show on mobile if `branch_stock.quantity > 0` for that branch (`product.available_at` is a legacy column no longer used for this) |
| **VAT** | 12% VAT Inclusive applied on POS walk-in receipts |
| **Shipping tiers (reworked 2026-10-22)** | 4-zone model modeled on real courier (J&T) pricing — same-region cheapest, same-island mid-tier, inter-island priciest — plus a light-item bracket under 500g so a small item isn't charged the same as something near 5kg: **South Cotabato** — always free, any weight. **Region XII (SOCCSKSARGEN)** — ₱70 flat under 500g, else ₱120 base + ₱30/kg over 5kg. **Rest of Mindanao mainland** (Region IX/X/XI, CARAGA, BARMM) — ₱90 flat under 500g, else ₱150 base + ₱32/kg over 5kg. **Luzon/Visayas** (inter-island) — ₱120 flat under 500g, else ₱200 base + ₱35/kg over 5kg. Computed server-side in `_compute_shipping_fee()` (never trusts the client-sent amount), mirrored in mobile's `CheckoutScreen.js calculateShipping()` |
| **Price history logging** | Every time an admin/staff edit actually changes a product's resale `price`, `price_history` gets one new row (old price, new price, who, when) — logged only when the value actually changed, not on every save. Read via `GET /api/admin/price-history` (optionally filtered to one product), surfaced in the admin Products table's "Price History" button |
| **Barcode scope** | `POST /api/admin/products/<id>/generate-barcode` takes a `scope`: `"product"` writes `product.barcode`; `"choice"` writes onto one `option_groups[].choices[]` entry (by group index + choice value); `"combo"` writes onto (or creates) one `variant_overrides[]` entry (matched by its `options` object). Lets a product, one variant choice, and one specific variant combination each carry their own distinct scannable code |
| **GCash verification** | No manually-typed reference numbers. GCash payments (staff POS and mobile checkout) go through a PayMongo Payment Intent; `payment.ref_no` is only set after PayMongo confirms the intent status is `succeeded`, and `payment.status` is set to `paid` at that point |
| **Payment methods** | `walk_in_cash`, `cash_on_delivery` (COD, online orders), or `gcash` |
| **Order status flow** | `pending` → `processing` → `out_for_delivery` → (`not_remitted` if still unresolved past 5pm Manila time, see below) → `completed` (Remit succeeds) or `returned_failed` (3rd failed delivery attempt); `cancelled` can happen before dispatch. **⚠️ `returned_failed` and `not_remitted` are not yet accepted by the live `order.status` CHECK constraint — see the warning under the `order` table above** |
| **Process Now (per-order bypass)** | A `pending` order can be pushed into `processing` immediately via a "Process Now" button, instead of waiting for the 30-minute auto-advance — same underlying PUT route and `DAILY_PROCESSING_CAP` as the automatic path, so the daily cap is enforced either way |
| **Delivery retry/return (courier-retry model)** | The courier physically holds the parcel across all 3 attempts rather than returning it to the warehouse between tries. `order.delivery_attempts` increments on each failed delivery and `order.last_attempt_at` is stamped every time, final or not. On a non-final failure (1st/2nd of 3), `order.dispatch_date` is rescheduled to **tomorrow** (not cleared) so the order shows in "Scheduled for Retry" and reappears in "Out for Deliveries" on its own once that date arrives — it never goes back to "To Dispatch". At the 3rd failed attempt, the order is marked `returned_failed` and stock is restored |
| **Not Remitted — 5pm closing-hour auto-flag** | A lazy/opportunistic check (no background scheduler, same pattern as the Pending→Processing auto-advance) runs whenever admin/staff orders are fetched: any order still `out_for_delivery` with `dispatch_date` on or before today, past 5:00 PM Philippines time (fixed UTC+8, no DST), auto-flips to `not_remitted`. It stays visible in "Out for Deliveries" with a red badge and remains fully actionable (Remit / Not Delivered) the next working day |
| **Bulk Remit / Bulk Not Delivered** | Multi-select checkboxes on the Out for Deliveries tab let admin/staff act on several orders at once. Bulk Remit skips the per-order typed-amount confirmation the single-order Remit modal requires — it trusts each order's server-computed grand total and completes every eligible selected order outright. Bulk Not Delivered applies the same per-order attempt-increment/courier-retry logic as the single-order action, to every checked order |
| **Remittance summary (Expected vs Actual)** | "Expected Today" = grand total of every order dispatched today (`dispatch_date == today` AND status in `out_for_delivery`/`not_remitted`/`completed`) — fixed once dispatched, doesn't shrink as orders get remitted. "Remitted So Far" is derived directly from today's `completed` orders (not from a separate `completed_at`-only query, to avoid the two figures ever drifting apart). Shown on both Admin (store-wide) and Staff (branch-scoped) Deliveries cards, alongside headline counts (Total Deliveries Today, Completed/Remitted, Failed Attempts, Returned/Failed) and read-only Delivered Today / Failed Attempts Today / Returned-Failed Today tabs so every figure traces back to an actual order row |
| **One-session-per-user** | `user.active_session_token` holds the current valid session; logging in elsewhere issues a new token and invalidates the old session |
| **OTP expiry** | Mobile: 5 minutes, Web: 15 minutes |
| **Web login MFA** | An unrecognized browser (no matching `mfa_device` row) must verify a 6-digit email code before login completes; once verified, that specific browser is trusted indefinitely via the `tefc_mfa_token` cookie |
| **Stock deduction timing** | Deducted from `branch_stock` (and `variant_stock` for variant products) only once an order enters `processing` (tracked via `order.processing_started_at`), not at checkout/Pending |
| **PO stock received** | Admin selects which branch(es) receive the stock per item (`po_item.received_quantity` tracks the cumulative total across batches); every received line requires `unit_cost > 0` and a non-empty `supplier` before it's accepted (see the PO Unit Cost & Supplier rule below). Updates `branch_stock`, `variant_stock`, and logs an `inventory` row per branch distributed to |
| **Partial PO receiving** | A receive batch can arrive short of what was ordered. Each item's write is isolated, so one item failing to save can't roll back a sibling item that already succeeded. `purchase_order.status` is computed from the actual `received_quantity` totals after the batch (`received` only once every item's running total meets its ordered quantity, otherwise `partially_received`) — never just set blindly to `received`. A receipt is issued for the batch either way, not only on a full receive |
| **Whole-number quantity validation** | Every direct quantity-entry endpoint (stock request creation, Add Stock, branch stock add, stock transfer creation, PO item quantities) rejects non-whole-number input server-side (decimals, non-numeric strings, booleans) rather than silently coercing it, mirrored client-side by a sanitizing input handler that strips non-digit characters as they're typed |
| **Stock request batching** | Multiple items submitted together in one "Generate Stock Request" action share a `batch_id`; admin reviews and approves/rejects the whole batch as one action unless some items in it were already decided (e.g. a dropped connection left some approved and some pending), in which case only the still-pending ones remain actionable |
| **Returns (post-completion)** | Separate from Cancel, which only applies before an order ships/completes. Admin/staff can process a return only on a `completed` order, per item, up to `qty - returned_qty` remaining. Restores `branch_stock`/`variant_stock`/`product.quantity` and logs an `inventory` row tagged `Return — Order #...` so Stock Movement History can tell it apart from a Sale or Cancellation. Each item's write is isolated (same per-item pattern as partial PO receiving) |
| **product.quantity sync** | This aggregate field is kept in sync with the real `branch_stock` total on every stock-changing action — sale, cancel, return, and manual restock/transfer/adjustment (transfers are net-zero across branches, so `product.quantity` isn't touched for those) |
| **Product creation — Status & Net Weight deferred** | Per panelist feedback at the mock defense: Net Weight is no longer required at product creation (it previously blocked Save). The Add Product modal hides both the Status display and the Net Weight field entirely — Status is auto-computed from stock and doesn't apply yet, and Net Weight can be filled in later. Both reappear in the Edit Product modal once the product exists. Products missing a net weight are visually flagged in the products table (tinted row + "⚠️ Needs weight" label) so admins know which ones still need it set via Edit |
| **PO Unit Cost & Supplier — entered at receive time, not creation** | ⚠️ **Supersedes the earlier "Base Price → PO Unit Cost auto-fill" rule** (removed in the third adviser-feedback round): Create PO no longer has Unit Cost or Supplier fields at all — every `po_item` is inserted with `unit_cost: 0` and `supplier: NULL`. Both are entered per line item on the **Receive & Distribute** modal instead (Unit Cost input + a Supplier `<datalist>` sourced from `GET /api/admin/suppliers`), since a single PO can source different products from different suppliers. The Create PO modal instead shows a color-coded stock-level tag (OUT OF STOCK/CRITICAL/LOW/OK) per item, and `po_item.requesting_branch_id` auto-fills the receiving split when the item came from an approved stock request |
| **PO viewing/search** | Purchase Orders toolbar has a search box (matches PO number, note, or PO ID) plus the existing status/date filters, and a "View All" button that clears all three filters at once |
| **Stock transfer (staff-initiated, destination-approved)** | Separate from Admin's own instant "Transfer Stock" action. A staff member at the source branch files a `stock_transfer` request; stock stays untouched until a staff member at the **destination branch** approves it (re-validating current source-branch stock at that exact moment) or rejects it with an optional note. The source branch can cancel its own request while still `pending`. One `inventory` row is logged per approved transfer, matching Admin's own transfer-logging convention |
| **POS category/sub-category browsing** | Staff POS shows only the category level in the chip row (per panelist feedback). A category with sub-categories gets a hover/tap flyout listing them; picking a sub-category filters by category + sub-category together, picking the category chip itself filters by the whole category (unchanged from before) |
| **Offline POS sales** | A sale made during a connectivity outage is queued locally and synced once connectivity returns; the resulting `order` row is marked `is_offline_sync = true` |
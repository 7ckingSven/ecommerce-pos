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
  └──< purchase_order >──< po_item >── product

user ──< staff
user ──< customer (role-shared: `user.role` is admin / staff / customer)
user ──< mfa_device

customer ──< cart >── product
customer ──< order >──< order_item >── product
otp_codes (keyed by email — no FK to customer)
```

> **Source of truth note:** this document was reconciled against a live `pg_dump`-style export of the actual Supabase schema. A few tables and columns existed in production but weren't previously documented here — those are now included below (`sales_transaction`, `variant_stock`, and several columns on `order`, `product`, `payment`, `customer`, `user`). Anywhere this doc previously described something incorrectly (e.g. `otp_codes` keying, `cart.status` values), it's been corrected to match what the database actually enforces.

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
| `option_groups` | JSONB | DEFAULT '[]' | Variants: `[{"label":"Size","choices":["S","M","L"]}]` — the active, structured variant system |
| `variants` | TEXT[] | DEFAULT '{}' | Legacy flat variant list, predates `option_groups`; not used by the current UI |
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
| `status` | VARCHAR | NOT NULL, DEFAULT 'pending', CHECK | `pending`, `processing`, `out_for_delivery`, `completed`, `cancelled` |
| `cancel_reason` | TEXT | NULLABLE | Why the order was cancelled, when applicable |
| `cancelled_by` | TEXT | NULLABLE | Who cancelled it (customer vs staff/admin) |
| `is_offline_sync` | BOOLEAN | NOT NULL, DEFAULT false | True if this order was created by the POS's offline sale queue syncing back up after a connectivity outage, rather than placed live |
| `processing_started_at` | TIMESTAMPTZ | NULLABLE | When the order entered `processing` — the stock-deduction-on-Processing business rule reads this to determine whether stock has already been taken for this order |
| `dispatch_date` | DATE | NULLABLE | Which day's delivery batch this order belongs to, for the "Deliveries for Today" view |
| `delivery_attempts` | INT | NOT NULL, DEFAULT 0 | Count of failed delivery attempts; after 3 the order auto-flips to Returned/Failed and stock is restored |
| `date` | DATE | NOT NULL, DEFAULT CURRENT_DATE | Order date |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT now() | Precise timestamp for sorting |

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
| `supplier` | VARCHAR | NULLABLE | Supplier name |
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
| `unit_cost` | DECIMAL(10,2) | DEFAULT 0 | Cost per unit |
| `variant_options` | JSONB | NULLABLE | Which variant this line item is for, if the product has variants |
| `received_quantity` | INT | NOT NULL, DEFAULT 0 | Cumulative units actually received so far (may be < quantity if the supplier shorted the order — PO stays `partially_received` until this reaches `quantity`) |

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
```

> **Note on completeness:** the tables/columns documented above that aren't reflected in the migration log — `sales_transaction`, `variant_stock`, `product.staff_id`/`available_at`/`variants`, `order.cart_id`/`ref_no`/`address_note`/`cancel_reason`/`cancelled_by`/`is_offline_sync`/`processing_started_at`/`dispatch_date`/`delivery_attempts`, `payment`'s `cash_on_delivery` method, `customer.address_note`, `user.active_session_token`, `staff.position` — were already present in production before this changelog started being kept during the panel-revision work this term. Their original creation SQL isn't tracked here; they're documented above purely from the live schema audit.

---

## Key Business Rules

| Rule | Description |
|---|---|
| **Branch visibility** | Products only show on mobile if `branch_stock.quantity > 0` for that branch (`product.available_at` is a legacy column no longer used for this) |
| **VAT** | 12% VAT Inclusive applied on POS walk-in receipts |
| **Shipping tiers** | Koronadal (FREE if ≥₱500 or ≤3kg) → South Cotabato (₱50 base) → Region XII (₱120 base) → Outside (₱200 base) + weight surcharge |
| **GCash verification** | No manually-typed reference numbers. GCash payments (staff POS and mobile checkout) go through a PayMongo Payment Intent; `payment.ref_no` is only set after PayMongo confirms the intent status is `succeeded`, and `payment.status` is set to `paid` at that point |
| **Payment methods** | `walk_in_cash`, `cash_on_delivery` (COD, online orders), or `gcash` |
| **Order status flow** | pending → processing → out_for_delivery → completed (customer marks received) or cancelled |
| **Delivery retry/return** | `order.delivery_attempts` increments on each failed delivery; at 3 the order is marked Returned/Failed and stock is restored. `order.dispatch_date` groups orders into a day's delivery batch for the Deliveries for Today view |
| **One-session-per-user** | `user.active_session_token` holds the current valid session; logging in elsewhere issues a new token and invalidates the old session |
| **OTP expiry** | Mobile: 5 minutes, Web: 15 minutes |
| **Web login MFA** | An unrecognized browser (no matching `mfa_device` row) must verify a 6-digit email code before login completes; once verified, that specific browser is trusted indefinitely via the `tefc_mfa_token` cookie |
| **Stock deduction timing** | Deducted from `branch_stock` (and `variant_stock` for variant products) only once an order enters `processing` (tracked via `order.processing_started_at`), not at checkout/Pending |
| **PO stock received** | Admin selects which branch(es) receive the stock per item (`po_item.received_quantity` tracks the cumulative total across batches); updates `branch_stock`, `variant_stock`, and logs an `inventory` row per branch distributed to |
| **Partial PO receiving** | A receive batch can arrive short of what was ordered. Each item's write is isolated, so one item failing to save can't roll back a sibling item that already succeeded. `purchase_order.status` is computed from the actual `received_quantity` totals after the batch (`received` only once every item's running total meets its ordered quantity, otherwise `partially_received`) — never just set blindly to `received`. A receipt is issued for the batch either way, not only on a full receive |
| **Stock request batching** | Multiple items submitted together in one "Generate Stock Request" action share a `batch_id`; admin reviews and approves/rejects the whole batch as one action unless some items in it were already decided (e.g. a dropped connection left some approved and some pending), in which case only the still-pending ones remain actionable |
| **Returns (post-completion)** | Separate from Cancel, which only applies before an order ships/completes. Admin/staff can process a return only on a `completed` order, per item, up to `qty - returned_qty` remaining. Restores `branch_stock`/`variant_stock`/`product.quantity` and logs an `inventory` row tagged `Return — Order #...` so Stock Movement History can tell it apart from a Sale or Cancellation. Each item's write is isolated (same per-item pattern as partial PO receiving) |
| **product.quantity sync** | This aggregate field is kept in sync with the real `branch_stock` total on every stock-changing action — sale, cancel, return, and manual restock/transfer/adjustment (transfers are net-zero across branches, so `product.quantity` isn't touched for those) |
| **Product creation — Status & Net Weight deferred** | Per panelist feedback at the mock defense: Net Weight is no longer required at product creation (it previously blocked Save). The Add Product modal hides both the Status display and the Net Weight field entirely — Status is auto-computed from stock and doesn't apply yet, and Net Weight can be filled in later. Both reappear in the Edit Product modal once the product exists. Products missing a net weight are visually flagged in the products table (tinted row + "⚠️ Needs weight" label) so admins know which ones still need it set via Edit |
| **Base Price → PO Unit Cost auto-fill** | When a product with `base_price` set is selected in a Create PO row (or pulled in via "Use Approved Requests" / the branch-stock quick-create shortcut), Unit Cost auto-fills from `base_price` — still editable by hand. A product with no `base_price` yet is left blank rather than auto-filled with 0, so it doesn't read as "free" |
| **POS category/sub-category browsing** | Staff POS shows only the category level in the chip row (per panelist feedback). A category with sub-categories gets a hover/tap flyout listing them; picking a sub-category filters by category + sub-category together, picking the category chip itself filters by the whole category (unchanged from before) |
| **Offline POS sales** | A sale made during a connectivity outage is queued locally and synced once connectivity returns; the resulting `order` row is marked `is_offline_sync = true` |
# Triple E & Fiel Collins — Database Documentation
**Database:** Supabase (PostgreSQL)

---

## Entity Relationship Overview

```
branch ──────────────────────────────────────────────────────────────────┐
  │                                                                       │
  ├──< branch_stock >── product ──< order_item >── order ──< payment     │
  │                        │                         │                   │
  │                    discount                    customer              │
  │                    option_groups               staff ───────────────┘
  │                    net_weight
  │
  ├──< inventory (from_branch / to_branch)
  ├──< stock_request >── staff
  └──< purchase_order >──< po_item >── product

user ──< staff
user ──< customer (via separate auth)
user ──< mfa_device

customer ──< cart >── product
customer ──< order >──< order_item >── product
customer ──< otp_codes
```

---

## Tables

---

### 1. `branch`
Stores the two physical branches of the store.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `branch_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique branch identifier |
| `branch_name` | VARCHAR | NOT NULL | Branch name (e.g. Triple E, Fiel Collince) |
| `address` | TEXT | | Physical address of branch |
| `created_at` | TIMESTAMP | DEFAULT now() | Date created |

---

### 2. `user`
Stores login credentials for Admin and Staff accounts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique user identifier |
| `username` | VARCHAR | NOT NULL, UNIQUE | Login username |
| `password` | VARCHAR | NOT NULL | Bcrypt hashed password |
| `role` | VARCHAR | NOT NULL | `admin` or `staff` |
| `status` | VARCHAR | DEFAULT 'active' | `active` or `inactive` |
| `created_at` | TIMESTAMP | DEFAULT now() | Date created |

---

### 3. `staff`
Stores staff profile details, linked to a user account and assigned branch.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `staff_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique staff identifier |
| `user_id` | UUID | **FK** → user.user_id | Login credentials |
| `branch_id` | UUID | **FK** → branch.branch_id | Assigned branch |
| `fname` | VARCHAR | NOT NULL | First name |
| `mi` | VARCHAR | | Middle initial |
| `lname` | VARCHAR | NOT NULL | Last name |
| `email` | VARCHAR | UNIQUE | Staff email |
| `phone_number` | VARCHAR | | Contact number |
| `created_at` | TIMESTAMP | DEFAULT now() | Date created |

---

### 4. `customer`
Stores customer accounts registered via the mobile app.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `customer_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique customer identifier |
| `user_id` | UUID | **FK** → user.user_id | Login credentials |
| `fname` | VARCHAR | NOT NULL | First name |
| `lname` | VARCHAR | NOT NULL | Last name |
| `email` | VARCHAR | NOT NULL, UNIQUE | Customer email |
| `phone_number` | VARCHAR | UNIQUE | Mobile number (11 digits, starts with 09) |
| `address` | TEXT | | PSGC address (pipe-separated: Street\|Barangay\|City\|Province\|Region\|Zip) |
| `fcm_token` | TEXT | | Firebase Cloud Messaging device token, used to push order-status notifications to the mobile app |
| `created_at` | TIMESTAMP | DEFAULT now() | Date registered |

---

### 5. `product`
Stores the product catalog with variants and weight.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `product_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique product identifier |
| `discount_id` | UUID | **FK** → discount.discount_id | Assigned discount (nullable) |
| `product_name` | VARCHAR | NOT NULL | Product name |
| `brand` | VARCHAR | | Brand name |
| `category` | VARCHAR | | Product category |
| `description` | TEXT | | Product description |
| `price` | DECIMAL(10,2) | NOT NULL | Selling price |
| `quantity` | INT | DEFAULT 0 | Legacy total stock (branch_stock is source of truth) |
| `image_url` | TEXT | | Main product image URL (Supabase Storage) |
| `image_urls` | TEXT[] | DEFAULT '{}' | Array of product image URLs |
| `option_groups` | JSONB | DEFAULT '[]' | Variants: `[{"label":"Size","choices":["S","M","L"]}]` |
| `net_weight` | DECIMAL(10,2) | DEFAULT 0 | Product weight/volume for shipping |
| `net_weight_unit` | VARCHAR(10) | DEFAULT 'kg' | Unit: `kg`, `gram`, `mL`, `L` |
| `status` | VARCHAR | DEFAULT 'active' | `active` or `inactive` |
| `created_at` | TIMESTAMP | DEFAULT now() | Date created |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last updated |

---

### 6. `branch_stock`
Tracks per-product, per-branch stock quantity. This is the **primary source of truth** for stock and product visibility.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique record identifier |
| `product_id` | UUID | **FK** → product.product_id ON DELETE CASCADE | Product |
| `branch_id` | UUID | **FK** → branch.branch_id ON DELETE CASCADE | Branch |
| `quantity` | INT | DEFAULT 0 | Current stock at this branch |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last updated |
| | | UNIQUE(product_id, branch_id) | One record per product per branch |

> **Note:** A product only appears on the mobile app if its `branch_stock.quantity > 0` for that branch. Products with zero stock across all branches are hidden.

---

### 7. `discount`
Stores discount records with optional date ranges.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `discount_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique discount identifier |
| `discount_name` | VARCHAR | NOT NULL | Display name (e.g. "Summer Sale") |
| `percentage` | DECIMAL(5,2) | NOT NULL | Discount percentage (0.01–100) |
| `starts_at` | TIMESTAMP | | When discount becomes active (optional) |
| `ends_at` | TIMESTAMP | | When discount expires (optional) |
| `created_at` | TIMESTAMP | DEFAULT now() | Date created |

> **Status logic:** Active if now is between `starts_at` and `ends_at`. If no dates set, always active.

---

### 8. `inventory`
Logs all stock movement history (restocks, transfers, adjustments).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique record identifier |
| `product_id` | UUID | **FK** → product.product_id | Product |
| `staff_id` | UUID | **FK** → staff.staff_id | Staff who made the movement |
| `from_branch_id` | UUID | **FK** → branch.branch_id, NULLABLE | Source branch (for transfers) |
| `to_branch_id` | UUID | **FK** → branch.branch_id, NULLABLE | Destination branch |
| `quantity_added` | INT | | Units added (positive) or deducted (negative) |
| `quantity_before` | INT | | Stock before the movement |
| `quantity_after` | INT | | Stock after the movement |
| `date` | DATE | | Date of movement |
| `note` | TEXT | | Reason (e.g. "loss", "stolen", "PO received") |
| `created_at` | TIMESTAMP | DEFAULT now() | Timestamp |

---

### 9. `order`
Stores all customer orders (online via mobile and walk-in via POS).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `order_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique order identifier |
| `customer_id` | UUID | **FK** → customer.customer_id | Customer (null for walk-in) |
| `staff_id` | UUID | **FK** → staff.staff_id | Staff who processed (walk-in) |
| `branch_id` | UUID | **FK** → branch.branch_id | Branch where order was placed |
| `order_type` | VARCHAR | NOT NULL | `online` or `walk_in` |
| `total` | DECIMAL(10,2) | NOT NULL | Grand total (including shipping) |
| `shipping_fee` | DECIMAL(10,2) | DEFAULT 0 | Shipping fee for online orders |
| `address` | TEXT | | Delivery address (pipe-separated PSGC format) |
| `status` | VARCHAR | DEFAULT 'pending' | `pending`, `processing`, `out_for_delivery`, `completed`, `cancelled` |
| `date` | DATE | | Order date |
| `created_at` | TIMESTAMP | DEFAULT now() | Precise timestamp for sorting |

---

### 10. `order_item`
Stores individual items within each order.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `order_item_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique item identifier |
| `order_id` | UUID | **FK** → order.order_id | Parent order |
| `product_id` | UUID | **FK** → product.product_id | Product ordered |
| `qty` | INT | NOT NULL | Quantity ordered |
| `price` | DECIMAL(10,2) | NOT NULL | Price at time of order |
| `selected_options` | JSONB | DEFAULT '{}' | Customer's selected variants: `{"Size":"M","Color":"Blue"}` |

---

### 11. `payment`
Stores payment records for each order.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `payment_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique payment identifier |
| `order_id` | UUID | **FK** → order.order_id | Associated order |
| `customer_id` | UUID | **FK** → customer.customer_id | Customer (nullable for walk-in) |
| `payment_method` | VARCHAR | NOT NULL | `gcash` or `walk_in_cash` |
| `total` | DECIMAL(10,2) | | Amount paid |
| `status` | VARCHAR | DEFAULT 'pending' | `pending`, `paid`, `failed` |
| `ref_no` | VARCHAR | | For `gcash`: the server-verified PayMongo Payment Intent ID (e.g. `pi_...`), set only after PayMongo reports the payment `succeeded` |
| `sender_number` | VARCHAR | | Legacy — GCash sender's mobile number from the old manual-entry flow. Always `null` on new orders (both staff POS and mobile checkout now go through PayMongo verification instead) |
| `receipt_image_url` | TEXT | | Legacy — uploaded GCash receipt screenshot URL from the old manual-entry flow. Always `null` on new orders |
| `date` | DATE | | Payment date |

---

### 12. `cart`
Stores active cart items for customers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `cart_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique cart item identifier |
| `customer_id` | UUID | **FK** → customer.customer_id | Cart owner |
| `product_id` | UUID | **FK** → product.product_id | Product in cart |
| `branch_id` | UUID | **FK** → branch.branch_id | Branch the product is from |
| `quantity` | INT | DEFAULT 1 | Quantity in cart |
| `selected_options` | JSONB | DEFAULT '{}' | Selected variants: `{"Size":"M","Color":"Blue"}` |
| `status` | VARCHAR | DEFAULT 'active' | `active` or `ordered` |
| `added_at` | TIMESTAMP | DEFAULT now() | When added to cart |

---

### 13. `stock_request`
Staff submits stock requests to admin when inventory is low.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `request_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique request identifier |
| `product_id` | UUID | **FK** → product.product_id | Requested product |
| `staff_id` | UUID | **FK** → staff.staff_id | Staff who submitted |
| `branch_id` | UUID | **FK** → branch.branch_id | Branch requesting stock |
| `quantity_requested` | INT | NOT NULL | Units requested |
| `status` | VARCHAR | DEFAULT 'pending' | `pending`, `approved`, `rejected` |
| `note` | TEXT | | Additional notes |
| `created_at` | TIMESTAMP | DEFAULT now() | Date submitted |

---

### 14. `purchase_order`
Admin creates POs for restocking from suppliers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `po_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique PO identifier |
| `po_number` | VARCHAR | NOT NULL, UNIQUE | PO number (e.g. PO-202608-001) |
| `supplier` | VARCHAR | | Supplier name |
| `status` | VARCHAR | DEFAULT 'draft' | `draft`, `ordered`, `partially_received`, `received`, `cancelled` |
| `total` | DECIMAL(10,2) | DEFAULT 0 | Total PO value |
| `note` | TEXT | | PO notes |
| `created_by` | UUID | **FK** → staff.staff_id | Admin who created PO |
| `created_at` | TIMESTAMP | DEFAULT now() | Date created |

---

### 15. `po_item`
Individual items within each purchase order.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `po_item_id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique item identifier |
| `po_id` | UUID | **FK** → purchase_order.po_id | Parent PO |
| `product_id` | UUID | **FK** → product.product_id | Product |
| `quantity` | INT | NOT NULL | Units ordered from supplier |
| `unit_cost` | DECIMAL(10,2) | NOT NULL | Cost per unit |
| `received_quantity` | INT | NOT NULL, DEFAULT 0 | Cumulative units actually received so far (may be < quantity if the supplier shorted the order — PO stays `partially_received` until this reaches `quantity`) |

---

### 16. `otp_codes`
Stores OTP tokens for mobile password reset.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | **PK**, DEFAULT uuid_generate_v4() | Unique OTP record |
| `customer_id` | UUID | **FK** → customer.customer_id | Customer requesting reset |
| `otp_code` | VARCHAR(6) | NOT NULL | 6-digit OTP |
| `expires_at` | TIMESTAMP | NOT NULL | OTP expiry (5 minutes from creation) |
| `used` | BOOLEAN | DEFAULT FALSE | Whether OTP has been used |
| `created_at` | TIMESTAMP | DEFAULT now() | When OTP was generated |

---

### 17. `mfa_device`
Stores trusted browsers for web (admin/staff) login — once a browser passes email OTP verification, it's remembered here so it's not re-challenged on future logins from that same browser.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | **PK**, DEFAULT gen_random_uuid() | Unique record identifier |
| `user_id` | UUID | **FK** → user.user_id ON DELETE CASCADE | The admin/staff account this trusted browser belongs to |
| `mfa_token` | TEXT | | Opaque token stored in the `tefc_mfa_token` browser cookie; matched against this table on login to skip the OTP challenge |
| `user_agent` | TEXT | | Browser user-agent string at time of trust, for reference |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | When this browser was first trusted |
| `last_used_at` | TIMESTAMPTZ | DEFAULT now() | Last login from this browser |

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
```

---

## Key Business Rules

| Rule | Description |
|---|---|
| **Branch visibility** | Products only show on mobile if `branch_stock.quantity > 0` for that branch |
| **VAT** | 12% VAT Inclusive applied on POS walk-in receipts |
| **Shipping tiers** | Koronadal (FREE if ≥₱500 or ≤3kg) → South Cotabato (₱50 base) → Region XII (₱120 base) → Outside (₱200 base) + weight surcharge |
| **GCash verification** | No manually-typed reference numbers. GCash payments (staff POS and mobile checkout) go through a PayMongo Payment Intent; `payment.ref_no` is only set after PayMongo confirms the intent status is `succeeded`, and `payment.status` is set to `paid` at that point |
| **Order status flow** | pending → processing → out_for_delivery → completed (customer marks received) or cancelled |
| **OTP expiry** | Mobile: 5 minutes, Web: 15 minutes |
| **Web login MFA** | An unrecognized browser (no matching `mfa_device` row) must verify a 6-digit email code before login completes; once verified, that specific browser is trusted indefinitely via the `tefc_mfa_token` cookie |
| **Stock deduction** | Deducted from `branch_stock` of the branch the order was placed from |
| **PO stock received** | Admin selects which branch receives the stock; updates `branch_stock` |
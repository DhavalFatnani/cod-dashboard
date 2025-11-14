# API Documentation

## Base URL

- **Production**: `https://your-project.supabase.co/functions/v1`
- **Local**: `http://localhost:54321/functions/v1`

## Authentication

All Edge Functions (except public webhooks) require authentication:

```http
Authorization: Bearer <jwt_token>
```

## Edge Functions

### 1. Webhook: WMS Orders

Create orders from WMS system.

**Endpoint**: `POST /webhook-wms-orders`

**Auth**: Public (webhook secret recommended)

**Request Body**:
```json
{
  "order_id": "WMS-12345",
  "order_number": "ORD-2024-001",
  "store_id": "STORE-001",
  "store_name": "Store Name",
  "customer_name": "John Doe",
  "customer_phone": "+911234567890",
  "payment_type": "COD",
  "cod_type": "COD_HARD",
  "order_amount": 1500.00,
  "cod_amount": 1500.00,
  "wms_created_at": "2024-01-15T10:30:00Z",
  "metadata": {}
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "order_number": "ORD-2024-001",
    ...
  }
}
```

**Idempotency**: Returns existing order if `order_number` already exists.

---

### 2. Webhook: Rider Events

Create rider events (collection, dispatch, etc.).

**Endpoint**: `POST /webhook-rider-events`

**Auth**: Public (webhook secret recommended)

**Request Body**:
```json
{
  "order_number": "ORD-2024-001",
  "rider_id": "RIDER-001",
  "rider_name": "Rider Name",
  "event_type": "COLLECTED",
  "amount": 1500.00,
  "notes": "Cash collected",
  "location": {
    "lat": 28.6139,
    "lng": 77.2090
  },
  "metadata": {}
}
```

**Event Types**: `COLLECTED`, `DISPATCHED`, `CANCELLED`, `RTO`

**Response** (201 Created):
```json
{
  "success": true,
  "event": {
    "id": "uuid",
    "order_id": "uuid",
    ...
  }
}
```

---

### 3. ASM Deposit

Create deposit and link orders.

**Endpoint**: `POST /asm-deposit`

**Auth**: Required (ASM role)

**Request Body**:
```json
{
  "asm_id": "ASM-001",
  "asm_name": "ASM Name",
  "order_ids": ["uuid1", "uuid2"],
  "total_amount": 3000.00,
  "deposit_slip_url": "https://...",
  "deposit_date": "2024-01-15",
  "bank_account": "ACC-123",
  "metadata": {}
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "deposit": {
    "id": "uuid",
    "deposit_number": "DEP-1234567890-abc",
    ...
  }
}
```

---

### 4. Simulator

Admin-only simulator for test data.

#### Get Status

**Endpoint**: `GET /simulator/status`

**Auth**: Required (Admin role)

**Response**:
```json
{
  "status": true,
  "test_tag": "test-1234567890"
}
```

#### Start Simulator

**Endpoint**: `POST /simulator/start`

**Auth**: Required (Admin role)

**Request Body**:
```json
{
  "count": 100,
  "rate_per_min": 100,
  "mix": {
    "cod_hard": 0.6,
    "cod_qr": 0.3,
    "prepaid": 0.1
  },
  "rider_pool": ["RIDER-001", "RIDER-002"],
  "asm_pool": ["ASM-001", "ASM-002"],
  "test_tag": "test-1234567890"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Created 100 test orders",
  "test_tag": "test-1234567890"
}
```

#### Bulk Process

**Endpoint**: `POST /simulator/bulk-process`

**Auth**: Required (Admin role)

**Request Body**:
```json
{
  "test_tag": "test-1234567890",
  "action": "collect",
  "batch_size": 100
}
```

**Actions**: `collect`, `handover`, `deposit`, `reconcile`

**Response**:
```json
{
  "success": true,
  "processed": 50,
  "action": "collect"
}
```

#### Stop Simulator

**Endpoint**: `POST /simulator/stop`

**Auth**: Required (Admin role)

**Response**:
```json
{
  "success": true,
  "message": "Simulator stopped"
}
```

#### Cleanup

**Endpoint**: `POST /simulator/cleanup`

**Auth**: Required (Admin role)

**Request Body**:
```json
{
  "test_tag": "test-1234567890"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Cleaned up test data for tag: test-1234567890"
}
```

## Database Functions

### Get KPI Metrics

**Function**: `get_kpi_metrics`

**Parameters**:
- `p_start_date` (TIMESTAMPTZ, optional)
- `p_end_date` (TIMESTAMPTZ, optional)
- `p_store_id` (TEXT, optional)
- `p_rider_id` (TEXT, optional)
- `p_asm_id` (TEXT, optional)

**Returns**: JSONB with hierarchical KPI structure

**Example**:
```sql
SELECT get_kpi_metrics(
  p_start_date => '2024-01-01'::timestamptz,
  p_end_date => '2024-01-31'::timestamptz
);
```

### Get Order Timeline

**Function**: `get_order_timeline`

**Parameters**:
- `p_order_id` (UUID)

**Returns**: JSONB array of timeline events

**Example**:
```sql
SELECT get_order_timeline('order-uuid');
```

## Supabase Client API

### Orders

```typescript
// Get orders with filters
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .eq('payment_type', 'COD')
  .eq('money_state', 'UNCOLLECTED')
  .order('created_at', { ascending: false })
  .range(0, 49)

// Get single order
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .eq('id', orderId)
  .single()

// Subscribe to changes
const channel = supabase
  .channel('orders-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders'
  }, (payload) => {
    console.log('Order changed:', payload)
  })
  .subscribe()
```

### KPIs

```typescript
// Get KPI metrics
const { data, error } = await supabase.rpc('get_kpi_metrics', {
  p_start_date: startDate,
  p_end_date: endDate
})
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message"
}
```

**HTTP Status Codes**:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

- Webhooks: 100 requests/minute
- Edge Functions: 1000 requests/minute
- Database queries: Based on Supabase plan limits

## Webhooks

### Incoming (WMS → Dashboard)

1. **Order Created**: `POST /webhook-wms-orders`
2. **Rider Event**: `POST /webhook-rider-events`

### Outgoing (Dashboard → External)

Configure in Supabase dashboard:
- Order status changes
- Deposit confirmations
- Reconciliation events

---

## Bundle Endpoints

### 1. Rider Bundles: Create Bundle

Create a new rider bundle with selected orders.

**Endpoint**: `POST /rider-bundles`

**Auth**: Rider or Admin

**Request Body**:
```json
{
  "order_ids": ["uuid1", "uuid2", "uuid3"],
  "denomination_breakdown": {
    "2000": 5,
    "500": 10,
    "200": 5,
    "100": 10
  },
  "photo_proofs": [
    "https://storage.supabase.co/.../photo1.jpg",
    "https://storage.supabase.co/.../photo2.jpg"
  ],
  "digital_signoff": true,
  "asm_id": "ASM-001"
}
```

**Response** (201 Created):
```json
{
  "bundle_id": "uuid",
  "expected_amount": 15000.00,
  "validated_amount": 15000.00,
  "status": "CREATED"
}
```

**Error Codes**:
- `400`: Invalid request (missing fields, denomination mismatch)
- `403`: Not authorized (not a rider)
- `404`: Order not found

---

### 2. Rider Bundles: List Bundles

Get list of bundles for a rider.

**Endpoint**: `GET /rider-bundles?rider_id=RIDER-001&status=READY_FOR_HANDOVER`

**Auth**: Rider, ASM, Admin, Finance

**Query Parameters**:
- `rider_id` (optional): Filter by rider ID
- `status` (optional): Filter by bundle status

**Response** (200 OK):
```json
{
  "success": true,
  "bundles": [
    {
      "id": "uuid",
      "rider_id": "RIDER-001",
      "expected_amount": 15000.00,
      "status": "READY_FOR_HANDOVER",
      "rider_bundle_orders": [...]
    }
  ]
}
```

---

### 3. Rider Bundles: Get Bundle Detail

Get detailed information about a specific bundle.

**Endpoint**: `GET /rider-bundles/{bundleId}`

**Auth**: Rider (own bundles), ASM (assigned bundles), Admin, Finance

**Response** (200 OK):
```json
{
  "success": true,
  "bundle": {
    "id": "uuid",
    "rider_id": "RIDER-001",
    "expected_amount": 15000.00,
    "denomination_breakdown": {...},
    "status": "READY_FOR_HANDOVER",
    "photo_proofs": [...],
    "rider_bundle_orders": [...]
  }
}
```

---

### 4. ASM Bundle Actions: Accept/Reject Bundle

Accept or reject a rider bundle.

**Endpoint**: `POST /asm-bundle-actions/accept`

**Auth**: ASM or Admin

**Request Body**:
```json
{
  "bundle_id": "uuid",
  "validation_status": "ACCEPTED",
  "actual_denominations": {
    "2000": 5,
    "500": 10
  },
  "comments": "Cash verified, all denominations correct"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "bundle": {
    "id": "uuid",
    "status": "HANDEDOVER_TO_ASM",
    "validated_amount": 15000.00
  },
  "validated_amount": 15000.00
}
```

**Reject Request**:
```json
{
  "bundle_id": "uuid",
  "validation_status": "REJECTED",
  "comments": "Denomination mismatch, short by ₹500"
}
```

---

### 5. ASM Bundle Actions: Create SuperBundle

Create a superbundle from multiple rider bundles.

**Endpoint**: `POST /asm-bundle-actions/superbundle`

**Auth**: ASM or Admin

**Request Body**:
```json
{
  "rider_bundle_ids": ["uuid1", "uuid2", "uuid3"],
  "denomination_breakdown": {
    "2000": 15,
    "500": 30,
    "200": 10
  },
  "digital_signoff": true,
  "sm_id": "SM-001"
}
```

**Response** (201 Created):
```json
{
  "superbundle_id": "uuid",
  "expected_amount": 50000.00,
  "validated_amount": 50000.00,
  "status": "CREATED"
}
```

**Error Codes**:
- `400`: Invalid request (bundles not in HANDEDOVER_TO_ASM, denomination mismatch)
- `403`: Not authorized (not an ASM)
- `404`: Bundle not found

---

### 6. SM SuperBundle Deposits: Create Deposit

Create a deposit from superbundle(s).

**Endpoint**: `POST /sm-superbundle-deposits/create`

**Auth**: SM or Admin

**Request Body**:
```json
{
  "superbundle_ids": ["uuid1", "uuid2"],
  "deposit_number": "DEP-2024-001",
  "deposit_date": "2024-01-15",
  "deposit_slip_url": "https://storage.supabase.co/.../slip.jpg",
  "bank_account": "ACCOUNT-001",
  "actual_amount_received": 100000.00
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "deposit": {
    "id": "uuid",
    "deposit_number": "DEP-2024-001",
    "expected_amount": 100000.00,
    "actual_amount_received": 100000.00,
    "validation_status": "VALIDATED"
  },
  "order_count": 50,
  "superbundle_count": 2
}
```

**Error Codes**:
- `400`: Invalid request (superbundles not ready, amount mismatch)
- `403`: Not authorized (not an SM)
- `404`: SuperBundle not found

---

### 7. SM SuperBundle Deposits: Get Deposit Detail

Get detailed information about a deposit with linked superbundles and orders.

**Endpoint**: `GET /sm-superbundle-deposits/deposit/{depositId}`

**Auth**: SM, Admin, Finance

**Response** (200 OK):
```json
{
  "success": true,
  "deposit": {
    "id": "uuid",
    "deposit_number": "DEP-2024-001",
    "expected_amount": 100000.00,
    "actual_amount_received": 100000.00
  },
  "superbundles": [
    {
      "id": "uuid",
      "expected_amount": 50000.00,
      "asm_superbundle_bundles": [...]
    }
  ],
  "deposit_orders": [...]
}
```

---

## Database Functions

### get_rider_ledger()

Get aggregated ledger for a rider (collected, bundled, unbundled amounts).

**Function**: `get_rider_ledger(p_rider_id TEXT, p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)`

**Returns**: Table with:
- `rider_id`, `rider_name`
- `collected_amount`, `bundled_amount`, `unbundled_amount`
- `bundled_count`, `unbundled_count`
- `date_range_start`, `date_range_end`

**Example**:
```sql
SELECT * FROM get_rider_ledger('RIDER-001', '2024-01-01', '2024-01-31');
```

---

### get_asm_ledger()

Get aggregated ledger for an ASM (bundle counts, superbundle counts, pending amounts).

**Function**: `get_asm_ledger(p_asm_id TEXT, p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)`

**Returns**: Table with:
- `asm_id`, `asm_name`
- `bundles_pending_count`, `bundles_pending_amount`
- `bundles_accepted_count`, `bundles_accepted_amount`
- `bundles_rejected_count`
- `superbundles_pending_count`, `superbundles_pending_amount`
- `superbundles_handedover_count`, `superbundles_handedover_amount`
- `date_range_start`, `date_range_end`

**Example**:
```sql
SELECT * FROM get_asm_ledger('ASM-001', '2024-01-01', '2024-01-31');
```

---

### check_unbundled_sla()

Check for orders that have been unbundled longer than threshold.

**Function**: `check_unbundled_sla(p_rider_id TEXT, p_threshold_minutes INTEGER)`

**Returns**: Table with:
- `order_id`, `order_number`
- `collected_at`, `unbundled_minutes`
- `collected_amount`

**Example**:
```sql
SELECT * FROM check_unbundled_sla('RIDER-001', 60);
```

---

## Bundle Status Flow

```
CREATED → READY_FOR_HANDOVER → HANDEDOVER_TO_ASM → INCLUDED_IN_SUPERBUNDLE
                                    ↓
                                REJECTED
```

## SuperBundle Status Flow

```
CREATED → READY_FOR_HANDOVER → HANDEDOVER_TO_SM → INCLUDED_IN_DEPOSIT
                                    ↓
                                REJECTED
```

## Error Handling

All bundle endpoints return standard error format:

```json
{
  "error": "Error message description"
}
```

Common error scenarios:
- **400 Bad Request**: Invalid input, validation failure
- **401 Unauthorized**: Missing or invalid auth token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

## Rate Limits

Bundle endpoints follow same rate limits as other Edge Functions:
- **1000 requests/minute** per user
- **Burst limit**: 100 requests in 10 seconds


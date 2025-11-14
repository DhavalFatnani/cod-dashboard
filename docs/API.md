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


# Bundle API Documentation

This document describes all bundle-related API endpoints for the Rider Bundles & ASM SuperBundles feature.

## Base URL

All endpoints are served from:
```
https://<your-project>.supabase.co/functions/v1/asm-bundle-actions
```

## Authentication

All endpoints require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Endpoints

### 1. Accept Bundle

Accept a rider bundle that is ready for handover.

**Endpoint:** `POST /:bundle_id/accept`

**Authorization:** ASM role or admin

**Request Body:**
```json
{
  "bundle_id": "bundle-uuid",
  "denomination_breakdown": {
    "2000": 5,
    "500": 10,
    "100": 20
  },
  "action_id": "optional-idempotency-key"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "bundle": {
    "id": "bundle-uuid",
    "bundle_number": "BND-1234567890",
    "status": "HANDEDOVER_TO_ASM",
    "expected_amount": 17000,
    "asm_validated_denomination_breakdown": {
      "2000": 5,
      "500": 10,
      "100": 20
    },
    "asm_validated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Bundle ID mismatch or denomination breakdown doesn't match
- `403 Forbidden`: Bundle doesn't belong to this ASM
- `404 Not Found`: Bundle not found
- `500 Internal Server Error`: Server error

**Idempotency:** Use `action_id` to make requests idempotent. If the same `action_id` is used, the previous result is returned.

---

### 2. Reject Bundle

Reject a rider bundle with a reason.

**Endpoint:** `POST /:bundle_id/reject`

**Authorization:** ASM role or admin

**Request Body:**
```json
{
  "bundle_id": "bundle-uuid",
  "rejection_reason": "Denomination mismatch - received different amounts",
  "action_id": "optional-idempotency-key"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "bundle": {
    "id": "bundle-uuid",
    "status": "REJECTED",
    "rejection_reason": "Denomination mismatch - received different amounts",
    "rejected_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Missing rejection reason or bundle in wrong status
- `403 Forbidden`: Bundle doesn't belong to this ASM
- `404 Not Found`: Bundle not found

---

### 3. Request Justification

Request justification from rider for an unbundled order.

**Endpoint:** `POST /:order_id/request-justification`

**Authorization:** ASM role or admin

**Request Body:**
```json
{
  "order_id": "order-uuid",
  "justification_request_reason": "Order has been unbundled for more than 60 minutes"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "justification_request": {
    "order_id": "order-uuid",
    "requested_by": "user-uuid",
    "requested_at": "2024-01-15T10:30:00Z",
    "reason": "Order has been unbundled for more than 60 minutes",
    "status": "PENDING"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Order is already bundled or in wrong state
- `403 Forbidden`: Order doesn't belong to this ASM
- `404 Not Found`: Order not found

---

### 4. Create SuperBundle

Create a superbundle from multiple accepted bundles.

**Endpoint:** `POST /superbundles`

**Authorization:** ASM role or admin

**Request Body:**
```json
{
  "bundle_ids": [
    "bundle-uuid-1",
    "bundle-uuid-2",
    "bundle-uuid-3"
  ],
  "denomination_breakdown": {
    "2000": 15,
    "500": 30,
    "100": 60
  },
  "asm_id": "asm-123",
  "action_id": "optional-idempotency-key"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "superbundle": {
    "id": "superbundle-uuid",
    "superbundle_number": "SB-1234567890",
    "asm_id": "asm-123",
    "expected_amount": 51000,
    "denomination_breakdown": {
      "2000": 15,
      "500": 30,
      "100": 60
    },
    "status": "CREATED",
    "asm_superbundle_bundles": [
      {
        "bundle_id": "bundle-uuid-1"
      },
      {
        "bundle_id": "bundle-uuid-2"
      },
      {
        "bundle_id": "bundle-uuid-3"
      }
    ]
  }
}
```

**Error Responses:**

- `400 Bad Request`: 
  - Missing bundle_ids or denomination breakdown
  - Bundles not in HANDEDOVER_TO_ASM status
  - Bundles belong to different ASMs
  - Denomination breakdown doesn't match expected amount
- `404 Not Found`: One or more bundles not found

**Validation Rules:**

1. All bundles must be in `HANDEDOVER_TO_ASM` status
2. All bundles must belong to the same ASM
3. Denomination breakdown total must match sum of bundle expected amounts (within 0.01 tolerance)
4. Each bundle can only be included in one superbundle

---

## SM Deposit Endpoint (Enhanced)

The existing deposit endpoint has been enhanced to support superbundles.

**Endpoint:** `POST /functions/v1/asm-deposit`

**Request Body (New Flow with SuperBundles):**
```json
{
  "asm_id": "asm-123",
  "asm_name": "ASM Name",
  "superbundle_ids": [
    "superbundle-uuid-1",
    "superbundle-uuid-2"
  ],
  "total_amount": 100000,
  "expected_amount": 100000,
  "actual_amount_received": 100000,
  "deposit_slip_url": "https://storage.supabase.co/...",
  "deposit_date": "2024-01-15",
  "bank_account": "Account Number",
  "reference_number": "REF-123456",
  "sm_user_id": "sm-user-uuid",
  "sm_name": "SM Name"
}
```

**Request Body (Legacy Flow with Order IDs):**
```json
{
  "asm_id": "asm-123",
  "order_ids": [
    "order-uuid-1",
    "order-uuid-2"
  ],
  "total_amount": 50000,
  "deposit_date": "2024-01-15"
}
```

**Note:** You cannot use both `order_ids` and `superbundle_ids` in the same request.

**Response (201 Created):**
```json
{
  "success": true,
  "deposit": {
    "id": "deposit-uuid",
    "deposit_number": "DEP-1234567890",
    "asm_id": "asm-123",
    "total_amount": 100000,
    "status": "PENDING_RECONCILIATION",
    "validation_status": "VALIDATED"
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input or validation failure |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error - Server error |

## Rate Limits

- Default rate limit: 100 requests per minute per user
- Burst limit: 20 requests per second

## Idempotency

All mutation endpoints support idempotency via the `action_id` parameter:

- If the same `action_id` is provided for the same resource, the previous result is returned
- `action_id` should be unique per action (e.g., UUID or timestamp-based)
- Idempotency is checked within a 24-hour window

## Examples

### Example: Accept Bundle

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/asm-bundle-actions/bundle-123/accept \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bundle_id": "bundle-123",
    "denomination_breakdown": {
      "2000": 5,
      "500": 10,
      "100": 20
    }
  }'
```

### Example: Create SuperBundle

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/asm-bundle-actions/superbundles \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bundle_ids": ["bundle-1", "bundle-2", "bundle-3"],
    "denomination_breakdown": {
      "2000": 15,
      "500": 30
    },
    "asm_id": "asm-123"
  }'
```

## Support

For issues or questions, contact the development team or refer to the main API documentation.

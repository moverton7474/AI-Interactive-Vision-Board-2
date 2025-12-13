# Admin Edge Functions - API Reference

> **Version**: 1.0
> **Last Updated**: 2025-12-13
> **Security Level**: Platform Admin Only

This document describes the Admin Edge Functions available for the Visionary AI Admin Control Center.

---

## Overview

All admin functions:
- Require `platform_admin` role (some allow `support_agent` for read-only operations)
- Log all mutations to `audit_logs` table
- Return structured JSON responses
- Use the existing RBAC infrastructure from `_shared/authz.ts`

### Base URL

```
https://<project-ref>.supabase.co/functions/v1/
```

### Authentication

All requests must include the Authorization header:
```
Authorization: Bearer <user-jwt-token>
```

---

## User Management

### admin-list-users

**Method:** `GET`

List and search users with filtering and pagination.

**Allowed Roles:** `platform_admin`, `support_agent`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by email or name (partial match) |
| `tier` | string | Filter by subscription tier (free, pro, elite) |
| `status` | string | Filter by account status (active, locked) |
| `stripe_customer_id` | string | Filter by Stripe customer ID |
| `date_from` | ISO date | Filter by created_at start date |
| `date_to` | ISO date | Filter by created_at end date |
| `sort_by` | string | Field to sort by (created_at, email, names) |
| `sort_order` | string | asc or desc (default: desc) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50, max: 200) |

**Example:**
```bash
curl -X GET \
  'https://<ref>.supabase.co/functions/v1/admin-list-users?search=john&tier=pro&page=1' \
  -H 'Authorization: Bearer <token>'
```

---

### admin-get-user-detail

**Method:** `GET`

Get detailed user profile including subscription, teams, and stats.

**Allowed Roles:** `platform_admin`, `support_agent`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | UUID | Yes | User ID to retrieve |

**Response includes:**
- Profile information
- Platform role (if any)
- Team memberships
- Usage stats (vision boards, habits, print orders)
- AMIE profile summary
- Recent activity

**Example:**
```bash
curl -X GET \
  'https://<ref>.supabase.co/functions/v1/admin-get-user-detail?user_id=<uuid>' \
  -H 'Authorization: Bearer <token>'
```

---

### admin-update-user

**Method:** `POST`

Update user properties (credits, lock status, flags).

**Allowed Roles:** `platform_admin`

**Request Body:**
```json
{
  "user_id": "uuid",
  "credits": 100,
  "credits_delta": 50,
  "is_locked": true,
  "locked_reason": "Terms of service violation",
  "is_beta_user": true,
  "is_early_access": true,
  "admin_notes": "Note about this user"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | UUID | Required. User to update |
| `credits` | number | Set credits to exact value |
| `credits_delta` | number | Add/subtract from credits |
| `is_locked` | boolean | Lock or unlock account |
| `locked_reason` | string | Required when locking |
| `is_beta_user` | boolean | Beta user flag |
| `is_early_access` | boolean | Early access flag |
| `admin_notes` | string | Admin notes |

---

## Team Management

### admin-list-teams

**Method:** `GET`

List and search teams with filtering and pagination.

**Allowed Roles:** `platform_admin`, `support_agent`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by team name |
| `owner_id` | UUID | Filter by owner |
| `min_members` | number | Minimum member count |
| `max_members` | number | Maximum member count |
| `date_from` | ISO date | Filter by created_at start |
| `date_to` | ISO date | Filter by created_at end |
| `page` | number | Page number |
| `limit` | number | Items per page |

---

### admin-get-team-detail

**Method:** `GET`

Get detailed team information including members and stats.

**Allowed Roles:** `platform_admin`, `support_agent`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `team_id` | UUID | Yes | Team ID to retrieve |

---

### admin-update-team

**Method:** `POST`

Update team properties.

**Allowed Roles:** `platform_admin`

**Request Body:**
```json
{
  "team_id": "uuid",
  "name": "New Team Name",
  "description": "Description",
  "owner_id": "new-owner-uuid",
  "plan": "enterprise",
  "is_enterprise": true,
  "trial_ends_at": "2025-01-31T00:00:00Z"
}
```

---

### admin-manage-team-membership

**Method:** `POST`

Add, remove, or change roles of team members.

**Allowed Roles:** `platform_admin`

**Request Body:**
```json
{
  "team_id": "uuid",
  "action": "add|remove|change_role",
  "user_id": "uuid",
  "role": "owner|admin|manager|member|viewer"
}
```

| Action | Description |
|--------|-------------|
| `add` | Add user to team with specified role |
| `remove` | Remove user from team (soft delete) |
| `change_role` | Change user's role in team |

---

## Print Orders

### admin-list-print-orders

**Method:** `GET`

List print orders with filtering.

**Allowed Roles:** `platform_admin`, `support_agent`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | UUID | Filter by user |
| `team_id` | UUID | Filter by team |
| `status` | string | Filter by status |
| `product_type` | string | Filter by product type |
| `date_from` | ISO date | Start date |
| `date_to` | ISO date | End date |

---

### admin-get-print-order-detail

**Method:** `GET`

Get detailed print order information.

**Allowed Roles:** `platform_admin`, `support_agent`

**Query Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| `order_id` | UUID | Yes |

---

### admin-update-print-order-status

**Method:** `POST`

Update print order status.

**Allowed Roles:** `platform_admin`

**Request Body:**
```json
{
  "order_id": "uuid",
  "status": "reprinted|refunded|cancelled|shipped",
  "tracking_number": "TRACK123",
  "admin_notes": "Note about status change",
  "reason": "Required for refund/cancel"
}
```

**Valid Statuses:**
- `pending`, `processing`, `production`, `shipped`, `delivered`
- `reprinted`, `refunded`, `cancelled`, `on_hold`

> **Note:** Marking as "refunded" only updates the order record. Process the actual refund in Stripe separately.

---

## Impersonation

### admin-start-impersonation

**Method:** `POST`

Start an impersonation session to view the app as a user.

**Allowed Roles:** `platform_admin` only

**Request Body:**
```json
{
  "target_user_id": "uuid",
  "reason": "Support ticket #12345",
  "duration_minutes": 60
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target_user_id` | UUID | Yes | User to impersonate |
| `reason` | string | Recommended | Audit trail reason |
| `duration_minutes` | number | No | Session duration (default: 60, max: 240) |

**Response:**
```json
{
  "success": true,
  "data": {
    "impersonation": {
      "sessionId": "uuid",
      "sessionToken": "token-to-use-in-header",
      "targetUser": { "id": "...", "name": "...", "email": "..." },
      "expiresAt": "2025-12-13T12:00:00Z"
    }
  }
}
```

**Using the Session:**
Include the session token in subsequent requests:
```
X-Impersonation-Token: <session_token>
```

---

### admin-stop-impersonation

**Method:** `POST`

End an active impersonation session.

**Allowed Roles:** `platform_admin`

**Request Body:**
```json
{
  "session_token": "token-from-start-response",
  "reason": "Support complete"
}
```

---

## Subscription Management

### admin-sync-stripe-subscription

**Method:** `POST`

Sync subscription status from Stripe to the local database.

**Allowed Roles:** `platform_admin`

**Request Body:**
```json
{
  "user_id": "uuid",
  "stripe_customer_id": "cus_xxx (optional)"
}
```

Use this when:
- Webhooks have failed
- Data is out of sync
- Troubleshooting subscription issues

---

### admin-override-subscription-tier

**Method:** `POST`

Manually override a user's subscription tier.

**Allowed Roles:** `platform_admin`

**Request Body:**
```json
{
  "user_id": "uuid",
  "tier": "ELITE",
  "reason": "Compensation for billing issue",
  "expires_at": "2025-01-31T00:00:00Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | UUID | Yes | User to override |
| `tier` | string | Yes | FREE, PRO, ELITE, or TEAM |
| `reason` | string | Yes | Audit reason (min 5 chars) |
| `expires_at` | ISO date | No | Optional expiration for temporary overrides |

---

## Response Format

All responses follow this structure:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "hasMore": true
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHENTICATED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | User lacks required role |
| `NOT_FOUND` | 404 | Resource not found |
| `MISSING_PARAM` | 400 | Required parameter missing |
| `INVALID_PARAM` | 400 | Parameter validation failed |
| `NO_UPDATES` | 400 | No valid update fields provided |
| `CONFLICT` | 409 | Operation conflicts with current state |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Security Notes

1. **All mutations are logged** to the `audit_logs` table with:
   - Actor user ID and platform role
   - Action type
   - Target table and ID
   - Old and new values
   - Timestamp

2. **Sensitive data is NEVER exposed:**
   - Plaid access tokens
   - Stripe secrets
   - API keys
   - Gemini keys

3. **Impersonation sessions:**
   - Are time-limited
   - Create full audit trail
   - Cannot be used to impersonate other admins
   - Cannot access raw secrets

---

## Setup Instructions

### 1. Run SQL Migrations

Execute in order:
```sql
-- In Supabase SQL Editor
\i supabase/sql/05_admin_impersonation.sql
```

### 2. Seed First Platform Admin

Edit `supabase/sql/06_seed_platform_admin.sql`:
- Replace `ADMIN_EMAIL_PLACEHOLDER` with the actual admin email
- Run the script in SQL Editor

### 3. Deploy Functions

```bash
supabase functions deploy admin-list-users
supabase functions deploy admin-get-user-detail
supabase functions deploy admin-update-user
# ... deploy all admin-* functions
```

### 4. Set Environment Variables

Ensure these are set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (for subscription functions)

---

## Changelog

### v1.0 (2025-12-13)
- Initial release of Admin Control Center backend
- User management functions
- Team management functions
- Print order support functions
- Impersonation system
- Subscription management functions

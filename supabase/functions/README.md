
# Supabase Edge Functions

This folder contains the backend logic for Visionary SaaS.

## Deployment Instructions

1.  **Install CLI:** `npm install -g supabase`
2.  **Login:** `supabase login`
3.  **Link Project:** `supabase link --project-ref <your-project-id>`
4.  **Set Secrets:**
    ```bash
    supabase secrets set PLAID_CLIENT_ID=your_client_id
    supabase secrets set PLAID_SECRET=your_secret
    supabase secrets set PLAID_ENV=sandbox
    ```
5.  **Deploy Functions:**
    ```bash
    supabase functions deploy create-link-token
    supabase functions deploy exchange-public-token
    ```

## Functions

*   `create-link-token`: Generating a temporary token for the frontend Plaid Widget.
*   `exchange-public-token`: Swapping the temporary token for a permanent access token and storing it in the database.

---

## Moving Plaid to Production

### Prerequisites

1. **Plaid Dashboard Account**: [https://dashboard.plaid.com](https://dashboard.plaid.com)
2. **Production Access**: Apply for production access in Plaid Dashboard (requires company verification)
3. **Production Credentials**: Obtain production `client_id` and `secret` from Plaid

### Environment Configuration

| Environment | Use Case | API URL |
|-------------|----------|---------|
| `sandbox` | Development/Testing (fake bank data) | `https://sandbox.plaid.com` |
| `development` | Testing with real banks (limited) | `https://development.plaid.com` |
| `production` | Live production use | `https://production.plaid.com` |

### Steps to Go Live

1. **Update Supabase Secrets for Production:**
   ```bash
   supabase secrets set PLAID_CLIENT_ID=your_production_client_id
   supabase secrets set PLAID_SECRET=your_production_secret
   supabase secrets set PLAID_ENV=production
   ```

2. **Redeploy Edge Functions:**
   ```bash
   supabase functions deploy create-link-token
   supabase functions deploy exchange-public-token
   ```

3. **Security Checklist for Production:**
   - [ ] Access tokens should be encrypted before storing in database
   - [ ] Implement proper error logging (avoid logging sensitive data)
   - [ ] Set up Plaid webhooks for real-time updates
   - [ ] Configure rate limiting on Edge Functions
   - [ ] Review RLS policies on `plaid_items` table

### Troubleshooting

**CORS Errors:** Ensure Edge Functions are deployed and secrets are set correctly.

**"Backend not ready" message:** The Edge Function is not responding. Check:
- Function deployment status: `supabase functions list`
- Secrets are configured: `supabase secrets list`
- Function logs: `supabase functions logs create-link-token`

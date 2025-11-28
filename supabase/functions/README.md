
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
    supabase functions deploy submit-to-prodigi
    supabase functions deploy create-checkout-session
    supabase functions deploy stripe-webhook
    ```

## Functions

*   `create-link-token`: Generating a temporary token for the frontend Plaid Widget.
*   `exchange-public-token`: Swapping the temporary token for a permanent access token and storing it in the database.
*   `submit-to-prodigi`: Submits print orders to Prodigi Print-on-Demand API. Requires `PRODIGI_API_KEY` secret.
*   `create-checkout-session`: Creates Stripe checkout sessions for payments.
*   `stripe-webhook`: Handles Stripe webhook events for payment confirmation.

## Required Secrets

Set these secrets for full functionality:

```bash
# Plaid (Financial Services)
supabase secrets set PLAID_CLIENT_ID=your_client_id
supabase secrets set PLAID_SECRET=your_secret
supabase secrets set PLAID_ENV=sandbox

# Prodigi Print-on-Demand
supabase secrets set PRODIGI_API_KEY=your_prodigi_api_key
supabase secrets set PRODIGI_SANDBOX=true  # Set to 'false' for production

# Stripe Payments
supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
supabase secrets set STRIPE_WEBHOOK_SECRET=your_webhook_secret
```

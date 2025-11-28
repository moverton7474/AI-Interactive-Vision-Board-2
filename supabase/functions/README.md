
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

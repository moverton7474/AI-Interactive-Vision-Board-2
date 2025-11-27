# Supabase Edge Functions - Deployment Guide

## Prerequisites

1. **Install Supabase CLI**
   ```bash
   # macOS
   brew install supabase/tap/supabase

   # Windows (Scoop)
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase

   # npm (all platforms)
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link to your project**
   ```bash
   supabase link --project-ref edaigbnnofyxcfbpcvct
   ```

## Deploying the Edge Function

### Method 1: Deploy via CLI (Recommended)

```bash
# From the project root directory
cd /path/to/AI-Interactive-Vision-Board-

# Deploy the function
supabase functions deploy submit-to-prodigi --project-ref edaigbnnofyxcfbpcvct
```

### Method 2: Deploy via Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/edaigbnnofyxcfbpcvct/functions)
2. Click "New Function"
3. Name it `submit-to-prodigi`
4. Paste the contents of `supabase/functions/submit-to-prodigi/index.ts`

## Setting Secrets

The Edge Function requires the `PRODIGI_API_KEY` secret to be set.

### Via CLI:
```bash
supabase secrets set PRODIGI_API_KEY=your-prodigi-api-key-here --project-ref edaigbnnofyxcfbpcvct
```

### Via Dashboard:
1. Go to [Edge Functions > Secrets](https://supabase.com/dashboard/project/edaigbnnofyxcfbpcvct/settings/functions)
2. Add a new secret:
   - Name: `PRODIGI_API_KEY`
   - Value: Your Prodigi API key

## Testing the Function

### Local Testing:
```bash
# Start local Supabase
supabase start

# Serve the function locally
supabase functions serve submit-to-prodigi --env-file .env.local
```

### Test via cURL:
```bash
curl -X POST 'https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/submit-to-prodigi' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "orderId": "test-123",
    "recipient": {
      "name": "Test User",
      "address": {
        "line1": "123 Test St",
        "townOrCity": "Test City",
        "stateOrCounty": "TS",
        "postalOrZipCode": "12345",
        "countryCode": "US"
      }
    },
    "items": [{
      "sku": "GLOBAL-CAN-18X24",
      "copies": 1,
      "sizing": "fillPrintArea",
      "assets": [{
        "url": "https://example.com/test-image.png",
        "printArea": "default"
      }]
    }]
  }'
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRODIGI_API_KEY` | Yes | Your Prodigi API key (production or sandbox) |
| `PRODIGI_USE_SANDBOX` | No | Set to `true` to force sandbox mode |
| `SUPABASE_URL` | Auto | Automatically provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Automatically provided by Supabase |

## Sandbox vs Production

- **Sandbox API Keys**: Use for testing (no real orders created)
- **Production API Keys**: Use for live orders (charges apply)

The function automatically detects sandbox keys if they contain "sandbox" in the key.
To force sandbox mode, set `PRODIGI_USE_SANDBOX=true` in your secrets.

## Troubleshooting

### "Edge Function Failed" Error
1. Check the function logs in Supabase Dashboard
2. Verify `PRODIGI_API_KEY` is set correctly
3. Ensure the image URL is publicly accessible

### "API Key Missing" Error
Run: `supabase secrets list` to verify the key is set.

### CORS Issues
The function includes CORS headers. If you still see issues, check:
- Browser extensions (ad blockers can block requests)
- Network tab for actual error messages

## Function Flow

```
Frontend (printService.ts)
    │
    ▼
supabase.functions.invoke('submit-to-prodigi')
    │
    ▼
Edge Function (index.ts)
    │
    ├─► Validates payload
    │
    ├─► Calls Prodigi API
    │
    ├─► Updates database (backup)
    │
    ▼
Returns { success: true, orderId: "PROD-xxx" }
    │
    ▼
Frontend updates order status
```

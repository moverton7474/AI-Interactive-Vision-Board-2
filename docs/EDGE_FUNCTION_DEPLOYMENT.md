# Edge Function Deployment Guide

This guide explains how to deploy Supabase Edge Functions to fix CORS errors and enable backend functionality.

---

## The Problem

The CORS errors you're seeing indicate that the Edge Functions haven't been deployed to Supabase. The frontend is trying to call functions that don't exist on your Supabase project yet.

```
Access to fetch at 'https://edaigbnnofyxcfbpcv...' from origin 'https://ai-interactive-vis...'
has been blocked by CORS policy
```

---

## Solution: Deploy Edge Functions

### Option 1: Deploy via Supabase CLI (Recommended)

**Step 1: Install Supabase CLI**
```bash
npm install -g supabase
```

**Step 2: Login to Supabase**
```bash
supabase login
```
This opens a browser to authenticate.

**Step 3: Link Your Project**
```bash
cd /path/to/AI-Interactive-Vision-Board-2
supabase link --project-ref edaigbnnofyxcfbpcvct
```

**Step 4: Deploy All Functions**
```bash
supabase functions deploy
```

Or deploy specific functions:
```bash
supabase functions deploy knowledge-ingest
supabase functions deploy onboarding-themes
supabase functions deploy agent-chat
supabase functions deploy habit-service
```

**Step 5: Set Required Secrets**
```bash
supabase secrets set GEMINI_API_KEY=your_gemini_api_key
supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
supabase secrets set STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

---

### Option 2: Deploy via Supabase Dashboard

**Step 1: Go to Edge Functions**
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Edge Functions** in the sidebar

**Step 2: Create Functions Manually**
For each function in `supabase/functions/`, create a new function:
1. Click **New Function**
2. Enter the function name (e.g., `knowledge-ingest`)
3. Paste the code from the corresponding `index.ts` file
4. Click **Deploy**

**Step 3: Set Secrets**
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add each required secret

---

## Required Edge Functions

| Function | Purpose | Required Secrets |
|----------|---------|------------------|
| `agent-chat` | AI chat conversations | `GEMINI_API_KEY` |
| `amie-prompt-builder` | Build personalized prompts | - |
| `compile-knowledge-base` | Compile user knowledge | - |
| `create-checkout-session` | Stripe checkout | `STRIPE_SECRET_KEY` |
| `gemini-proxy` | AI image generation | `GEMINI_API_KEY` |
| `generate-weekly-review` | Weekly summaries | `GEMINI_API_KEY` |
| `habit-service` | Habit CRUD operations | - |
| `knowledge-ingest` | Document processing | - |
| `onboarding-themes` | AMIE themes & questions | - |
| `partner-collaboration` | Partner features | - |
| `print-products` | Print catalog | - |
| `send-sms` | SMS notifications | `TWILIO_*` |
| `slack-bot` | Slack integration | `SLACK_*` |
| `stripe-webhook` | Payment webhooks | `STRIPE_WEBHOOK_SECRET` |
| `teams-bot` | Teams integration | `TEAMS_*` |
| `voice-coach-session` | Voice coaching | `GEMINI_API_KEY` |

---

## Required Secrets

| Secret | Description | How to Get |
|--------|-------------|------------|
| `GEMINI_API_KEY` | Google AI API key | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `STRIPE_SECRET_KEY` | Stripe API secret | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Stripe Webhooks section |
| `TWILIO_ACCOUNT_SID` | Twilio account ID | [Twilio Console](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Twilio Console |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | Twilio Console |
| `SLACK_CLIENT_ID` | Slack app client ID | [Slack API](https://api.slack.com/apps) |
| `SLACK_CLIENT_SECRET` | Slack app secret | Slack API |
| `SLACK_SIGNING_SECRET` | Slack signing secret | Slack API |
| `TEAMS_APP_ID` | Azure AD app ID | [Azure Portal](https://portal.azure.com) |
| `TEAMS_APP_SECRET` | Azure AD client secret | Azure Portal |
| `PRODIGI_API_KEY` | Prodigi print API | [Prodigi Dashboard](https://dashboard.prodigi.com) |

---

## Verification

After deployment, test the functions:

**Via cURL:**
```bash
curl -X OPTIONS https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/knowledge-ingest \
  -H "Origin: https://ai-interactive-vision-board-2.vercel.app" \
  -v
```

Should return status 200 with CORS headers.

**Via Dashboard:**
1. Go to Edge Functions
2. Click on a function
3. Check **Logs** tab for invocations

---

## Troubleshooting

### "Failed to send a request to the Edge Function"
- Function not deployed → Deploy the function
- Missing secrets → Add required secrets
- Function error → Check logs in Supabase Dashboard

### CORS Errors Persist
- Clear browser cache
- Check function logs for errors
- Verify function is deployed (shows in Dashboard)

### "Slack integration is not configured"
- This is expected if you haven't set up a Slack app
- The app works without Slack integration
- To fix: Create Slack app and set secrets

---

## Quick Deploy Script

Save and run this script to deploy all functions:

```bash
#!/bin/bash
# deploy-functions.sh

cd /path/to/AI-Interactive-Vision-Board-2

# Login if needed
supabase login

# Link project
supabase link --project-ref edaigbnnofyxcfbpcvct

# Deploy all functions
for dir in supabase/functions/*/; do
  name=$(basename "$dir")
  if [ "$name" != "_shared" ]; then
    echo "Deploying $name..."
    supabase functions deploy "$name"
  fi
done

echo "All functions deployed!"
```

---

## After Deployment

1. Refresh your app at https://ai-interactive-vision-board-2.vercel.app
2. The CORS errors should be resolved
3. Test Knowledge Base, Coach, and other features
4. Check Supabase Dashboard logs if issues persist

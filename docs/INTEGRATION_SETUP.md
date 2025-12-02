# Integration Setup Guide

This guide covers setting up third-party integrations for Visionary AI, including Slack, Microsoft Teams, and Stripe.

---

## Table of Contents

1. [Slack Bot Integration](#slack-bot-integration)
2. [Microsoft Teams Bot Integration](#microsoft-teams-bot-integration)
3. [Stripe Payment Integration](#stripe-payment-integration)
4. [Supabase Secrets Management](#supabase-secrets-management)

---

## Slack Bot Integration

### Step 1: Create a Slack App

1. Go to [Slack API Portal](https://api.slack.com/apps)
2. Click **Create New App**
3. Choose **From scratch**
4. Enter App Name: `Visionary AI`
5. Select your workspace
6. Click **Create App**

### Step 2: Configure OAuth & Permissions

1. In your app settings, go to **OAuth & Permissions**
2. Add the following **Bot Token Scopes**:
   - `chat:write` - Send messages
   - `commands` - Add slash commands
   - `users:read` - Read user info
   - `users:read.email` - Read user email

3. Under **Redirect URLs**, add:
   ```
   https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/slack-bot/oauth/callback
   ```

### Step 3: Enable Interactive Components

1. Go to **Interactivity & Shortcuts**
2. Toggle **Interactivity** to ON
3. Set Request URL to:
   ```
   https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/slack-bot/interactions
   ```

### Step 4: Add Slash Commands (Optional)

1. Go to **Slash Commands**
2. Click **Create New Command**
3. Add these commands:
   - `/habits` - View and complete habits
   - `/goals` - View goal progress
   - `/vision` - Get a motivational vision reminder

### Step 5: Get Your Credentials

From **Basic Information**, copy:
- **Client ID**
- **Client Secret**
- **Signing Secret**

### Step 6: Set Supabase Secrets

```bash
supabase secrets set SLACK_CLIENT_ID=xoxb-your-client-id
supabase secrets set SLACK_CLIENT_SECRET=your-client-secret
supabase secrets set SLACK_SIGNING_SECRET=your-signing-secret
```

Or via Supabase Dashboard:
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add each secret with its value

---

## Microsoft Teams Bot Integration

### Step 1: Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Enter:
   - Name: `Visionary AI Bot`
   - Supported account types: **Multitenant**
5. Click **Register**

### Step 2: Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Add these **Delegated permissions**:
   - `User.Read`
   - `offline_access`
   - `openid`
   - `profile`

### Step 3: Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Add description: `Visionary AI Production`
4. Select expiration (recommended: 24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the secret value immediately (it won't be shown again)

### Step 4: Configure Authentication

1. Go to **Authentication**
2. Add **Platform** → **Web**
3. Add Redirect URI:
   ```
   https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/teams-bot/auth/callback
   ```
4. Enable **ID tokens** under Implicit grant

### Step 5: Create Teams App Package

1. Go to [Teams Developer Portal](https://dev.teams.microsoft.com/)
2. Create new app with matching App ID
3. Configure bot messaging endpoint:
   ```
   https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/teams-bot/messages
   ```

### Step 6: Get Your Credentials

From Azure Portal, copy:
- **Application (client) ID**
- **Client secret** (from step 3)

### Step 7: Set Supabase Secrets

```bash
supabase secrets set TEAMS_APP_ID=your-application-client-id
supabase secrets set TEAMS_APP_SECRET=your-client-secret
```

---

## Stripe Payment Integration

### Step 1: Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Complete account verification

### Step 2: Get API Keys

1. Go to **Developers** → **API keys**
2. Copy:
   - **Publishable key** (for frontend)
   - **Secret key** (for backend)

### Step 3: Create Webhook Endpoint

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter URL:
   ```
   https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/stripe-webhook
   ```
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

5. Click **Add endpoint**
6. Copy the **Webhook signing secret**

### Step 4: Create Products & Prices

1. Go to **Products**
2. Create products for:
   - Monthly subscription
   - Annual subscription
   - Print products (workbooks, pads, etc.)

### Step 5: Set Supabase Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_your-secret-key
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

For frontend, add to `.env`:
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your-publishable-key
```

---

## Supabase Secrets Management

### Option 1: Via CLI

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref edaigbnnofyxcfbpcvct

# Set secrets
supabase secrets set KEY_NAME=value

# List all secrets
supabase secrets list
```

### Option 2: Via Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
4. Click **Add new secret**
5. Enter key name and value
6. Click **Save**

### Required Secrets Summary

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `SLACK_CLIENT_ID` | Slack OAuth Client ID | Slack Bot |
| `SLACK_CLIENT_SECRET` | Slack OAuth Client Secret | Slack Bot |
| `SLACK_SIGNING_SECRET` | Slack Request Signing | Slack Bot |
| `TEAMS_APP_ID` | Azure AD Application ID | Teams Bot |
| `TEAMS_APP_SECRET` | Azure AD Client Secret | Teams Bot |
| `STRIPE_SECRET_KEY` | Stripe API Secret Key | Payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Signing | Payments |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | SMS/Voice |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | SMS/Voice |
| `TWILIO_PHONE_NUMBER` | Twilio Phone Number | SMS/Voice |
| `GEMINI_API_KEY` | Google AI API Key | AI Features |
| `PRODIGI_API_KEY` | Prodigi Print API Key | Print Products |

---

## Verification Steps

### Test Slack Integration

1. Install the app to your workspace
2. Send a DM to the bot
3. Check for welcome message response

### Test Teams Integration

1. Install the app in Teams
2. Send a message to the bot
3. Verify response

### Test Stripe Integration

1. Use Stripe test mode first
2. Create a test checkout session
3. Complete with test card: `4242 4242 4242 4242`
4. Verify webhook events in Stripe Dashboard

---

## Troubleshooting

### Common Issues

**Slack: "invalid_client_id"**
- Verify SLACK_CLIENT_ID is set correctly
- Ensure no extra whitespace in the value

**Teams: "AADSTS50011: Reply URL does not match"**
- Check redirect URI matches exactly in Azure Portal
- Include trailing slashes if configured

**Stripe: "No signatures found matching"**
- Webhook secret may be incorrect
- Ensure you're using the correct endpoint secret (not API secret)

### Checking Edge Function Logs

```bash
supabase functions logs slack-bot --tail
supabase functions logs teams-bot --tail
supabase functions logs stripe-webhook --tail
```

Or via Dashboard:
1. Go to **Edge Functions**
2. Select the function
3. Click **Logs** tab

---

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment-specific secrets** (dev, staging, prod)
3. **Rotate secrets regularly** (every 6-12 months)
4. **Use Stripe test mode** for development
5. **Enable webhook signature verification** for all integrations
6. **Monitor Edge Function logs** for suspicious activity

---

## Next Steps

After setting up integrations:

1. Test each integration in development
2. Configure production credentials
3. Set up monitoring and alerting
4. Document any custom configurations
5. Train team on integration usage


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
5.  **Deploy All Functions:**
    ```bash
    supabase functions deploy
    ```

---

## Functions Overview

### Financial Services
| Function | Purpose |
|----------|---------|
| `create-link-token` | Generate temporary token for Plaid widget |
| `exchange-public-token` | Swap temp token for permanent Plaid access token |

### AI & Agent Services
| Function | Purpose |
|----------|---------|
| `agent-chat` | AI agent conversation handler |
| `gemini-proxy` | Proxy for Gemini API calls |
| `amie-prompt-builder` | Build prompts for AMIE AI coach |
| `compile-knowledge-base` | Aggregate user data for AI context |
| `voice-coach-session` | Voice-based coaching sessions |

### Habit & Progress
| Function | Purpose |
|----------|---------|
| `habit-service` | CRUD operations for habits |
| `generate-weekly-review` | Generate weekly progress summaries |
| `schedule-notification` | Schedule and process habit reminders |

### Communication
| Function | Purpose |
|----------|---------|
| `send-sms` | Send SMS notifications via Twilio |
| `make-call` | Initiate voice calls via Twilio |

### Apple Watch (New)
| Function | Purpose |
|----------|---------|
| `watch-sync` | Sync habits and completions with Watch app |
| `watch-notifications` | Send APNs push notifications to Watch |

### Print & Products
| Function | Purpose |
|----------|---------|
| `print-products` | Print product catalog |
| `generate-workbook-pdf` | Generate Vision Workbook PDFs |
| `submit-to-prodigi` | Submit print orders to Prodigi |

### Payments
| Function | Purpose |
|----------|---------|
| `create-checkout-session` | Create Stripe checkout sessions |
| `stripe-webhook` | Handle Stripe webhook events |

### Integrations
| Function | Purpose |
|----------|---------|
| `slack-bot` | Slack workspace integration |
| `teams-bot` | Microsoft Teams integration |
| `partner-collaboration` | Partner account features |
| `knowledge-ingest` | Ingest documents for RAG |
| `onboarding-themes` | Onboarding customization |

---

## Apple Watch Setup

### Required Secrets for APNs

```bash
supabase secrets set APNS_KEY_ID=your_key_id
supabase secrets set APNS_TEAM_ID=your_team_id
supabase secrets set APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
supabase secrets set APNS_BUNDLE_ID=com.visionary.app
supabase secrets set APNS_ENVIRONMENT=development  # or 'production'
```

### watch-sync Actions

| Action | Description |
|--------|-------------|
| `get_habits` | Get active habits with today's completion status |
| `complete_habit` | Log a habit completion from Watch |
| `uncomplete_habit` | Undo a habit completion |
| `get_stats` | Get habit statistics (streaks, counts) |
| `register_device` | Register Watch device token for push |
| `get_coach_prompt` | Get micro-coaching message |

### watch-notifications Actions

| Action | Description |
|--------|-------------|
| `send` | Send to specific device token |
| `send_to_user` | Send to all user's devices |
| `send_habit_reminder` | Send habit reminder notification |
| `send_streak_celebration` | Send streak milestone celebration |
| `send_coach_message` | Send coach tip notification |
| `batch_send` | Send multiple notifications |

---

## Plaid Configuration

| Environment | Use Case | API URL |
|-------------|----------|---------|
| `sandbox` | Development/Testing (fake bank data) | `https://sandbox.plaid.com` |
| `development` | Testing with real banks (limited) | `https://development.plaid.com` |
| `production` | Live production use | `https://production.plaid.com` |

### Production Checklist

- [ ] Access tokens encrypted in database
- [ ] Error logging configured (no sensitive data)
- [ ] Plaid webhooks set up
- [ ] Rate limiting enabled
- [ ] RLS policies reviewed

---

## Troubleshooting

**CORS Errors:** Ensure Edge Functions are deployed and secrets are set correctly.

**"Backend not ready" message:** Check:
- Function deployment status: `supabase functions list`
- Secrets are configured: `supabase secrets list`
- Function logs: `supabase functions logs <function-name>`

**APNs Not Working:**
- Verify all APNS_* secrets are set
- Check APNs key hasn't expired (keys expire after 1 year)
- Confirm device token is valid
- Check logs: `supabase functions logs watch-notifications`

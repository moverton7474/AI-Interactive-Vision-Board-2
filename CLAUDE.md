# Visionary AI - Project Guidelines

## Project Overview
Visionary AI is an agentic success platform SPA combining a React frontend with Supabase serverless backend. It uses Google Gemini AI for personalized coaching, image generation, and voice interaction.

## Tech Stack
- **Frontend:** React 18 + TypeScript (Strict) + Vite
- **Styling:** Tailwind CSS v3 (CDN) + custom CSS
- **State:** React Hooks & Context API
- **Backend:** Supabase (PostgreSQL 15+, Edge Functions, Auth, Storage)
- **AI:** Google Gemini 1.5 Pro / 2.0 Flash, Imagen 3, text-embedding-004
- **Integrations:** Stripe, Plaid, Twilio, Prodigi

## Common Commands

```bash
# Development
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run preview      # Preview production build

# Testing
npm run test         # Run Vitest in watch mode
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage

# Supabase Edge Functions
npx supabase functions serve <function-name> --env-file .env.local   # Local dev
npx supabase functions deploy <function-name>                         # Deploy to production
npx supabase functions deploy --all                                   # Deploy all functions
```

## Directory Structure

```
/                       # Root - main App.tsx, types.ts, config files
├── components/         # React UI components (Widgets, Dashboard, Modals)
├── services/           # Frontend service layers (geminiService, imageService, etc.)
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # Additional TypeScript type definitions
├── supabase/
│   ├── functions/      # Deno Edge Functions (each in own folder with index.ts)
│   └── migrations/     # SQL migration files
├── src/
│   └── test/           # Vitest test files (*.test.ts)
├── public/             # Static assets
└── docs/               # Documentation
```

## Code Conventions

### TypeScript
- Use strict TypeScript - no `any` types without justification
- Prefer interfaces over types for object shapes
- Use path alias `@/*` for imports from root

### React Components
- Functional components with hooks only
- Component files: PascalCase (e.g., `VisionBoard.tsx`)
- Keep components focused - extract logic to hooks/services
- Use Tailwind utility classes for styling

### Services
- Service files: camelCase (e.g., `geminiService.ts`)
- Export named functions, not default exports
- Handle errors gracefully with try/catch
- Return typed responses

### Edge Functions (Supabase/Deno)
- Each function in its own folder: `supabase/functions/<name>/index.ts`
- Use Deno runtime APIs
- Always include CORS headers for browser requests:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```
- Validate authentication using Supabase client
- Use environment variables via `Deno.env.get()`

### Testing
- Test files: `src/test/<feature>.test.ts`
- Use Vitest with `describe`, `it`, `expect`
- Mock external services (Supabase, Gemini) in tests

## Key Files Reference

| File | Purpose |
|------|---------|
| `App.tsx` | Main application entry, routing, global state |
| `types.ts` | Core TypeScript interfaces and types |
| `services/geminiService.ts` | Gemini AI integration |
| `services/imageService.ts` | Image generation/storage |
| `services/storageService.ts` | Supabase storage operations |
| `supabase/functions/amie-psychological-coach/` | Main AI coaching endpoint |
| `supabase/functions/voice-coach-session/` | Voice interaction logic |

## Environment Variables

Required in `.env.local`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_GEMINI_API_KEY` - Google Gemini API key
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe public key

Edge Functions (set in Supabase Dashboard):
- `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `TWILIO_*`, `PLAID_*`, `PRODIGI_*`

## Database

- PostgreSQL with extensions: `vector` (pgvector), `pg_net`, `pg_cron`
- All user data protected by Row Level Security (RLS)
- Key tables: `profiles`, `vision_boards`, `habits`, `user_knowledge_chunks`

## Security Notes

- Never commit `.env` or `.env.local` files
- Always validate user authentication in Edge Functions
- Use RLS policies for data isolation
- Sanitize user inputs before AI prompts

## AI Integration Patterns

### Gemini Chat
```typescript
import { geminiChat } from '@/services/geminiService';
const response = await geminiChat(messages, { model: 'gemini-2.0-flash' });
```

### Image Generation
```typescript
import { generateImage } from '@/services/imageService';
const imageUrl = await generateImage(prompt, userId);
```

## Deployment

- Frontend: Vercel (configured in `vercel.json`)
- Backend: Supabase Cloud
- Edge Functions: Deploy via Supabase CLI

## Current Development Focus

See `ROADMAP.md` for current sprint items and feature backlog.

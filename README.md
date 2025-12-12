<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Visionary AI — Interactive Vision Board Platform

**Version:** 2.1 (December 2025)  
**Status:** Core features deployed, UI completion in progress

> The first agentic success platform that turns visions into reality by combining emotional visualization, financial intelligence, and autonomous AI execution—backed by physical products that reinforce identity and commitment.

---

## 🎯 Mission

Enable ambitious professionals, executives, athletes, families, and teams to achieve goals faster through identity-aligned, AI-driven execution across web, mobile, Apple Watch, voice, and print.

---

## ✨ Key Features

### 🖼️ AI Vision Board Generation
- Photorealistic vision boards powered by Gemini 1.5 Flash
- Voice-to-vision workflow using Web Speech API
- Iterative refinement with "Refine This" feature
- Gallery management with social sharing

### 🧠 AMIE Identity Engine (NEW)
- **Adaptive Motivational Identity Engine** with 5 themes:
  - Christian Faith & Purpose
  - Executive Performance
  - Health & Vitality
  - Legacy & Wisdom
  - Custom personalization
- Identity-driven AI coaching using psychological frameworks
- Master Prompt Q&A for personalized onboarding
- Knowledge base ingestion with RAG retrieval

### 💼 Executive Vision Planner
- Premium workbook generation with AI content
- Ghostwriter AI Foreword - "Letter from Your Future Self"
- Flipbook preview with realistic 2-page spreads
- Monthly planners, habit trackers, and reflection pages
- Print fulfillment via Prodigi integration

### 🎯 Habit Tracking & Accountability
- Daily micro-habits with streak tracking
- Apple Watch companion with notifications
- Voice coach integration using Gemini Live
- AI-generated weekly progress reviews
- Predictive pace warnings and recommendations

### 🏢 Enterprise & Team Features
- Shared goals and team dashboards
- Slack and Microsoft Teams bot integration
- Partner collaboration for couples/families
- Team leaderboards and gamification
- Manager oversight and progress tracking

### 🎵 MDALS Music Engine
- Music-Driven Adaptive Learning System
- Song analysis for learning plans
- Identity conditioning through audio

### 📊 Systems Architecture
- **Input Diet**: AI-curated educational content feed
- **Identity Architect**: Psychological RAG for mindset coaching
- **Systems Dashboard**: Calendar-based SOP enforcement
- Background worker for automated processing

---

## 🏗️ Technical Architecture

### Frontend Stack
- **React 18.3** with TypeScript
- **Vite** for fast development
- **Recharts** for data visualization
- **Supabase Client** for real-time features

### Backend Infrastructure
- **Supabase** (PostgreSQL + Row Level Security)
- **30+ Edge Functions** (Deno runtime)
- **35+ Database Tables** across 6 categories
- **Vector embeddings** with pgvector for RAG

### AI Models
- **Gemini 1.5 Flash** - Vision generation, content curation
- **Gemini Live** - Voice coaching and conversations
- **Future**: Claude integration for enhanced reasoning

### External Integrations
- **Stripe** - Payments and subscriptions
- **Plaid** - Bank account aggregation
- **Twilio** - SMS and voice calls
- **Prodigi** - Print fulfillment
- **YouTube API** - Content curation

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/moverton7474/AI-Interactive-Vision-Board-2.git
   cd AI-Interactive-Vision-Board-2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create `.env.local` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   GEMINI_API_KEY=your_gemini_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm test
   ```

---

## 📁 Project Structure

```
├── components/          # React UI components
├── services/           # API services and business logic
├── types/              # TypeScript type definitions
├── supabase/           # Database migrations and edge functions
│   ├── functions/      # 30+ edge functions
│   └── migrations/     # SQL schema updates
├── docs/               # Technical documentation
└── artifacts/          # Feature summaries and reports
```

---

## 🎨 Key Components

### Edge Functions (30 Deployed)
- `gemini-proxy` - Secure AI API proxy
- `agent-chat` - AI coaching conversations
- `habit-service` - Habit tracking and streaks
- `generate-workbook-pdf` - Workbook PDF generation
- `amie-prompt-builder` - Identity-based prompts
- `voice-coach-session` - Voice coaching
- `partner-collaboration` - Couple workspaces
- `slack-bot` / `teams-bot` - Enterprise integrations
- `ingest-youtube-feed` - Content curation
- `watch-sync` - Apple Watch integration
- And 20 more...

### Database Schema
- **Core**: profiles, vision_boards, documents, action_tasks
- **AI Agent**: habits, agent_sessions, weekly_reviews
- **AMIE**: motivational_themes, user_identity_profiles, knowledge_chunks
- **Workbook**: workbook_orders, workbook_sections, templates
- **Enterprise**: teams, team_goals, team_integrations
- **Systems**: system_sops, resource_feed, psychological_frameworks

---

## 📚 Documentation

- [**ROADMAP.md**](./ROADMAP.md) - Complete development roadmap and feature status
- [**EXECUTIVE_PLANNER_ROADMAP.md**](./EXECUTIVE_PLANNER_ROADMAP.md) - Executive workbook implementation
- [**TECH_STACK.md**](./TECH_STACK.md) - Technology decisions and rationale
- [**TESTING_GUIDE.md**](./TESTING_GUIDE.md) - Testing strategy and practices
- [**docs/STATUS_REPORT.md**](./docs/STATUS_REPORT.md) - Detailed status tracking

---

## 🔄 Current Development Status (v2.1)

### ✅ Completed (v1.0 - v2.0)
- All backend infrastructure deployed (30 edge functions)
- Complete database schema (35+ tables)
- AMIE Identity Engine fully operational
- Executive Planner with Ghostwriter feature
- Enterprise team features with Slack/Teams bots
- Apple Watch integration
- Systems Architecture Upgrade
- Voice coaching backend

### ✅ Landing Page UI Enhancements (December 2025)
Research-backed conversion optimization updates:

**Hero Section (`VisionHero.tsx`)**
- Entrance animations with staggered delays (fadeUp, slideRight)
- Social proof strip with avatars, user count (10,000+), and 4.9/5 rating
- Click triggers: "Free to start", "No credit card", "Ready in 2 min"
- First-person CTA copy: "Start My Vision Board"

**Features Section (`PathCards.tsx`)**
- Scroll-triggered animations using Intersection Observer
- Staggered card reveal with 100ms delays
- Enhanced hover effects with lift and shadow

**Testimonials Section (`ProofSection.tsx`)**
- Scroll animations on stats, header, and CTA
- Dynamic avatar gradients based on author initials
- Improved testimonial card design

**Mobile Experience (`PublicLayout.tsx`)**
- Sticky CTA bar appears after scrolling past hero
- Optimized mobile navigation with streamlined CTAs

**Animation System (`index.html`)**
- CSS keyframe animations (fadeUp, fadeIn, slideRight, scaleIn)
- Scroll-triggered animation classes with stagger delays
- Zero external dependencies (pure CSS)

### 🚧 In Progress (UI Completion)
- AMIE theme selection UI
- Master prompt Q&A wizard
- Weekly review display cards
- Systems dashboard interface
- Resource feed display
- Knowledge source management

### 📋 Upcoming (Production Prep)
- Payment flow testing
- Security audit
- Load testing
- Email notifications via Resend
- Print center unified interface

---

## 🤝 Contributing

This is a private project. For questions or collaboration inquiries, please contact the maintainer.

---

## 📄 License

Proprietary - All rights reserved by Milton Overton

---

## 🔗 Links

- **AI Studio**: https://ai.studio/apps/drive/1FKAE5c-tOFRL8_how0d0zhCbqQ9gcYrs
- **Roadmap**: [ROADMAP.md](./ROADMAP.md)
- **Tech Stack**: [TECH_STACK.md](./TECH_STACK.md)

---

**Built with ❤️ by Milton Overton**  
*Making dreams reality through identity-driven AI achievement systems*

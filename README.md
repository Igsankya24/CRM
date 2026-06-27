# CRM with AI Integration

A production-ready, self-hostable CRM with WhatsApp automation and multi-provider AI integration.

Built on **Next.js 16**, **Supabase**, and the **Meta WhatsApp Cloud API**.

---

## Features

### CRM
- **Inbox** — Shared WhatsApp inbox with real-time message delivery
- **Contacts** — Contact management with custom fields, tags, and notes
- **Pipelines** — Kanban-style sales pipelines and deal tracking
- **Broadcasts** — Template-based mass WhatsApp campaigns with delivery tracking
- **Automations** — No-code automation builder (keyword triggers, tag actions, webhooks, wait steps)
- **Flows** — Visual conversation flow designer (beta)
- **Reports** — Broadcast analytics and pipeline reporting

### WhatsApp
- Meta Cloud API integration (Business Messaging)
- Inbound webhook with HMAC-SHA256 signature verification
- Template management with Meta lifecycle sync (APPROVED/REJECTED/PAUSED)
- Media handling (images, documents, audio, video)
- Interactive messages (buttons, lists)
- Broadcast scheduling and delivery tracking

### AI Agent
- **AI auto-reply** — Toggle per-conversation AI mode; bot replies to inbound text messages
- **Multi-provider** — OpenRouter (primary), OpenAI, Gemini, Claude, DeepSeek, Ollama
- **Configurable prompts** — Global env var or per-conversation system prompt override
- **AI Agent Monitor** — Real-time dashboard at `/ai-agent` to watch and override AI conversations
- **REST API** — `/api/ai/chat` for custom AI integrations

### Authentication & Multi-tenant
- Supabase Auth (email/password)
- Multi-user accounts with role-based access (Owner / Admin / Agent / Viewer)
- Team invitations via shareable links
- Row Level Security on all tables

---

## Quick Start

### 1. Prerequisites

- Node.js ≥ 20
- A Supabase project ([supabase.com](https://supabase.com))
- A Meta WhatsApp Business account ([developers.facebook.com](https://developers.facebook.com))
- An OpenRouter API key ([openrouter.ai](https://openrouter.ai)) — or any supported AI provider

### 2. Clone & Install

```bash
git clone <your-repo-url> crm-with-ai-integration
cd crm-with-ai-integration
npm install
```

### 3. Environment Variables

```bash
cp .env.example .env
```

Fill in your `.env` file. At minimum, these are **required**:

```env
# Supabase (Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# WhatsApp token encryption (generate with the command below)
ENCRYPTION_KEY=your-64-char-hex-key

# Meta webhook signature verification
META_APP_SECRET=your-meta-app-secret

# AI (pick one or use OpenRouter for all)
OPENROUTER_API_KEY=your-openrouter-key
AI_MODEL=anthropic/claude-sonnet-4-20250514
```

Generate your encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Set Up Supabase

Run all migrations in order in the Supabase SQL Editor:

```bash
# Run each file in supabase/migrations/ in order:
# 001_initial_schema.sql → 002 → ... → 023_ai_agent.sql
```

Or apply them programmatically via the Supabase CLI:
```bash
supabase db push
```

### 5. Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).  
Sign up for an account, then configure your WhatsApp Business number at `/settings`.

---

## Project Structure

```
crm-with-ai-integration/
├── src/
│   ├── app/
│   │   ├── (auth)/                  # Login, signup, forgot-password
│   │   ├── (dashboard)/             # All authenticated pages
│   │   │   ├── ai-agent/            # AI Agent Monitor dashboard
│   │   │   ├── automations/         # Automation builder
│   │   │   ├── broadcasts/          # Broadcast campaigns
│   │   │   ├── contacts/            # Contact management
│   │   │   ├── dashboard/           # Main dashboard
│   │   │   ├── flows/               # Visual flow designer
│   │   │   ├── inbox/               # Shared WhatsApp inbox
│   │   │   ├── pipelines/           # Sales pipelines
│   │   │   └── settings/            # Account & WhatsApp settings
│   │   ├── join/                    # Team invitation acceptance
│   │   └── api/
│   │       ├── account/             # Account & invitation APIs
│   │       ├── ai/chat/             # AI chat REST endpoint
│   │       ├── automations/         # Automation CRUD + cron runner
│   │       ├── flows/               # Flow APIs
│   │       └── whatsapp/            # WhatsApp APIs + webhook
│   ├── components/                  # Reusable UI components
│   ├── hooks/                       # React hooks
│   ├── lib/
│   │   ├── ai/                      # AI module
│   │   │   ├── agent.ts             # Core AI response function
│   │   │   ├── client.ts            # OpenAI-compatible client factory
│   │   │   ├── providers.ts         # Multi-provider configuration
│   │   │   └── system-prompt.ts     # System prompt library
│   │   ├── auth/                    # Roles, invitations, account helpers
│   │   ├── supabase/
│   │   │   ├── admin.ts             # Service-role client (bypasses RLS)
│   │   │   ├── client.ts            # Browser singleton client
│   │   │   └── server.ts            # Server async client
│   │   └── whatsapp/                # Meta API, encryption, templates, send
│   ├── middleware.ts                 # Auth route protection
│   └── types/index.ts               # TypeScript type definitions
├── supabase/
│   ├── migrations/                  # 001–023 SQL migrations
│   └── schema_documentation.md     # Full schema reference
├── public/                          # Static assets
├── .env.example                     # Environment variable template
├── package.json
└── README.md
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only) |
| `ENCRYPTION_KEY` | ✅ | 64-hex-char AES-256-GCM key for WhatsApp tokens |
| `META_APP_SECRET` | ✅ | Meta App Secret for webhook signature verification |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical URL (used for invite links) |
| `OPENROUTER_API_KEY` | For AI | Primary AI gateway API key |
| `AI_MODEL` | For AI | Model string (default: anthropic/claude-sonnet-4-20250514) |
| `WHATSAPP_ACCESS_TOKEN` | For AI agent | Meta access token for AI auto-reply send |
| `WHATSAPP_PHONE_NUMBER_ID` | For AI agent | Meta Phone Number ID for AI auto-reply send |
| `OPENAI_API_KEY` | Optional | Direct OpenAI fallback |
| `GEMINI_API_KEY` | Optional | Direct Google Gemini fallback |
| `CLAUDE_API_KEY` | Optional | Direct Anthropic Claude fallback |
| `DEEPSEEK_API_KEY` | Optional | Direct DeepSeek fallback |
| `OLLAMA_URL` | Optional | Local Ollama endpoint |
| `AUTOMATION_CRON_SECRET` | Optional | Protects GET /api/automations/cron |
| `WHATSAPP_TEMPLATES_DRY_RUN` | Optional | Skip Meta API calls for template testing |

---

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| Handled by Supabase | | Email/password via Supabase Auth UI |

### WhatsApp
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/whatsapp/webhook` | Meta webhook verification |
| POST | `/api/whatsapp/webhook` | Inbound message processing + AI auto-reply |
| POST | `/api/whatsapp/send` | Send a message |
| GET/POST | `/api/whatsapp/config` | WhatsApp config management |
| GET/POST | `/api/whatsapp/templates` | Template CRUD |
| POST | `/api/whatsapp/broadcast` | Send broadcast |

### AI
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/chat` | AI chat completion (auth required) |

### Account
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/account` | Account settings |
| POST | `/api/account/invitations` | Create invitation |
| GET | `/api/automations/cron` | Cron runner for Wait steps |

---

## WhatsApp Setup

1. Create a Meta App at [developers.facebook.com](https://developers.facebook.com)
2. Enable the WhatsApp Business API product
3. Configure your webhook URL: `https://your-domain.com/api/whatsapp/webhook`
4. In the app, go to Settings → WhatsApp and enter your Phone Number ID and Access Token
5. The app will automatically register and subscribe your number for webhooks

---

## AI Agent Setup

1. Set `OPENROUTER_API_KEY` in your `.env` file
2. Optionally set `AI_MODEL` to your preferred model
3. Optionally set `AI_SYSTEM_PROMPT` for a custom global system prompt
4. In the app, navigate to **AI Agent** in the sidebar
5. Select a conversation and toggle **AI Auto-Reply** ON
6. Send a test WhatsApp message — the AI will reply automatically

### Customizing the AI

**Global system prompt**: Set `AI_SYSTEM_PROMPT` env var.

**Per-conversation**: Update the `ai_system_prompt` column on the `conversations` table (Settings UI coming soon).

**Per-conversation model**: Update the `ai_model` column on the `conversations` table.

**Built-in prompts** (see `src/lib/ai/system-prompt.ts`):
- `GENERIC_CRM_SYSTEM_PROMPT` — Default general-purpose business assistant
- `DENTIST_SYSTEM_PROMPT` — Dental clinic assistant (from original WhatsApp Agent)

---

## Development Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build production bundle
npm run start        # Start production server
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run test         # Run unit tests (vitest)
npm run test:watch   # Watch mode tests
npm run format       # Format with Prettier
```

---

## Supabase CLI Commands

```bash
# Apply migrations to your Supabase project
supabase db push

# Generate TypeScript types from your schema
supabase gen types typescript --project-id your-project-id > src/types/database.types.ts

# Start local Supabase stack
supabase start
```

---

## Deployment

### Vercel (Recommended)

```bash
vercel --prod
```

Add all environment variables in the Vercel dashboard (Settings → Environment Variables).

### Docker / PM2

```bash
npm run build
npm run start
```

Or with PM2:
```bash
pm2 start npm --name "crm-with-ai" -- start
```

---

## Troubleshooting

### "Verification token mismatch" on webhook
Ensure `META_APP_SECRET` in your env matches the App Secret from Meta for Developers → App Settings → Basic.

### AI not replying
1. Check `OPENROUTER_API_KEY` is set
2. Check `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are set (needed to send the AI reply)
3. Verify the conversation has `ai_mode = true` in the database
4. Check server logs for `[webhook] AI auto-reply failed:`

### Messages not appearing in inbox
1. Verify your webhook is publicly accessible (use ngrok for local dev)
2. Check that the webhook is verified (GET request from Meta returns the challenge)
3. Ensure `META_APP_SECRET` is correct (signature verification failure drops messages)

### Build fails with TypeScript errors
```bash
npm run typecheck 2>&1 | head -50
```
Check for missing env var references or broken imports.

### "Lock was released because another request stole it" (Supabase)
This is a known Supabase auth contention issue when multiple browser clients are created. The app uses singleton clients in `src/lib/supabase/client.ts` — ensure you are not importing `createClient` from `@supabase/supabase-js` directly in client components.

---

## Credits

- **wacrm** by [Arnas Donauskas](https://github.com/ArnasDon/wacrm) — CRM base, MIT License
- **Whatsapp-Agent-main** — AI auto-reply agent integration
- Built with [Next.js](https://nextjs.org), [Supabase](https://supabase.com), [OpenRouter](https://openrouter.ai)

# TaskCraft AI

**Plan smarter. Track faster. Invoice instantly.**

TaskCraft AI is a task, project, and time-tracking platform built for freelancers, consultants, and small teams. Organize work with Kanban boards, track billable time, generate reports, and sync seamlessly with [BillCraft AI](https://github.com/aakasatech) for invoicing and [SupportCraft AI](https://github.com/aakasatech) for turning support tickets into tasks — all with AI-powered productivity features.

## ✨ Features

- **Projects & tasks** — Kanban boards, drag-and-drop (`@dnd-kit`), labels, statuses, priorities, comments, and attachments.
- **Time tracking** — start/stop timers and manual time entries, with billable-hour tracking per client and project.
- **Clients** — client profiles linked to projects, with billable hours and revenue tracking.
- **Reports & analytics** — project progress, time, and client profitability reports; CSV export.
- **Calendar** — visualize tasks and deadlines.
- **Team management** — invite members, assign roles (owner / admin / member / viewer), and collaborate on shared projects.
- **AI productivity** — smart focus plans, task suggestions, and AI summaries (OpenAI).
- **Subscriptions** — PayPal billing with Solo and Team plans, plan-based feature gating.
- **Integrations**
  - **BillCraft AI** — send tracked billable hours and generate invoices in one click.
  - **SupportCraft AI** — convert support tickets into TaskCraft tasks and keep them in sync.
- **Notifications** — in-app notification center with read/unread state.
- **Admin panel** — user management, free-pass grants, and audit logs.
- **Auth** — email/password (bcrypt) and Google OAuth via Auth.js (NextAuth v5), JWT sessions.
- **API & webhooks** — REST API with API keys plus inbound/outbound webhooks.

## 🧱 Tech Stack

| Layer        | Technology |
|--------------|------------|
| Framework    | [Next.js 15](https://nextjs.org/) (App Router, React 19) |
| Styling      | Tailwind CSS 3 + shadcn/ui (Radix UI) |
| Database     | PostgreSQL via [Prisma 7](https://www.prisma.io/) (`@prisma/adapter-pg`) |
| Auth         | NextAuth v5 (Auth.js), JWT sessions, Google OAuth |
| AI           | OpenAI API (via `node:https`, no SDK) |
| Storage      | AWS S3 / Cloudflare R2 (local fallback) |
| Payments     | PayPal Subscriptions |
| Runtime      | Node.js 24 (standalone build, PM2 cluster) |
| Language     | TypeScript |

## 📁 Project Structure

```
TaskCraft_AI/
├── app/                      # Next.js App Router
│   ├── (public)/             # Public pages: landing, pricing, FAQ, privacy, terms
│   ├── (auth)/               # Login, register, forgot/reset password
│   ├── (app)/                # Authenticated app shell
│   │   ├── dashboard/ tasks/ projects/ time/ reports/
│   │   ├── calendar/ clients/ invoices/ ai/ team/
│   │   ├── integrations/ settings/ help/
│   ├── (admin)/              # Admin panel (users, free passes)
│   ├── api/                  # Route handlers (ai, auth, paypal, export, notifications, webhooks, v1)
│   └── actions/              # Server actions
├── components/               # ui/, shared/, providers/
├── lib/                      # prisma, auth, ai, storage, plan-gates, integrations, webhooks
├── prisma/
│   ├── schema.prisma         # Data model (User, Workspace, Project, Task, TimeEntry, …)
│   └── seed.ts               # Plan seed data
├── public/                   # Static assets
├── Dockerfile                # Multi-stage production build
├── ecosystem.config.js       # PM2 config
└── .env.example              # Environment template
```

## 🚀 Getting Started

### Prerequisites

- Node.js 24+
- PostgreSQL database (e.g. [Neon](https://neon.tech))
- (Optional) Google OAuth credentials, OpenAI API key, PayPal credentials, S3/R2 bucket

### Installation

1. Clone the repository:

   ```bash
   git clone <repo-url> TaskCraft_AI
   cd TaskCraft_AI
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

   > `postinstall` runs `prisma generate` automatically.

3. Configure environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Fill in at least `DATABASE_URL` and `AUTH_SECRET` (generate with `openssl rand -base64 32`). See [Configuration](#-configuration) below.

4. Set up the database:

   ```bash
   npx prisma migrate deploy   # or: npx prisma db push
   npm run seed                # seeds plan tiers (free/solo/team)
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## 📜 Scripts

| Script            | Description |
|-------------------|-------------|
| `npm run dev`     | Start Next.js dev server |
| `npm run build`   | Production build (`next build`) |
| `npm run start`   | Start production server (`next start`) |
| `npm run seed`    | Seed plan tiers into the database |
| `npm run db:*`    | Prisma CLI commands (e.g. `npx prisma studio`) |

## 🐳 Docker

A multi-stage `Dockerfile` produces a minimal production image (Node 24 Alpine + PM2 cluster, ~200 MB) using Next.js standalone output.

```bash
# Build (NEXT_PUBLIC_* vars are embedded at build time — pass as --build-arg)
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://taskcraft.aakasa.dev \
  -t taskcraft-ai:latest .

# Run
docker run -p 3003:3003 --env-file .env.production taskcraft-ai:latest
```

> The container listens on port **3003** inside (see `EXPOSE` and `PORT` in the Dockerfile). Public env vars cannot be changed at runtime — rebuild to update them.

## ⚙️ Configuration

All variables are documented in [`.env.example`](.env.example). Key groups:

- **Database** — `DATABASE_URL` (PostgreSQL, e.g. Neon with `?sslmode=require`).
- **Auth** — `AUTH_SECRET`, `NEXTAUTH_URL`, optional `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- **Storage** — `STORAGE_PROVIDER` (`s3`), `AWS_S3_REGION` / `AWS_S3_BUCKET` / `AWS_S3_ACCESS_KEY_ID` / `AWS_S3_SECRET_ACCESS_KEY`, optional `AWS_S3_ENDPOINT` (Cloudflare R2) and `STORAGE_PUBLIC_URL`. Local `/public/uploads` fallback when unconfigured.
- **PayPal** — `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_URL`, `PAYPAL_WEBHOOK_ID`, and Solo/Team plan IDs (monthly/yearly, both client- and server-side).
- **OpenAI** — `OPENAI_API_KEY`.
- **Integrations** — `BILLCRAFT_INTERNAL_URL`, `SUPPORTCRAFT_INTERNAL_URL` (Docker internal service names).
- **Admin & cron** — `ADMIN_EMAILS`, `CRON_SECRET`.
- **App** — `NEXT_PUBLIC_APP_URL`.

## 💳 Plans & Feature Gating

Three tiers, defined in [`prisma/seed.ts`](prisma/seed.ts) and [`lib/constants.ts`](lib/constants.ts):

| Plan  | Price (mo / yr) | Highlights |
|-------|-----------------|-----------|
| Free  | $0 / $0         | 1 user, up to 3 projects, basic time tracking, 5 AI requests/mo |
| Solo  | $9 / $89        | Unlimited projects, reports, clients, exports, AI, integrations |
| Team  | $19 / $189      | Unlimited members, roles, team reports, audit logs, team AI |

Feature availability is enforced server-side via [`lib/plan-gates.ts`](lib/plan-gates.ts) (e.g. `tasks`, `reports`, `clients`, `integrations`, `exports`, `billcraft_sync`, `supportcraft_sync`, `team_management`, `audit_logs`). Expired plans gracefully fall back to Free.

## 🔌 Integrations

- **BillCraft AI** — sync billable hours and create invoices. Uses a mock implementation when `api_key` is empty or prefixed `mock_`.
- **SupportCraft AI** — turn support tickets into tasks and keep them in sync. Same mock-mode behavior; Docker uses the internal service URL.

Both services communicate over `node:http/https` (not `fetch`/undici) to avoid premature-close issues, and run in mock mode for local development.

## 🔐 Auth & Roles

- Email/password (bcryptjs) and Google OAuth via Auth.js v5.
- JWT session strategy — edge-safe middleware (no Prisma/pg imports) guards `/dashboard`, `/projects`, `/tasks`, `/team`, `/admin`, etc., and redirects unauthenticated users to `/login`.
- Workspace roles: **owner / admin / member / viewer**.

## 📡 API

- REST API under `/api/v1` protected by API keys ([`lib/api-auth.ts`](lib/api-auth.ts)).
- Webhooks: inbound (`/api/webhooks`, `/api/supportcraft/webhook`) and outbound (`Webhook` / `WebhookDelivery` models) with delivery tracking.
- Auth endpoints at `/api/auth/[...nextauth]`.

## 🤝 Contributing

1. Create a feature branch.
2. Make your changes and ensure `npm run build` passes.
3. Open a pull request.

## 📄 License

TaskCraft AI is source-available and released under the **PolyForm Noncommercial License 1.0.0** — free for personal, educational, research, and evaluation use. **All commercial use requires a paid Commercial License.**

- [LICENSE.md](LICENSE.md) — PolyForm Noncommercial License 1.0.0 (non-commercial use)
- [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) — commercial licensing terms and tiers

For commercial licensing inquiries, contact [licenses@aakasa.dev](mailto:licenses@aakasa.dev).

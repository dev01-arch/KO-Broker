# KO Broker Platform

> AI-powered mortgage broker platform with FCA compliance, CRM, and suitability report generation.

Built by [Luxcity Technology](https://luxcity.tech) for KO Realtors (KO Financials).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS v4 |
| **Components** | shadcn/ui |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Prisma |
| **Auth** | Clerk |
| **AI** | Azure AI Foundry |
| **Email** | Resend |
| **SMS** | Twilio |
| **Storage** | Cloudflare R2 |
| **Deployment** | Vercel |

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- Docker (for local PostgreSQL)

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd ko-broker

# 2. Install dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env.local
# Fill in your values in .env.local

# 4. Start local PostgreSQL (optional — or use Supabase)
docker compose -f docker/docker-compose.yml up -d

# 5. Generate Prisma client
pnpm db:generate

# 6. Push schema to database
pnpm db:push

# 7. Seed demo data
pnpm db:seed

# 8. Start development server
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
ko-broker/
├── apps/
│   └── web/                    # Next.js application
│       ├── app/
│       │   ├── (marketing)/    # Public landing page
│       │   ├── (dashboard)/    # Protected app routes
│       │   ├── (client-portal)/# Phase 2 client portal
│       │   └── api/            # API route handlers
│       ├── components/
│       │   ├── ui/             # shadcn/ui primitives
│       │   ├── marketing/      # Landing page components
│       │   └── dashboard/      # Dashboard components
│       └── lib/                # Shared utilities
│           ├── auth/           # Authentication helpers
│           ├── api/            # Handler factory
│           ├── db/             # Prisma client singleton
│           ├── ai/             # Azure AI Foundry integration
│           ├── compliance/     # Workflow & audit
│           ├── notifications/  # Email & SMS
│           └── calculators/    # Formula functions
├── packages/
│   ├── db/                     # Prisma schema & client
│   ├── types/                  # Shared TypeScript types & Zod schemas
│   └── utils/                  # Shared pure utility functions
├── tooling/
│   └── eslint-config/          # Shared ESLint configuration
├── docker/                     # Dockerfile & docker-compose
├── docs/                       # PRDs, API docs, design system docs
└── .github/workflows/          # CI/CD pipelines
```

## Development Commands

| Command | Description |
|---------|------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checker |
| `pnpm format` | Format code with Prettier |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |
| `pnpm db:seed` | Seed demo data |

## Branching Model

- **Feature branches**: `feature/PRD-06-case-kanban`
- **Bug fixes**: `fix/PRD-07-compliance-stage-gate`
- **Infrastructure**: `chore/PRD-02-monorepo-setup`
- All PRs require review from Head of D&E before merge to `main`

## Documentation

- [Modular PRD Set (PRD-00 to PRD-14)](./Doc/KO_Modular_PRD_Set_v2.docx.md)
- [Reference Prototype v2a](./Doc/ko-platform-prototype-v2a.html)

---

© 2026 KO Realtors · Powered by Luxcity Technology

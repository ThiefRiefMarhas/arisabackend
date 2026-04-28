# 🌿 ARISA — Cloud Backend

> **Hybrid IoT Backend** untuk sistem pertanian cerdas.
> NestJS monolith modular dengan Supabase Auth, PostgreSQL, Redis, dan Raspberry Pi edge sync.

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Setup environment
cp .env.example .env
# → Edit .env, isi Supabase credentials + DATABASE_URL

# 3. Setup database
npx prisma generate
npx prisma migrate dev --name init

# 4. Run
npm run start:dev

# 5. Open Swagger
# → http://localhost:3000/api/docs
```

📖 **Guide lengkap**: [docs/GETTING-STARTED.md](./docs/GETTING-STARTED.md)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | NestJS 11 (TypeScript) |
| **Database** | PostgreSQL via Supabase |
| **ORM** | Prisma 7 (driver adapter) |
| **Auth** | Supabase Auth (JWT + OAuth) |
| **Cache/Queue** | Redis + ioredis (optional) |
| **Security** | Helmet, CORS, Rate Limiting |
| **Docs** | Swagger/OpenAPI |

---

## Modules

| Module | Endpoints | Auth |
|--------|-----------|------|
| **Auth** | register, login, OAuth Google, refresh, logout | Public / JWT |
| **User** | get profile, update profile | JWT |
| **Device** | register, pair, list, revoke, heartbeat | Secret / JWT / Device Token |
| **Sync** | push, batch, status, ack, pull | Device Token |
| **Data** | CRUD with ownership | JWT |
| **Telemetry** | push, history | Device Token / JWT |
| **Notification** | list, mark read | JWT |
| **AI Gateway** | analyze, chat, history | JWT |
| **Admin** | dashboard, users, devices, logs | JWT + RBAC |
| **Health** | liveness, readiness | Public |

---

## Documentation

| Dokumen | Isi |
|---------|-----|
| [📖 GETTING-STARTED](./docs/GETTING-STARTED.md) | **Mulai dari sini** — setup, run, test |
| [🏗️ SYSTEM-OVERVIEW](./docs/SYSTEM-OVERVIEW.md) | Gambaran besar cloud + edge |
| [🧱 ARCHITECTURE](./docs/ARCHITECTURE.md) | Module map, data flow, patterns |
| [💾 DATABASE-SCHEMA](./docs/DATABASE-SCHEMA.md) | Prisma models, ER diagram, indexes |
| [📡 API-REFERENCE](./docs/API-REFERENCE.md) | Semua endpoint + format |
| [🔐 AUTH-SECURITY](./docs/AUTH-SECURITY.md) | JWT, Device Token, RBAC |
| [🔄 SYNC-ENGINE](./docs/SYNC-ENGINE.md) | Idempotency, LWW, offline sync |
| [🔧 EDGE-RASPBERRY-PI](./docs/EDGE-RASPBERRY-PI.md) | Setup Pi, SQLite, sync queue |
| [📊 OBSERVABILITY](./docs/OBSERVABILITY.md) | Logging, health, audit |
| [📋 BUILD-PHASES](./docs/BUILD-PHASES.md) | Fase 0–4 checklist |
| [🧠 ARCHITECTURE-DECISIONS](./docs/ARCHITECTURE-DECISIONS.md) | ADR: kenapa X bukan Y |

---

## Scripts

```bash
npm run start:dev      # Development (auto-reload)
npm run build          # Build TypeScript
npm run start:prod     # Run production build
npm run lint           # Lint check
npm run format         # Auto-format
npm test               # Run tests
npx prisma studio      # Database GUI
npx prisma migrate dev # New migration
docker compose up -d   # Start local DB + Redis
```

---

## License

Private — UNLICENSED

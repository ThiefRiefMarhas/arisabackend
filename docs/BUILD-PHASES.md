# ARISA Cloud Backend — Build Phases

> **Dokumen ini adalah checklist eksekusi yang dipakai selama development.**
> Update status setiap item saat selesai.

---

## Timeline Overview

| Fase | Nama | Durasi | Prioritas | Dependensi |
|------|------|--------|-----------|-----------|
| **0** | Infrastruktur & Setup | 2 hari | 🔴 MUST | - |
| **1** | Auth & Identity | 3 hari | 🔴 MUST | Fase 0 |
| **2** | Device Management | 3 hari | 🔴 MUST | Fase 1 |
| **3** | Sync Engine & Data | 5 hari | 🔴 MUST | Fase 2 |
| **4** | Operasional & Polish | 5 hari | 🟡 SHOULD | Fase 3 |

**Total estimasi: ~18 hari kerja** (tanpa blocker atau scope creep)

---

## Fase 0 — Infrastruktur & Setup

**Goal**: Environment development siap. Database connected. Swagger berjalan. Health check OK.

**Dependensi**: Tidak ada.

### Checklist

#### Config & Environment
- [ ] Install dependencies: `@nestjs/config`, `joi`
- [ ] Buat `common/config/configuration.ts` — config factory
- [ ] Buat `common/config/env.validation.ts` — Joi validation schema
- [ ] Buat `.env.example` dengan semua variabel yang diperlukan
- [ ] Buat `.env` untuk development
- [ ] Register `ConfigModule.forRoot()` di `AppModule` (global, validasi on)

#### Database (Prisma)
- [ ] Install: `prisma`, `@prisma/client`
- [ ] Buat `prisma/schema.prisma` — SELURUH schema (lihat `02-DATABASE.md`)
- [ ] Konfigurasi datasource → `env("DATABASE_URL")`
- [ ] Run `npx prisma migrate dev --name init` — initial migration
- [ ] Run `npx prisma generate` — generate client
- [ ] Buat `src/prisma/prisma.service.ts` — Prisma client wrapper
- [ ] Buat `src/prisma/prisma.module.ts` — global module
- [ ] Register `PrismaModule` di `AppModule`
- [ ] Test: query `SELECT 1` berhasil

#### Redis
- [ ] Install: `ioredis`
- [ ] Buat `src/redis/redis.service.ts` — Redis client wrapper
- [ ] Buat `src/redis/redis.module.ts` — global module
- [ ] Register `RedisModule` di `AppModule`
- [ ] Test: `PING` → `PONG`

#### Supabase
- [ ] Update `src/supabase/supabase.service.ts` — tambah service role client
- [ ] Buat `src/supabase/supabase.module.ts` — global module
- [ ] Register `SupabaseModule` di `AppModule`

#### Common Utilities
- [ ] Buat `common/middleware/request-id.middleware.ts`
- [ ] Buat `common/filters/http-exception.filter.ts` — response error format standar
- [ ] Buat `common/interceptors/transform.interceptor.ts` — response success format standar
- [ ] Buat `common/interceptors/logging.interceptor.ts`
- [ ] Buat `common/dto/pagination.dto.ts`
- [ ] Buat `common/dto/api-response.dto.ts`
- [ ] Buat `common/interfaces/api-response.interface.ts`
- [ ] Buat `common/interfaces/authenticated-request.interface.ts`
- [ ] Buat `common/constants/error-codes.ts`
- [ ] Buat `common/constants/roles.ts`

#### Health Module
- [ ] Buat `modules/health/health.module.ts`
- [ ] Buat `modules/health/health.controller.ts` — `GET /health`, `GET /ready`
- [ ] Register di `AppModule`
- [ ] **PENTING**: Health endpoints harus di-exclude dari global prefix `/api/v1`

#### Main.ts Update
- [ ] Register global exception filter
- [ ] Register global transform interceptor
- [ ] Register global logging interceptor
- [ ] Register RequestIdMiddleware
- [ ] Add Helmet middleware
- [ ] Update CORS config
- [ ] Update Swagger config (tags, groups)
- [ ] Exclude `/health` dan `/ready` dari global prefix

#### Docker (Development)
- [ ] Buat `docker-compose.yml` — PostgreSQL + Redis containers
- [ ] Test: `docker compose up -d` → DB + Redis running

#### Hapus Boilerplate
- [ ] Hapus `app.controller.ts` + `app.controller.spec.ts`
- [ ] Hapus `app.service.ts`
- [ ] Update `app.module.ts` — clean, import semua global modules

### ✅ Deliverable Fase 0
```
npm run start:dev
→ Swagger terbuka di http://localhost:3000/api/docs
→ GET /health → 200 { status: "ok" }
→ GET /ready → 200 { database: "ok", redis: "ok", supabase: "ok" }
→ Database connected, migration applied
→ Redis connected
→ Request ID di setiap response header
→ Error response format konsisten
```

---

## Fase 1 — Authentication & Identity

**Goal**: User bisa register, login, dan mendapat token yang valid. RBAC berjalan.

**Dependensi**: Fase 0 complete.

### Checklist

#### Auth Guards & Decorators
- [ ] Buat `common/guards/jwt-auth.guard.ts` — verify Supabase JWT
- [ ] Buat `common/guards/roles.guard.ts` — RBAC enforcement
- [ ] Buat `common/decorators/roles.decorator.ts` — `@Roles()`
- [ ] Buat `common/decorators/current-user.decorator.ts` — `@CurrentUser()`

#### Auth Module
- [ ] Buat `modules/auth/auth.module.ts`
- [ ] Buat `modules/auth/auth.controller.ts`
- [ ] Buat `modules/auth/auth.service.ts`
- [ ] Buat DTO: `register.dto.ts`, `login.dto.ts`, `oauth-google.dto.ts`, `refresh-token.dto.ts`
- [ ] Implement: `POST /auth/register` — Supabase signUp + create DB record
- [ ] Implement: `POST /auth/login` — Supabase signIn + update lastLoginAt
- [ ] Implement: `POST /auth/oauth/google` — Supabase signInWithIdToken
- [ ] Implement: `POST /auth/refresh` — Supabase refreshSession
- [ ] Implement: `POST /auth/logout` — Supabase signOut
- [ ] Implement: `POST /auth/revoke-all` — Supabase signOut global
- [ ] Register `AuthModule` di `AppModule`

#### User Module
- [ ] Buat `modules/user/user.module.ts`
- [ ] Buat `modules/user/user.controller.ts`
- [ ] Buat `modules/user/user.service.ts`
- [ ] Buat DTO: `update-profile.dto.ts`
- [ ] Implement: `GET /users/me` — return user profile
- [ ] Implement: `PATCH /users/me` — update profile
- [ ] Register `UserModule` di `AppModule`

#### Seed Data
- [ ] Buat seed script: create super admin user
- [ ] Add `prisma:seed` script di package.json

#### Testing
- [ ] Test via Swagger: register → login → get profile
- [ ] Test: JWT guard reject invalid token → 401
- [ ] Test: roles guard reject non-admin → 403
- [ ] Test: refresh token flow
- [ ] Unit test: `auth.service.spec.ts`

### ✅ Deliverable Fase 1
```
POST /auth/register → 201, accessToken + refreshToken
POST /auth/login → 200, accessToken + refreshToken
GET /users/me (with Bearer) → 200, user profile
PATCH /users/me (with Bearer) → 200, updated profile
POST /auth/refresh → 200, new tokens
POST /auth/logout → 200
Request tanpa token → 401
User biasa akses admin → 403
```

---

## Fase 2 — Device Management & Pairing

**Goal**: Raspberry Pi bisa register, di-pair ke user, dan diidentifikasi.

**Dependensi**: Fase 1 complete.

### Checklist

#### Device Auth
- [ ] Install: `bcrypt`, `@types/bcrypt`
- [ ] Buat `common/guards/device-auth.guard.ts` — verify device token
- [ ] Buat `common/decorators/current-device.decorator.ts` — `@CurrentDevice()`

#### Device Module
- [ ] Buat `modules/device/device.module.ts`
- [ ] Buat `modules/device/device.controller.ts`
- [ ] Buat `modules/device/device.service.ts`
- [ ] Buat DTO: `register-device.dto.ts`, `pair-start.dto.ts`, `pair-confirm.dto.ts`
- [ ] Implement: `POST /devices/register` — generate token, hash, store
- [ ] Implement: `POST /devices/pair/start` — generate pairing code
- [ ] Implement: `POST /devices/pair/confirm` — verify code, bind to user
- [ ] Implement: `GET /devices` — list user's devices
- [ ] Implement: `GET /devices/:id` — device detail (ownership check)
- [ ] Implement: `POST /devices/:id/revoke` — unpair device
- [ ] Implement: `POST /devices/:id/heartbeat` — update lastSeenAt
- [ ] Pairing code generation (6-char alphanumeric)
- [ ] Pairing expiry enforcement (10 min TTL)
- [ ] Device token generation (48 bytes random → hex)
- [ ] Ownership validation (user hanya lihat device miliknya)
- [ ] Add `DEVICE_REGISTRATION_SECRET` ke `.env`
- [ ] Register `DeviceModule` di `AppModule`

#### Testing
- [ ] Test via Swagger: register device → pair → list → revoke
- [ ] Test: device auth guard dengan token valid → 200
- [ ] Test: device auth guard dengan token invalid → 401
- [ ] Test: pairing code expired → 410
- [ ] Test: heartbeat update lastSeenAt
- [ ] Unit test: `device.service.spec.ts`

### ✅ Deliverable Fase 2
```
POST /devices/register { serial, secret } → 201, deviceId + deviceToken
POST /devices/pair/start → 200, pairingCode + QR data
POST /devices/pair/confirm { code, deviceId } → 200, paired
GET /devices (Bearer) → 200, list of user's devices
POST /devices/:id/heartbeat (X-Device-Token) → 200
POST /devices/:id/revoke → 200, revoked
Device token invalid → 401
Pairing code expired → 410
```

---

## Fase 3 — Sync Engine & Data

**Goal**: Data dari Pi bisa masuk cloud, deduplicated, tersimpan aman.

**Dependensi**: Fase 2 complete.

### Checklist

#### BullMQ Setup
- [ ] Install: `@nestjs/bullmq`, `bullmq`
- [ ] Register `BullModule.forRoot()` di `AppModule` (Redis connection)
- [ ] Register `BullModule.registerQueue({ name: 'sync-queue' })` di SyncModule

#### Sync Module
- [ ] Buat `modules/sync/sync.module.ts`
- [ ] Buat `modules/sync/sync.controller.ts`
- [ ] Buat `modules/sync/sync.service.ts`
- [ ] Buat `modules/sync/sync.processor.ts` — BullMQ worker
- [ ] Buat DTO: `sync-push.dto.ts`, `sync-batch.dto.ts`, `sync-ack.dto.ts`
- [ ] Implement: `POST /sync/push` — idempotent single push
- [ ] Implement: `POST /sync/batch` — batch push (max 100 items)
- [ ] Implement: `GET /sync/status/:jobId` — query job status
- [ ] Implement: `POST /sync/ack` — acknowledge synced items
- [ ] Implement: `GET /sync/pull` — pull updates from cloud
- [ ] Implement idempotency check (query request_id before insert)
- [ ] Implement SyncProcessor:
  - [ ] Pick job from queue
  - [ ] Validate payload
  - [ ] Write to core_data
  - [ ] Handle conflict (LWW default)
  - [ ] Update SyncJob status
- [ ] Configure retry strategy (exponential backoff, 5 attempts)
- [ ] Configure dead letter queue
- [ ] Ownership validation (device → user match)
- [ ] Register `SyncModule` di `AppModule`

#### Data Module
- [ ] Buat `modules/data/data.module.ts`
- [ ] Buat `modules/data/data.controller.ts`
- [ ] Buat `modules/data/data.service.ts`
- [ ] Buat DTO: `create-data.dto.ts`, `update-data.dto.ts`
- [ ] Implement: `POST /data` — create record
- [ ] Implement: `GET /data` — list with pagination + filters
- [ ] Implement: `GET /data/:id` — single record (ownership check)
- [ ] Implement: `PATCH /data/:id` — update (ownership check)
- [ ] Implement: `DELETE /data/:id` — soft-delete (ownership check)
- [ ] Register `DataModule` di `AppModule`

#### Telemetry Module
- [ ] Buat `modules/telemetry/telemetry.module.ts`
- [ ] Buat `modules/telemetry/telemetry.controller.ts`
- [ ] Buat `modules/telemetry/telemetry.service.ts`
- [ ] Buat DTO: `push-telemetry.dto.ts`
- [ ] Implement: `POST /telemetry` — push telemetry (device auth)
- [ ] Implement: `GET /telemetry/device/:deviceId` — get history (user auth, ownership)
- [ ] Register `TelemetryModule` di `AppModule`

#### Testing
- [ ] Test: push single sync → job created → worker processes → data appears
- [ ] Test: push batch → items accepted/skipped
- [ ] Test: duplicate request_id → idempotent response
- [ ] Test: sync status → correct status returned
- [ ] Test: sync ack → cleanup
- [ ] Test: sync pull → correct data returned
- [ ] Test: data CRUD → ownership enforced
- [ ] Test: telemetry push + query
- [ ] Unit test: `sync.service.spec.ts`, `sync.processor.spec.ts`
- [ ] Integration test: end-to-end sync flow

### ✅ Deliverable Fase 3
```
POST /sync/push (Device Token) → 202 Accepted, jobId
POST /sync/batch → 202, accepted + skipped counts
GET /sync/status/:id → 200, { status: "SYNCED" }
POST /sync/ack → 200, acknowledged count
GET /sync/pull?since=... → 200, items[]
POST /data (Bearer) → 201
GET /data (Bearer) → 200, paginated list (only own data)
POST /telemetry (Device Token) → 201
Duplicate request_id → 200 (idempotent, no duplicate)
Sync worker proses queue → data muncul di core_data
```

---

## Fase 4 — Operasional & Polish

**Goal**: Sistem lengkap untuk demo. Monitoring, notification, AI, admin.

**Dependensi**: Fase 3 complete.

### Checklist

#### Audit Module
- [ ] Buat `modules/audit/audit.module.ts`
- [ ] Buat `modules/audit/audit.service.ts`
- [ ] Buat `common/interceptors/audit.interceptor.ts`
- [ ] Integrate audit logging ke auth, device, sync endpoints
- [ ] Register `AuditModule` di `AppModule` (global)

#### Notification Module
- [ ] Buat `modules/notification/notification.module.ts`
- [ ] Buat `modules/notification/notification.controller.ts`
- [ ] Buat `modules/notification/notification.service.ts`
- [ ] Implement: `GET /notifications` — paginated list
- [ ] Implement: `PATCH /notifications/:id/read` — mark read
- [ ] Notification triggers:
  - [ ] Device paired successfully
  - [ ] Device offline > 1 hour
  - [ ] Sync failed permanently (DLQ)
  - [ ] AI result ready
- [ ] Register `NotificationModule` di `AppModule`

#### AI Gateway Module
- [ ] Buat `modules/ai-gateway/ai-gateway.module.ts`
- [ ] Buat `modules/ai-gateway/ai-gateway.controller.ts`
- [ ] Buat `modules/ai-gateway/ai-gateway.service.ts`
- [ ] Buat `modules/ai-gateway/providers/ai-provider.interface.ts`
- [ ] Buat `modules/ai-gateway/providers/openai.provider.ts`
- [ ] Buat `modules/ai-gateway/providers/gemini.provider.ts`
- [ ] Implement: `POST /ai/analyze` — proxy to AI provider
- [ ] Implement: `POST /ai/chat` — chat proxy
- [ ] Implement: `GET /ai/history` — request history
- [ ] Quota/rate check sebelum forward
- [ ] Register `AiGatewayModule` di `AppModule`

#### Admin Module
- [ ] Buat `modules/admin/admin.module.ts`
- [ ] Buat `modules/admin/admin.controller.ts`
- [ ] Buat `modules/admin/admin.service.ts`
- [ ] Implement: `GET /admin/users` — list all users
- [ ] Implement: `GET /admin/devices` — list all devices
- [ ] Implement: `GET /admin/sync-jobs` — list sync jobs
- [ ] Implement: `GET /admin/logs` — query audit logs
- [ ] Implement: `POST /admin/devices/:id/disable` — disable device
- [ ] Implement: `GET /admin/dashboard` — stats overview
- [ ] All admin endpoints: RBAC guard (ADMIN/SUPER_ADMIN only)
- [ ] Register `AdminModule` di `AppModule`

#### Security Hardening
- [ ] Install: `@nestjs/throttler`
- [ ] Setup rate limiting globally
- [ ] Custom rate limits untuk sensitive endpoints (login, register, pairing)
- [ ] Review CORS whitelist
- [ ] Review Helmet config

#### Documentation & Polish
- [ ] Update Swagger: semua endpoint terdokumentasi
- [ ] Review semua error codes konsisten
- [ ] Review response format konsisten
- [ ] Add API versioning notes

#### Docker Production
- [ ] Buat `Dockerfile` untuk cloud backend
- [ ] Buat `docker-compose.prod.yml`
- [ ] Test: build + run di Docker

#### Testing
- [ ] Integration test: full user journey (register → pair → sync → data visible)
- [ ] Test: audit logs muncul untuk semua action sensitif
- [ ] Test: notification muncul saat device offline
- [ ] Test: AI request proxy berjalan
- [ ] Test: admin dashboard returns correct stats
- [ ] Test: rate limiting berjalan di login endpoint

### ✅ Deliverable Fase 4
```
Sistem lengkap:
- User register → login → pair device → sync data → view data → get AI analysis
- Admin login → view dashboard → inspect logs → disable device
- Notifications muncul untuk events penting
- Rate limiting aktif
- Audit log lengkap
- Docker ready
- Swagger komprehensif
```

---

## Post-MVP (Future Enhancements)

| Item | Prioritas | Estimasi |
|------|-----------|----------|
| WebSocket untuk real-time device status | NICE | 2 hari |
| Prometheus + Grafana metrics | NICE | 2 hari |
| OTA firmware update untuk Pi | NICE | 3 hari |
| Advanced conflict resolution (manual merge) | SHOULD | 3 hari |
| Email notification channel | NICE | 1 hari |
| Push notification (FCM) | SHOULD | 2 hari |
| File upload to Supabase Storage | SHOULD | 2 hari |
| Data export (CSV/PDF) | NICE | 1 hari |
| Cron job for data retention cleanup | SHOULD | 1 hari |
| CI/CD pipeline (GitHub Actions) | SHOULD | 1 hari |

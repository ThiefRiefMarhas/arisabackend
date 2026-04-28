# ARISA Cloud Backend — Architecture Detail

> **Dokumen ini menjelaskan setiap keputusan arsitektur dan struktur modul.**

---

## 1. Pola Arsitektur: Modular Monolith

### Mengapa Monolith Modular?

| Opsi | Pro | Kontra | Keputusan |
|------|-----|--------|-----------|
| **Monolith modular** | Simple deploy, shared DB, easy debug | Single process, must refactor to scale | ✅ Dipilih |
| Microservices | Independent scale, isolation | Complex deploy, network overhead, overkill | ❌ Terlalu awal |
| Serverless | Auto-scale, no server | Cold start, vendor lock, complex state | ❌ Tidak cocok untuk sync |

**Keputusan**: Monolith modular NestJS. Setiap domain adalah module terpisah yang bisa diekstrak jadi microservice nanti jika perlu.

### Prinsip Modular

1. Setiap module memiliki controller, service, DTOs sendiri
2. Module berkomunikasi via dependency injection, bukan direct import
3. Shared logic masuk ke `common/`
4. Database access via Prisma service (global module)
5. Tidak boleh ada circular dependency antar module

---

## 2. Layer Architecture

```
┌─────────────────────────────────────────────┐
│ HTTP Request                                │
├─────────────────────────────────────────────┤
│ 1. Middleware Layer                         │
│    - RequestIdMiddleware (UUID per request)  │
│    - Helmet (security headers)              │
│    - CORS                                   │
├─────────────────────────────────────────────┤
│ 2. Guard Layer                              │
│    - JwtAuthGuard (user requests)           │
│    - DeviceAuthGuard (device requests)      │
│    - RolesGuard (RBAC enforcement)          │
├─────────────────────────────────────────────┤
│ 3. Interceptor Layer                        │
│    - LoggingInterceptor (request/response)  │
│    - TransformInterceptor (response format) │
│    - AuditInterceptor (sensitive actions)   │
├─────────────────────────────────────────────┤
│ 4. Pipe Layer                               │
│    - ValidationPipe (DTO validation)        │
├─────────────────────────────────────────────┤
│ 5. Controller Layer                         │
│    - Route handling                         │
│    - Swagger decorators                     │
├─────────────────────────────────────────────┤
│ 6. Service Layer                            │
│    - Business logic                         │
│    - Ownership checks                       │
│    - Data transformation                    │
├─────────────────────────────────────────────┤
│ 7. Data Access Layer                        │
│    - PrismaService (PostgreSQL)             │
│    - RedisService (cache/queue)             │
│    - SupabaseService (auth/storage)         │
├─────────────────────────────────────────────┤
│ 8. External Services                        │
│    - AI Providers (OpenAI/Gemini)           │
│    - Push Notification (FCM)                │
│    - Email (optional)                       │
└─────────────────────────────────────────────┘
```

---

## 3. Module Map

### Core Infrastructure Modules (Global)

| Module | Tanggung Jawab | Global? |
|--------|---------------|---------|
| `PrismaModule` | Database connection + Prisma client | ✅ Yes |
| `RedisModule` | Redis connection + helper methods | ✅ Yes |
| `SupabaseModule` | Supabase client (auth + storage) | ✅ Yes |

### Feature Modules

| Module | Domain | Dependensi |
|--------|--------|-----------|
| `HealthModule` | Health check + readiness | PrismaModule, RedisModule |
| `AuthModule` | Register, login, OAuth, token | SupabaseModule, PrismaModule |
| `UserModule` | User profile CRUD | PrismaModule, AuthModule |
| `DeviceModule` | Device register, pair, revoke | PrismaModule, RedisModule |
| `SyncModule` | Push, batch, pull, ack | PrismaModule, BullMQ, DeviceModule |
| `DataModule` | Core data CRUD | PrismaModule |
| `TelemetryModule` | Device telemetry storage | PrismaModule, DeviceModule |
| `AuditModule` | Audit log writing + querying | PrismaModule |
| `NotificationModule` | In-app + push notifications | PrismaModule, RedisModule |
| `AiGatewayModule` | AI request proxy + history | PrismaModule, external AI |
| `AdminModule` | Admin dashboard + management | Semua module di atas |

### Module Dependency Graph

```
HealthModule ──────► PrismaModule
                 ├─► RedisModule
                 └─► SupabaseModule

AuthModule ────────► SupabaseModule
                 └─► PrismaModule

UserModule ────────► PrismaModule
                 └─► AuthModule (guard re-use)

DeviceModule ──────► PrismaModule
                 └─► RedisModule (heartbeat cache)

SyncModule ────────► PrismaModule
                 ├─► BullMQ (queue)
                 ├─► RedisModule
                 └─► DeviceModule (ownership verify)

DataModule ────────► PrismaModule

TelemetryModule ───► PrismaModule

AuditModule ───────► PrismaModule

NotificationModule ► PrismaModule

AiGatewayModule ───► PrismaModule
                 └─► External HTTP (AI provider)

AdminModule ───────► All modules (read-only aggregation)
```

---

## 4. Folder Structure

```
src/
├── main.ts                          # Bootstrap, Swagger, global config
├── app.module.ts                    # Root module — imports semua module
│
├── common/                          # Shared utilities (TIDAK punya module sendiri)
│   ├── config/
│   │   ├── configuration.ts         # Config factory function
│   │   └── env.validation.ts        # Joi validation schema untuk .env
│   ├── constants/
│   │   ├── error-codes.ts           # Enum error codes (AUTH_001, DEVICE_001, dll)
│   │   └── roles.ts                 # Role enum constants
│   ├── decorators/
│   │   ├── roles.decorator.ts       # @Roles('admin', 'user')
│   │   ├── current-user.decorator.ts # @CurrentUser() param decorator
│   │   └── current-device.decorator.ts # @CurrentDevice() param decorator
│   ├── dto/
│   │   ├── pagination.dto.ts        # Shared pagination query DTO
│   │   └── api-response.dto.ts      # Response wrapper DTO
│   ├── filters/
│   │   └── http-exception.filter.ts # Global exception handler
│   ├── guards/
│   │   ├── jwt-auth.guard.ts        # Verify Supabase JWT untuk user
│   │   ├── device-auth.guard.ts     # Verify device token
│   │   └── roles.guard.ts           # RBAC enforcement
│   ├── interceptors/
│   │   ├── transform.interceptor.ts # Wrap response dalam format standar
│   │   ├── logging.interceptor.ts   # Log setiap request/response
│   │   └── audit.interceptor.ts     # Write audit log untuk sensitive endpoints
│   ├── middleware/
│   │   └── request-id.middleware.ts  # Inject X-Request-Id ke setiap request
│   └── interfaces/
│       ├── api-response.interface.ts # TypeScript interface untuk response
│       └── authenticated-request.interface.ts # Request + user/device info
│
├── prisma/
│   ├── prisma.module.ts             # Global Prisma module
│   └── prisma.service.ts            # Prisma client + onModuleInit
│
├── redis/
│   ├── redis.module.ts              # Global Redis module
│   └── redis.service.ts             # Redis client wrapper
│
├── supabase/
│   ├── supabase.module.ts           # Global Supabase module
│   └── supabase.service.ts          # Supabase client wrapper
│
└── modules/
    ├── health/
    │   ├── health.module.ts
    │   └── health.controller.ts
    │
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   └── dto/
    │       ├── register.dto.ts
    │       ├── login.dto.ts
    │       ├── oauth-google.dto.ts
    │       └── refresh-token.dto.ts
    │
    ├── user/
    │   ├── user.module.ts
    │   ├── user.controller.ts
    │   ├── user.service.ts
    │   └── dto/
    │       └── update-profile.dto.ts
    │
    ├── device/
    │   ├── device.module.ts
    │   ├── device.controller.ts
    │   ├── device.service.ts
    │   └── dto/
    │       ├── register-device.dto.ts
    │       ├── pair-start.dto.ts
    │       └── pair-confirm.dto.ts
    │
    ├── sync/
    │   ├── sync.module.ts
    │   ├── sync.controller.ts
    │   ├── sync.service.ts
    │   ├── sync.processor.ts         # BullMQ worker
    │   └── dto/
    │       ├── sync-push.dto.ts
    │       ├── sync-batch.dto.ts
    │       └── sync-ack.dto.ts
    │
    ├── data/
    │   ├── data.module.ts
    │   ├── data.controller.ts
    │   ├── data.service.ts
    │   └── dto/
    │       ├── create-data.dto.ts
    │       └── update-data.dto.ts
    │
    ├── telemetry/
    │   ├── telemetry.module.ts
    │   ├── telemetry.controller.ts
    │   ├── telemetry.service.ts
    │   └── dto/
    │       └── push-telemetry.dto.ts
    │
    ├── notification/
    │   ├── notification.module.ts
    │   ├── notification.controller.ts
    │   ├── notification.service.ts
    │   └── dto/
    │
    ├── ai-gateway/
    │   ├── ai-gateway.module.ts
    │   ├── ai-gateway.controller.ts
    │   ├── ai-gateway.service.ts
    │   ├── providers/
    │   │   ├── ai-provider.interface.ts   # Abstraksi provider
    │   │   ├── openai.provider.ts
    │   │   └── gemini.provider.ts
    │   └── dto/
    │       ├── analyze.dto.ts
    │       └── chat.dto.ts
    │
    ├── audit/
    │   ├── audit.module.ts
    │   └── audit.service.ts
    │
    └── admin/
        ├── admin.module.ts
        ├── admin.controller.ts
        └── admin.service.ts
```

---

## 5. Data Flow per Use Case

### Use Case 1: User Login → Akses Data

```
App → POST /auth/login → Cloud
Cloud → Supabase Auth → verify credentials
Cloud → DB → update lastLoginAt
Cloud → return { accessToken, refreshToken }

App → GET /data (Bearer: accessToken)
Cloud → JwtAuthGuard → verify token
Cloud → UserService → get userId from token
Cloud → DataService → findMany({ where: { userId } })
Cloud → return data[]
```

### Use Case 2: Device Pairing

```
User App → POST /devices/pair/start → Cloud
Cloud → generate pairingCode + expiry (10 min)
Cloud → return { pairingCode, qrData }

User App → menampilkan QR ke operator
Pi → scan QR → dapat pairingCode + deviceId

User App → POST /devices/pair/confirm { pairingCode, deviceId }
Cloud → verify pairing code valid + not expired
Cloud → bind device ke user
Cloud → generate device_token
Cloud → return { deviceToken } → Pi menyimpan secara aman
```

### Use Case 3: Offline → Online Sync

```
(Offline)
Pi → menyimpan data lokal ke SQLite

(Saat internet kembali)
Pi → POST /sync/batch { items[] }
Cloud → validate → Filter idempotent → create SyncJobs (PENDING)
Cloud → enqueue ke BullMQ
Cloud → return 202 { accepted, skipped, jobIds }

(Background)
BullMQ Worker → pick job → validate → write to core_data
Worker → update SyncJob status → SYNCED

(Pi polling)
Pi → GET /sync/status/:jobId
Cloud → return { status: "synced" }

Pi → POST /sync/ack { jobIds[] }
Cloud → mark acknowledged → Pi hapus data lokal
```

---

## 6. Configuration Strategy

### Environment Variables

```env
# Application
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...
SUPABASE_JWT_SECRET=your-jwt-secret

# Database
DATABASE_URL=postgresql://user:pass@host:5432/arisa?schema=public

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# AI Providers
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...

# Security
DEVICE_TOKEN_SALT_ROUNDS=12
PAIRING_CODE_EXPIRY_MINUTES=10
ACCESS_TOKEN_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

### Config Validation (Joi)

```typescript
// common/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
  SUPABASE_JWT_SECRET: Joi.string().required(),
  DATABASE_URL: Joi.string().required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
});
```

---

## 7. API Response Contract

Semua endpoint WAJIB mengembalikan format berikut:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-04-20T10:00:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Email or password is incorrect",
    "statusCode": 401
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-04-20T10:00:00Z"
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "requestId": "...",
    "timestamp": "...",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

## 8. Error Code Convention

Format: `{DOMAIN}_{ERROR_TYPE}`

| Domain | Examples |
|--------|----------|
| AUTH | `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`, `AUTH_UNAUTHORIZED` |
| DEVICE | `DEVICE_NOT_FOUND`, `DEVICE_ALREADY_PAIRED`, `DEVICE_REVOKED` |
| SYNC | `SYNC_DUPLICATE_REQUEST`, `SYNC_PAYLOAD_INVALID`, `SYNC_CONFLICT` |
| DATA | `DATA_NOT_FOUND`, `DATA_OWNERSHIP_DENIED` |
| SYSTEM | `SYSTEM_INTERNAL_ERROR`, `SYSTEM_SERVICE_UNAVAILABLE` |

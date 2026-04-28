# ARISA Cloud Backend — Database Schema

> **Dokumen ini mendefinisikan seluruh schema database PostgreSQL yang dikelola via Prisma ORM.**

---

## 1. Database Technology

| Komponen | Technology |
|----------|-----------|
| Database Engine | PostgreSQL 15+ (via Supabase) |
| ORM | Prisma |
| Migration | Prisma Migrate |
| Connection Pool | Prisma default + PgBouncer (Supabase) |

---

## 2. Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐
│      users       │       │     devices       │
│──────────────────│       │──────────────────│
│ id (PK, UUID)    │       │ id (PK, UUID)    │
│ supabase_id (UQ) │       │ device_serial(UQ)│
│ email (UQ)       │       │ device_name      │
│ name             │       │ token_hash       │
│ avatar_url       │       │ pairing_status   │
│ role             │       │ pairing_code     │
│ status           │       │ pairing_expiry   │
│ last_login_at    │       │ status           │
│ created_at       │       │ firmware_version │
│ updated_at       │       │ last_seen_at     │
└──────┬───────────┘       └──────┬───────────┘
       │                          │
       │    ┌──────────────────┐  │
       │    │   user_devices   │  │
       └───►│──────────────────│◄─┘
            │ id (PK, UUID)    │
            │ user_id (FK)     │
            │ device_id (FK)   │
            │ is_primary       │
            │ paired_at        │
            │ revoked_at       │
            │ UQ(user,device)  │
            └──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│    sync_jobs     │       │    core_data     │
│──────────────────│       │──────────────────│
│ id (PK, UUID)    │       │ id (PK, UUID)    │
│ request_id (UQ)  │       │ user_id (FK)     │
│ device_id (FK)   │       │ device_id (FK?)  │
│ user_id (FK)     │       │ data_type        │
│ payload_type     │       │ data_json        │
│ payload_raw      │       │ version          │
│ status           │       │ source           │
│ retry_count      │       │ event_id (UQ?)   │
│ error_message    │       │ created_at       │
│ processed_at     │       │ updated_at       │
│ created_at       │       └──────────────────┘
│ updated_at       │
└──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│    telemetry     │       │   audit_logs     │
│──────────────────│       │──────────────────│
│ id (PK, UUID)    │       │ id (PK, UUID)    │
│ device_id (FK)   │       │ actor_type       │
│ cpu_temp         │       │ actor_id         │
│ cpu_usage        │       │ action           │
│ ram_usage        │       │ target_type      │
│ disk_usage       │       │ target_id        │
│ uptime           │       │ metadata         │
│ network_status   │       │ ip_address       │
│ battery_status   │       │ user_agent       │
│ created_at       │       │ created_at       │
└──────────────────┘       └──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│  notifications   │       │   ai_requests    │
│──────────────────│       │──────────────────│
│ id (PK, UUID)    │       │ id (PK, UUID)    │
│ user_id (FK)     │       │ user_id (FK)     │
│ type             │       │ request_type     │
│ title            │       │ input_payload    │
│ body             │       │ output_result    │
│ status           │       │ provider         │
│ metadata         │       │ status           │
│ read_at          │       │ duration_ms      │
│ created_at       │       │ token_usage      │
└──────────────────┘       │ created_at       │
                           └──────────────────┘
```

---

## 3. Complete Prisma Schema

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ===================== ENUMS =====================

enum UserRole {
  SUPER_ADMIN
  ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

enum DevicePairingStatus {
  UNPAIRED
  PAIRING
  PAIRED
  REVOKED
}

enum DeviceStatus {
  ACTIVE
  DISABLED
  DECOMMISSIONED
}

enum SyncJobStatus {
  PENDING
  QUEUED
  PROCESSING
  SYNCED
  FAILED
  CONFLICT
}

enum NotificationStatus {
  UNREAD
  READ
  ARCHIVED
}

// ===================== MODELS =====================

/// Tabel user utama. Setiap user punya 1 record Supabase Auth yang terikat via supabase_id.
model User {
  id            String     @id @default(uuid()) @db.Uuid
  supabaseId    String     @unique @map("supabase_id")
  email         String     @unique
  name          String?
  avatarUrl     String?    @map("avatar_url")
  role          UserRole   @default(USER)
  status        UserStatus @default(ACTIVE)
  lastLoginAt   DateTime?  @map("last_login_at")
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  // Relations
  devices       UserDevice[]
  syncJobs      SyncJob[]
  coreData      CoreData[]
  notifications Notification[]
  aiRequests    AiRequest[]

  @@map("users")
}

/// Tabel device Raspberry Pi. Setiap Pi punya serial unik dan token ter-hash.
model Device {
  id              String              @id @default(uuid()) @db.Uuid
  deviceName      String              @map("device_name")
  deviceSerial    String              @unique @map("device_serial")
  tokenHash       String              @map("token_hash")
  pairingStatus   DevicePairingStatus @default(UNPAIRED) @map("pairing_status")
  pairingCode     String?             @map("pairing_code")
  pairingExpiry   DateTime?           @map("pairing_expiry")
  status          DeviceStatus        @default(ACTIVE)
  firmwareVersion String?             @map("firmware_version")
  appVersion      String?             @map("app_version")
  lastSeenAt      DateTime?           @map("last_seen_at")
  metadata        Json?
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")

  // Relations
  owners          UserDevice[]
  syncJobs        SyncJob[]
  coreData        CoreData[]
  telemetry       Telemetry[]

  @@map("devices")
}

/// Tabel relasi many-to-many antara user dan device.
/// Satu user bisa punya banyak device, satu device bisa dipindahkan ke user lain.
model UserDevice {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  deviceId  String    @map("device_id") @db.Uuid
  isPrimary Boolean   @default(false) @map("is_primary")
  pairedAt  DateTime  @default(now()) @map("paired_at")
  revokedAt DateTime? @map("revoked_at")

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@unique([userId, deviceId])
  @@map("user_devices")
}

/// Tabel antrian sinkronisasi. Setiap data yang dikirim dari Pi masuk sebagai SyncJob.
/// request_id UNIQUE → idempotency. Kirim ulang tidak dobel.
model SyncJob {
  id           String        @id @default(uuid()) @db.Uuid
  requestId    String        @unique @map("request_id")
  deviceId     String        @map("device_id") @db.Uuid
  userId       String        @map("user_id") @db.Uuid
  payloadType  String        @map("payload_type")
  payloadRaw   Json          @map("payload_raw")
  status       SyncJobStatus @default(PENDING)
  retryCount   Int           @default(0) @map("retry_count")
  maxRetries   Int           @default(5) @map("max_retries")
  errorMessage String?       @map("error_message")
  processedAt  DateTime?     @map("processed_at")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")

  device Device @relation(fields: [deviceId], references: [id])
  user   User   @relation(fields: [userId], references: [id])

  @@index([deviceId, status])
  @@index([userId, createdAt])
  @@index([status, createdAt])
  @@map("sync_jobs")
}

/// Tabel data inti bisnis ARISA.
/// Ini adalah "sumber kebenaran" setelah data melewati sync engine.
model CoreData {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  deviceId  String?  @map("device_id") @db.Uuid
  dataType  String   @map("data_type")
  dataJson  Json     @map("data_json")
  version   Int      @default(1)
  source    String   // "cloud" | "edge" | "app"
  eventId   String?  @unique @map("event_id") // Idempotency key dari source
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user   User    @relation(fields: [userId], references: [id])
  device Device? @relation(fields: [deviceId], references: [id])

  @@index([userId, dataType, createdAt])
  @@index([deviceId, createdAt])
  @@map("core_data")
}

/// Tabel telemetry: data teknis device (CPU, RAM, disk, dll).
/// Append-only — tidak pernah di-update, hanya insert.
model Telemetry {
  id            String   @id @default(uuid()) @db.Uuid
  deviceId      String   @map("device_id") @db.Uuid
  cpuTemp       Float?   @map("cpu_temp")
  cpuUsage      Float?   @map("cpu_usage")
  ramUsage      Float?   @map("ram_usage")
  diskUsage     Float?   @map("disk_usage")
  uptime        Int?     // in seconds
  networkStatus String?  @map("network_status")  // "online" | "offline" | "degraded"
  batteryStatus String?  @map("battery_status")
  metadata      Json?
  createdAt     DateTime @default(now()) @map("created_at")

  device Device @relation(fields: [deviceId], references: [id])

  @@index([deviceId, createdAt])
  @@map("telemetry")
}

/// Tabel audit log. Mencatat semua aksi penting: login, pairing, revoke, sync, admin action.
/// actor_id bisa berisi user_id, device_id, atau "system".
/// Tidak ada foreign key ke user — agar device dan system juga bisa jadi actor. (EVALUASI: lihat 09-EVALUATION.md)
model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  actorType  String   @map("actor_type")   // "user" | "device" | "system"
  actorId    String   @map("actor_id")     // UUID of actor (no FK — polymorphic)
  action     String                         // "auth.login" | "device.pair" | "sync.push" etc
  targetType String?  @map("target_type")  // "user" | "device" | "sync_job" | null
  targetId   String?  @map("target_id")
  metadata   Json?                          // Extra context
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([actorId, createdAt])
  @@index([action, createdAt])
  @@index([targetType, targetId, createdAt])
  @@map("audit_logs")
}

/// Tabel notifikasi in-app untuk user.
model Notification {
  id        String             @id @default(uuid()) @db.Uuid
  userId    String             @map("user_id") @db.Uuid
  type      String             // "device.paired" | "sync.failed" | "ai.result"
  title     String
  body      String
  status    NotificationStatus @default(UNREAD)
  metadata  Json?
  readAt    DateTime?          @map("read_at")
  createdAt DateTime           @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@index([userId, status, createdAt])
  @@map("notifications")
}

/// Tabel log AI requests + responses.
model AiRequest {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  requestType  String   @map("request_type")  // "analyze" | "chat"
  inputPayload Json     @map("input_payload")
  outputResult Json?    @map("output_result")
  provider     String                          // "openai" | "gemini" | "local"
  status       String                          // "pending" | "completed" | "failed"
  durationMs   Int?     @map("duration_ms")
  tokenUsage   Json?    @map("token_usage")    // { prompt: N, completion: N, total: N }
  createdAt    DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
  @@map("ai_requests")
}
```

---

## 4. Index Strategy

### Primary Lookups (Critical Performance)

| Query Pattern | Index | Table |
|---------------|-------|-------|
| User login by email | `users.email` (unique) | users |
| User lookup by supabase ID | `users.supabase_id` (unique) | users |
| Device lookup by serial | `devices.device_serial` (unique) | devices |
| Sync idempotency check | `sync_jobs.request_id` (unique) | sync_jobs |
| Data dedup check | `core_data.event_id` (unique) | core_data |

### List/Filter Queries

| Query Pattern | Index | Table |
|---------------|-------|-------|
| User's devices | `user_devices(user_id, device_id)` (unique) | user_devices |
| Pending sync jobs per device | `sync_jobs(device_id, status)` | sync_jobs |
| Queue processing order | `sync_jobs(status, created_at)` | sync_jobs |
| User's data listing | `core_data(user_id, data_type, created_at)` | core_data |
| Device telemetry history | `telemetry(device_id, created_at)` | telemetry |
| User notifications | `notifications(user_id, status, created_at)` | notifications |
| Audit log search | `audit_logs(action, created_at)` | audit_logs |
| Audit log by target | `audit_logs(target_type, target_id, created_at)` | audit_logs |

---

## 5. Data Lifecycle

### User Data

```
Register → ACTIVE → (admin suspend) → SUSPENDED → (re-activate) → ACTIVE
                  → (delete request) → DELETED (soft delete)
```

### Device Data

```
Register → UNPAIRED → (pairing start) → PAIRING → (confirm) → PAIRED
                                                 → (expiry) → UNPAIRED
         → PAIRED → (revoke) → REVOKED → (re-register) → UNPAIRED
         → ACTIVE → (admin disable) → DISABLED → DECOMMISSIONED
```

### Sync Job Data

```
Push → PENDING → (worker pick) → PROCESSING → SYNCED ✓
                                             → FAILED → (retry) → PROCESSING
                                             → CONFLICT → (manual/auto resolve)
         → (idempotent hit) → skip, return existing
```

---

## 6. Data Retention Policy

| Data Type | Retention | Alasan |
|-----------|-----------|--------|
| users | Permanent | Identity data |
| devices | Permanent | Asset tracking |
| core_data | Permanent | Business data |
| sync_jobs | 90 days (after SYNCED) | Audit trail, lalu archive |
| telemetry | 30 days | Time-series, ringkas lama |
| audit_logs | 1 year | Compliance |
| notifications | 90 days (after READ) | Not critical long-term |
| ai_requests | 30 days | Cost tracking |

> **Catatan**: Retention policy diimplementasikan via cron job / scheduled task yang jalan berkala. Bukan di Fase 1 — implement di Fase 4 atau setelahnya.

# ARISA Cloud Backend — Getting Started

> **Dokumen ini menjelaskan langkah-langkah untuk menjalankan ARISA Cloud Backend dari nol.**

---

## Prerequisites

Pastikan sudah terinstall:

| Software | Versi Minimum | Cek Versi |
|----------|---------------|-----------|
| **Node.js** | v18+ | `node -v` |
| **npm** | v9+ | `npm -v` |
| **Git** | any | `git --version` |
| **Docker Desktop** | any (untuk local dev) | `docker --version` |

### Akun yang Dibutuhkan
- **Supabase** — Buat project di [supabase.com](https://supabase.com). Gratis untuk development.

---

## Step 1 — Clone & Install

```bash
# Clone repo
git clone <repository-url>
cd back_end

# Install dependencies
npm install
```

---

## Step 2 — Setup Environment

```bash
# Copy file .env.example ke .env
cp .env.example .env
```

Buka file `.env` dan isi nilai-nilai berikut:

### Supabase (WAJIB)
Ambil dari **Supabase Dashboard → Settings → API**:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...    # anon/public key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # service_role key (RAHASIA!)
SUPABASE_JWT_SECRET=your-jwt-secret    # Settings → API → JWT Secret
```

### Database (WAJIB)
**Opsi A** — Supabase PostgreSQL (recommended):
```env
# Ambil dari Supabase Dashboard → Settings → Database → Connection String → URI
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

**Opsi B** — Local Docker PostgreSQL:
```env
DATABASE_URL=postgresql://arisa:arisa_dev_password@localhost:5432/arisa?schema=public
```

### Redis (OPSIONAL untuk dev)
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```
> **Note**: Server bisa jalan TANPA Redis. Redis hanya diperlukan untuk BullMQ queue dan caching.

### Device Security
```env
DEVICE_REGISTRATION_SECRET=ganti-dengan-string-random-yang-aman
DEVICE_TOKEN_SALT_ROUNDS=12
PAIRING_CODE_EXPIRY_MINUTES=10
```

---

## Step 3 — Jalankan Database

### Opsi A: Pakai Supabase (skip Docker)
Tidak perlu menjalankan apa-apa. Langsung ke Step 4.

### Opsi B: Pakai Docker Lokal
```bash
# Start PostgreSQL + Redis containers
docker compose up -d

# Verifikasi containers running
docker compose ps
```

Output yang diharapkan:
```
NAME              STATUS    PORTS
arisa-postgres    running   0.0.0.0:5432->5432/tcp
arisa-redis       running   0.0.0.0:6379->6379/tcp
```

---

## Step 4 — Setup Database Schema

```bash
# Generate Prisma client
npx prisma generate

# Jalankan migration (buat tabel di database)
npx prisma migrate dev --name init
```

> **Troubleshooting**: Jika migration gagal, pastikan `DATABASE_URL` di `.env` sudah benar dan database bisa diakses.

### Verifikasi Database
```bash
# Buka Prisma Studio (GUI database browser)
npx prisma studio
```
Akan terbuka di `http://localhost:5555`. Pastikan semua tabel terbuat.

---

## Step 5 — Jalankan Server

```bash
# Development mode (auto-reload on file change)
npm run start:dev
```

Output yang diharapkan:
```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] AppModule dependencies initialized
[Nest] LOG [InstanceLoader] PrismaModule dependencies initialized
[Nest] LOG [InstanceLoader] RedisModule dependencies initialized
[Nest] LOG [InstanceLoader] HealthModule dependencies initialized
[Nest] LOG [InstanceLoader] AuthModule dependencies initialized
[Nest] LOG [InstanceLoader] UserModule dependencies initialized
[Nest] LOG [InstanceLoader] DeviceModule dependencies initialized
[Nest] LOG [InstanceLoader] SyncModule dependencies initialized
...
[Nest] LOG [PrismaService] Database connection established
[Nest] LOG [NestApplication] Nest application successfully started

🚀 ARISA Cloud Backend running on port 3000
📚 Swagger docs: http://localhost:3000/api/docs
❤️  Health check: http://localhost:3000/health
```

> **Warning Redis**: Jika muncul `Redis not available ... running without cache`, itu NORMAL jika Docker/Redis tidak dijalankan. Server tetap berfungsi penuh.

---

## Step 6 — Verifikasi

### Health Check
```bash
# Liveness
curl http://localhost:3000/health

# Readiness (cek semua dependency)
curl http://localhost:3000/ready
```

### Swagger UI
Buka browser ke: **http://localhost:3000/api/docs**

Di sini kamu bisa:
- Lihat semua endpoint yang tersedia
- Test endpoint langsung dari browser
- Lihat request/response schema

### Test Register + Login
1. Buka Swagger → **Auth** section
2. `POST /api/v1/auth/register` → isi email + password → Execute
3. Copy `accessToken` dari response
4. Klik **Authorize** (🔒) di atas → paste token → Authorize
5. `GET /api/v1/users/me` → Execute → lihat profile kamu

---

## Perintah-Perintah Penting

| Perintah | Kegunaan |
|----------|----------|
| `npm run start:dev` | Jalankan server (development, auto-reload) |
| `npm run build` | Build TypeScript ke JavaScript |
| `npm run start:prod` | Jalankan build production |
| `npm run lint` | Cek code style |
| `npm run format` | Auto-format code |
| `npm test` | Jalankan unit test |
| `npx prisma generate` | Regenerate Prisma client setelah ubah schema |
| `npx prisma migrate dev --name <nama>` | Buat migration baru |
| `npx prisma studio` | Buka database GUI browser |
| `npx prisma db push` | Push schema ke DB tanpa migration |
| `docker compose up -d` | Start Docker containers |
| `docker compose down` | Stop Docker containers |

---

## Struktur Folder

```
back_end/
├── prisma/
│   └── schema.prisma          # Database schema (9 models)
├── prisma.config.ts           # Prisma 7 CLI config
├── src/
│   ├── main.ts                # Entry point (Helmet, CORS, Swagger)
│   ├── app.module.ts          # Root module (11 feature modules)
│   ├── common/                # Shared utilities
│   │   ├── config/            # Env validation + config factory
│   │   ├── constants/         # Error codes, roles
│   │   ├── decorators/        # @Public, @Roles, @CurrentUser, @CurrentDevice
│   │   ├── filters/           # Global exception filter
│   │   ├── guards/            # JWT, RBAC, Device auth
│   │   ├── interceptors/      # Response transform, logging
│   │   └── middleware/        # Request ID
│   ├── prisma/                # Database connection
│   ├── redis/                 # Cache (optional)
│   ├── supabase/              # Auth provider
│   └── modules/
│       ├── health/            # GET /health, GET /ready
│       ├── auth/              # Register, Login, OAuth, Refresh, Logout
│       ├── user/              # Profile management
│       ├── device/            # Pi registration, pairing, heartbeat
│       ├── sync/              # Data sync cloud ↔ edge
│       ├── data/              # Core data CRUD
│       ├── telemetry/         # Device metrics
│       ├── audit/             # Action logging
│       ├── notification/      # In-app notifications
│       ├── ai-gateway/        # AI provider proxy
│       └── admin/             # Admin dashboard
├── docs/                      # ← kamu di sini! 📖
├── docker-compose.yml         # Local dev containers
├── .env.example               # Template environment variables
└── package.json
```

---

## Troubleshooting

### ❌ `PrismaClientInitializationError`
**Penyebab**: `DATABASE_URL` salah atau database tidak bisa diakses.
**Solusi**: Cek `.env`, pastikan PostgreSQL running, coba `npx prisma db push`.

### ❌ `listen EADDRINUSE: address already in use :::3000`
**Penyebab**: Port 3000 sudah dipakai process lain.
**Solusi**: Kill process: `taskkill /F /IM node.exe` (Windows) atau `kill $(lsof -t -i:3000)` (Mac/Linux).

### ❌ `Redis not available`
**Penyebab**: Redis tidak running.
**Solusi**: Ini WARNING, bukan error. Server tetap jalan. Jalankan `docker compose up -d` jika butuh Redis.

### ❌ `Supabase signUp error`
**Penyebab**: Supabase credentials salah.
**Solusi**: Cek `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di `.env`. Pastikan sama dengan di Supabase Dashboard.

### ❌ `prisma migrate` gagal
**Penyebab**: Database belum ready atau sudah ada tabel konflik.
**Solusi**: Coba `npx prisma db push --force-reset` (⚠️ ini HAPUS semua data!).

---

## Langkah Selanjutnya

Setelah server berjalan:

1. **🧪 Test API via Swagger** — Buka `/api/docs`, coba register → login → explore
2. **📱 Connect mobile app** — Gunakan `accessToken` dari login sebagai `Bearer` header
3. **🔧 Setup Raspberry Pi** — Baca [EDGE-RASPBERRY-PI.md](./EDGE-RASPBERRY-PI.md)
4. **📊 Baca API Reference** — Lihat [API-REFERENCE.md](./API-REFERENCE.md)
5. **🔐 Pelajari Auth flow** — Lihat [AUTH-SECURITY.md](./AUTH-SECURITY.md)

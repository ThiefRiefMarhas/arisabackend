# ARISA Cloud Backend — System Overview

> **Dokumen ini adalah entry point untuk memahami seluruh sistem ARISA Cloud Backend.**
> Setiap developer yang bergabung harus baca dokumen ini terlebih dahulu.

---

## Apa itu ARISA?

ARISA adalah sistem hybrid IoT untuk sektor pertanian yang terdiri dari:

1. **Mobile/Web App** — interface utama untuk petani dan operator
2. **Cloud Backend** — pusat identitas, data, sync, AI, dan monitoring
3. **Edge Backend (Raspberry Pi)** — server lokal yang bekerja offline dan sync ke cloud

## Arsitektur Tingkat Tinggi

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
│  ┌──────────────┐              ┌──────────────────────┐     │
│  │  Mobile/Web   │              │   Raspberry Pi       │     │
│  │    App        │              │   Edge Backend       │     │
│  └──────┬───────┘              └──────────┬───────────┘     │
│         │ HTTPS                           │ HTTPS           │
└─────────┼─────────────────────────────────┼─────────────────┘
          │                                 │
          ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   CLOUD BACKEND (NestJS)                     │
│                                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │  Auth  │ │ Device │ │  Sync  │ │  Data  │ │  AI    │    │
│  │ Module │ │ Module │ │ Module │ │ Module │ │Gateway │    │
│  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘    │
│      │          │          │          │          │           │
│  ┌───┴──────────┴──────────┴──────────┴──────────┘          │
│  │                                                           │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │  │Telemetry │ │  Audit   │ │ Notif    │ │  Admin   │    │
│  │  │ Module   │ │ Module   │ │ Module   │ │ Module   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│  └──────────────────────────────────────────────────────────│
│                                                              │
│           ┌──────────────┐  ┌──────────────┐                │
│           │   Prisma     │  │    BullMQ    │                │
│           │   Service    │  │    Workers   │                │
│           └──────┬───────┘  └──────┬───────┘                │
└──────────────────┼─────────────────┼────────────────────────┘
                   │                 │
         ┌─────────┼─────────────────┼──────────┐
         │         ▼                 ▼          │
         │  ┌─────────────┐  ┌─────────────┐   │
         │  │ PostgreSQL  │  │    Redis     │   │
         │  │ (Supabase)  │  │  (Cache/Q)  │   │
         │  └─────────────┘  └─────────────┘   │
         │         DATA LAYER                   │
         │  ┌─────────────┐                     │
         │  │ Supabase    │                     │
         │  │ Storage     │                     │
         │  └─────────────┘                     │
         └──────────────────────────────────────┘
```

## 3 Mode Operasi

| Mode | App | Pi | Cloud | Alur Data |
|------|-----|-----|-------|-----------|
| **Online-Online** | ✅ Online | ✅ Online | ✅ | App → Cloud ← Pi |
| **Offline-Online** | ❌ Offline | ✅ Online | ✅ | Pi simpan lokal → Sync ke cloud nanti |
| **Offline-Offline** | ❌ Offline | ❌ Offline | ❌ | Pi pakai credential cache, sync saat online |

## Prinsip Desain Inti

1. **Cloud = Sumber kebenaran utama** — semua keputusan final di cloud
2. **Pi = Buffer sementara** — menyimpan dan forward data
3. **Identitas terkontrol** — tidak boleh ada identitas baru tanpa cloud approval
4. **Sync idempotent** — kirim ulang aman, data tidak dobel
5. **Observability from day one** — semua komponen harus terlihat
6. **Security by default** — token, hash, audit, revocation

## Dokumentasi Lengkap

| # | Dokumen | Isi |
|---|---------|-----|
| 00 | [Overview](./00-OVERVIEW.md) | Dokumen ini — ringkasan sistem |
| 01 | [Architecture](./01-ARCHITECTURE.md) | Arsitektur detail + evaluasi keputusan |
| 02 | [Database](./02-DATABASE.md) | Schema, tabel, index, relasi |
| 03 | [API Reference](./03-API.md) | Semua endpoint + request/response |
| 04 | [Sync Engine](./04-SYNC.md) | Mekanisme sinkronisasi cloud ↔ edge |
| 05 | [Auth & Security](./05-AUTH.md) | Autentikasi, otorisasi, keamanan |
| 06 | [Edge Backend Guide](./06-EDGE.md) | Apa yang harus dibangun di Raspberry Pi |
| 07 | [Observability](./07-OBSERVABILITY.md) | Logging, monitoring, health check |
| 08 | [Build Phases](./08-BUILD.md) | Fase build + checklist eksekusi |
| 09 | [Architecture Evaluation](./09-EVALUATION.md) | Review kritis + decision log |

## Tech Stack

| Layer | Technology | Alasan |
|-------|-----------|--------|
| Framework | NestJS (TypeScript) | Modular, DI, ekosistem rich |
| Database | PostgreSQL (Supabase) | Managed, RLS, proven |
| ORM | Prisma | Type-safe, migration-first |
| Auth | Supabase Auth | OAuth, email, JWT built-in |
| Cache/Queue | Redis | Fast, BullMQ compatible |
| Job Queue | BullMQ | Retry, DLQ, dashboard |
| Object Storage | Supabase Storage | Unified with DB |
| API Docs | Swagger (OpenAPI) | Auto-generated dari decorator |
| Container | Docker Compose | Dev & prod consistency |

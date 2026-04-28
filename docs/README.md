# ARISA Cloud Backend — Documentation

> Dokumentasi lengkap untuk arsitektur, API, dan operasional ARISA Hybrid Backend.

---

## 📖 Daftar Dokumen

### 🚀 Memulai
| Dokumen | Deskripsi |
|---------|-----------|
| [**GETTING-STARTED.md**](./GETTING-STARTED.md) | **Mulai dari sini** — setup environment, install, run, dan test |

### 🏗️ Arsitektur & Desain
| Dokumen | Deskripsi |
|---------|-----------|
| [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md) | Gambaran besar sistem ARISA: cloud + edge, mode operasi, tech stack |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Detail arsitektur modular: module map, data flow, config pattern |
| [ARCHITECTURE-DECISIONS.md](./ARCHITECTURE-DECISIONS.md) | Log keputusan arsitektur (ADR): kenapa memilih X bukan Y |

### 💾 Backend Reference
| Dokumen | Deskripsi |
|---------|-----------|
| [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) | Prisma schema, ER diagram, index strategy, migration guide |
| [API-REFERENCE.md](./API-REFERENCE.md) | Semua endpoint API: request/response format, auth, error codes |
| [AUTH-SECURITY.md](./AUTH-SECURITY.md) | Dual-layer auth (JWT + Device Token), RBAC, security hardening |
| [SYNC-ENGINE.md](./SYNC-ENGINE.md) | Sync pipeline: idempotency, LWW conflict resolution, retry strategy |
| [OBSERVABILITY.md](./OBSERVABILITY.md) | Logging, health checks, audit trail, monitoring |

### 🔧 Edge & Deployment
| Dokumen | Deskripsi |
|---------|-----------|
| [EDGE-RASPBERRY-PI.md](./EDGE-RASPBERRY-PI.md) | **Guide lengkap Raspberry Pi**: setup, code, sync, offline mode |
| [BUILD-PHASES.md](./BUILD-PHASES.md) | Checklist build per fase: apa yang sudah selesai, apa yang next |

---

## 🗺️ Urutan Baca yang Disarankan

```
1. GETTING-STARTED.md      → Setup & jalankan server
2. SYSTEM-OVERVIEW.md       → Pahami gambaran besar
3. ARCHITECTURE.md          → Detail modul & data flow
4. DATABASE-SCHEMA.md       → Struktur data
5. API-REFERENCE.md         → Endpoint yang tersedia
6. AUTH-SECURITY.md          → Mekanisme auth
7. SYNC-ENGINE.md            → Cara data sync cloud ↔ edge
8. EDGE-RASPBERRY-PI.md     → Build edge backend di Pi
9. OBSERVABILITY.md          → Monitoring & logging
10. ARCHITECTURE-DECISIONS.md → Kenapa arsitektur ini dipilih
```

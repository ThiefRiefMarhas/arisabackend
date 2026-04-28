# ARISA Cloud Backend — Architecture Evaluation

> **Dokumen ini berisi evaluasi kritis terhadap semua keputusan arsitektur.**
> Review ini dilakukan SEBELUM eksekusi coding untuk menangkap masalah lebih awal.

---

## 1. Evaluasi Keputusan Arsitektur

### ✅ Keputusan yang BENAR

#### 1.1 Monolith Modular (bukan Microservices)

**Verdict: BENAR ✅**

- Untuk skala OPSI 2026 (< 1.000 user, < 500 device), microservices adalah over-engineering
- NestJS module system sudah menyediakan boundary yang cukup
- Deploy, debug, dan maintain satu service jauh lebih simpel
- Jika perlu scale nanti, module bisa diekstrak tanpa rewrite

**Risiko**: Jika load meningkat drastis → database jadi bottleneck → tapi ini bisa di-solve dengan read replica, bukan microservices.

---

#### 1.2 Prisma sebagai ORM (bukan TypeORM)

**Verdict: BENAR ✅**

- Schema-first approach → satu file `schema.prisma` jadi single source of truth
- Migration versioned dan reproducible
- Type-safe generated client → lebih sedikit runtime error
- Query API intuitif dan tidak verbose
- Portable: ganti database provider hanya ubah datasource

**Risiko**: Prisma belum support semua PostgreSQL fitur advanced (e.g., custom type, complex CTEs). Tapi untuk scope ARISA ini, sudah lebih dari cukup.

---

#### 1.3 Supabase Auth untuk User Authentication

**Verdict: BENAR ✅**

- Email/password auth + Google OAuth out-of-the-box
- JWT generation, signing, dan verification sudah diurus Supabase
- Refresh token rotation built-in
- Session management dan revocation tersedia
- Tidak perlu build auth system dari nol → save waktu signifikan

**Risiko**: Vendor dependency. Mitigasi: semua logic bisnis tetap di cloud backend kita, Supabase hanya handle token & session. Jika pindah provider, hanya `SupabaseService` yang perlu diganti.

---

#### 1.4 Dual Auth System (JWT untuk User, Token untuk Device)

**Verdict: BENAR ✅**

- User butuh OAuth, refresh, session → JWT via Supabase cocok
- Device butuh long-lived token tanpa OAuth overhead → simple hashed token lebih tepat
- Guard terpisah membuat security boundary jelas
- Pi tidak perlu library OAuth/JWT → lebih ringan

**Risiko**: Device token tidak ada expiry. Mitigasi: revocation endpoint + audit log. Token rotation manual via admin.

---

#### 1.5 BullMQ untuk Sync Queue

**Verdict: BENAR ✅**

- Battle-tested di ekosistem Node.js
- Built-in retry, exponential backoff, dead letter queue
- Dashboard visual via Bull Board
- Native NestJS integration via `@nestjs/bullmq`
- Redis sebagai backend = fast dan reliable

**Risiko**: Redis single point of failure. Mitigasi: untuk scale ini, single Redis cukup. Cluster nanti jika perlu.

---

#### 1.6 SQLite untuk Edge Backend

**Verdict: BENAR ✅**

- Ringan, file-based, tidak butuh server tambahan di Pi
- Cocok untuk buffer data sementara
- Tahan reboot (file persist di disk)
- Tidak butuh Redis di Pi (overkill untuk edge)

---

### ⚠️ Keputusan yang Perlu EVALUASI

#### 2.1 AuditLog — Polymorphic actorId (Tidak Ada Foreign Key)

**Masalah Original**:
Pada design awal, `AuditLog.actorId` punya FK ke `User`. Tapi aktor bisa juga `device` atau `system`.

**Evaluasi**: Sudah diperbaiki di schema final. `actorId` sekarang berupa `String` tanpa FK, dengan `actorType` sebagai discriminator.

**Trade-off**:
- ✅ Fleksibel — device, user, system semua bisa jadi aktor
- ❌ Tidak ada referential integrity di DB level
- ❌ Tidak bisa JOIN langsung ke User/Device table

**Mitigasi**: Audit log adalah append-only log. Referential integrity kurang kritis dibanding fleksibilitas. Query dilakukan via `WHERE actorType = 'user' AND actorId = ?`.

**Verdict: ACCEPTABLE ⚠️** — trade-off yang masuk akal.

---

#### 2.2 Swagger Path vs Global Prefix

**Masalah**: `app.setGlobalPrefix('api/v1')` akan juga menambah prefix ke Swagger endpoint (`/api/v1/api/docs`).

**Solusi yang harus diterapkan**:

```typescript
// main.ts
app.setGlobalPrefix('api/v1', {
  exclude: [
    { path: 'health', method: RequestMethod.GET },
    { path: 'ready', method: RequestMethod.GET },
  ],
});

// Swagger setup SEBELUM setGlobalPrefix, atau pakai path absolute:
SwaggerModule.setup('api/docs', app, document); // ini jadi /api/docs, bukan /api/v1/api/docs
```

**Verdict: HARUS DIPERBAIKI saat implementasi ✅**

---

#### 2.3 Supabase JWT Verification Method

**Masalah**: Ada 2 cara verify Supabase JWT:

| Metode | Cara | Pro | Kontra |
|--------|------|-----|--------|
| `supabase.auth.getUser(token)` | API call ke Supabase | Selalu akurat, session check | Network overhead, latency ~100ms |
| JWT decode manual (verify JWT secret) | Local verification | Cepat, no network | Tidak check session revocation |

**Keputusan**: Gunakan `supabase.auth.getUser(token)` karena:
1. Session revocation harus respect — kalau user logout, token harus invalid
2. Latency ~100ms masih acceptable untuk API backend
3. Lebih simple — tidak perlu manage JWT secret dan JWKS

**Optimasi yang bisa ditambahkan nanti**:
- Cache `getUser()` result di Redis selama 5 menit
- Invalidate cache saat logout/revoke

**Verdict: BENAR ✅ — dengan catatan bisa dioptimasi nanti**

---

#### 2.4 Device Token Tanpa Expiry

**Masalah**: Device token tidak ada TTL (long-lived). Jika bocor, token valid selamanya.

**Evaluasi**:
- Pi deployment di lapangan → token harus persist lintas reboot
- Expiring token berarti Pi perlu mekanisme refresh → kompleks
- Token yang bocor bisa di-revoke manual via admin

**Mitigasi**:
1. Token disimpan dengan `chmod 600` di Pi
2. Cloud hash token (bcrypt) — stolen DB dump tidak leak token
3. Admin bisa revoke device kapan saja
4. Semua device request di-log → anomaly detectable
5. **Future**: implementasi token rotation scheduled (Fase 5+)

**Verdict: ACCEPTABLE ⚠️ untuk Fase 1-4** — tambah rotation di post-MVP

---

#### 2.5 File Upload Strategy

**Masalah**: PRD menyebut Object Storage tapi belum ada endpoint file upload di API design.

**Evaluasi**: Untuk Fase 1-4, file upload belum critical. Data utama berbentuk JSON. Tapi AI analysis butuh image upload.

**Solusi yang direncanakan (Fase 4)**:
1. Upload langsung ke Supabase Storage dari client/Pi
2. Cloud backend menerima `imageUrl` (bukan file binary)
3. Cloud validate URL is from trusted Supabase Storage bucket
4. Ini menghindari cloud backend jadi file proxy → lebih efisien

```
Pi → Upload image ke Supabase Storage → dapat URL
Pi → POST /sync/push { payload: { imageUrl: "..." } }
Cloud → validate URL → proses
```

**Verdict: DEFERRED ⏳ — implementasikan di Fase 4 saat AI Gateway**

---

#### 2.6 Sync Pull — Polling vs Push

**Masalah**: Pi harus polling `GET /sync/pull` setiap 5 menit. Ini tidak real-time.

**Evaluasi**:

| Pendekatan | Pro | Kontra |
|-----------|-----|--------|
| **Polling (dipilih)** | Simple, stateless, HTTP | Delay 0-5 menit, extra requests |
| **WebSocket** | Real-time, efficient | Stateful connection, complex on Pi |
| **Server-Sent Events** | One-way real-time | Limited browser support, complex |
| **MQTT** | IoT standard, lightweight | Extra broker needed |

**Keputusan**: Polling untuk Fase 1-4. Alasan:
- Pi sudah punya schedule heartbeat → sync pull bisa piggyback
- Data dari cloud → Pi biasanya tidak time-critical (config, AI results)
- WebSocket membutuhkan connection management di Pi = complexity
- MQTT butuh broker tambahan = infrastructure cost

**Verdict: BENAR untuk sekarang ✅ — WebSocket bisa ditambah post-MVP**

---

### ❌ Masalah yang Harus DIANTISIPASI

#### 3.1 Clock Skew antara Pi dan Cloud

**Masalah**: Pi timestamp bisa tidak sinkron dengan cloud. Ini mempengaruhi LWW conflict resolution dan ordering.

**Mitigasi**:
1. Pi HARUS jalankan NTP sync (`timedatectl set-ntp true`)
2. Heartbeat response dari cloud mengandung `serverTime` → Pi bisa detect drift
3. Toleransi clock skew: ±30 detik masih acceptable
4. Jika skew > 5 menit: log warning, tetap process tapi flag

**Implementasi di cloud**:
```typescript
// Di heartbeat response
{
  "lastSeenAt": "2026-04-20T10:00:00Z",
  "serverTime": "2026-04-20T10:00:01Z"  // Pi bisa compare
}
```

---

#### 3.2 Database Growth — Telemetry Explosion

**Masalah**: Dengan 500 device × 1 telemetry per menit = 720.000 records/day = ~22 juta/bulan.

**Mitigasi**:
1. Retention policy: hapus telemetry > 30 hari
2. Aggregate telemetry menjadi hourly summary setelah 7 hari
3. Partition table by month (PostgreSQL table partitioning) — nanti jika perlu
4. Index hanya pada `device_id + created_at` — tidak index semua field

**Prioritas**: Implementasi cleanup cron di Fase 4 atau post-MVP.

---

#### 3.3 Batch Sync Payload Size

**Masalah**: 100 items × rata-rata 5KB per item = 500KB per batch. Acceptable. Tapi jika item include image data → bisa GB.

**Mitigasi**:
1. Sync payload HANYA JSON — tidak include binary
2. Image/file upload ke Supabase Storage terpisah
3. Sync payload hanya berisi URL referensi
4. Enforce max payload size: 10MB per request (NestJS body parser limit)

```typescript
// main.ts
app.use(json({ limit: '10mb' }));
```

---

#### 3.4 Concurrent Pairing Race Condition

**Masalah**: Dua user scan QR yang sama secara bersamaan.

**Mitigasi**:
1. Pairing code di-nullkan SEGERA setelah first successful confirm
2. Database unique constraint pada `user_devices(user_id, device_id)` → second insert gagal
3. Transaction wrapping pada confirm pairing
4. Second user mendapat error `DEVICE_ALREADY_PAIRED`

---

## 2. Decision Log

| # | Keputusan | Tanggal | Alasan | Status |
|---|-----------|---------|--------|--------|
| D1 | Monolith modular NestJS | 2026-04-20 | Scale cocok, simple deploy | ✅ Final |
| D2 | Prisma ORM | 2026-04-20 | Type-safe, migration versioned | ✅ Final |
| D3 | Supabase Auth | 2026-04-20 | Built-in OAuth, JWT, session | ✅ Final |
| D4 | Dual auth (JWT + device token) | 2026-04-20 | Separation of concerns | ✅ Final |
| D5 | BullMQ + Redis queue | 2026-04-20 | Retry, DLQ, dashboard | ✅ Final |
| D6 | LWW conflict resolution default | 2026-04-20 | Simple, sufficient for V1 | ✅ Final |
| D7 | REST polling (bukan WebSocket) | 2026-04-20 | Simple, Pi resource limited | ✅ Final |
| D8 | SQLite di Pi (bukan Redis) | 2026-04-20 | Lightweight, persistent | ✅ Final |
| D9 | Polymorphic AuditLog actorId | 2026-04-20 | Device + user + system actors | ✅ Final |
| D10 | No expiry device token | 2026-04-20 | Pi field deployment, revoke manual | ⚠️ Monitor |
| D11 | Supabase getUser() verification | 2026-04-20 | Session revoke respected | ✅ Final |
| D12 | File upload via Supabase Storage | 2026-04-20 | Avoid cloud as proxy | ⏳ Deferred |

---

## 3. Arsitektur — Hal yang Berubah dari Design Awal

| Item | Design Awal | Setelah Evaluasi | Reason |
|------|------------|-----------------|--------|
| AuditLog.actorId | FK ke User | Polymorphic `String` (no FK) | Device dan system juga bisa jadi actor |
| Swagger path | Terkena global prefix | Exclude dari prefix | Avoid double prefix `/api/v1/api/docs` |
| Health endpoints | Dalam global prefix | Exclude dari prefix | Health check harus accessible tanpa prefix |
| Device headers | Hanya X-Device-Token | + X-Device-Serial | Token alone can't identify device (bcrypt can't reverse) |
| Telemetry table | Unlimited retention | 30-day retention policy | Prevent DB explosion |
| File upload | Via sync push | Via Supabase Storage direct | Avoid cloud as file proxy |

---

## 4. Risiko yang Masih Perlu Dipantau

| # | Risiko | Impact | Probability | Trigger untuk Action |
|---|--------|--------|-------------|---------------------|
| R1 | Supabase free tier limit | Medium | Low | Jika user > 50.000 atau storage > 1GB |
| R2 | Redis memory overflow | High | Low | Jika sync queue > 100K pending jobs |
| R3 | Prisma connection pool exhaustion | High | Low | Jika concurrent request > 100 |
| R4 | Telemetry table bloat | Medium | Medium | Jika records > 10 juta |
| R5 | Pi clock skew > 5 minutes | Low | Medium | Implement NTP check di Pi |
| R6 | Leaked device token | High | Low | Implement audit + anomaly detection |

---

## 5. Final Verdict

### Arsitektur ini SIAP untuk dieksekusi? ✅ YA

**Alasan**:
1. Setiap keputusan sudah dievaluasi dan di-justified
2. Trade-off sudah didokumentasikan
3. Masalah yang ditemukan ada mitigasinya
4. Tidak ada red flag yang memerlukan redesign fundamental
5. Schema database sudah komprehensif dan ter-normalisasi
6. API sudah lengkap dan konsisten
7. Sync engine sudah dipikirkan sampai edge cases

**Yang harus diingat selama development**:
1. Swagger path → exclude dari global prefix
2. Health endpoints → exclude dari global prefix
3. Device auth → butuh SERIAL + TOKEN (bukan token saja)
4. AuditLog → polymorphic, jangan FK ke User only
5. Telemetry → plan retention cleanup
6. File upload → via Supabase Storage, bukan via sync push

### Urutan Eksekusi

```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4
  ↑ TIDAK BOLEH LONCAT. Auth harus selesai sebelum device. Device sebelum sync.
```

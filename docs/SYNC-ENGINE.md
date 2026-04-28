# ARISA Cloud Backend — Sync Engine

> **Dokumen ini menjelaskan secara detail bagaimana sinkronisasi data antara Raspberry Pi (edge) dan Cloud bekerja.**
> Ini adalah komponen paling kritis dalam arsitektur ARISA.

---

## 1. Prinsip Dasar Sync

| # | Prinsip | Kenapa |
|---|---------|--------|
| 1 | **Cloud = sumber kebenaran** | Semua data final hidup di cloud |
| 2 | **Edge = buffer sementara** | Pi menyimpan data sementara saat offline |
| 3 | **Idempotent** | Request yang sama dikirim ulang tidak dobel di database |
| 4 | **Ordered by timestamp** | Data diproses berdasarkan waktu event, bukan waktu diterima |
| 5 | **Acknowledge-based** | Pi baru hapus data lokal setelah mendapat konfirmasi dari cloud |
| 6 | **Fault tolerant** | Gagal network, gagal processing — harus bisa recover otomatis |

---

## 2. Sync Flow Overview

### 2.1 Normal Flow (Online)

```
Pi menerima data sensor
    ↓
Pi langsung POST /sync/push ke Cloud
    ↓
Cloud terima → buat SyncJob (PENDING) → masukkan ke BullMQ queue
    ↓
Cloud return 202 Accepted { jobId }
    ↓
BullMQ Worker ambil job → validate → tulis ke core_data → update status SYNCED
    ↓
Pi polling GET /sync/status/:jobId → status: SYNCED
    ↓
Pi POST /sync/ack { jobIds } → Cloud catat acknowledged
    ↓
Pi hapus data lokal yang sudah di-ack
```

### 2.2 Offline Flow

```
Pi menerima data sensor (TIDAK ADA INTERNET)
    ↓
Pi simpan ke SQLite lokal dengan status "pending_sync"
    ↓
Pi simpan request_id (UUID) untuk setiap record
    ↓
... (minutes/hours/days offline) ...
    ↓
Internet kembali → Pi detect connectivity
    ↓
Pi kumpulkan semua pending_sync records
    ↓
Pi POST /sync/batch { items[] } ke Cloud (max 100 per batch)
    ↓
Cloud proses → idempotency check → create SyncJobs
    ↓
Cloud return 202 { accepted: N, skipped: M }
    ↓
Pi lanjut batch berikutnya sampai semua terkirim
    ↓
Pi polling status → ack → hapus lokal
```

### 2.3 Bidirectional Sync (Cloud → Pi)

```
Cloud ada data baru (config update, hasil AI, dll)
    ↓
Pi secara periodik GET /sync/pull?since=<last_sync_time>
    ↓
Cloud return items yang diupdate setelah last_sync_time
    ↓
Pi simpan ke lokal → update last_sync_time
```

---

## 3. Sync Data Format

### Standard Sync Payload (Pi → Cloud)

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "eventType": "scan_result",
  "timestamp": "2026-04-20T09:00:00Z",
  "version": 1,
  "source": "edge",
  "payload": {
    "raw": {
      "sensor_id": "S001",
      "temperature": 28.5,
      "humidity": 75.2,
      "soil_moisture": 42.1
    },
    "processed": {
      "status": "normal",
      "risk_level": "low"
    },
    "metadata": {
      "location": "Field A - Block 3",
      "gps": { "lat": -6.175, "lng": 106.827 },
      "capture_method": "automatic"
    }
  }
}
```

### Field Explanation

| Field | Type | Required | Keterangan |
|-------|------|----------|-----------|
| `requestId` | UUID | ✅ | ID unik per event — dipakai untuk idempotency |
| `userId` | UUID | ✅ | User pemilik device — harus cocok dengan device ownership |
| `eventType` | string | ✅ | Tipe data: `scan_result`, `sensor_reading`, `manual_input`, dll |
| `timestamp` | ISO 8601 | ✅ | Waktu event terjadi di Pi (BUKAN waktu dikirim) |
| `version` | integer | ✅ | Schema version payload — untuk backward compat |
| `source` | string | ✅ | `"edge"` = dari Pi, `"app"` = dari mobile, `"cloud"` = dari cloud |
| `payload.raw` | JSON | ✅ | Data mentah dari sensor/input |
| `payload.processed` | JSON | ❌ | Hasil processing lokal (jika ada) |
| `payload.metadata` | JSON | ❌ | Info tambahan (lokasi, metode, dll) |

---

## 4. SyncJob State Machine

```
                    ┌──────────────────────────────┐
                    │        SYNC JOB STATES        │
                    └──────────────────────────────┘

    POST /sync/push          BullMQ picks job         Process success
  ─────────────────►  PENDING ──────────────► PROCESSING ──────────────► SYNCED ✓
                        │                        │
                        │                        │ Process fails
                        │                        ▼
                        │                      FAILED
                        │                        │
                        │                        │ retry_count < max_retries?
                        │                        ├── YES ──► re-enqueue → PROCESSING
                        │                        │
                        │                        └── NO ───► DEAD LETTER
                        │                                       │
                        │                                       ▼
                        │                              Notification ke admin
                        │
                        │ Version conflict detected
                        └──────────────────────────────► CONFLICT
                                                            │
                                                            ├── Auto-resolve (LWW) → SYNCED
                                                            │
                                                            └── Manual review required
```

### Status Definitions

| Status | Artinya | Next Action |
|--------|---------|-------------|
| `PENDING` | Data diterima, belum diproses | Worker akan ambil |
| `PROCESSING` | Sedang diproses oleh worker | Tunggu selesai |
| `SYNCED` | Berhasil ditulis ke core_data | Pi bisa ack + hapus lokal |
| `FAILED` | Gagal diproses | Auto-retry jika belum max |
| `CONFLICT` | Ada konflik data | Auto-resolve atau manual |

---

## 5. Idempotency Mechanism

### Bagaimana mencegah duplikasi?

```
Pi mengirim: POST /sync/push { requestId: "abc-123", ... }

Cloud SyncService:
  1. SELECT * FROM sync_jobs WHERE request_id = 'abc-123'
  2. Jika DITEMUKAN:
     → return 200 OK { jobId: existing.id, status: existing.status }
     → TIDAK buat record baru
  3. Jika TIDAK ditemukan:
     → INSERT sync_job baru
     → Enqueue ke BullMQ
     → return 202 Accepted { jobId: new.id, status: "PENDING" }
```

### Database enforcement

```sql
-- request_id memiliki UNIQUE constraint di tabel sync_jobs
-- Bahkan jika ada race condition, DB akan reject INSERT kedua
ALTER TABLE sync_jobs ADD CONSTRAINT sync_jobs_request_id_unique UNIQUE (request_id);
```

### Kenapa ini penting?

- Pi bisa retry tanpa takut data dobel
- Network timeout di tengah jalan → Pi kirim ulang → aman
- Batch upload retry → items yang sudah masuk di-skip

---

## 6. Retry Strategy

### Exponential Backoff

```
Attempt 1: langsung (0 second delay)
Attempt 2: 30 seconds
Attempt 3: 2 minutes (120 seconds)
Attempt 4: 10 minutes (600 seconds)
Attempt 5: 1 hour (3600 seconds)
```

### Implementasi di BullMQ

```typescript
// sync.module.ts
BullModule.registerQueue({
  name: 'sync-queue',
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 30000, // 30 seconds base
    },
    removeOnComplete: {
      age: 86400,    // keep completed jobs for 24h
      count: 1000,   // max 1000 completed jobs
    },
    removeOnFail: false, // keep failed jobs for inspection
  },
});
```

### Dead Letter Queue (DLQ)

Job yang gagal setelah 5 attempts:

1. Status SyncJob di-update ke `FAILED` permanen
2. Job dipindah ke queue `sync-dead-letter`
3. Notification dikirim ke admin
4. Admin bisa inspect payload dan retry manual via admin API

---

## 7. Conflict Resolution

### 7.1 Kapan Conflict Terjadi?

Conflict terjadi ketika:
- Pi mengirim data dengan `eventId` yang sudah ada di `core_data`
- Data yang sama diubah di cloud langsung DAN di Pi
- Timestamp data dari Pi lebih lama dari data yang sudah ada

### 7.2 Conflict Resolution Strategies

#### Strategy 1: Last Write Wins (LWW) — DEFAULT

```
Cloud punya: { eventId: "X", version: 2, updatedAt: "10:00" }
Pi kirim:    { eventId: "X", version: 1, timestamp: "09:55" }

Keputusan: Cloud menang (timestamp lebih baru)
Aksi: SyncJob → SYNCED (skip, data cloud tetap)
Audit: log conflict resolution
```

**Dipakai untuk**: Telemetry, sensor readings, data yang bisa di-overwrite.

#### Strategy 2: Version-Based Reject

```
Cloud punya: { eventId: "X", version: 3 }
Pi kirim:    { eventId: "X", version: 2 }

Keputusan: REJECT — version Pi stale
Aksi: SyncJob → CONFLICT
Response ke Pi: "version_mismatch, current_version: 3"
Pi harus pull data terbaru dulu, merge, lalu push ulang
```

**Dipakai untuk**: Data bisnis yang sensitif, perubahan yang tidak boleh di-overwrite sembarangan.

#### Strategy 3: Manual Review (Future/Fase 4+)

```
Conflict terdeteksi yang tidak bisa di-resolve otomatis
    ↓
SyncJob status → CONFLICT
    ↓
Notification ke admin
    ↓
Admin review via admin panel
    ↓
Admin pilih: accept Pi version / keep cloud version / merge manual
```

### 7.3 Implementasi

```typescript
// sync.processor.ts (simplified)
async processSyncJob(job: SyncJob): Promise<void> {
  const existing = await this.prisma.coreData.findUnique({
    where: { eventId: job.payloadRaw.requestId }
  });

  if (!existing) {
    // No conflict — insert new record
    await this.prisma.coreData.create({ data: { ... } });
    return;
  }

  // Conflict detected
  if (existing.version >= job.payloadRaw.version) {
    // LWW: cloud wins — Pi data is stale
    await this.auditService.log({
      action: 'sync.conflict.lww',
      metadata: { kept: 'cloud', rejected: 'edge', eventId: existing.eventId }
    });
    // Mark as synced (cloud version kept)
    return;
  }

  // Pi has newer version — update cloud
  await this.prisma.coreData.update({
    where: { id: existing.id },
    data: {
      dataJson: job.payloadRaw.payload,
      version: job.payloadRaw.version,
      source: 'edge',
    }
  });
}
```

---

## 8. Batch Upload Strategy

### Mengapa batch penting?

Saat Pi offline berminggu-minggu, bisa ada ribuan records yang harus disync. Upload satu-satu terlalu lambat.

### Batch Limits

| Parameter | Value | Alasan |
|-----------|-------|--------|
| Max items per batch | 100 | Balance antara payload size dan processing time |
| Max payload size | 10 MB | Prevent memory spike di cloud |
| Max concurrent batches | 3 | Prevent Pi monopolize cloud resources |

### Batch Upload Algorithm (Pi-side)

```
1. Query semua records WHERE status = 'pending_sync' ORDER BY timestamp ASC
2. Chunk menjadi batches of 100
3. Untuk setiap batch:
   a. POST /sync/batch { items }
   b. Jika 202 → catat jobIds, lanjut batch berikutnya
   c. Jika 429 (rate limited) → tunggu sesuai Retry-After header
   d. Jika 5xx → exponential backoff, retry batch ini
4. Setelah semua batch terkirim:
   a. Polling GET /sync/status untuk setiap jobId
   b. Jika semua SYNCED → POST /sync/ack
   c. Hapus records lokal yang sudah di-ack
```

---

## 9. Sync Pull (Cloud → Pi)

### Use Cases

- Config update dari cloud ke Pi
- Hasil AI analysis dikirim ke Pi
- Credential/token refresh
- User profile update

### Pull Strategy

Pi melakukan polling periodik:

```
Setiap 5 menit (jika online):
  GET /sync/pull?since=<last_pull_timestamp>&limit=50

Response:
  items[] + cursor (timestamp terakhir)

Pi update last_pull_timestamp = cursor
```

### Data Types yang Di-pull

| Type | Deskripsi |
|------|-----------|
| `config_update` | Konfigurasi device dari cloud |
| `ai_result` | Hasil analisis AI yang diminta sebelumnya |
| `user_preference` | Setting user yang diubah dari app |
| `system_announcement` | Pesan sistem |

---

## 10. Monitoring Sync Health

### Metrics yang Dipantau

| Metric | Alert Condition | Severity |
|--------|-----------------|----------|
| Queue depth (pending jobs) | > 500 | ⚠️ Warning |
| Queue depth (pending jobs) | > 2000 | 🔴 Critical |
| Failed jobs in last hour | > 10 | ⚠️ Warning |
| Average processing time | > 5 seconds | ⚠️ Warning |
| Dead letter queue count | > 0 | 🔴 Critical (harus review manual) |
| Sync success rate | < 95% | 🔴 Critical |

### Dashboard Queries

```sql
-- Pending sync jobs count
SELECT COUNT(*) FROM sync_jobs WHERE status = 'PENDING';

-- Failed jobs breakdown
SELECT error_message, COUNT(*) 
FROM sync_jobs 
WHERE status = 'FAILED' 
GROUP BY error_message 
ORDER BY COUNT(*) DESC;

-- Average processing time (last 24h)
SELECT AVG(EXTRACT(EPOCH FROM (processed_at - created_at)))
FROM sync_jobs 
WHERE status = 'SYNCED' 
AND created_at > NOW() - INTERVAL '24 hours';

-- Sync jobs per device (last 24h)
SELECT device_id, status, COUNT(*)
FROM sync_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY device_id, status;
```

---

## 11. Edge Cases dan Handling

| Scenario | Handling |
|----------|---------|
| Pi kirim data untuk user yang tidak match device ownership | REJECT 403 — log anomaly |
| Pi kirim batch > 100 items | REJECT 400 — batch too large |
| Pi kirim payload > 10MB | REJECT 413 — payload too large |
| Cloud down saat Pi kirim | Pi simpan lokal, retry nanti |
| Worker crash mid-processing | BullMQ auto-retry (job kembali ke queue) |
| requestId yang sama dikirim 2x bersamaan (race condition) | DB unique constraint prevent duplicate |
| Device token invalid saat sync | REJECT 401 — Pi harus re-auth |
| Device di-revoke saat masih ada pending sync | Pending jobs di-cancel, notify admin |
| Timestamp dari Pi jauh di masa depan | REJECT 422 — clock skew detected |
| Timestamp dari Pi > 30 hari di masa lalu | Accept tetapi flag sebagai late_sync |

# ARISA Cloud Backend — API Reference

> **Dokumen ini mendefinisikan semua endpoint REST API yang harus dibangun.**
> Setiap endpoint memiliki detail auth requirement, request body, dan response.

---

## Base URL

```
Production: https://api.arisa.app/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication Types

| Type | Header | Digunakan Oleh |
|------|--------|---------------|
| **Bearer Token** | `Authorization: Bearer <access_token>` | Mobile/Web App (user) |
| **Device Token** | `X-Device-Token: <device_token>` | Raspberry Pi |
| **Admin** | Bearer Token + role `ADMIN` / `SUPER_ADMIN` | Admin panel |
| **Public** | Tidak ada auth | Health check, register, login |

## Standard Headers (Semua Request)

```
Content-Type: application/json
X-Request-Id: <uuid>  (optional — auto-generated jika tidak ada)
```

---

## 1. Health API

> **Prefix**: Tidak ada prefix — langsung di root.
> **Catatan**: Health endpoints HARUS di-exclude dari global prefix `/api/v1`.

### `GET /health`

Liveness check sederhana.

**Auth**: ❌ None

**Response** `200 OK`:
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2026-04-20T10:00:00Z"
}
```

### `GET /ready`

Readiness check — memverifikasi koneksi ke semua dependency.

**Auth**: ❌ None

**Response** `200 OK`:
```json
{
  "status": "ok",
  "checks": {
    "database": { "status": "ok", "responseTimeMs": 5 },
    "redis": { "status": "ok", "responseTimeMs": 2 },
    "supabase": { "status": "ok" }
  }
}
```

**Response** `503 Service Unavailable`:
```json
{
  "status": "degraded",
  "checks": {
    "database": { "status": "ok" },
    "redis": { "status": "error", "error": "Connection refused" }
  }
}
```

---

## 2. Auth API

> **Prefix**: `/api/v1/auth`

### `POST /auth/register`

Register user baru dengan email dan password.

**Auth**: ❌ None

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Validation Rules**:
- `email`: required, valid email format
- `password`: required, min 8 chars, harus ada uppercase, lowercase, angka
- `name`: required, min 2 chars, max 100 chars

**Response** `201 Created`:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER",
      "createdAt": "2026-04-20T10:00:00Z"
    },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

**Errors**:
- `409 Conflict` — `AUTH_EMAIL_EXISTS`: Email sudah terdaftar

---

### `POST /auth/login`

Login dengan email dan password.

**Auth**: ❌ None

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER",
      "lastLoginAt": "2026-04-20T10:00:00Z"
    },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

**Errors**:
- `401 Unauthorized` — `AUTH_INVALID_CREDENTIALS`: Email atau password salah
- `403 Forbidden` — `AUTH_ACCOUNT_SUSPENDED`: Akun di-suspend

---

### `POST /auth/oauth/google`

Login atau register via Google OAuth.

**Auth**: ❌ None

**Request Body**:
```json
{
  "idToken": "google-id-token-from-client"
}
```

**Response** `200 OK`: Sama dengan login response.

---

### `POST /auth/refresh`

Refresh access token menggunakan refresh token.

**Auth**: ❌ None (refresh token di body)

**Request Body**:
```json
{
  "refreshToken": "eyJhbG..."
}
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...(new)",
    "refreshToken": "eyJhbG...(new, rotated)"
  }
}
```

**Errors**:
- `401 Unauthorized` — `AUTH_REFRESH_TOKEN_INVALID`: Token tidak valid atau expired

---

### `POST /auth/logout`

Logout user — invalidate current session.

**Auth**: ✅ Bearer Token

**Response** `200 OK`:
```json
{
  "success": true,
  "data": { "message": "Logged out successfully" }
}
```

---

### `POST /auth/revoke-all`

Revoke SEMUA session user (force logout semua device).

**Auth**: ✅ Bearer Token

**Response** `200 OK`:
```json
{
  "success": true,
  "data": { "message": "All sessions revoked" }
}
```

---

## 3. User API

> **Prefix**: `/api/v1/users`

### `GET /users/me`

Get profile user yang sedang login.

**Auth**: ✅ Bearer Token

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": "https://...",
    "role": "USER",
    "status": "ACTIVE",
    "lastLoginAt": "2026-04-20T10:00:00Z",
    "createdAt": "2026-04-20T08:00:00Z",
    "devicesCount": 2
  }
}
```

### `PATCH /users/me`

Update profile user.

**Auth**: ✅ Bearer Token

**Request Body** (partial):
```json
{
  "name": "John Updated",
  "avatarUrl": "https://..."
}
```

**Response** `200 OK`: Updated user object.

---

## 4. Device API

> **Prefix**: `/api/v1/devices`

### `POST /devices/register`

Register Raspberry Pi baru ke cloud. Dipanggil oleh Pi saat pertama kali dinyalakan.

**Auth**: ❌ None (first-time setup) — tetapi harus ada `registration_secret` di body sebagai pre-shared key.

**Request Body**:
```json
{
  "deviceSerial": "ARISA-PI-001",
  "deviceName": "Farm Sensor Alpha",
  "firmwareVersion": "1.0.0",
  "registrationSecret": "pre-shared-secret-key"
}
```

**Validation**:
- `deviceSerial`: required, unique, format `ARISA-*`
- `registrationSecret`: required, must match env `DEVICE_REGISTRATION_SECRET`

**Response** `201 Created`:
```json
{
  "success": true,
  "data": {
    "deviceId": "uuid",
    "deviceToken": "generated-secure-token",
    "message": "Store this token securely. It cannot be retrieved again."
  }
}
```

> **PENTING**: `deviceToken` hanya ditampilkan SEKALI saat register. Cloud hanya menyimpan hash-nya. Pi harus menyimpan token ini di secure storage.

---

### `POST /devices/pair/start`

User memulai proses pairing device. Cloud men-generate pairing code.

**Auth**: ✅ Bearer Token (user)

**Request Body**:
```json
{
  "deviceId": "uuid"
}
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "pairingCode": "A7X9K2",
    "qrData": "arisa://pair?code=A7X9K2&device=uuid",
    "expiresAt": "2026-04-20T10:10:00Z"
  }
}
```

**Errors**:
- `404 Not Found` — `DEVICE_NOT_FOUND`
- `409 Conflict` — `DEVICE_ALREADY_PAIRED`: Device sudah di-pair oleh user lain

---

### `POST /devices/pair/confirm`

App mengirim konfirmasi pairing setelah scan QR.

**Auth**: ✅ Bearer Token (user)

**Request Body**:
```json
{
  "pairingCode": "A7X9K2",
  "deviceId": "uuid"
}
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "deviceId": "uuid",
    "pairedAt": "2026-04-20T10:05:00Z",
    "status": "PAIRED"
  }
}
```

**Errors**:
- `400 Bad Request` — `DEVICE_PAIRING_CODE_INVALID`: Code salah
- `410 Gone` — `DEVICE_PAIRING_CODE_EXPIRED`: Code sudah expired

---

### `GET /devices`

List semua device milik user yang login.

**Auth**: ✅ Bearer Token

**Response** `200 OK`:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "deviceName": "Farm Sensor Alpha",
      "deviceSerial": "ARISA-PI-001",
      "pairingStatus": "PAIRED",
      "status": "ACTIVE",
      "lastSeenAt": "2026-04-20T09:50:00Z",
      "firmwareVersion": "1.0.0",
      "pairedAt": "2026-04-20T08:00:00Z"
    }
  ]
}
```

---

### `GET /devices/:id`

Get detail satu device.

**Auth**: ✅ Bearer Token (hanya pemilik device)

**Response** `200 OK`: Detail device object.

---

### `POST /devices/:id/revoke`

Unpair / revoke device dari akun user.

**Auth**: ✅ Bearer Token (hanya pemilik device)

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "deviceId": "uuid",
    "status": "REVOKED",
    "revokedAt": "2026-04-20T10:30:00Z"
  }
}
```

---

### `POST /devices/:id/heartbeat`

Device mengirim heartbeat ke cloud. Dipanggil secara periodik oleh Pi.

**Auth**: 🔑 Device Token (`X-Device-Token`)

**Request Body** (optional):
```json
{
  "firmwareVersion": "1.0.1",
  "appVersion": "2.0.0",
  "networkStatus": "online"
}
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "lastSeenAt": "2026-04-20T10:00:00Z",
    "serverTime": "2026-04-20T10:00:01Z"
  }
}
```

---

## 5. Sync API

> **Prefix**: `/api/v1/sync`

### `POST /sync/push`

Push single sync item dari Pi ke cloud.

**Auth**: 🔑 Device Token

**Request Body**:
```json
{
  "requestId": "uuid-dari-pi",
  "userId": "uuid",
  "eventType": "scan_result",
  "timestamp": "2026-04-20T09:00:00Z",
  "version": 1,
  "source": "edge",
  "payload": {
    "raw": { "sensor_data": "..." },
    "processed": { "result": "healthy" },
    "metadata": { "location": "Field A" }
  }
}
```

**Validation**:
- `requestId`: required, UUID format
- `userId`: required, UUID, harus cocok dengan device owner
- `eventType`: required, string
- `timestamp`: required, ISO 8601
- `payload`: required, object

**Response** `202 Accepted`:
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "PENDING",
    "message": "Sync job accepted"
  }
}
```

**Idempotent behavior**: Jika `requestId` sudah pernah dikirim, return `200 OK` dengan status job yang existing.

---

### `POST /sync/batch`

Push multiple sync items sekaligus.

**Auth**: 🔑 Device Token

**Request Body**:
```json
{
  "items": [
    {
      "requestId": "uuid-1",
      "userId": "uuid",
      "eventType": "scan_result",
      "timestamp": "...",
      "version": 1,
      "source": "edge",
      "payload": { ... }
    },
    {
      "requestId": "uuid-2",
      ...
    }
  ]
}
```

**Validation**:
- `items`: required, array, max 100 items per batch

**Response** `202 Accepted`:
```json
{
  "success": true,
  "data": {
    "accepted": 8,
    "skipped": 2,
    "results": [
      { "requestId": "uuid-1", "jobId": "uuid", "status": "PENDING" },
      { "requestId": "uuid-2", "jobId": null, "status": "SKIPPED", "reason": "duplicate" }
    ]
  }
}
```

---

### `GET /sync/status/:jobId`

Check status of a sync job.

**Auth**: ✅ Bearer Token atau 🔑 Device Token

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "requestId": "uuid-dari-pi",
    "status": "SYNCED",
    "processedAt": "2026-04-20T09:01:00Z",
    "createdAt": "2026-04-20T09:00:00Z"
  }
}
```

---

### `POST /sync/ack`

Acknowledge bahwa Pi sudah tahu data berhasil sync.

**Auth**: 🔑 Device Token

**Request Body**:
```json
{
  "jobIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "acknowledged": 3
  }
}
```

---

### `GET /sync/pull`

Pull data update dari cloud ke Pi (untuk bidirectional sync).

**Auth**: 🔑 Device Token

**Query Params**:
- `since`: ISO 8601 datetime — hanya ambil data yang diupdate setelah waktu ini
- `limit`: max items to return (default 50, max 200)

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "dataType": "config_update",
        "dataJson": { ... },
        "updatedAt": "2026-04-20T09:00:00Z"
      }
    ],
    "hasMore": false,
    "cursor": "2026-04-20T09:00:00Z"
  }
}
```

---

## 6. Data API

> **Prefix**: `/api/v1/data`

### `POST /data`

Create data record langsung (bukan via sync).

**Auth**: ✅ Bearer Token

**Request Body**:
```json
{
  "dataType": "crop_observation",
  "dataJson": {
    "crop": "rice",
    "status": "healthy",
    "notes": "No visible disease"
  },
  "deviceId": "uuid",
  "eventId": "uuid-optional"
}
```

**Response** `201 Created`: Created record.

---

### `GET /data`

List data records milik user.

**Auth**: ✅ Bearer Token

**Query Params**:
- `dataType`: filter by type
- `deviceId`: filter by device
- `startDate`, `endDate`: date range filter
- `page`, `limit`: pagination
- `sortBy`: field name (default: `createdAt`)
- `sortOrder`: `asc` | `desc` (default: `desc`)

**Response** `200 OK`: Paginated list.

---

### `GET /data/:id`

Get single record.

**Auth**: ✅ Bearer Token (hanya pemilik)

---

### `PATCH /data/:id`

Update record.

**Auth**: ✅ Bearer Token (hanya pemilik)

**Request Body** (partial):
```json
{
  "dataJson": { "status": "updated" }
}
```

---

### `DELETE /data/:id`

Soft-delete record.

**Auth**: ✅ Bearer Token (hanya pemilik)

---

## 7. Telemetry API

> **Prefix**: `/api/v1/telemetry`

### `POST /telemetry`

Push telemetry data dari device.

**Auth**: 🔑 Device Token

**Request Body**:
```json
{
  "cpuTemp": 45.2,
  "cpuUsage": 32.5,
  "ramUsage": 58.1,
  "diskUsage": 42.0,
  "uptime": 86400,
  "networkStatus": "online",
  "batteryStatus": "charging"
}
```

**Response** `201 Created`.

---

### `GET /telemetry/device/:deviceId`

Get telemetry history. User harus pemilik device.

**Auth**: ✅ Bearer Token

**Query Params**:
- `startDate`, `endDate`: date range
- `limit`: max records (default 100)

---

## 8. AI API

> **Prefix**: `/api/v1/ai`

### `POST /ai/analyze`

Submit image/data untuk analisis AI.

**Auth**: ✅ Bearer Token

**Request Body**:
```json
{
  "analysisType": "plant_disease",
  "inputData": {
    "imageUrl": "https://storage.supabase.co/...",
    "metadata": { "crop": "rice", "location": "Field A" }
  },
  "preferredProvider": "gemini"
}
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "requestId": "uuid",
    "result": {
      "diagnosis": "Bacterial Leaf Blight",
      "confidence": 0.87,
      "recommendations": ["Apply bactericide", "Improve drainage"]
    },
    "provider": "gemini",
    "durationMs": 2340
  }
}
```

---

### `POST /ai/chat`

Chat interaktif dengan AI assistant.

**Auth**: ✅ Bearer Token

**Request Body**:
```json
{
  "message": "Bagaimana cara mengatasi hama wereng?",
  "context": {
    "crop": "rice",
    "previousMessages": []
  }
}
```

---

### `GET /ai/history`

Get riwayat AI requests user.

**Auth**: ✅ Bearer Token

**Query Params**: `page`, `limit`, `requestType`.

---

## 9. Notification API

> **Prefix**: `/api/v1/notifications`

### `GET /notifications`

List notifikasi user.

**Auth**: ✅ Bearer Token

**Query Params**:
- `status`: `UNREAD` | `READ` | `ALL`
- `page`, `limit`

---

### `PATCH /notifications/:id/read`

Mark notifikasi sebagai dibaca.

**Auth**: ✅ Bearer Token (hanya pemilik)

---

## 10. Admin API

> **Prefix**: `/api/v1/admin`
> **Auth**: ✅ Bearer Token + Role `ADMIN` atau `SUPER_ADMIN`

### `GET /admin/users`
List semua user (paginated, searchable by email/name).

### `GET /admin/devices`
List semua devices (paginated, filterable by status).

### `GET /admin/sync-jobs`
List sync jobs (paginated, filterable by status, device).

### `GET /admin/logs`
Search audit logs (filterable by action, actor, target, date range).

### `POST /admin/devices/:id/disable`
Disable device — mencegah device mengirim data.

### `GET /admin/dashboard`
Overview stats:
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalDevices": 80,
    "activeDevices": 65,
    "pendingSyncJobs": 23,
    "failedSyncJobs": 2,
    "todayApiRequests": 4521
  }
}
```

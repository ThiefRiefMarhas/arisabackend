# ARISA Edge Backend — Raspberry Pi Guide

> **Dokumen ini menjelaskan apa yang harus dibangun di Raspberry Pi agar bisa terhubung dan berfungsi penuh dengan Cloud Backend.**
> Ini adalah panduan untuk tim yang mengerjakan edge backend.

---

## 1. Overview Peran Raspberry Pi

```
┌─────────────────────────────────────────────────────┐
│              RASPBERRY PI EDGE BACKEND               │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Sensor  │  │  Local   │  │  Sync Client     │   │
│  │ Reader  │  │  Storage │  │  (ke Cloud)      │   │
│  │         │  │ (SQLite) │  │                  │   │
│  └────┬────┘  └────┬─────┘  └────────┬─────────┘   │
│       │            │                  │              │
│  ┌────┴────────────┴──────────────────┴───────────┐ │
│  │           Core Edge Service                     │ │
│  │  - Data collection                              │ │
│  │  - Local processing                             │ │
│  │  - Queue management                             │ │
│  │  - Offline mode handling                        │ │
│  └──────────────────┬─────────────────────────────┘ │
│                     │                                │
│  ┌──────────────────┴─────────────────────────────┐ │
│  │           Device Identity Manager               │ │
│  │  - Token storage                                │ │
│  │  - Auth headers                                 │ │
│  │  - Registration flow                            │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │           Connectivity Monitor                  │ │
│  │  - Internet check                              │ │
│  │  - Auto-sync trigger                            │ │
│  │  - Heartbeat scheduler                          │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
          │
          │ HTTPS  (saat online)
          ▼
    ☁️ Cloud Backend
```

---

## 2. Komponen yang Harus Dibangun

### MUST-HAVE (Wajib untuk sistem berfungsi)

| # | Komponen | Deskripsi |
|---|----------|-----------|
| 1 | **Device Identity Manager** | Menyimpan & mengelola device token, serial, config |
| 2 | **Cloud API Client** | HTTP client yang berkomunikasi ke Cloud Backend |
| 3 | **Local Storage (SQLite)** | Database lokal untuk data saat offline |
| 4 | **Sync Queue Manager** | Queue lokal untuk data pending sync |
| 5 | **Sync Client** | Mengirim data dari queue ke cloud + handle retry |
| 6 | **Connectivity Monitor** | Deteksi online/offline, trigger sync |
| 7 | **Heartbeat Service** | Kirim heartbeat ke cloud secara periodik |
| 8 | **Telemetry Collector** | Kumpulkan CPU, RAM, disk, dll dan kirim ke cloud |

### SHOULD-HAVE (Penting tapi bisa menyusul)

| # | Komponen | Deskripsi |
|---|----------|-----------|
| 9 | **Local AI Engine** | Inference model lokal saat offline |
| 10 | **QR Code Display** | Tampilkan QR untuk pairing di layar Pi |
| 11 | **Pull Sync Client** | Ambil data update dari cloud secara periodik |
| 12 | **Config Manager** | Kelola konfigurasi yang di-push dari cloud |

### NICE-TO-HAVE (Enhancement)

| # | Komponen | Deskripsi |
|---|----------|-----------|
| 13 | **Local Web Dashboard** | UI lokal di Pi untuk monitoring |
| 14 | **OTA Update Manager** | Update firmware/app dari cloud |
| 15 | **Log Shipper** | Kirim log Pi ke cloud untuk centralized logging |

---

## 3. Tech Stack Rekomendasi untuk Pi

| Layer | Pilihan | Alasan |
|-------|---------|--------|
| **Runtime** | Python 3.11+ atau Node.js 18+ | Python lebih umum di Pi + ML library |
| **HTTP Client** | `httpx` (Python) atau `axios` (Node) | Async, retry support |
| **Local Database** | SQLite 3 | Ringan, file-based, reliable |
| **Queue** | SQLite table sebagai queue | Tidak perlu Redis di Pi — terlalu berat |
| **Scheduler** | `APScheduler` (Python) atau `node-cron` | Heartbeat, sync trigger, telemetry |
| **Hardware Access** | `gpiozero`, `Adafruit libraries` | Sensor reading |

> **Rekomendasi**: Gunakan **Python** untuk edge backend karena:
> - Library sensor dan hardware lebih mature
> - ML inference (TensorFlow Lite, ONNX) lebih mudah
> - Resource usage lebih terkontrol di Pi

---

## 4. Device Identity Manager

### 4.1 First-Time Setup (Registration)

Pi harus melakukan registrasi ke cloud saat pertama kali dinyalakan:

```python
# edge/identity_manager.py

import httpx
import json
import os

CLOUD_URL = "https://api.arisa.app/api/v1"
CREDENTIALS_PATH = "/etc/arisa/device.json"
REGISTRATION_SECRET = os.environ.get("ARISA_REGISTRATION_SECRET")

async def register_device(serial: str, name: str):
    """Register device ke cloud. Dipanggil satu kali saat setup awal."""
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{CLOUD_URL}/devices/register", json={
            "deviceSerial": serial,
            "deviceName": name,
            "firmwareVersion": get_firmware_version(),
            "registrationSecret": REGISTRATION_SECRET,
        })
    
    if response.status_code == 201:
        data = response.json()["data"]
        
        # Simpan credentials secara aman
        credentials = {
            "deviceId": data["deviceId"],
            "deviceToken": data["deviceToken"],
            "deviceSerial": serial,
            "registeredAt": datetime.utcnow().isoformat(),
        }
        
        # Tulis ke file dengan permission terbatas
        with open(CREDENTIALS_PATH, "w") as f:
            json.dump(credentials, f)
        os.chmod(CREDENTIALS_PATH, 0o600)  # Owner read/write only
        
        print(f"Device registered: {data['deviceId']}")
        return credentials
    else:
        raise Exception(f"Registration failed: {response.text}")


def load_credentials():
    """Load credentials yang sudah disimpan."""
    if not os.path.exists(CREDENTIALS_PATH):
        return None
    
    with open(CREDENTIALS_PATH, "r") as f:
        return json.load(f)
```

### 4.2 Credential Structure

File `/etc/arisa/device.json`:

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceToken": "4f8a3b2c1d7e...96hexchars",
  "deviceSerial": "ARISA-PI-001",
  "registeredAt": "2026-04-20T08:00:00Z"
}
```

### 4.3 Security di Pi

```bash
# Credentials file
sudo chmod 600 /etc/arisa/device.json
sudo chown arisa:arisa /etc/arisa/device.json

# Run service as dedicated user (bukan root)
sudo useradd -r -s /bin/false arisa
```

---

## 5. Cloud API Client

### 5.1 Base Client

```python
# edge/cloud_client.py

import httpx
import uuid
from identity_manager import load_credentials

class CloudClient:
    def __init__(self):
        self.base_url = "https://api.arisa.app/api/v1"
        self.credentials = load_credentials()
        self.timeout = httpx.Timeout(30.0, connect=10.0)
    
    def _headers(self):
        """Generate headers standar untuk semua request ke cloud."""
        return {
            "Content-Type": "application/json",
            "X-Device-Token": self.credentials["deviceToken"],
            "X-Device-Serial": self.credentials["deviceSerial"],
            "X-Request-Id": str(uuid.uuid4()),
        }
    
    async def sync_push(self, payload: dict) -> dict:
        """Push single sync item ke cloud."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/sync/push",
                json=payload,
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
    
    async def sync_batch(self, items: list) -> dict:
        """Push batch sync items ke cloud."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/sync/batch",
                json={"items": items},
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
    
    async def heartbeat(self, telemetry: dict = None) -> dict:
        """Kirim heartbeat ke cloud."""
        device_id = self.credentials["deviceId"]
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/devices/{device_id}/heartbeat",
                json=telemetry or {},
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
    
    async def push_telemetry(self, data: dict) -> dict:
        """Push telemetry data ke cloud."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/telemetry",
                json=data,
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
    
    async def get_sync_status(self, job_id: str) -> dict:
        """Check status sync job."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/sync/status/{job_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
    
    async def sync_ack(self, job_ids: list) -> dict:
        """Acknowledge synced items."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/sync/ack",
                json={"jobIds": job_ids},
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
    
    async def sync_pull(self, since: str, limit: int = 50) -> dict:
        """Pull updates dari cloud."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/sync/pull",
                params={"since": since, "limit": limit},
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    async def check_connection(self) -> bool:
        """Test apakah cloud reachable."""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                response = await client.get(f"{self.base_url.replace('/api/v1', '')}/health")
                return response.status_code == 200
        except Exception:
            return False
```

---

## 6. Local Storage (SQLite)

### 6.1 Schema SQLite di Pi

```sql
-- Pi local database: /var/lib/arisa/local.db

-- Tabel untuk data yang belum di-sync ke cloud
CREATE TABLE sync_queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id  TEXT UNIQUE NOT NULL,
    user_id     TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    timestamp   TEXT NOT NULL,   -- ISO 8601
    version     INTEGER DEFAULT 1,
    source      TEXT DEFAULT 'edge',
    payload     TEXT NOT NULL,   -- JSON string
    status      TEXT DEFAULT 'pending_sync',  -- pending_sync | sending | synced | failed
    cloud_job_id TEXT,           -- job_id dari cloud setelah push
    retry_count INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- Index untuk query cepat
CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_timestamp ON sync_queue(timestamp);

-- Tabel untuk cached pull data dari cloud
CREATE TABLE cloud_cache (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    data_id     TEXT UNIQUE NOT NULL,  -- ID dari cloud core_data
    data_type   TEXT NOT NULL,
    data_json   TEXT NOT NULL,         -- JSON string
    updated_at  TEXT NOT NULL,         -- timestamp dari cloud
    cached_at   TEXT DEFAULT (datetime('now'))
);

-- Tabel untuk menyimpan state sync
CREATE TABLE sync_state (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- Initial sync state
INSERT INTO sync_state (key, value) VALUES ('last_pull_timestamp', '1970-01-01T00:00:00Z');
INSERT INTO sync_state (key, value) VALUES ('last_heartbeat', '1970-01-01T00:00:00Z');

-- Tabel telemetry lokal (buffer sebelum kirim ke cloud)
CREATE TABLE telemetry_buffer (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cpu_temp    REAL,
    cpu_usage   REAL,
    ram_usage   REAL,
    disk_usage  REAL,
    uptime      INTEGER,
    network_status TEXT,
    battery_status TEXT,
    status      TEXT DEFAULT 'pending',  -- pending | sent
    created_at  TEXT DEFAULT (datetime('now'))
);
```

---

## 7. Sync Queue Manager

### 7.1 Menambah Data ke Queue

```python
# edge/sync_queue.py

import sqlite3
import uuid
import json
from datetime import datetime

DB_PATH = "/var/lib/arisa/local.db"

class SyncQueueManager:
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
    
    def enqueue(self, user_id: str, event_type: str, payload: dict) -> str:
        """Tambah data baru ke sync queue. Return request_id."""
        request_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        self.conn.execute("""
            INSERT INTO sync_queue (request_id, user_id, event_type, timestamp, payload)
            VALUES (?, ?, ?, ?, ?)
        """, (request_id, user_id, event_type, timestamp, json.dumps(payload)))
        self.conn.commit()
        
        return request_id
    
    def get_pending(self, limit: int = 100) -> list:
        """Ambil data yang belum disync."""
        cursor = self.conn.execute("""
            SELECT * FROM sync_queue 
            WHERE status = 'pending_sync' 
            ORDER BY timestamp ASC 
            LIMIT ?
        """, (limit,))
        return [dict(row) for row in cursor.fetchall()]
    
    def mark_sending(self, request_ids: list):
        """Mark items sebagai sedang dikirim."""
        placeholders = ",".join("?" * len(request_ids))
        self.conn.execute(f"""
            UPDATE sync_queue 
            SET status = 'sending', updated_at = datetime('now')
            WHERE request_id IN ({placeholders})
        """, request_ids)
        self.conn.commit()
    
    def mark_synced(self, request_id: str, cloud_job_id: str):
        """Mark item sebagai sukses sync."""
        self.conn.execute("""
            UPDATE sync_queue 
            SET status = 'synced', cloud_job_id = ?, updated_at = datetime('now')
            WHERE request_id = ?
        """, (cloud_job_id, request_id))
        self.conn.commit()
    
    def mark_failed(self, request_id: str):
        """Mark item sebagai gagal — increment retry count."""
        self.conn.execute("""
            UPDATE sync_queue 
            SET status = 'pending_sync', 
                retry_count = retry_count + 1, 
                updated_at = datetime('now')
            WHERE request_id = ?
        """, (request_id,))
        self.conn.commit()
    
    def cleanup_synced(self):
        """Hapus data yang sudah di-ack (synced > 24 jam)."""
        self.conn.execute("""
            DELETE FROM sync_queue 
            WHERE status = 'synced' 
            AND updated_at < datetime('now', '-1 day')
        """)
        self.conn.commit()
    
    def get_queue_stats(self) -> dict:
        """Statistik queue lokal."""
        cursor = self.conn.execute("""
            SELECT status, COUNT(*) as count 
            FROM sync_queue 
            GROUP BY status
        """)
        return {row["status"]: row["count"] for row in cursor.fetchall()}
```

---

## 8. Sync Client (Orchestrator)

```python
# edge/sync_client.py

import asyncio
import logging
from cloud_client import CloudClient
from sync_queue import SyncQueueManager

logger = logging.getLogger("arisa.sync")

class SyncClient:
    def __init__(self):
        self.cloud = CloudClient()
        self.queue = SyncQueueManager()
        self.batch_size = 100
        self.max_concurrent_batches = 3
    
    async def run_sync_cycle(self):
        """Satu siklus sync. Dipanggil saat connectivity terdeteksi."""
        
        # 1. Check connectivity
        if not await self.cloud.check_connection():
            logger.info("Cloud not reachable, skipping sync cycle")
            return
        
        logger.info("Starting sync cycle...")
        
        # 2. Push pending data ke cloud
        await self._push_pending()
        
        # 3. Check status jobs yang sudah dikirim
        await self._check_job_status()
        
        # 4. Ack completed jobs
        await self._ack_completed()
        
        # 5. Pull updates dari cloud
        await self._pull_updates()
        
        # 6. Cleanup
        self.queue.cleanup_synced()
        
        logger.info("Sync cycle complete")
    
    async def _push_pending(self):
        """Push semua pending items ke cloud dalam batches."""
        while True:
            items = self.queue.get_pending(limit=self.batch_size)
            if not items:
                break
            
            # Format items untuk cloud API
            request_ids = [item["request_id"] for item in items]
            self.queue.mark_sending(request_ids)
            
            sync_items = []
            for item in items:
                sync_items.append({
                    "requestId": item["request_id"],
                    "userId": item["user_id"],
                    "eventType": item["event_type"],
                    "timestamp": item["timestamp"],
                    "version": item["version"],
                    "source": item["source"],
                    "payload": json.loads(item["payload"]),
                })
            
            try:
                result = await self.cloud.sync_batch(sync_items)
                data = result["data"]
                
                # Process results
                for item_result in data["results"]:
                    if item_result["status"] in ("PENDING", "SKIPPED"):
                        job_id = item_result.get("jobId")
                        self.queue.mark_synced(item_result["requestId"], job_id)
                
                logger.info(f"Batch pushed: accepted={data['accepted']}, skipped={data['skipped']}")
                
            except Exception as e:
                logger.error(f"Batch push failed: {e}")
                # Revert status back to pending
                for rid in request_ids:
                    self.queue.mark_failed(rid)
                break  # Stop pushing this cycle
    
    async def _pull_updates(self):
        """Pull updates dari cloud."""
        last_pull = self.queue.conn.execute(
            "SELECT value FROM sync_state WHERE key = 'last_pull_timestamp'"
        ).fetchone()["value"]
        
        try:
            result = await self.cloud.sync_pull(since=last_pull)
            items = result["data"]["items"]
            cursor = result["data"]["cursor"]
            
            for item in items:
                # Cache di local DB
                self.queue.conn.execute("""
                    INSERT OR REPLACE INTO cloud_cache 
                    (data_id, data_type, data_json, updated_at)
                    VALUES (?, ?, ?, ?)
                """, (item["id"], item["dataType"], json.dumps(item["dataJson"]), item["updatedAt"]))
            
            # Update last pull timestamp
            self.queue.conn.execute("""
                UPDATE sync_state SET value = ?, updated_at = datetime('now')
                WHERE key = 'last_pull_timestamp'
            """, (cursor,))
            self.queue.conn.commit()
            
            logger.info(f"Pulled {len(items)} updates from cloud")
        except Exception as e:
            logger.error(f"Pull failed: {e}")
```

---

## 9. Connectivity Monitor

```python
# edge/connectivity.py

import asyncio
import logging
from cloud_client import CloudClient

logger = logging.getLogger("arisa.connectivity")

class ConnectivityMonitor:
    def __init__(self, sync_client, heartbeat_service):
        self.cloud = CloudClient()
        self.sync_client = sync_client
        self.heartbeat_service = heartbeat_service
        self.is_online = False
        self.check_interval = 30  # seconds
    
    async def monitor_loop(self):
        """Loop terus-menerus memantau koneksi."""
        while True:
            was_online = self.is_online
            self.is_online = await self.cloud.check_connection()
            
            if self.is_online and not was_online:
                # Transisi dari offline → online
                logger.info("🟢 Connection restored! Triggering sync...")
                await self.sync_client.run_sync_cycle()
                await self.heartbeat_service.send_heartbeat()
            
            elif not self.is_online and was_online:
                # Transisi dari online → offline
                logger.warning("🔴 Connection lost. Switching to offline mode.")
            
            elif self.is_online:
                # Masih online — periodic heartbeat
                await self.heartbeat_service.send_heartbeat()
            
            await asyncio.sleep(self.check_interval)
```

---

## 10. Heartbeat & Telemetry

```python
# edge/heartbeat.py

import psutil
import logging
from cloud_client import CloudClient

logger = logging.getLogger("arisa.heartbeat")

class HeartbeatService:
    def __init__(self):
        self.cloud = CloudClient()
    
    def collect_telemetry(self) -> dict:
        """Kumpulkan data hardware Pi."""
        cpu_temp = None
        try:
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                cpu_temp = float(f.read().strip()) / 1000.0
        except Exception:
            pass
        
        return {
            "cpuTemp": cpu_temp,
            "cpuUsage": psutil.cpu_percent(interval=1),
            "ramUsage": psutil.virtual_memory().percent,
            "diskUsage": psutil.disk_usage("/").percent,
            "uptime": int(psutil.boot_time()),
            "networkStatus": "online",
            "batteryStatus": None,
        }
    
    async def send_heartbeat(self):
        """Kirim heartbeat + telemetry ke cloud."""
        try:
            telemetry = self.collect_telemetry()
            
            # Heartbeat
            await self.cloud.heartbeat({
                "firmwareVersion": get_firmware_version(),
                "networkStatus": telemetry["networkStatus"],
            })
            
            # Telemetry (terpisah)
            await self.cloud.push_telemetry(telemetry)
            
            logger.debug("Heartbeat sent successfully")
        except Exception as e:
            logger.error(f"Heartbeat failed: {e}")
```

---

## 11. Main Entry Point Pi

```python
# edge/main.py

import asyncio
import logging
from identity_manager import load_credentials, register_device
from sync_client import SyncClient
from heartbeat import HeartbeatService
from connectivity import ConnectivityMonitor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("arisa.main")

DEVICE_SERIAL = "ARISA-PI-001"
DEVICE_NAME = "Farm Sensor Alpha"

async def main():
    # 1. Check if device is registered
    credentials = load_credentials()
    if not credentials:
        logger.info("Device not registered. Starting registration...")
        credentials = await register_device(DEVICE_SERIAL, DEVICE_NAME)
        logger.info("Registration complete!")
    
    logger.info(f"Device ID: {credentials['deviceId']}")
    logger.info(f"Serial: {credentials['deviceSerial']}")
    
    # 2. Initialize services
    sync_client = SyncClient()
    heartbeat_service = HeartbeatService()
    connectivity_monitor = ConnectivityMonitor(sync_client, heartbeat_service)
    
    # 3. Start background tasks
    tasks = [
        asyncio.create_task(connectivity_monitor.monitor_loop()),
        asyncio.create_task(periodic_sync(sync_client)),
        asyncio.create_task(periodic_telemetry(heartbeat_service)),
    ]
    
    logger.info("🚀 ARISA Edge Backend started")
    
    # Run forever
    await asyncio.gather(*tasks)


async def periodic_sync(sync_client: SyncClient):
    """Run sync setiap 5 menit."""
    while True:
        await asyncio.sleep(300)  # 5 minutes
        try:
            await sync_client.run_sync_cycle()
        except Exception as e:
            logger.error(f"Periodic sync failed: {e}")


async def periodic_telemetry(heartbeat_service: HeartbeatService):
    """Kirim telemetry setiap 1 menit."""
    while True:
        await asyncio.sleep(60)
        try:
            await heartbeat_service.send_heartbeat()
        except Exception as e:
            logger.error(f"Telemetry push failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())
```

---

## 12. Folder Structure Pi

```
/opt/arisa/
├── main.py                      # Entry point
├── identity_manager.py          # Device registration & credentials
├── cloud_client.py              # HTTP client ke cloud
├── sync_queue.py                # SQLite queue manager
├── sync_client.py               # Sync orchestrator
├── connectivity.py              # Online/offline monitor
├── heartbeat.py                 # Heartbeat + telemetry
├── config.py                    # Configuration
├── requirements.txt             # Python dependencies
├── setup_db.py                  # SQLite schema init
└── tests/
    ├── test_sync_queue.py
    ├── test_cloud_client.py
    └── test_connectivity.py

/etc/arisa/
├── device.json                  # Credentials (chmod 600)
└── config.yaml                  # Device configuration

/var/lib/arisa/
├── local.db                     # SQLite database
└── logs/
    └── arisa.log                # Application logs
```

---

## 13. Pi ↔ Cloud Communication Summary

| Pi Action | Cloud Endpoint | Kapan |
|-----------|---------------|-------|
| Register device | `POST /devices/register` | Sekali saat pertama kali |
| Send heartbeat | `POST /devices/:id/heartbeat` | Setiap 1 menit |
| Push single data | `POST /sync/push` | Realtime saat online |
| Push batch data | `POST /sync/batch` | Saat online recovery |
| Check sync status | `GET /sync/status/:jobId` | Setelah push |
| Acknowledge sync | `POST /sync/ack` | Setelah confirmed synced |
| Pull updates | `GET /sync/pull` | Setiap 5 menit |
| Push telemetry | `POST /telemetry` | Setiap 1 menit |

---

## 14. Checklist Setup Pi

- [ ] Install Python 3.11+ di Pi
- [ ] Install dependencies: `pip install httpx psutil`
- [ ] Buat user `arisa` untuk run service
- [ ] Buat direktori: `/opt/arisa/`, `/etc/arisa/`, `/var/lib/arisa/`
- [ ] Set permissions: `chown -R arisa:arisa /etc/arisa /var/lib/arisa`
- [ ] Set device serial di `/etc/arisa/config.yaml`
- [ ] Set `ARISA_REGISTRATION_SECRET` di environment
- [ ] Set cloud URL di config
- [ ] Init SQLite database: `python setup_db.py`
- [ ] Register device: `python main.py` (first run akan register otomatis)
- [ ] Buat systemd service untuk auto-start
- [ ] Test: heartbeat muncul di cloud dashboard

### Systemd Service File

```ini
# /etc/systemd/system/arisa-edge.service

[Unit]
Description=ARISA Edge Backend
After=network.target

[Service]
Type=simple
User=arisa
Group=arisa
WorkingDirectory=/opt/arisa
ExecStart=/usr/bin/python3 /opt/arisa/main.py
Restart=always
RestartSec=10
Environment=ARISA_REGISTRATION_SECRET=your-secret-here
Environment=ARISA_CLOUD_URL=https://api.arisa.app

[Install]
WantedBy=multi-user.target
```

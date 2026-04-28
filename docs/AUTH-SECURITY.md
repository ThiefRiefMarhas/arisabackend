# ARISA Cloud Backend — Auth & Security

> **Dokumen ini menjelaskan seluruh mekanisme autentikasi, otorisasi, dan keamanan sistem.**

---

## 1. Auth Architecture

ARISA memiliki **dua jalur autentikasi yang berbeda**:

| Jalur | Untuk | Mekanisme | Header |
|-------|-------|-----------|--------|
| **User Auth** | Mobile/Web App | Supabase Auth JWT | `Authorization: Bearer <token>` |
| **Device Auth** | Raspberry Pi | Hashed Device Token | `X-Device-Token: <token>` |

### Mengapa Dua Jalur?

- User butuh OAuth, session management, refresh token → Supabase Auth cocok
- Device butuh token statis yang long-lived, tidak perlu OAuth → simple hashed token lebih efisien
- Memisahkan guard membuat security boundary jelas dan tidak bisa mixed

---

## 2. User Authentication Flow

### 2.1 Register

```
App                           Cloud                        Supabase Auth
 │                               │                              │
 │  POST /auth/register          │                              │
 │  { email, password, name }    │                              │
 │ ─────────────────────────────►│                              │
 │                               │  supabase.auth.signUp()      │
 │                               │ ────────────────────────────►│
 │                               │                              │
 │                               │  { user, session }           │
 │                               │◄────────────────────────────│
 │                               │                              │
 │                               │  Create User record in DB    │
 │                               │  (with supabase_id mapping)  │
 │                               │                              │
 │  { user, accessToken,         │                              │
 │    refreshToken }             │                              │
 │◄─────────────────────────────│                              │
```

### 2.2 Login

```
App                           Cloud                        Supabase Auth
 │                               │                              │
 │  POST /auth/login             │                              │
 │  { email, password }          │                              │
 │ ─────────────────────────────►│                              │
 │                               │  supabase.auth.signInWithPassword()
 │                               │ ────────────────────────────►│
 │                               │                              │
 │                               │  { user, session }           │
 │                               │◄────────────────────────────│
 │                               │                              │
 │                               │  Update lastLoginAt in DB    │
 │                               │  Write audit log              │
 │                               │                              │
 │  { user, accessToken,         │                              │
 │    refreshToken }             │                              │
 │◄─────────────────────────────│                              │
```

### 2.3 Google OAuth

```
App                           Cloud                        Supabase Auth
 │                               │                              │
 │  POST /auth/oauth/google      │                              │
 │  { idToken }                  │                              │
 │ ─────────────────────────────►│                              │
 │                               │  supabase.auth.signInWithIdToken({
 │                               │    provider: 'google',
 │                               │    token: idToken
 │                               │  })                          │
 │                               │ ────────────────────────────►│
 │                               │                              │
 │                               │  { user, session }           │
 │                               │◄────────────────────────────│
 │                               │                              │
 │                               │  Upsert User record in DB    │
 │                               │  (create if first login)      │
 │                               │                              │
 │  { user, accessToken,         │                              │
 │    refreshToken }             │                              │
 │◄─────────────────────────────│                              │
```

### 2.4 Token Refresh

```
App                           Cloud                        Supabase Auth
 │                               │                              │
 │  POST /auth/refresh           │                              │
 │  { refreshToken }             │                              │
 │ ─────────────────────────────►│                              │
 │                               │  supabase.auth.refreshSession()
 │                               │ ────────────────────────────►│
 │                               │                              │
 │                               │  { new accessToken,           │
 │                               │    new refreshToken (rotated) │
 │                               │  }                            │
 │                               │◄────────────────────────────│
 │                               │                              │
 │  { accessToken, refreshToken }│                              │
 │◄─────────────────────────────│                              │
```

### 2.5 Logout / Revoke

```
POST /auth/logout      → supabase.auth.signOut() → invalidate current session
POST /auth/revoke-all  → supabase.auth.signOut({ scope: 'global' }) → invalidate ALL sessions
```

---

## 3. JWT Verification (JwtAuthGuard)

### Bagaimana Cloud Memverifikasi Token User?

```typescript
// common/guards/jwt-auth.guard.ts

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private supabaseService: SupabaseService,
    private prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('AUTH_TOKEN_MISSING');
    }

    const token = authHeader.split(' ')[1];

    try {
      // Verify token via Supabase
      const { data: { user }, error } = await this.supabaseService
        .getClient()
        .auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('AUTH_TOKEN_INVALID');
      }

      // Get our internal user record
      const dbUser = await this.prismaService.user.findUnique({
        where: { supabaseId: user.id },
      });

      if (!dbUser) {
        throw new UnauthorizedException('AUTH_USER_NOT_FOUND');
      }

      if (dbUser.status !== 'ACTIVE') {
        throw new ForbiddenException('AUTH_ACCOUNT_SUSPENDED');
      }

      // Attach user to request for downstream use
      request.user = dbUser;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('AUTH_TOKEN_VERIFICATION_FAILED');
    }
  }
}
```

### Penggunaan di Controller

```typescript
@Controller('data')
export class DataController {
  @Get()
  @UseGuards(JwtAuthGuard)  // ← Hanya user yang sudah login
  async findAll(@CurrentUser() user: User) {
    return this.dataService.findByUser(user.id);
  }
}
```

---

## 4. Device Authentication

### 4.1 Device Registration Flow

```
Setup pertama Pi:
  1. Pi punya pre-shared registration secret (dari env/config)
  2. Pi POST /devices/register { deviceSerial, registrationSecret }
  3. Cloud verify registrationSecret == env.DEVICE_REGISTRATION_SECRET
  4. Cloud generate device_token (crypto.randomBytes(48).toString('hex'))
  5. Cloud hash token (bcrypt) → simpan di DB
  6. Cloud return { deviceId, deviceToken } ke Pi
  7. Pi simpan deviceToken di file yang protected (/etc/arisa/device.key)
```

### 4.2 Device Auth Guard

```typescript
// common/guards/device-auth.guard.ts

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private prismaService: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const deviceToken = request.headers['x-device-token'];

    if (!deviceToken) {
      throw new UnauthorizedException('DEVICE_TOKEN_MISSING');
    }

    // Extract device serial from token or use separate header
    const deviceSerial = request.headers['x-device-serial'];
    if (!deviceSerial) {
      throw new UnauthorizedException('DEVICE_SERIAL_MISSING');
    }

    const device = await this.prismaService.device.findUnique({
      where: { deviceSerial },
      include: { owners: { where: { revokedAt: null } } }
    });

    if (!device) {
      throw new UnauthorizedException('DEVICE_NOT_FOUND');
    }

    if (device.status !== 'ACTIVE') {
      throw new ForbiddenException('DEVICE_DISABLED');
    }

    // Verify token hash
    const isValid = await bcrypt.compare(deviceToken, device.tokenHash);
    if (!isValid) {
      throw new UnauthorizedException('DEVICE_TOKEN_INVALID');
    }

    // Update last seen
    await this.prismaService.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    // Attach device to request
    request.device = device;
    return true;
  }
}
```

### 4.3 Device Token Properties

| Property | Value |
|----------|-------|
| Length | 96 hex chars (48 bytes random) |
| Hashing | bcrypt (12 salt rounds) |
| Storage (Cloud) | Hanya hash disimpan |
| Storage (Pi) | Plain token di `/etc/arisa/device.key` (chmod 600) |
| Rotation | Manual via admin — old token invalidated, new token issued |
| Expiry | Tidak ada expiry (long-lived) — revoke manual |

### 4.4 Request Headers dari Pi

```http
POST /api/v1/sync/push HTTP/1.1
Host: api.arisa.app
Content-Type: application/json
X-Device-Token: 4f8a3b2c...96hexchars...
X-Device-Serial: ARISA-PI-001
X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
```

---

## 5. Role-Based Access Control (RBAC)

### 5.1 Roles

| Role | Level | Hak Akses |
|------|-------|-----------|
| `SUPER_ADMIN` | 100 | Semua akses, kelola admin lain |
| `ADMIN` | 50 | Monitoring, revoke device, inspect log |
| `USER` | 10 | Akses data sendiri, manage device sendiri |

### 5.2 Implementation

```typescript
// common/decorators/roles.decorator.ts
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

// common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No roles specified → allow
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('AUTH_NO_USER_IN_REQUEST');
    }

    return requiredRoles.includes(user.role);
  }
}
```

### 5.3 Penggunaan

```typescript
// Admin-only endpoint
@Get('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
async listAllUsers() { ... }

// Any authenticated user
@Get('data')
@UseGuards(JwtAuthGuard)
async getMyData(@CurrentUser() user) { ... }

// Device-only endpoint
@Post('sync/push')
@UseGuards(DeviceAuthGuard)
async pushSync(@CurrentDevice() device) { ... }
```

---

## 6. Ownership Enforcement

### Prinsip

- User HANYA bisa melihat data miliknya sendiri
- User HANYA bisa manage device yang di-pair ke akunnya
- Device HANYA bisa push data untuk user yang jadi owner-nya
- Admin bisa override — TETAPI semua override dicatat di audit log

### Implementation di Service Layer

```typescript
// data.service.ts
async findOne(recordId: string, userId: string): Promise<CoreData> {
  const record = await this.prisma.coreData.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    throw new NotFoundException('DATA_NOT_FOUND');
  }

  // Ownership check
  if (record.userId !== userId) {
    throw new ForbiddenException('DATA_OWNERSHIP_DENIED');
  }

  return record;
}

// device.service.ts
async findUserDevices(userId: string): Promise<Device[]> {
  return this.prisma.device.findMany({
    where: {
      owners: {
        some: {
          userId,
          revokedAt: null, // Hanya yang masih aktif
        },
      },
    },
  });
}
```

---

## 7. Device Pairing Security

### Pairing Code Properties

| Property | Value |
|----------|-------|
| Format | 6 karakter alphanumeric uppercase (e.g., `A7X9K2`) |
| Expiry | 10 menit |
| Single use | Ya — setelah dipakai, code di-nullkan |
| Storage | Di tabel devices (pairing_code, pairing_expiry) |

### Pairing Flow Security

```
1. User request pair → Cloud generate code
2. Code disimpan di DB + expiry time
3. QR data: arisa://pair?code=A7X9K2&device=uuid
4. User scan QR → App kirim POST /devices/pair/confirm
5. Cloud verify:
   a. Code match? ✓
   b. Code belum expired? ✓
   c. Device belum di-pair user lain? ✓
   d. User valid? ✓
6. Cloud bind device ke user
7. Cloud nullkan pairing_code → single use enforced
8. Cloud kirim notification ke user: "Device paired successfully"
```

### Anti-brute-force

- Pairing code endpoint di-rate limit: max 5 attempts per 15 minutes
- Setelah 3 failed attempts → code di-invalidate → generate code baru

---

## 8. Security Hardening Checklist

### Fase 0 (Wajib dari Awal)

- [ ] Helmet middleware (security headers)
- [ ] CORS whitelist (hanya domain yang diizinkan)
- [ ] Global ValidationPipe (reject malformed payloads)
- [ ] Request ID middleware (traceability)
- [ ] Environment variable validation (no missing secrets)

### Fase 1 (Auth)

- [ ] Password hashing via Supabase Auth (bcrypt)
- [ ] JWT verification via Supabase
- [ ] Refresh token rotation (Supabase native)
- [ ] Session revocation capability
- [ ] User status check (block suspended accounts)

### Fase 2 (Device)

- [ ] Device token hashing (bcrypt, 12 rounds)
- [ ] Registration secret verification
- [ ] Pairing code expiry enforcement
- [ ] Device ownership validation

### Fase 3 (Sync)

- [ ] Idempotency enforcement (unique request_id)
- [ ] Ownership validation: device → user matching
- [ ] Payload size limits
- [ ] Timestamp sanity check (reject future dates)

### Fase 4 (Hardening)

- [ ] Rate limiting via `@nestjs/throttler`
- [ ] IP-based rate limiting per endpoint
- [ ] Audit logging untuk semua action sensitif
- [ ] Admin action audit trail

---

## 9. Token Lifecycle Summary

### User Access Token (Supabase JWT)

```
Created: saat login/register
Lifetime: 1 hour (configurable di Supabase dashboard)
Refresh: via POST /auth/refresh
Invalidate: via POST /auth/logout or revoke-all
Verification: supabase.auth.getUser(token)
```

### User Refresh Token (Supabase)

```
Created: saat login/register
Lifetime: 7 days (configurable) — rotated setiap refresh
Storage (App): Secure storage (Keychain/Keystore)
Invalidate: via POST /auth/logout (current) or revoke-all (global)
```

### Device Token (Custom)

```
Created: saat POST /devices/register (one-time)
Lifetime: unlimited (no expiry)
Storage (Cloud): bcrypt hash
Storage (Pi): /etc/arisa/device.key (chmod 600)
Invalidate: via POST /devices/:id/revoke atau admin disable
Rotation: manual — admin issues new token, old one invalidated
```

### Pairing Code

```
Created: saat POST /devices/pair/start
Lifetime: 10 minutes
Format: 6 char alphanumeric
Single use: yes
Storage: devices.pairing_code + devices.pairing_expiry
Invalidate: after successful pair or expiry
```

---

## 10. Threat Model

| Threat | Mitigasi |
|--------|----------|
| Stolen user JWT | Short expiry (1h), revoke-all capability |
| Stolen device token | Bcrypt hash di cloud, revoke endpoint, audit log |
| Brute-force pairing code | Rate limit, 6-char code = 2.2 billion combinations, 10 min expiry |
| Man-in-the-middle | TLS 1.2+ mandatory |
| SQL injection | Prisma ORM (parameterized queries) |
| Payload injection | class-validator + whitelist mode |
| CSRF | Token-based auth (no cookies), CORS whitelist |
| DDoS | Rate limiting, cloud provider DDoS protection |
| Replay attack | request_id idempotency, timestamp validation |
| Privilege escalation | RBAC guard, ownership enforcement in service layer |

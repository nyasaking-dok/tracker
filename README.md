# Plaspy-mimic Server

A NestJS backend that mimics the [Plaspy](https://www.plaspy.com) satellite tracking
platform's REST API for car/GPS tracking — same endpoints, same request/response
shapes, same quirks (POST-as-query, the `milleage` field typo, per-response
`apiUsage`/`apiDailyUsage` counters) — so existing Plaspy client code can point
at this server unmodified.

## Stack

- NestJS 11, TypeScript
- PostgreSQL 16 (Docker Compose), Prisma ORM
- JWT auth (HS512) via `@nestjs/jwt` + Passport
- Swagger UI at `/docs`
- Jest unit + e2e tests

## Architecture

The server is a NestJS monolith organized by feature module. One shared
`PrismaModule` (`@Global()`) provides the `PrismaService` everywhere, and a set
of `APP_*` providers in `AppModule` apply cross-cutting concerns globally.

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Request                                  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  JwtOwnGuard (global)│   ← ownership chain from JWT
                     └─────────────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │   Controller(s)     │  ← route + DTO validation
                     └─────────────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │    Service / Prisma │  ← business logic + queries
                     └─────────────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ PostgreSQL (Prisma) │
                     └─────────────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ EnvelopeInterceptor │  ← wraps in Plaspy envelope
                     └─────────────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ PlaspyExceptionFilter│ ← normalizes errors
                     └─────────────────────┘
```

### Modules

| Module      | Path prefix                       | Responsibility                                            |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `auth`      | `/api/Auth`                       | Token issuance, JWT strategy, ownership-chain guard, API-key validation |
| `devices`   | `/api/devices`                    | Device CRUD, shapes, last-location, ownership scoping    |
| `locations` | `/api/devices/{id}/locations`     | Telemetry history (POST-as-query, `skip`/`take` paging)   |
| `alerts`    | `/api/devices/{id}/alerts`        | Alert history, filterable by ~50 alert names              |
| `commands`  | `/api/devices/{id}/sendCommand`   | Command validation + simulated delivery, command log      |
| `groups`    | `/api/groups`                     | Device groups, device-ownership validation on write       |
| `users`     | `/api/users`                      | Master/sub-user management, countries/timezones           |
| `ingestion` | `/api/ingest/{id}/position`       | Tracker-facing position intake + alert evaluation         |
| `prisma`    | —                                 | `@Global()` module exporting `PrismaService`              |
| `common`    | —                                 | Envelope interceptor, exception filter, API-usage service |

### Data model

```
User 1 ──< Device (ownerId)
 │ │
 │ └────< Group   (ownerId)
 └──────< User    (masterId → self-referential master/sub-user)

Device 1 ─< Location   (deviceId)
      1 ─< Alert      (deviceId)
      1 ─< CommandLog (deviceId)
```

- **User** — account, API key (bcrypt hash), master/sub-user hierarchy via
  `masterId`, daily usage counters.
- **Device** — owned by a `User`, has a unique `ingestionKeyHash` (the hash of
  the tracker-facing key, not the JWT path) and an `apiKey`.
- **Location** — one telemetry point (full Plaspy field set incl. `milleage`).
- **Alert** — a persisted, evaluated alert (drives the alerts API).
- **CommandLog** — audit trail of every `sendCommand`.
- **Group** — a named set of `deviceIds`.

## Request flow

### 1. User (JWT) requests

```
Client ── POST /api/Auth/Token {userName, apiKey}
        ──> AuthService.issueToken: validates apiKey, disabled/expiry,
            issues HS512 JWT. Response returns `token`, `expires`.

Client ── <Any endpoint> with Authorization: Bearer <JWT>
        ──> JwtOwnGuard: decodes token, builds `req.ownerIds`
            (self id + all descendant sub-user ids), attaches `req.user`.

        ──> Controller: parses + validates body/query (ValidationPipe),
            calls service with `req.ownerIds`.

        ──> Service: queries via Prisma scoped to `ownerId ∈ ownerIds`;
            `loadOwnedDevice` throws 404 for foreign/unknown ids (no leak).

        ──> EnvelopeInterceptor: wraps result in
            { success, error, apiUsage, apiDailyUsage, ...payload }.
```

### 2. Tracker (ingest) requests

```
Tracker ── POST /api/ingest/{deviceId}/position
            header X-Ingest-Key: <plaintext device ingestion key>
        ──> (Public route — bypasses JwtOwnGuard)

        ──> IngestionController:
              1. looks up device, bcrypt-compares key to ingestionKeyHash
              2. checks subscription expiry
              3. AlertEvaluationService.evaluate(prev, incoming)
                 → SpeedLimit, SOSButton, LowBattery, FuelJumpDown/Up,
                   FuelLessThan, TemperatureGreaterThan/LowerThan,
                   HarshBraking/Acceleration, IdleTime
              4. writes a Location row (alertTexts/alerts/hasCriticalAlert
                 enriched from evaluation)
              5. writes evaluated Alert rows so the alerts API returns them.

Response: { result, alertsGenerated, locationDateTime } (still enveloped).
```

### Two trust domains

| Aspect      | User API (JWT)                          | Ingestion (tracker)                  |
| ----------- | --------------------------------------- | ------------------------------------ |
| Auth        | `Bearer` JWT via `POST /api/Auth/Token` | `X-Ingest-Key` header               |
| Identity    | `User` with `ownerIds` chain            | `Device` with `ingestionKeyHash`     |
| Scope       | Own + descendant data, 404 otherwise    | Single device only                   |
| Guard       | `JwtOwnGuard` (`@Public()` to opt out)  | Public route, manual bcrypt check    |

## Quick start

```bash
# 1. Start Postgres
docker compose up -d

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env   # then edit JWT_SECRET etc.

# 4. Create schema + seed demo data (48h of simulated history per device)
npx prisma migrate dev --name init
npm run seed

# 5. Run
npm run start:dev      # http://localhost:3000, Swagger at /docs
```

## Seeded accounts

| userName   | apiKey             | Role      | Sees                                   |
| ---------- | ------------------ | --------- | -------------------------------------- |
| `master`   | `master-api-key-123` | Master    | Own 2 devices + sub-users' 1 device    |
| `fleetops` | `fleetops-api-key` | Sub-user  | Own 1 device (Service Car 03)          |
| `fieldtech`| `fieldtech-api-key`| Sub-user  | No devices                             |

Devices carry deterministic dev ingestion keys (rotate for production):
`ik_truck01_devkey`, `ik_van02_devkey`, `ik_servicecar03_devkey`.

## API surface

All responses use the Plaspy envelope:

```json
{ "success": true, "error": null, "apiUsage": 12, "apiDailyUsage": 3, "...": "..." }
```

### Auth

- `POST /api/Auth/Token` `{userName, apiKey}` → `{success, token, expires}`.
  Use `Authorization: Bearer <token>` for everything else.

### Devices

- `GET /api/devices` — list devices (ownership-scoped)
- `GET /api/devices/{deviceId}` — device detail
- `GET /api/devices/{deviceId}/lastLocation` — newest position with full telemetry

### History (POST-as-query, per Plaspy)

- `POST /api/devices/{deviceId}/locations` `{from, to}` (+ `?skip=&take=` paging)
- `POST /api/devices/{deviceId}/alerts` `{from, to, alertName?}` — filter by any
  of the ~50 Plaspy alert names (`SpeedLimit`, `SOSButton`, `FuelJumpDown`,
  `HarshBraking`, ...)

### Commands

- `POST /api/devices/{deviceId}/sendCommand` `{command, format: Text|Hex|Base64, sms?}`
  — validated, logged, simulated result (no physical device attached)

### Groups

- `GET /api/groups`, `POST /api/groups`
- `GET/PUT/PATCH/DELETE /api/groups/{groupId}`

### Users (masters manage sub-users)

- `GET /api/users`, `POST /api/users` (returns the new sub-user's API key once)
- `GET/PUT/PATCH/DELETE /api/users/{userId}`
- `GET /api/users/countries`, `GET /api/users/timeZones`

### Ingestion (tracker-facing, non-JWT)

- `POST /api/ingest/{deviceId}/position` with header `X-Ingest-Key: <device key>`
  — stores the position, evaluates alert rules (speeding, SOS flag, low battery,
  fuel jump down/up/low, temperature high/low, harsh braking/acceleration, idle
  time) and persists generated alerts so they appear in the alerts API.

## curl walkthrough

```bash
# 1. Token
TOKEN=$(curl -s -X POST http://localhost:3000/api/Auth/Token \
  -H 'Content-Type: application/json' \
  -d '{"userName":"master","apiKey":"master-api-key-123"}' | jq -r .token)

# 2. Devices
curl -s http://localhost:3000/api/devices -H "Authorization: Bearer $TOKEN" | jq

DEV=$(curl -s http://localhost:3000/api/devices -H "Authorization: Bearer $TOKEN" | jq -r '.devices[0].id')

# 3. Last location
curl -s http://localhost:3000/api/devices/$DEV/lastLocation \
  -H "Authorization: Bearer $TOKEN" | jq '.lastLocation | {latitude, longitude, speed, milleage}'

# 4. History range (last 48h)
FROM=$(date -u -v-48H +%Y-%m-%dT%H:%M:%SZ)  # macOS; GNU date: date -u -d '-48 hours' ...
TO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s -X POST http://localhost:3000/api/devices/$DEV/locations \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"to\":\"$TO\"}" | jq '.locations | length'

# 5. Speeding alerts
curl -s -X POST http://localhost:3000/api/devices/$DEV/alerts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"to\":\"$TO\",\"alertName\":\"SpeedLimit\"}" | jq '.alerts[0:3]'

# 6. Send a command
curl -s -X POST http://localhost:3000/api/devices/$DEV/sendCommand \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"command":"engine_stop","format":"Text"}' | jq .result

# 7. Ingest a live position (as the tracker)
curl -s -X POST http://localhost:3000/api/ingest/$DEV/position \
  -H 'Content-Type: application/json' -H 'X-Ingest-Key: ik_truck01_devkey' \
  -d "{\"dateTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"latitude\":40.71,\"longitude\":-74.01,\"speed\":95,\"fuel\":40,\"battery\":88}"
```

## Ownership model

- A **master** sees its own data plus everything belonging to its sub-users.
- A **sub-user** sees only its own data; foreign IDs return 404 (no information leak).
- Only masters can create or delete sub-users.

## Tests

```bash
npm test           # unit (alert engine)
npm run test:e2e   # requires a migrated+seeded database
npm run lint:check
```

## Notes on fidelity

- `POST` is used for queries with `{from, to}` bodies because that's how the
  real Plaspy API works.
- The `milleage` field keeps Plaspy's spelling; `min` is their Mobile Identity
  Number field.
- Command results are simulated — there is no physical tracker connected — but
  every command is validated and persisted to the command log table.

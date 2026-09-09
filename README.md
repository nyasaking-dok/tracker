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

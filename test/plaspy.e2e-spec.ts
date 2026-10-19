import request from 'supertest';
import { createTestApp } from './test-app';

describe('Plaspy-mimic e2e (auth + envelope + ownership)', () => {
  let app: any;
  let token: string;
  let subToken: string;
  let deviceId: string;
  let subDeviceId: string;

  const MASTER = process.env.MASTER_USERNAME || 'master';
  const MASTER_KEY = process.env.MASTER_API_KEY || 'master-api-key-123';

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('POST /api/Auth/Token issues a JWT for valid master credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/Auth/Token')
      .send({ userName: MASTER, apiKey: MASTER_KEY })
      .expect(201); // Nest default for POST
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.expires).toBeDefined();
    token = res.body.token;
  });

  it('POST /api/Auth/Token rejects invalid credentials with the Plaspy envelope', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/Auth/Token')
      .send({ userName: MASTER, apiKey: 'wrong' });
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Invalid API key or username.');
  });

  it('GET /api/devices returns seeded devices with usage counters in the envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/devices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.apiUsage).toBeDefined();
    expect(res.body.apiDailyUsage).toBeDefined();
    expect(Array.isArray(res.body.devices)).toBe(true);
    // master sees own + sub-user devices (3 seeded)
    expect(res.body.devices.length).toBeGreaterThanOrEqual(3);
    // Pick a master-owned device (Truck 01 or Van 02) so the sub-user ownership
    // check later correctly returns 404. "Service Car 03" sorts first
    // alphabetically but is owned by the sub-user.
    const masterOwned = res.body.devices.find(
      (d: any) => d.name === 'Truck 01' || d.name === 'Van 02',
    );
    deviceId = (masterOwned ?? res.body.devices[0]).id;
  });


  it('GET /api/devices/{id} returns the device detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.device.id).toBe(deviceId);
    expect(res.body.device.name).toBeDefined();
    expect(res.body.device).not.toHaveProperty('apiKey');
  });

  it('GET /api/devices/{id}/lastLocation returns the newest position', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/devices/${deviceId}/lastLocation`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.lastLocation).not.toBeNull();
    expect(typeof res.body.lastLocation.latitude).toBe('number');
    expect(typeof res.body.lastLocation.milleage).toBe('number'); // Plaspy typo preserved
    expect(res.body.lastLocation.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('POST /api/devices/{id}/locations queries history by range', async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 49 * 3600 * 1000);
    const res = await request(app.getHttpServer())
      .post(`/api/devices/${deviceId}/locations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: from.toISOString(), to: to.toISOString() })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.locations.length).toBeGreaterThan(50);
  });

  it('POST /api/devices/{id}/alerts filters by alertName', async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 49 * 3600 * 1000);
    const all = await request(app.getHttpServer())
      .post(`/api/devices/${deviceId}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: from.toISOString(), to: to.toISOString() })
      .expect(201);
    expect(all.body.success).toBe(true);

    const filtered = await request(app.getHttpServer())
      .post(`/api/devices/${deviceId}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: from.toISOString(), to: to.toISOString(), alertName: 'SpeedLimit' })
      .expect(201);
    expect(filtered.body.alerts.length).toBeGreaterThan(0);
    for (const a of filtered.body.alerts) {
      expect(a.text).toBe('Speeding Alert');
    }
  });

  it('POST /api/devices/{id}/alerts rejects an invalid alertName', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/devices/${deviceId}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2024-01-01T00:00:00Z', to: '2024-01-02T00:00:00Z', alertName: 'Nope' });
    expect(res.body.success).toBe(false);
  });

  it('POST /api/devices/{id}/sendCommand accepts Text and logs it', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/devices/${deviceId}/sendCommand`)
      .set('Authorization', `Bearer ${token}`)
      .send({ command: 'engine_stop', format: 'Text' })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toContain('Command executed successfully');
  });

  it('POST /api/devices/{id}/sendCommand validates Hex format', async () => {
    const bad = await request(app.getHttpServer())
      .post(`/api/devices/${deviceId}/sendCommand`)
      .set('Authorization', `Bearer ${token}`)
      .send({ command: 'ZZZZ', format: 'Hex' });
    expect(bad.body.success).toBe(false);

    const good = await request(app.getHttpServer())
      .post(`/api/devices/${deviceId}/sendCommand`)
      .set('Authorization', `Bearer ${token}`)
      .send({ command: '0A 1B 2C', format: 'Hex' })
      .expect(201);
    expect(good.body.success).toBe(true);
  });

  it('groups CRUD works end to end', async () => {
    // create
    const created = await request(app.getHttpServer())
      .post('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Group', description: 'created by e2e', devices: [deviceId] })
      .expect(201);
    expect(created.body.success).toBe(true);
    expect(created.body.name).toBe('E2E Group');
    const groupId = created.body.id;

    // read list + detail
    const list = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.groups.some((g: any) => g.id === groupId)).toBe(true);

    // patch
    const patched = await request(app.getHttpServer())
      .patch(`/api/groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Group Renamed' })
      .expect(200);
    expect(patched.body.name).toBe('E2E Group Renamed');

    // delete
    const deleted = await request(app.getHttpServer())
      .delete(`/api/groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(deleted.body.success).toBe(true);
  });

  it('users API: sub-user cannot create users, master can', async () => {
    // login as sub-user
    const subLogin = await request(app.getHttpServer())
      .post('/api/Auth/Token')
      .send({ userName: 'fleetops', apiKey: 'fleetops-api-key' });
    subToken = subLogin.body.token;
    expect(subToken).toBeDefined();

    // sub-user sees only their own devices (Service Car 03)
    const subDevices = await request(app.getHttpServer())
      .get('/api/devices')
      .set('Authorization', `Bearer ${subToken}`)
      .expect(200);
    expect(subDevices.body.devices).toHaveLength(1);
    subDeviceId = subDevices.body.devices[0].id;

    // sub-user cannot see master's device detail
    const forbidden = await request(app.getHttpServer())
      .get(`/api/devices/${deviceId}`)
      .set('Authorization', `Bearer ${subToken}`);
    expect(forbidden.body.success).toBe(false);
    expect(forbidden.status).toBe(404);

    // sub-user cannot create users
    const denied = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${subToken}`)
      .send({
        name: 'X',
        email: 'x@example.com',
        country: 'US',
        timeZone: 'America/Los_Angeles',
      });
    expect(denied.body.success).toBe(false);

    // master creates a sub-user and gets the API key back
    const created = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E User',
        email: 'e2e-user@example.com',
        country: 'US',
        timeZone: 'America/Los_Angeles',
      })
      .expect(201);
    expect(created.body.success).toBe(true);
    expect(created.body.apiKey).toMatch(/^pk_/);

    // cleanup
    await request(app.getHttpServer())
      .delete(`/api/users/${created.body.user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('GET /api/users/countries and /api/users/timeZones return reference data', async () => {
    const c = await request(app.getHttpServer())
      .get('/api/users/countries')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(c.body.countries.length).toBeGreaterThan(40);

    const tz = await request(app.getHttpServer())
      .get('/api/users/timeZones')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(tz.body.timeZones).toContain('America/Los_Angeles');
  });

  it('ingestion stores a position and generates alerts visible in the alerts API', async () => {
    // subDeviceId is the seeded "Service Car 03" with deterministic dev key
    const now = new Date();
    const res = await request(app.getHttpServer())
      .post(`/api/ingest/${subDeviceId}/position`)
      .set('X-Ingest-Key', 'ik_servicecar03_devkey')
      .send({
        dateTime: now.toISOString(),
        latitude: 41.88,
        longitude: -87.63,
        speed: 95, // above SpeedLimit threshold => SpeedLimit alert
        battery: 90,
        fuel: 45,
        temperature: 25,
      })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.alertsGenerated).toContain('SpeedLimit');

    // the alert should now be queryable via the alerts API
    const alerts = await request(app.getHttpServer())
      .post(`/api/devices/${subDeviceId}/alerts`)
      .set('Authorization', `Bearer ${subToken}`)
      .send({
        from: new Date(now.getTime() - 60 * 1000).toISOString(),
        to: new Date(now.getTime() + 60 * 1000).toISOString(),
        alertName: 'SpeedLimit',
      })
      .expect(201);
    expect(alerts.body.success).toBe(true);
    expect(alerts.body.alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts.body.alerts[0].text).toBe('Speeding Alert');

    // and the new position should be the lastLocation
    const last = await request(app.getHttpServer())
      .get(`/api/devices/${subDeviceId}/lastLocation`)
      .set('Authorization', `Bearer ${subToken}`)
      .expect(200);
    expect(last.body.lastLocation.latitude).toBeCloseTo(41.88, 5);
    expect(last.body.lastLocation.speed).toBe(95);

    // wrong key is rejected
    const bad = await request(app.getHttpServer())
      .post(`/api/ingest/${subDeviceId}/position`)
      .set('X-Ingest-Key', 'definitely-wrong-key')
      .send({ dateTime: now.toISOString(), latitude: 41.88, longitude: -87.63, speed: 10 });
    expect(bad.body.success).toBe(false);
    expect(bad.status).toBe(401);
  });

  it('requires auth: no token -> 401 envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/devices').expect(401);
    expect(res.body.success).toBe(false);
  });
});

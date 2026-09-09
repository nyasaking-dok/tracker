import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function daysAgo(days: number, hours = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d;
}

// Simple deterministic pseudo-random walk around a start point
function simulateRoute(
  startLat: number,
  startLng: number,
  points: number,
  startIndex: number,
) {
  const pts: { lat: number; lng: number; speed: number; course: number }[] = [];
  let lat = startLat;
  let lng = startLng;
  let course = 45;
  let seed = startIndex;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < points; i++) {
    course = (course + (rand() - 0.5) * 60 + 360) % 360;
    const dist = 0.002 + rand() * 0.004;
    lat += Math.cos((course * Math.PI) / 180) * dist;
    lng += Math.sin((course * Math.PI) / 180) * dist;
    const speed = rand() > 0.15 ? 20 + rand() * 60 : 0;
    pts.push({ lat, lng, speed: Math.round(speed), course: Math.round(course) });
  }
  return pts;
}

async function main() {
  const masterUsername = process.env.MASTER_USERNAME || 'master';
  const masterApiKey = process.env.MASTER_API_KEY || 'master-api-key-123';

  console.log('Clearing existing data...');
  await prisma.commandLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.location.deleteMany();
  await prisma.group.deleteMany();
  await prisma.device.deleteMany();
  await prisma.user.deleteMany();

  console.log(`Creating master user ${masterUsername}...`);
  const master = await prisma.user.create({
    data: {
      userName: masterUsername,
      apiKey: await bcrypt.hash(masterApiKey, 10),
      email: 'master@example.com',
      name: 'Master Account',
      country: 'US',
      timeZone: 'America/Los_Angeles',
      privileges: ['read', 'write', 'admin'],
      tags: { role: 'master' },
    },
  });

  console.log('Creating sub-users...');
  const sub1 = await prisma.user.create({
    data: {
      userName: 'fleetops',
      apiKey: await bcrypt.hash('fleetops-api-key', 10),
      email: 'fleetops@example.com',
      name: 'Fleet Operations',
      country: 'US',
      timeZone: 'America/New_York',
      masterId: master.id,
      privileges: ['read', 'write'],
      tags: { role: 'subuser', department: 'operations' },
    },
  });
  const sub2 = await prisma.user.create({
    data: {
      userName: 'fieldtech',
      apiKey: await bcrypt.hash('fieldtech-api-key', 10),
      email: 'fieldtech@example.com',
      name: 'Field Technician',
      country: 'US',
      timeZone: 'America/Chicago',
      masterId: master.id,
      privileges: ['read'],
      tags: { role: 'subuser', department: 'service' },
    },
  });

  console.log('Creating devices...');
  // Deterministic dev ingestion keys so the demo and e2e tests work out of the
  // box. Rotate these (or generate random ones) for any real deployment.
  const ingestionKeys: Record<string, string> = {
    dev1: 'ik_truck01_devkey',
    dev2: 'ik_van02_devkey',
    dev3: 'ik_servicecar03_devkey',
  };
  const dev1 = await prisma.device.create({
    data: {
      name: 'Truck 01',
      description: 'Main tracking device',
      min: '12345',
      tags: { fleet: 'north', type: 'truck' },
      ownerId: master.id,
      expires: daysAgo(-365),
      ingestionKeyHash: await bcrypt.hash(ingestionKeys.dev1, 10),
    },
  });
  const dev2 = await prisma.device.create({
    data: {
      name: 'Van 02',
      description: 'Backup tracking device',
      min: '67890',
      tags: { fleet: 'north', type: 'van' },
      ownerId: master.id,
      expires: daysAgo(-180),
      ingestionKeyHash: await bcrypt.hash(ingestionKeys.dev2, 10),
    },
  });
  const dev3 = await prisma.device.create({
    data: {
      name: 'Service Car 03',
      description: 'Field service vehicle',
      min: '55112',
      tags: { fleet: 'south', type: 'car' },
      ownerId: sub1.id,
      expires: daysAgo(-90),
      ingestionKeyHash: await bcrypt.hash(ingestionKeys.dev3, 10),
    },
  });

  console.log('Creating group...');
  await prisma.group.create({
    data: {
      name: 'North Fleet',
      description: 'All vehicles in the northern region',
      deviceIds: [dev1.id, dev2.id],
      ownerId: master.id,
    },
  });
  await prisma.group.create({
    data: {
      name: 'South Fleet',
      description: 'Field service vehicles',
      deviceIds: [dev3.id],
      ownerId: sub1.id,
    },
  });

  console.log('Simulating 48h of location history...');
  const now = Date.now();
  const stepMs = 10 * 60 * 1000; // one point every 10 minutes
  const totalPoints = Math.floor((48 * 60 * 60 * 1000) / stepMs);

  const routes: Record<string, ReturnType<typeof simulateRoute>> = {
    [dev1.id]: simulateRoute(40.7128, -74.006, totalPoints, 1),
    [dev2.id]: simulateRoute(34.0522, -118.2437, totalPoints, 77),
    [dev3.id]: simulateRoute(41.8781, -87.6298, totalPoints, 1234),
  };

  let mileageAccum: Record<string, number> = { [dev1.id]: 15000, [dev2.id]: 8200, [dev3.id]: 3100 };

  for (const [deviceId, pts] of Object.entries(routes)) {
    const locations: any[] = [];
    const alerts: any[] = [];
    let fuel = 80;
    let prevSpeed = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const t = new Date(now - (pts.length - i) * stepMs);
      const moving = p.speed > 0;
      if (moving) fuel = Math.max(5, fuel - 0.15);
      mileageAccum[deviceId] += moving ? (p.speed * stepMs) / 3600000 : 0;

      // alert conditions
      const alertTexts: string[] = [];
      const alertNames: string[] = [];
      if (p.speed > 70) {
        alertTexts.push('Speeding Alert');
        alertNames.push('SpeedLimit');
      }
      if (prevSpeed > 45 && p.speed < 5) {
        alertTexts.push('Harsh Braking');
        alertNames.push('HarshBraking');
      }
      if (prevSpeed < 10 && p.speed > 55) {
        alertTexts.push('Harsh Acceleration');
        alertNames.push('HarshAcceleration');
      }
      if (fuel < 15) {
        alertTexts.push('Low Fuel');
        alertNames.push('FuelLessThan');
      }
      if (i === Math.floor(pts.length * 0.4)) {
        // one SOS event per device mid-history
        alertTexts.push('SOS Button');
        alertNames.push('SOSButton');
      }
      prevSpeed = p.speed;

      locations.push({
        deviceId,
        dateTime: t,
        latitude: Number(p.lat.toFixed(6)),
        longitude: Number(p.lng.toFixed(6)),
        speed: p.speed,
        course: p.course,
        battery: 60 + (i % 40),
        fuel: Math.round(fuel),
        temperature: 20 + (i % 10),
        inactiveSeconds: moving ? 0 : 600,
        rpm: moving ? 1500 + Math.round(p.speed * 30) : 0,
        milleage: Math.round(mileageAccum[deviceId] * 10) / 10,
        alertTexts,
        alerts: alertNames,
        hasCriticalAlert: alertNames.includes('SOSButton'),
      });

      for (let a = 0; a < alertTexts.length; a++) {
        alerts.push({
          deviceId,
          dateTime: t,
          latitude: Number(p.lat.toFixed(6)),
          longitude: Number(p.lng.toFixed(6)),
          text: alertTexts[a],
          alertName: alertNames[a],
          notifications: ['Email'],
          alerts: [alertNames[a]],
        });
      }
    }
    // chunked insert
    for (let i = 0; i < locations.length; i += 200) {
      await prisma.location.createMany({ data: locations.slice(i, i + 200) });
    }
    for (let i = 0; i < alerts.length; i += 200) {
      await prisma.alert.createMany({ data: alerts.slice(i, i + 200) });
    }
  }

  console.log('Seed complete.');
  console.log(`  Master login: userName=${masterUsername} apiKey=${masterApiKey}`);
  console.log('  Sub-users: fleetops/fleetops-api-key, fieldtech/fieldtech-api-key');
  console.log(`  Devices: ${dev1.name}, ${dev2.name}, ${dev3.name}`);
  console.log('  Ingestion keys (X-Ingest-Key header):');
  console.log(`    ${dev1.name} (${dev1.id}): ${ingestionKeys.dev1}`);
  console.log(`    ${dev2.name} (${dev2.id}): ${ingestionKeys.dev2}`);
  console.log(`    ${dev3.name} (${dev3.id}): ${ingestionKeys.dev3}`);
  console.log(`  Location points: ~${totalPoints * 3}, alerts generated alongside.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

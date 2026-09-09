import { AlertEvaluationService } from './alert-evaluation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AlertEvaluationService', () => {
  let service: AlertEvaluationService;
  let prisma: { location: { findFirst: jest.Mock } };

  beforeEach(() => {
    prisma = {
      location: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    service = new AlertEvaluationService(prisma as unknown as PrismaService);
  });

  const base = {
    dateTime: new Date(),
    latitude: 40.7,
    longitude: -74.0,
    speed: 0,
  };

  it('fires SpeedLimit above the threshold', async () => {
    const alerts = await service.evaluate('dev', { ...base, speed: 95 });
    expect(alerts.map((a) => a.alertName)).toContain('SpeedLimit');
  });

  it('does not fire SpeedLimit at or below the threshold', async () => {
    const alerts = await service.evaluate('dev', { ...base, speed: 70 });
    expect(alerts.map((a) => a.alertName)).not.toContain('SpeedLimit');
  });

  it('fires SOSButton when the client flags SOS in alertTexts', async () => {
    const alerts = await service.evaluate('dev', { ...base, alertTexts: ['SOS pressed!'] });
    expect(alerts.map((a) => a.alertName)).toContain('SOSButton');
  });

  it('fires LowBattery at or under the threshold', async () => {
    const alerts = await service.evaluate('dev', { ...base, battery: 10 });
    expect(alerts.map((a) => a.alertName)).toContain('LowBattery');
  });

  it('fires FuelJumpDown when the level drops sharply vs the previous point', async () => {
    prisma.location.findFirst.mockResolvedValue({ fuel: 60, speed: 0 });
    const alerts = await service.evaluate('dev', { ...base, fuel: 30 });
    expect(alerts.map((a) => a.alertName)).toContain('FuelJumpDown');
  });

  it('fires FuelJumpUp when the level rises sharply vs the previous point', async () => {
    prisma.location.findFirst.mockResolvedValue({ fuel: 20, speed: 0 });
    const alerts = await service.evaluate('dev', { ...base, fuel: 60 });
    expect(alerts.map((a) => a.alertName)).toContain('FuelJumpUp');
  });

  it('fires HarshBraking on a large speed drop vs the previous point', async () => {
    prisma.location.findFirst.mockResolvedValue({ speed: 90 });
    const alerts = await service.evaluate('dev', { ...base, speed: 20 });
    expect(alerts.map((a) => a.alertName)).toContain('HarshBraking');
  });

  it('fires HarshAcceleration on a large speed gain vs the previous point', async () => {
    prisma.location.findFirst.mockResolvedValue({ speed: 0 });
    const alerts = await service.evaluate('dev', { ...base, speed: 60 });
    expect(alerts.map((a) => a.alertName)).toContain('HarshAcceleration');
  });

  it('fires IdleTime when stationary with engine off', async () => {
    const alerts = await service.evaluate('dev', {
      ...base,
      inactiveSeconds: 900,
      rpm: 0,
    });
    expect(alerts.map((a) => a.alertName)).toContain('IdleTime');
  });

  it('fires temperature rules', async () => {
    const hot = await service.evaluate('dev', { ...base, temperature: 55 });
    expect(hot.map((a) => a.alertName)).toContain('TemperatureGreaterThan');

    const cold = await service.evaluate('dev', { ...base, temperature: -20 });
    expect(cold.map((a) => a.alertName)).toContain('TemperatureLowerThan');
  });

  it('dedupes alert names', async () => {
    const alerts = await service.evaluate('dev', { ...base, speed: 95, alertTexts: ['SOS'] });
    const names = alerts.map((a) => a.alertName);
    expect(new Set(names).size).toBe(names.length);
  });
});

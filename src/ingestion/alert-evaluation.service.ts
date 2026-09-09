import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EvaluatedAlert {
  alertName: string;
  text: string;
}

/**
 * Evaluates alert rules for an incoming position against the device's
 * previous position, mirroring Plaspy's alert engine for the rules that
 * can be derived from position data alone:
 * SpeedLimit, SOSButton (client-flagged), LowBattery, FuelJumpDown,
 * FuelJumpUp, FuelLessThan, TemperatureGreaterThan, TemperatureLowerThan,
 * HarshBraking, HarshAcceleration, IdleTime, Offline.
 */
@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger(AlertEvaluationService.name);

  // tunable thresholds, deliberately simple
  static SPEED_LIMIT = 70; // km/h above which SpeedLimit fires
  static LOW_BATTERY = 15; // % below which LowBattery fires
  static FUEL_JUMP = 15; // percentage-point drop/rise that constitutes a jump
  static FUEL_LOW = 10; // % below which FuelLessThan fires
  static TEMP_MAX = 40; // Celsius above which TemperatureGreaterThan fires
  static TEMP_MIN = -10; // Celsius below which TemperatureLowerThan fires
  static HARSH_BRAKE_DECEL = 40; // km/h speed drop between points => HarshBraking
  static HARSH_ACCEL = 45; // km/h speed gain between points => HarshAcceleration
  static IDLE_SECONDS = 600; // 10 minutes stationary with engine data => IdleTime

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    deviceId: string,
    incoming: {
      dateTime: Date;
      latitude: number;
      longitude: number;
      speed: number;
      battery?: number;
      fuel?: number;
      fuel2?: number;
      temperature?: number;
      temperature2?: number;
      inactiveSeconds?: number;
      rpm?: number;
      alertTexts?: string[];
    },
  ): Promise<EvaluatedAlert[]> {
    const alerts: EvaluatedAlert[] = [];
    const prev = await this.prisma.location.findFirst({
      where: { deviceId },
      orderBy: { dateTime: 'desc' },
    });

    // 1. Speed limit
    if (incoming.speed > AlertEvaluationService.SPEED_LIMIT) {
      alerts.push({ alertName: 'SpeedLimit', text: 'Speeding Alert' });
    }

    // 2. Client-flagged SOS: clients may pass alertTexts containing "SOS"
    if ((incoming.alertTexts ?? []).some((t) => /sos/i.test(t))) {
      alerts.push({ alertName: 'SOSButton', text: 'SOS Button' });
    }

    // 3. Low battery
    if (incoming.battery !== undefined && incoming.battery <= AlertEvaluationService.LOW_BATTERY) {
      alerts.push({ alertName: 'LowBattery', text: 'Low Battery' });
    }

    // 4. Fuel rules (need previous point for jumps)
    if (incoming.fuel !== undefined) {
      if (prev?.fuel !== null && prev?.fuel !== undefined) {
        const drop = prev.fuel - incoming.fuel;
        if (drop >= AlertEvaluationService.FUEL_JUMP) {
          alerts.push({ alertName: 'FuelJumpDown', text: 'Sudden Fuel Drop' });
        }
        if (-drop >= AlertEvaluationService.FUEL_JUMP) {
          alerts.push({ alertName: 'FuelJumpUp', text: 'Sudden Fuel Increase' });
        }
      }
      if (incoming.fuel <= AlertEvaluationService.FUEL_LOW) {
        alerts.push({ alertName: 'FuelLessThan', text: 'Low Fuel' });
      }
    }

    // 5. Temperature
    if (incoming.temperature !== undefined) {
      if (incoming.temperature > AlertEvaluationService.TEMP_MAX) {
        alerts.push({ alertName: 'TemperatureGreaterThan', text: 'High Temperature' });
      }
      if (incoming.temperature < AlertEvaluationService.TEMP_MIN) {
        alerts.push({ alertName: 'TemperatureLowerThan', text: 'Low Temperature' });
      }
    }

    // 6. Harsh braking / acceleration (delta vs previous point)
    if (prev) {
      const decel = prev.speed - incoming.speed;
      if (decel >= AlertEvaluationService.HARSH_BRAKE_DECEL) {
        alerts.push({ alertName: 'HarshBraking', text: 'Harsh Braking' });
      }
      const accel = incoming.speed - prev.speed;
      if (accel >= AlertEvaluationService.HARSH_ACCEL) {
        alerts.push({ alertName: 'HarshAcceleration', text: 'Harsh Acceleration' });
      }
    }

    // 7. Idle time
    if ((incoming.inactiveSeconds ?? 0) >= AlertEvaluationService.IDLE_SECONDS && incoming.rpm === 0) {
      alerts.push({ alertName: 'IdleTime', text: 'Excessive Idle Time' });
    }

    // dedupe by alertName
    const seen = new Set<string>();
    return alerts.filter((a) => {
      if (seen.has(a.alertName)) return false;
      seen.add(a.alertName);
      return true;
    });
  }
}

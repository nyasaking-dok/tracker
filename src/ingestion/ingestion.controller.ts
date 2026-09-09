import { Body, Controller, Headers, NotFoundException, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AlertEvaluationService } from './alert-evaluation.service';
import { IngestPositionDto } from './dto/ingest-position.dto';
import { Public } from '../auth/jwt-own.guard';

/**
 * Tracker-facing ingestion endpoint.
 *
 * Unlike the user API (JWT), trackers authenticate with their device
 * ingestion key: header `X-Ingest-Key: <device.ingestionKey>`.
 * This mirrors Plaspy's separation of device traffic from user traffic.
 */
@ApiTags('Ingestion')
@Controller('api/ingest')
export class IngestionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertEvaluation: AlertEvaluationService,
  ) {}

  @Public()
  @Post(':deviceId/position')
  async ingestPosition(
    @Param('deviceId') deviceId: string,
    @Body() dto: IngestPositionDto,
    @Headers('x-ingest-key') ingestKey?: string,
  ) {
    if (!ingestKey) throw new UnauthorizedException('Missing X-Ingest-Key header.');

    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found.');

    const keyOk = await bcrypt.compare(ingestKey, device.ingestionKeyHash);
    if (!keyOk) throw new UnauthorizedException('Invalid ingestion key.');
    if (device.expires && device.expires < new Date()) {
      throw new UnauthorizedException('Device subscription expired.');
    }

    const dateTime = new Date(dto.dateTime);
    const evaluated = await this.alertEvaluation.evaluate(device.id, {
      dateTime,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speed: dto.speed ?? 0,
      battery: dto.battery,
      fuel: dto.fuel,
      fuel2: dto.fuel2,
      temperature: dto.temperature,
      temperature2: dto.temperature2,
      inactiveSeconds: dto.inactiveSeconds,
      rpm: dto.rpm,
      alertTexts: dto.alertTexts,
    });

    const location = await this.prisma.location.create({
      data: {
        deviceId: device.id,
        dateTime,
        latitude: dto.latitude,
        longitude: dto.longitude,
        speed: dto.speed ?? 0,
        course: dto.course ?? 0,
        battery: dto.battery ?? 100,
        fuel: dto.fuel,
        fuel2: dto.fuel2,
        temperature: dto.temperature,
        temperature2: dto.temperature2,
        sensorTime1: dto.sensorTime1,
        sensorTime2: dto.sensorTime2,
        sensorTime3: dto.sensorTime3,
        sensorTime4: dto.sensorTime4,
        inactiveSeconds: dto.inactiveSeconds ?? 0,
        rpm: dto.rpm ?? 0,
        milleage: dto.milleage ?? 0,
        warningTexts: [],
        alertTexts: evaluated.map((a) => a.text),
        alerts: evaluated.map((a) => a.alertName),
        warnings: [],
        hasCriticalAlert: evaluated.some((a) => a.alertName === 'SOSButton'),
        attributes: (dto.attributes ?? {}) as any,
        accessoriesAttributes: [],
        inputs: (dto.inputs ?? []) as any,
        outputs: (dto.outputs ?? []) as any,
      },
    });

    // persist evaluated alerts so POST /api/devices/{id}/alerts returns them
    if (evaluated.length > 0) {
      await this.prisma.alert.createMany({
        data: evaluated.map((a) => ({
          deviceId: device.id,
          dateTime,
          latitude: dto.latitude,
          longitude: dto.longitude,
          text: a.text,
          alertName: a.alertName,
          notifications: ['Email'],
          alerts: [a.alertName],
        })),
      });
    }

    return {
      result: 'Position stored.',
      alertsGenerated: evaluated.map((a) => a.alertName),
      locationDateTime: location.dateTime.toISOString(),
    };
  }
}

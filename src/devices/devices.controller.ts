import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { deviceShape, loadOwnedDevice } from './device.helpers';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('api/devices')
export class DevicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const devices = await this.prisma.device.findMany({
      where: { ownerId: { in: Array.from(req.ownerIds) } },
      orderBy: { name: 'asc' },
    });
    return { devices: devices.map(deviceShape) };
  }

  @Get(':deviceId')
  async findOne(@Param('deviceId') deviceId: string, @Req() req: any) {
    const device = await loadOwnedDevice(this.prisma, deviceId, req.ownerIds);
    return { device: deviceShape(device) };
  }

  @Get(':deviceId/lastLocation')
  async lastLocation(@Param('deviceId') deviceId: string, @Req() req: any) {
    const device = await loadOwnedDevice(this.prisma, deviceId, req.ownerIds);
    const loc = await this.prisma.location.findFirst({
      where: { deviceId: device.id },
      orderBy: { dateTime: 'desc' },
    });
    if (!loc) {
      return { lastLocation: null };
    }
    return {
      lastLocation: {
        dateTime: loc.dateTime.toISOString(),
        latitude: loc.latitude,
        longitude: loc.longitude,
        speed: loc.speed,
        course: loc.course,
        battery: loc.battery,
        fuel: loc.fuel,
        fuel2: loc.fuel2,
        temperature: loc.temperature,
        temperature2: loc.temperature2,
        sensorTime1: loc.sensorTime1,
        sensorTime2: loc.sensorTime2,
        sensorTime3: loc.sensorTime3,
        sensorTime4: loc.sensorTime4,
        inactiveSeconds: loc.inactiveSeconds,
        rpm: loc.rpm,
        milleage: loc.milleage,
        warningTexts: loc.warningTexts,
        alertTexts: loc.alertTexts,
        alerts: loc.alerts,
        warnings: loc.warnings,
        hasCriticalAlert: loc.hasCriticalAlert,
        attributes: loc.attributes,
        accessoriesAttributes: loc.accessoriesAttributes,
        inputs: loc.inputs,
        outputs: loc.outputs,
      },
    };
  }
}

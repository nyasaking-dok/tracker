import { Body, BadRequestException, Controller, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { loadOwnedDevice } from '../devices/device.helpers';
import { DateRangeDto } from './dto/date-range.dto';

const MAX_PAGE = 1000;

@ApiTags('Locations')
@ApiBearerAuth()
@Controller('api/devices')
export class LocationsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Plaspy queries history via POST with {from, to} body.
   */
  @Post(':deviceId/locations')
  async locations(
    @Param('deviceId') deviceId: string,
    @Req() req: any,
    @Body() dto: DateRangeDto,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const device = await loadOwnedDevice(this.prisma, deviceId, req.ownerIds);
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date range.');
    }
    const takeN = Math.min(Math.max(parseInt(take ?? '200', 10) || 200, 1), MAX_PAGE);
    const skipN = Math.max(parseInt(skip ?? '0', 10) || 0, 0);

    const locations = await this.prisma.location.findMany({
      where: { deviceId: device.id, dateTime: { gte: from, lte: to } },
      orderBy: { dateTime: 'asc' },
      take: takeN,
      skip: skipN,
    });

    return {
      locations: locations.map((l) => ({
        dateTime: l.dateTime.toISOString(),
        latitude: l.latitude,
        longitude: l.longitude,
        speed: l.speed,
        course: l.course,
        battery: l.battery,
        fuel: l.fuel,
        fuel2: l.fuel2,
        temperature: l.temperature,
        temperature2: l.temperature2,
        sensorTime1: l.sensorTime1,
        sensorTime2: l.sensorTime2,
        sensorTime3: l.sensorTime3,
        sensorTime4: l.sensorTime4,
        inactiveSeconds: l.inactiveSeconds,
        rpm: l.rpm,
        milleage: l.milleage,
        warningTexts: l.warningTexts,
        alertTexts: l.alertTexts,
        alerts: l.alerts,
        warnings: l.warnings,
        hasCriticalAlert: l.hasCriticalAlert,
        attributes: l.attributes,
        accessoriesAttributes: l.accessoriesAttributes,
        inputs: l.inputs,
        outputs: l.outputs,
      })),
    };
  }
}

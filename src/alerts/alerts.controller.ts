import { Body, Controller, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { loadOwnedDevice } from '../devices/device.helpers';
import { AlertsQueryDto } from '../locations/dto/date-range.dto';

const MAX_PAGE = 1000;

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('api/devices')
export class AlertsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Plaspy queries alerts via POST with {from, to, alertName?}.
   */
  @Post(':deviceId/alerts')
  async alerts(
    @Param('deviceId') deviceId: string,
    @Req() req: any,
    @Body() dto: AlertsQueryDto,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const device = await loadOwnedDevice(this.prisma, deviceId, req.ownerIds);
    const takeN = Math.min(Math.max(parseInt(take ?? '200', 10) || 200, 1), MAX_PAGE);
    const skipN = Math.max(parseInt(skip ?? '0', 10) || 0, 0);

    const where: any = {
      deviceId: device.id,
      dateTime: { gte: new Date(dto.from), lte: new Date(dto.to) },
    };
    if (dto.alertName) where.alertName = dto.alertName;

    const alerts = await this.prisma.alert.findMany({
      where,
      orderBy: { dateTime: 'asc' },
      take: takeN,
      skip: skipN,
    });

    return {
      alerts: alerts.map((a) => ({
        dateTime: a.dateTime.toISOString(),
        latitude: a.latitude,
        longitude: a.longitude,
        text: a.text,
        notifications: a.notifications,
        alerts: a.alerts,
      })),
    };
  }
}

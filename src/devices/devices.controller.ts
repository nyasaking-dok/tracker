import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('api/devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  async list(@Req() req: any) {
    return { devices: await this.devices.list(req.ownerIds) };
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateDeviceDto) {
    const { device, ingestionKey } = await this.devices.create(req.user.id, dto);
    return { device, ingestionKey };
  }

  @Get(':deviceId')
  async findOne(@Param('deviceId') deviceId: string, @Req() req: any) {
    return { device: await this.devices.findOne(deviceId, req.ownerIds) };
  }

  @Put(':deviceId')
  async update(
    @Param('deviceId') deviceId: string,
    @Req() req: any,
    @Body() dto: UpdateDeviceDto,
  ) {
    return { device: await this.devices.update(deviceId, req.ownerIds, dto) };
  }

  @Delete(':deviceId')
  async remove(@Param('deviceId') deviceId: string, @Req() req: any) {
    await this.devices.remove(deviceId, req.ownerIds);
    return {};
  }

  @Get(':deviceId/lastLocation')
  async lastLocation(@Param('deviceId') deviceId: string, @Req() req: any) {
    const lastLocation = await this.devices.lastLocation(deviceId, req.ownerIds);
    return { lastLocation };
  }
}

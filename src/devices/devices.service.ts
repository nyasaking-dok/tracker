import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { loadOwnedDevice, deviceShape } from './device.helpers';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateDeviceDto) {
    const ingestionKey = `ig_${randomBytes(24).toString('hex')}`;
    const device = await this.prisma.device.create({
      data: {
        ownerId,
        name: dto.name,
        description: dto.description,
        min: dto.min,
        tags: dto.tags ?? [],
        expires: dto.expires ? new Date(dto.expires) : null,
        ingestionKeyHash: await bcrypt.hash(ingestionKey, 10),
      },
    });
    return { device: deviceShape(device), ingestionKey };
  }

  async list(ownerIds: Set<string>) {
    const devices = await this.prisma.device.findMany({
      where: { ownerId: { in: Array.from(ownerIds) } },
      orderBy: { name: 'asc' },
    });
    return devices.map(deviceShape);
  }

  async findOne(id: string, ownerIds: Set<string>) {
    const device = await loadOwnedDevice(this.prisma, id, ownerIds);
    return deviceShape(device);
  }

  async update(id: string, ownerIds: Set<string>, dto: UpdateDeviceDto) {
    await loadOwnedDevice(this.prisma, id, ownerIds);
    const device = await this.prisma.device.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        min: dto.min,
        tags: dto.tags,
        expires: dto.expires ? new Date(dto.expires) : undefined,
      },
    });
    return deviceShape(device);
  }

  async remove(id: string, ownerIds: Set<string>) {
    await loadOwnedDevice(this.prisma, id, ownerIds);
    await this.prisma.device.delete({ where: { id } });
  }

  async lastLocation(id: string, ownerIds: Set<string>) {
    await loadOwnedDevice(this.prisma, id, ownerIds);

    const loc = await this.prisma.location.findFirst({
      where: { deviceId: id },
      orderBy: { dateTime: 'desc' },
    });
    if (!loc) return null;

    return {
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
    };
  }
}

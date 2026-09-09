import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto, UpdateGroupDto } from './dto/group.dto';

function groupShape(g: any) {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    devices: g.deviceIds,
    creation: g.creation.toISOString(),
    lastModified: g.lastModified.toISOString(),
  };
}

@ApiTags('Groups')
@ApiBearerAuth()
@Controller('api/groups')
export class GroupsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const groups = await this.prisma.group.findMany({
      where: { ownerId: { in: Array.from(req.ownerIds) } },
      orderBy: { creation: 'asc' },
    });
    return { groups: groups.map(groupShape) };
  }

  @Post()
  async create(@Body() dto: CreateGroupDto, @Req() req: any) {
    // validate device ownership when a device list is provided
    let deviceIds: string[] = [];
    if (dto.devices && dto.devices.length > 0) {
      const owned = await this.prisma.device.findMany({
        where: { id: { in: dto.devices }, ownerId: { in: Array.from(req.ownerIds) } },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((d) => d.id));
      for (const id of dto.devices) {
        if (!ownedSet.has(id)) throw new ForbiddenException(`Device ${id} not accessible.`);
      }
      deviceIds = dto.devices;
    }
    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        deviceIds,
        ownerId: req.user.id,
      },
    });
    return groupShape(group);
  }

  @Get(':groupId')
  async findOne(@Param('groupId', ParseUUIDPipe) groupId: string, @Req() req: any) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group || !req.ownerIds.has(group.ownerId)) {
      throw new NotFoundException('Group not found.');
    }
    return groupShape(group);
  }

  @Put(':groupId')
  async replace(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateGroupDto,
    @Req() req: any,
  ) {
    return this.update(groupId, dto, req);
  }

  @Patch(':groupId')
  async update(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateGroupDto,
    @Req() req: any,
  ) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group || !req.ownerIds.has(group.ownerId)) {
      throw new NotFoundException('Group not found.');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.devices !== undefined) {
      if (dto.devices.length > 0) {
        const owned = await this.prisma.device.findMany({
          where: { id: { in: dto.devices }, ownerId: { in: Array.from(req.ownerIds) } },
          select: { id: true },
        });
        const ownedSet = new Set(owned.map((d) => d.id));
        for (const id of dto.devices) {
          if (!ownedSet.has(id)) throw new ForbiddenException(`Device ${id} not accessible.`);
        }
      }
      data.deviceIds = dto.devices;
    }

    const updated = await this.prisma.group.update({ where: { id: groupId }, data });
    return groupShape(updated);
  }

  @Delete(':groupId')
  async remove(@Param('groupId', ParseUUIDPipe) groupId: string, @Req() req: any) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group || !req.ownerIds.has(group.ownerId)) {
      throw new NotFoundException('Group not found.');
    }
    await this.prisma.group.delete({ where: { id: groupId } });
    return { result: 'Group deleted.' };
  }
}

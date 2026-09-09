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
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { countries } from './countries';
import { timeZones } from './timezones';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize<T extends { apiKey?: string; password?: string }>(u: T): T {
    const copy: any = { ...u };
    delete copy.apiKey;
    return copy as T;
  }

  @Get()
  async list(@Req() req: any) {
    const ownerIds: Set<string> = req.ownerIds;
    const users = await this.prisma.user.findMany({
      where: { OR: [{ id: req.user.id }, { masterId: req.user.id }] },
      orderBy: { creation: 'asc' },
    });
    void ownerIds;
    return { users: users.map((u) => this.sanitize(u)) };
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @Req() req: any) {
    // masters create sub-users under themselves; sub-users cannot create users
    if (req.user.masterId !== null) {
      throw new ForbiddenException('Only master accounts can create users.');
    }
    const userName = dto.userName || `user_${Date.now().toString(36)}`;
    const exists = await this.prisma.user.findUnique({ where: { userName } });
    if (exists) throw new ForbiddenException('userName already exists.');
    const emailExists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (emailExists) throw new ForbiddenException('Email already in use.');

    const apiKey = `pk_${require('crypto').randomBytes(24).toString('hex')}`;
    const created = await this.prisma.user.create({
      data: {
        userName,
        apiKey: await bcrypt.hash(apiKey, 10),
        email: dto.email,
        name: dto.name,
        country: dto.country,
        timeZone: dto.timeZone,
        description: dto.description,
        message: dto.message,
        disabled: dto.disabled ?? false,
        disabledMessage: dto.disabledMessage,
        tags: (dto.tags ?? {}) as any,
        privileges: dto.privileges ?? [],
        adminDevices: dto.adminDevices ?? 0,
        expires: dto.expires ? new Date(dto.expires) : null,
        masterId: req.user.id,
      },
    });
    // return the plaintext key once so the creator can hand it to the sub-user
    const { apiKey: _hash, ...safe } = created;
    return { user: safe, apiKey };
  }

  @Get('countries')
  async countriesList() {
    return { countries };
  }

  @Get('timeZones')
  async timeZonesList() {
    return { timeZones };
  }

  @Get(':userId')
  async findOne(@Param('userId', ParseUUIDPipe) userId: string, @Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    const allowed: Set<string> = req.ownerIds;
    if (!allowed.has(user.id) && user.masterId !== req.user.id) {
      throw new NotFoundException('User not found.');
    }
    return { user: this.sanitize(user) };
  }

  @Put(':userId')
  async replace(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    return this.update(userId, dto, req);
  }

  @Patch(':userId')
  async update(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    const allowed: Set<string> = req.ownerIds;
    if (!allowed.has(user.id) && user.masterId !== req.user.id) {
      throw new NotFoundException('User not found.');
    }

    const data: any = {
      modification: new Date(),
    };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.timeZone !== undefined) data.timeZone = dto.timeZone;
    if (dto.userName !== undefined) data.userName = dto.userName;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.message !== undefined) data.message = dto.message;
    if (dto.disabled !== undefined) data.disabled = dto.disabled;
    if (dto.disabledMessage !== undefined) data.disabledMessage = dto.disabledMessage;
    if (dto.tags !== undefined) data.tags = dto.tags as any;
    if (dto.privileges !== undefined) data.privileges = dto.privileges;
    if (dto.adminDevices !== undefined) data.adminDevices = dto.adminDevices;
    if (dto.expires !== undefined) data.expires = dto.expires ? new Date(dto.expires) : null;
    if (dto.password !== undefined) data.password = dto.password;

    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    return { user: this.sanitize(updated) };
  }

  @Delete(':userId')
  async remove(@Param('userId', ParseUUIDPipe) userId: string, @Req() req: any) {
    if (userId === req.user.id) throw new ForbiddenException('Cannot delete your own account.');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    if (user.masterId !== req.user.id) {
      throw new ForbiddenException('You can only delete users you created.');
    }
    await this.prisma.user.delete({ where: { id: userId } });
    return { result: 'User deleted.' };
  }
}

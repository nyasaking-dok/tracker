import { BadRequestException, Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { loadOwnedDevice } from '../devices/device.helpers';
import { SendCommandDto, validateCommandFormat } from './dto/send-command.dto';

@ApiTags('Commands')
@ApiBearerAuth()
@Controller('api/devices')
export class CommandsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(':deviceId/sendCommand')
  async sendCommand(
    @Param('deviceId') deviceId: string,
    @Body() dto: SendCommandDto,
    @Req() req: any,
  ) {
    const device = await loadOwnedDevice(this.prisma, deviceId, req.ownerIds);

    const formatError = validateCommandFormat(dto);
    if (formatError) throw new BadRequestException(formatError);

    const format = dto.format ?? 'Text';
    const sms = dto.sms ?? false;

    // No physical device is attached; delivery is simulated but fully logged,
    // exactly like Plaspy's queued command pipeline.
    const result =
      format === 'Text'
        ? `Command executed successfully`
        : `Command executed successfully (${format} decoded ${Buffer.byteLength(
            decodeCommand(dto),
            'utf8',
          )} bytes)`;

    await this.prisma.commandLog.create({
      data: {
        deviceId: device.id,
        userId: req.user.id,
        command: dto.command,
        format,
        sms,
        result,
      },
    });

    return { result };
  }
}

function decodeCommand(dto: SendCommandDto): string {
  const format = dto.format ?? 'Text';
  if (format === 'Hex') {
    const cleaned = dto.command.replace(/[\s-]/g, '');
    return Buffer.from(cleaned, 'hex').toString('utf8');
  }
  if (format === 'Base64') {
    return Buffer.from(dto.command, 'base64').toString('utf8');
  }
  return dto.command;
}

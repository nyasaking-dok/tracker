import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsBoolean, IsNotEmpty } from 'class-validator';

export class SendCommandDto {
  @ApiProperty({ example: 'engine_stop' })
  @IsString()
  @IsNotEmpty()
  command!: string;

  @ApiPropertyOptional({ enum: ['Text', 'Hex', 'Base64'], default: 'Text' })
  @IsOptional()
  @IsIn(['Text', 'Hex', 'Base64'])
  format?: string;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;
}

const HEX_RE = /^([0-9a-fA-F]{2}[\s-]?)+$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function validateCommandFormat(dto: SendCommandDto): string | null {
  const format = dto.format ?? 'Text';
  if (format === 'Hex' && !HEX_RE.test(dto.command.trim())) {
    return 'Invalid Hex command string.';
  }
  if (format === 'Base64') {
    try {
      const decoded = Buffer.from(dto.command, 'base64');
      if (decoded.length === 0 && dto.command.length > 0) return 'Invalid Base64 command string.';
      // strict round-trip check: canonical base64 re-encodes identically
      if (decoded.toString('base64').replace(/=+$/, '') !== dto.command.replace(/=+$/, '')) {
        return 'Invalid Base64 command string.';
      }
    } catch {
      return 'Invalid Base64 command string.';
    }
  }
  return null;
}

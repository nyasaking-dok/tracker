import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @IsNotEmpty()
  country!: string;

  @ApiProperty({ example: 'America/Los_Angeles' })
  @IsString()
  @IsNotEmpty()
  timeZone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  disabledMessage?: string;

  @ApiPropertyOptional({ example: { role: 'user' } })
  @IsOptional()
  @IsObject()
  tags?: Record<string, unknown>;

  @ApiPropertyOptional({ example: ['read', 'write'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  privileges?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  group?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  adminDevices?: number;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00Z', type: String })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00Z', type: String })
  @IsOptional()
  @IsDateString()
  expires?: string;

  @ApiPropertyOptional({ writeOnly: true })
  @IsOptional()
  @IsString()
  password?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timeZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  disabledMessage?: string;

  @ApiPropertyOptional({ example: { role: 'user' } })
  @IsOptional()
  @IsObject()
  tags?: Record<string, unknown>;

  @ApiPropertyOptional({ example: ['read', 'write'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  privileges?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  adminDevices?: number;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00Z', type: String })
  @IsOptional()
  @IsDateString()
  expires?: string;

  @ApiPropertyOptional({ writeOnly: true })
  @IsOptional()
  @IsString()
  password?: string;
}

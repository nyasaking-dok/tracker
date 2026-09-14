import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeviceDto {
  @ApiProperty({ example: 'Vehicle Tracker 01' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'My primary GPS device' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'default-min-interval' })
  @IsString()
  @IsOptional()
  min?: string;

  @ApiPropertyOptional({ example: ['vehicle', 'fleet'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ example: '2026-12-31T00:00:00.000Z' })
  @IsString()
  @IsOptional()
  expires?: string;
}

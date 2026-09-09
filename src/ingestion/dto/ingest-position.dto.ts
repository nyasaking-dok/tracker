import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class IngestPositionDto {
  @ApiProperty({ example: '2024-06-01T12:00:00Z' })
  @IsDateString()
  dateTime!: string;

  @ApiProperty({ example: 40.712776 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: -74.005974 })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ example: 60.5 })
  @IsOptional()
  @IsNumber()
  speed?: number;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsNumber()
  course?: number;

  @ApiPropertyOptional({ example: 85 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  battery?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  fuel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  fuel2?: number;

  @ApiPropertyOptional({ example: 22.5 })
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sensorTime1?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sensorTime2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sensorTime3?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sensorTime4?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  inactiveSeconds?: number;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @IsInt()
  rpm?: number;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  milleage?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alertTexts?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [Boolean] })
  @IsOptional()
  @IsArray()
  @IsBoolean({ each: true })
  inputs?: boolean[];

  @ApiPropertyOptional({ type: [Boolean] })
  @IsOptional()
  @IsArray()
  @IsBoolean({ each: true })
  outputs?: boolean[];
}

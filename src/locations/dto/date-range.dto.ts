import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsIn } from 'class-validator';

export const ALERT_NAMES = [
  'GPSOff',
  'GPSNoSignal',
  'ForbiddenArea',
  'AllowedArea',
  'SOSButton',
  'SpeedLimit',
  'NoMovementTime',
  'Sensor1On',
  'GPSUnplugged',
  'Sensor1Off',
  'TemperatureGreaterThan',
  'TemperatureLowerThan',
  'FuelJumpDown',
  'FuelJumpUp',
  'FuelLessThan',
  'FutureDate',
  'PastDate',
  'Sensor2On',
  'Sensor2Off',
  'Sensor3On',
  'Sensor3Off',
  'Sensor4On',
  'Sensor4Off',
  'ExpiredDate',
  'Mileage',
  'Vibration',
  'RPM',
  'CheckPoint',
  'CheckArea',
  'SpeedLower',
  'Offline',
  'LowBattery',
  'BatteryVoltage',
  'SleepMode',
  'Temperature2LessThan',
  'Temperature2GreaterThan',
  'Route',
  'Sensor1Time',
  'Sensor2Time',
  'Sensor3Time',
  'Sensor4Time',
  'SensorAccumulated1Time',
  'SensorAccumulated2Time',
  'SensorAccumulated3Time',
  'SensorAccumulated4Time',
  'FuelJumpDown2',
  'FuelJumpUp2',
  'FuelLessThan2',
  'AttributeEquals',
  'AttributeLessThan',
  'AttributeGreaterThan',
  'HarshBraking',
  'HarshAcceleration',
  'AuthenticationFailed',
  'IdleTime',
] as const;

export class DateRangeDto {
  @ApiProperty({ example: '2024-06-01T00:00:00Z' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2024-06-01T23:59:59Z' })
  @IsDateString()
  to!: string;
}

export class AlertsQueryDto extends DateRangeDto {
  @ApiPropertyOptional({
    example: 'SpeedLimit',
    enum: ALERT_NAMES,
  })
  @IsOptional()
  @IsIn(ALERT_NAMES as unknown as string[])
  alertName?: string;
}

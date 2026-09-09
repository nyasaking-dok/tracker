import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { ApiUsageService } from './common/api-usage.service';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { PlaspyExceptionFilter } from './common/plaspy.exception-filter';
import { AuthModule } from './auth/auth.module';
import { JwtOwnGuard } from './auth/jwt-own.guard';
import { UsersModule } from './users/users.module';
import { DevicesModule } from './devices/devices.module';
import { LocationsModule } from './locations/locations.module';
import { AlertsModule } from './alerts/alerts.module';
import { CommandsModule } from './commands/commands.module';
import { GroupsModule } from './groups/groups.module';
import { IngestionModule } from './ingestion/ingestion.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    DevicesModule,
    LocationsModule,
    AlertsModule,
    CommandsModule,
    GroupsModule,
    IngestionModule,
  ],
  providers: [
    ApiUsageService,
    { provide: APP_GUARD, useClass: JwtOwnGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: PlaspyExceptionFilter },
  ],
})
export class AppModule {}

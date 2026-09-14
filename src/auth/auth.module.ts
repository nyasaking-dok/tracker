import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ApiKeyService } from './api-key.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'change-me-to-a-long-random-string',
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || '24h',
          algorithm: 'HS512',
        } as any,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ApiKeyService, JwtStrategy],
  exports: [JwtModule, ApiKeyService, AuthService],
})
export class AuthModule {}

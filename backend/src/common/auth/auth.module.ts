// File: src/common/auth/auth.module.ts
// บันทึกการแก้ไข: แก้ไข Type Mismatch ของ expiresIn (Fix TS2322)
// [P0-1] เพิ่ม CASL RBAC Integration
// [P2-2] Register RefreshToken Entity

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionController } from './session.controller';
import { UserModule } from '../../modules/user/user.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { User } from '../../modules/user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity'; // [P2-2]
import { CaslModule } from './casl/casl.module';
import { PermissionsGuard } from './guards/permissions.guard';
import type { StringValue } from 'ms';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken]), // [P2-2] Added RefreshToken
    UserModule,
    PassportModule,
    // CacheModule is now global (from AppModule)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
            '15m') as StringValue,
        },
      }),
    }),
    CaslModule,
  ],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, PermissionsGuard],
  controllers: [AuthController, SessionController],
  exports: [AuthService, PermissionsGuard],
})
export class AuthModule {}

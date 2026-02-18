// File: src/common/auth/auth.module.ts
// บันทึกการแก้ไข: แก้ไข Type Mismatch ของ expiresIn (Fix TS2322)
// [P0-1] เพิ่ม CASL RBAC Integration
// [P2-2] Register RefreshToken Entity

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { SessionController } from './session.controller.js';
import { UserModule } from '../../modules/user/user.module.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { User } from '../../modules/user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity'; // [P2-2]
import { CaslModule } from './casl/casl.module';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken]), // [P2-2] Added RefreshToken
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
            '15m') as any,
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

// File: src/common/auth/auth.module.ts
// บันทึกการแก้ไข: แก้ไข Type Mismatch ของ expiresIn (Fix TS2322)
// [P0-1] เพิ่ม CASL RBAC Integration

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { UserModule } from '../../modules/user/user.module.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { User } from '../../modules/user/entities/user.entity';
import { CaslModule } from './casl/casl.module'; // [P0-1] Import CASL
import { PermissionsGuard } from './guards/permissions.guard'; // [P0-1] Import Guard

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
            '15m') as any,
        },
      }),
    }),
    CaslModule, // [P0-1] Import CASL module
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    PermissionsGuard, // [P0-1] Register PermissionsGuard
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    PermissionsGuard, // [P0-1] Export for use in other modules
  ],
})
export class AuthModule {}

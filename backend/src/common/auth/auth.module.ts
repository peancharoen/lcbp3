// File: src/common/auth/auth.module.ts
// บันทึกการแก้ไข: แก้ไข Type Mismatch ของ expiresIn (Fix TS2322)

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm'; // [NEW] 1. Import TypeOrmModule
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { UserModule } from '../../modules/user/user.module.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { User } from '../../modules/user/entities/user.entity'; // [NEW] 2. Import User Entity
@Module({
  imports: [
    // [NEW] 3. Register User Entity เพื่อให้ AuthService ใช้ InjectRepository(User) ได้
    TypeOrmModule.forFeature([User]),
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // ✅ Fix: Cast เป็น any เพื่อแก้ปัญหา Type ไม่ตรงกับ Library (StringValue vs string)
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
            '15m') as any,
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

// File: src/common/auth/strategies/jwt-refresh.strategy.ts
// บันทึกการแก้ไข: Strategy สำหรับ Refresh Token (T1.2)
// บันทึกการแก้ไข: แก้ไข TS2345 โดยยืนยันค่า secretOrKey ด้วย ! (Non-null assertion)

import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // ✅ Fix: ใส่ ! เพื่อบอก TS ว่าค่านี้มีอยู่จริง (จาก env validation)
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET')!,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    return {
      ...payload,
      refreshToken,
    };
  }
}

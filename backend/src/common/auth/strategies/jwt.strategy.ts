// บันทึกการแก้ไข: แก้ไข TS2345 (secretOrKey type) และ TS2551 (user.isActive property name)

import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Request } from 'express';
import { UserService } from '../../../modules/user/user.service.js';

// Interface สำหรับ Payload ใน Token
export interface JwtPayload {
  sub: number;
  username: string;
  scope?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private userService: UserService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // ✅ Fix TS2345: ใส่ ! เพื่อยืนยันว่า Secret Key มีค่าแน่นอน
      secretOrKey: configService.get<string>('JWT_SECRET')!,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    // 1. ดึง Token ออกมาเพื่อตรวจสอบใน Blacklist
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    // 2. ตรวจสอบว่า Token นี้อยู่ใน Redis Blacklist หรือไม่
    const isBlacklisted = await this.cacheManager.get(
      `blacklist:token:${token}`,
    );
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked (Logged out)');
    }

    // 3. ค้นหา User จาก Database
    const user = await this.userService.findOne(payload.sub);

    // 4. ตรวจสอบความถูกต้องของ User
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 5. (Optional) ตรวจสอบว่า User ยัง Active อยู่หรือไม่
    // ✅ Fix TS2551: แก้ไขชื่อ Property จาก is_active เป็น isActive ตาม Entity Definition
    if (user.isActive === false) {
      throw new UnauthorizedException('User account is inactive');
    }

    return user;
  }
}

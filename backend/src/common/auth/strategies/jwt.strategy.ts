// File: src/common/auth/strategies/jwt.strategy.ts
// บันทึกการแก้ไข: ปรับปรุง JwtStrategy ให้ตรวจสอบ Blacklist (Redis) และสถานะ User (T1.2)

import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager'; // ✅ ใช้สำหรับ Blacklist
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { UserService } from '../../../modules/user/user.service.js';

// Interface สำหรับ Payload ใน Token
export interface JwtPayload {
  sub: number;
  username: string;
  scope?: string; // เพิ่ม Scope ถ้ามีการใช้
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private userService: UserService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache, // ✅ Inject Redis Cache
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true, // ✅ จำเป็นต้องใช้ เพื่อดึง Raw Token มาเช็ค Blacklist
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    // 1. ดึง Token ออกมาเพื่อตรวจสอบใน Blacklist
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    // 2. ตรวจสอบว่า Token นี้อยู่ใน Redis Blacklist หรือไม่ (กรณี Logout ไปแล้ว)
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
    if (user.is_active === false || user.is_active === 0) {
      throw new UnauthorizedException('User account is inactive');
    }

    // คืนค่า User เพื่อนำไปใส่ใน req.user
    return user;
  }
}

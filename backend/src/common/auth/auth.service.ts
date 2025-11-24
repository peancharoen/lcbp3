// File: src/common/auth/auth.service.ts
// บันทึกการแก้ไข: แก้ไข Type Mismatch ใน signAsync (Fix TS2769)

import {
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { UserService } from '../../modules/user/user.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // 1. ตรวจสอบ Username/Password
  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userService.findOneByUsername(username);
    if (user && (await bcrypt.compare(pass, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  // 2. Login: สร้าง Access & Refresh Token
  async login(user: any) {
    const payload = {
      username: user.username,
      sub: user.user_id,
      scope: 'Global',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        // ✅ Fix: Cast as any
        expiresIn: (this.configService.get<string>('JWT_EXPIRATION') ||
          '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        // ✅ Fix: Cast as any
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION') ||
          '7d') as any,
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: user,
    };
  }

  // 3. Register (สำหรับ Admin)
  async register(userDto: RegisterDto) {
    const existingUser = await this.userService.findOneByUsername(
      userDto.username,
    );
    if (existingUser) {
      throw new BadRequestException('Username already exists');
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(userDto.password, salt);

    return this.userService.create({
      ...userDto,
      password: hashedPassword,
    });
  }

  // 4. Refresh Token: ออก Token ใหม่
  async refreshToken(userId: number, refreshToken: string) {
    const user = await this.userService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const payload = { username: user.username, sub: user.user_id };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      // ✅ Fix: Cast as any
      expiresIn: (this.configService.get<string>('JWT_EXPIRATION') ||
        '15m') as any,
    });

    return {
      access_token: accessToken,
    };
  }

  // 5. Logout: นำ Token เข้า Blacklist ใน Redis
  async logout(userId: number, accessToken: string) {
    try {
      const decoded = this.jwtService.decode(accessToken);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.cacheManager.set(
            `blacklist:token:${accessToken}`,
            true,
            ttl * 1000,
          );
        }
      }
    } catch (error) {
      // Ignore decoding error
    }
    return { message: 'Logged out successfully' };
  }
}

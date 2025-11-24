// File: src/common/auth/auth.service.ts
// บันทึกการแก้ไข: เพิ่ม Refresh Token, Logout (Redis Blacklist) และ Profile ตาม T1.2

import {
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { UserService } from '../../modules/user/user.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { User } from '../../modules/user/entities/user.entity.js';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache, // ใช้ Redis สำหรับ Blacklist
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
      scope: 'Global', // ตัวอย่าง: ใส่ Scope เริ่มต้น หรือดึงจาก Role
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d',
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: user, // ส่งข้อมูล user กลับไปให้ Frontend ใช้แสดงผลเบื้องต้น
    };
  }

  // 3. Register (สำหรับ Admin)
  async register(userDto: RegisterDto) {
    // ตรวจสอบว่ามี user อยู่แล้วหรือไม่
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
    // ตรวจสอบความถูกต้องของ Refresh Token (ถ้าใช้ DB เก็บ Refresh Token ก็เช็คตรงนี้)
    // ในที่นี้เราเชื่อใจ Signature ของ JWT Refresh Secret
    const user = await this.userService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');

    // สร้าง Access Token ใหม่
    const payload = { username: user.username, sub: user.user_id };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION') || '15m',
    });

    return {
      access_token: accessToken,
      // refresh_token: refreshToken, // จะส่งเดิมกลับ หรือ Rotate ใหม่ก็ได้ (แนะนำ Rotate เพื่อความปลอดภัยสูงสุด)
    };
  }

  // 5. Logout: นำ Token เข้า Blacklist ใน Redis
  async logout(userId: number, accessToken: string) {
    // หาเวลาที่เหลือของ Token เพื่อตั้ง TTL ใน Redis
    try {
      const decoded = this.jwtService.decode(accessToken);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          // Key pattern: blacklist:token:{token_string}
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

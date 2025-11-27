// File: src/common/auth/auth.service.ts
// บันทึกการแก้ไข:
// 1. แก้ไข Type Mismatch ใน signAsync
// 2. แก้ไข validateUser ให้ดึง password_hash ออกมาด้วย (Fix HTTP 500: data and hash arguments required)

import {
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm'; // [NEW]
import { Repository } from 'typeorm'; // [NEW]
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';

import { UserService } from '../../modules/user/user.service.js';
import { User } from '../../modules/user/entities/user.entity.js'; // [NEW] ต้อง Import Entity เพื่อใช้ Repository
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    // [NEW] Inject Repository เพื่อใช้ QueryBuilder
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  // 1. ตรวจสอบ Username/Password
  async validateUser(username: string, pass: string): Promise<any> {
    console.log(`🔍 Checking login for: ${username}`); // [DEBUG]
    // [FIXED] ใช้ createQueryBuilder เพื่อ addSelect field 'password' ที่ถูกซ่อนไว้
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password') // สำคัญ! สั่งให้ดึง column password มาด้วย
      .where('user.username = :username', { username })
      .getOne();

    if (!user) {
      console.log('❌ User not found in database'); // [DEBUG]
      return null;
    }

    console.log('✅ User found. Hash from DB:', user.password); // [DEBUG]

    const isMatch = await bcrypt.compare(pass, user.password);
    console.log(`🔐 Password match result: ${isMatch}`); // [DEBUG]

    // ตรวจสอบว่ามี user และมี password hash หรือไม่
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
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

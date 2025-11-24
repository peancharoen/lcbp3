// File: src/common/auth/auth.controller.ts
// บันทึกการแก้ไข: เพิ่ม Endpoints ให้ครบตามแผน T1.2 (Refresh, Logout, Profile)

import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  UnauthorizedException,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard.js'; // ต้องสร้าง Guard นี้
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'; // (ถ้าใช้ Swagger)

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // เข้มงวด: 5 ครั้ง/นาที
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'เข้าสู่ระบบเพื่อรับ Access & Refresh Token' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authService.login(user);
  }

  @Post('register-admin')
  @UseGuards(JwtAuthGuard) // ควรป้องกัน Route นี้ให้เฉพาะ Superadmin
  @ApiBearerAuth()
  @ApiOperation({ summary: 'สร้างบัญชีผู้ใช้ใหม่ (Admin Only)' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ขอ Access Token ใหม่ด้วย Refresh Token' })
  async refresh(@Request() req) {
    // req.user จะมาจาก JwtRefreshStrategy
    return this.authService.refreshToken(req.user.sub, req.user.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ออกจากระบบ (Revoke Token)' })
  async logout(@Request() req) {
    // ดึง Token จาก Header Authorization: Bearer <token>
    const token = req.headers.authorization?.split(' ')[1];
    return this.authService.logout(req.user.sub, token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ดึงข้อมูลผู้ใช้ปัจจุบัน' })
  getProfile(@Request() req) {
    return req.user;
  }
}

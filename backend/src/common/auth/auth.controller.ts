// File: src/common/auth/auth.controller.ts
// บันทึกการแก้ไข: เพิ่ม Type ให้ req และแก้ไข Import (Fix TS7006)

import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  UnauthorizedException,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard.js';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express'; // ✅ Import Request

// สร้าง Interface สำหรับ Request ที่มี User (เพื่อให้ TS รู้จัก req.user)
interface RequestWithUser extends Request {
  user: any;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'สร้างบัญชีผู้ใช้ใหม่ (Admin Only)' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ขอ Access Token ใหม่ด้วย Refresh Token' })
  async refresh(@Req() req: RequestWithUser) {
    // ✅ ระบุ Type ชัดเจน
    return this.authService.refreshToken(req.user.sub, req.user.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ออกจากระบบ (Revoke Token)' })
  async logout(@Req() req: RequestWithUser) {
    // ✅ ระบุ Type ชัดเจน
    const token = req.headers.authorization?.split(' ')[1];
    // ต้องเช็คว่ามี token หรือไม่ เพื่อป้องกัน runtime error
    if (!token) {
      return { message: 'No token provided' };
    }
    return this.authService.logout(req.user.sub, token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ดึงข้อมูลผู้ใช้ปัจจุบัน' })
  getProfile(@Req() req: RequestWithUser) {
    // ✅ ระบุ Type ชัดเจน
    return req.user;
  }
}

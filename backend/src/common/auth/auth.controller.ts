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
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import type {
  RequestWithUser,
  RequestWithRefreshUser,
} from '../interfaces/request-with-user.interface';
import type { Request } from 'express';

/**
 * ดึง IP จริงของ client จาก request headers (รองรับ Cloudflare proxy)
 * ลำดับความสำคัญ: CF-Connecting-IP → X-Forwarded-For → request.ip → socket.remoteAddress
 */
function getClientIp(req: Request): string | undefined {
  const cfIp = req.headers['cf-connecting-ip'] as string | undefined;
  if (cfIp) return cfIp.trim();

  const xff = req.headers['x-forwarded-for'] as string | undefined;
  if (xff) {
    const firstIp = xff.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  const rawIp = req.ip ?? req.socket.remoteAddress;
  return rawIp;
}

/**
 * Parse ชื่อ device จาก User-Agent string (เช่น "Windows · Chrome 127")
 * ไม่ใช้ library เพื่อลด dependency — parse แบบง่ายเพียงพอสำหรับ session display
 */
function parseDeviceName(userAgent: string | undefined): string | undefined {
  if (!userAgent) return undefined;

  // OS detection
  let os = 'Unknown OS';
  if (/Windows NT 10/i.test(userAgent)) os = 'Windows';
  else if (/Windows NT/i.test(userAgent)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(userAgent)) os = 'iOS';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/Mac OS X/i.test(userAgent)) os = 'macOS';
  else if (/Linux/i.test(userAgent)) os = 'Linux';

  // Browser detection (เช็ค Edge ก่อน Chrome เพราะ Edge มี "Chrome" ใน UA ด้วย)
  let browser = 'Unknown Browser';
  if (/Edg\//i.test(userAgent)) {
    const m = userAgent.match(/Edg\/(\d+)/);
    browser = `Edge${m ? ' ' + m[1] : ''}`;
  } else if (/OPR\//i.test(userAgent)) {
    const m = userAgent.match(/OPR\/(\d+)/);
    browser = `Opera${m ? ' ' + m[1] : ''}`;
  } else if (/Firefox\//i.test(userAgent)) {
    const m = userAgent.match(/Firefox\/(\d+)/);
    browser = `Firefox${m ? ' ' + m[1] : ''}`;
  } else if (/Chrome\//i.test(userAgent)) {
    const m = userAgent.match(/Chrome\/(\d+)/);
    browser = `Chrome${m ? ' ' + m[1] : ''}`;
  } else if (/Safari\//i.test(userAgent)) {
    const m = userAgent.match(/Version\/(\d+)/);
    browser = `Safari${m ? ' ' + m[1] : ''}`;
  }

  return `${os} · ${browser}`;
}

/**
 * ดึง device info ทั้งหมดจาก request สำหรับ session tracking
 */
function getDeviceInfo(req: Request): {
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
} {
  const userAgent = req.get('user-agent');
  return {
    deviceName: parseDeviceName(userAgent),
    ipAddress: getClientIp(req),
    userAgent: userAgent ?? undefined,
  };
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login to get Access & Refresh Token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        user: { type: 'object' },
      },
    },
  })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authService.login(user, getDeviceInfo(req));
  }

  @Post('register-admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new user (Admin Only)' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh Access Token using Refresh Token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
      },
    },
  })
  async refresh(@Req() req: RequestWithRefreshUser) {
    return this.authService.refreshToken(
      req.user.sub,
      req.user.refreshToken,
      getDeviceInfo(req as unknown as Request)
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (Revoke Tokens)' })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logged out successfully' },
      },
    },
  })
  async logout(@Req() req: RequestWithUser) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return { message: 'No token provided' };
    }
    // ส่ง refresh token ไปด้วยถ้ามี (ใน header หรือ body)
    // สำหรับตอนนี้ส่งแค่ access token ไป blacklist
    return this.authService.logout(req.user.user_id, token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  getProfile(@Req() req: RequestWithUser) {
    return req.user;
  }
}

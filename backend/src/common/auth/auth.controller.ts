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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';

// สร้าง Interface สำหรับ Request ที่มี User
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
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authService.login(user);
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
  async refresh(@Req() req: RequestWithUser) {
    return this.authService.refreshToken(req.user.sub, req.user.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (Revoke Tokens)' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req: RequestWithUser) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return { message: 'No token provided' };
    }
    // ส่ง refresh token ไปด้วยถ้ามี (ใน header หรือ body)
    // สำหรับตอนนี้ส่งแค่ access token ไป blacklist
    return this.authService.logout(req.user.sub, token);
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

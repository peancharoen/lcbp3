import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler'; // <--- ✅ เพิ่มบรรทัดนี้ครับ
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js'; // <--- Import DTO
import { RegisterDto } from './dto/register.dto.js'; // <--- Import DTO

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  // เพิ่มความเข้มงวดให้ Login (กัน Brute Force)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 🔒 ให้ลองได้แค่ 5 ครั้ง ใน 1 นาที
  // เปลี่ยน @Body() req เป็น @Body() loginDto: LoginDto
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
  // เปลี่ยน @Body() req เป็น @Body() registerDto: RegisterDto
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
  /*ตัวอย่าง: ยกเว้นการนับ (เช่น Health Check)
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Get('health')
check() { ... }
*/
}

// File: src/common/auth/auth.service.ts
// บันทึกการแก้ไข:
// 1. แก้ไข Type Mismatch ใน signAsync
// 2. แก้ไข validateUser ให้ดึง password_hash ออกมาด้วย (Fix HTTP 500: data and hash arguments required)
// 3. [P2-2] Implement Refresh Token storage & rotation

import {
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';

import { UserService } from '../../modules/user/user.service';
import { User } from '../../modules/user/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity'; // [P2-2]

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    // [P2-2] Inject RefreshToken Repository
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>
  ) {}

  // 1. ตรวจสอบ Username/Password
  async validateUser(username: string, pass: string): Promise<User | null> {
    this.logger.log(`🔍 Checking login for: ${username}`);
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.assignments', 'assignments')
      .leftJoinAndSelect('assignments.role', 'role')
      .where('user.username = :username', { username })
      .getOne();

    if (!user) {
      this.logger.warn('❌ User not found in database');
      return null;
    }

    // ตรวจสอบว่ามี user และมี password hash หรือไม่
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      // Logic: Map RBAC Roles to 'ADMIN' | 'DC' | 'User' for Frontend Compatibility
      // Roles Table: 'Superadmin', 'Org Admin', 'Document Control', 'Editor', 'Viewer'

      let derivedRole = 'User';
      if (user.assignments && user.assignments.length > 0) {
        const roleNames = user.assignments
          .map((a) => a.role?.roleName)
          .filter(Boolean);

        // Check for Admin privileges
        if (roleNames.some((r) => r === 'Superadmin' || r === 'Org Admin')) {
          derivedRole = 'ADMIN';
        }
        // Check for Document Control privileges
        else if (roleNames.some((r) => r === 'Document Control')) {
          derivedRole = 'DC';
        }
      }
      const { password, ...result } = user;
      return { ...result, role: derivedRole } as User & { role: string };
    }
    return null;
  }

  // 2. Login: สร้าง Access & Refresh Token และบันทึกลง DB
  async login(user: User) {
    const payload = {
      username: user.username,
      sub: user.user_id,
      scope: 'Global',
    };

    const isBot = user.username === 'migration_bot';
    const accessTokenExpiresIn = isBot
      ? '100y'
      : this.configService.get<string>('JWT_EXPIRATION') || '15m';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: accessTokenExpiresIn as StringValue,
    });

    const refreshTokenExpiresIn = isBot
      ? '100y'
      : this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTokenExpiresIn as StringValue,
    });

    // [P2-2] Store Refresh Token in DB
    await this.storeRefreshToken(user.user_id, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: user,
    };
  }

  // [P2-2] Store Refresh Token Logic
  private async storeRefreshToken(
    userId: number,
    token: string
  ): Promise<void> {
    // Hash token before storing for security
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresInDays = 7; // Should match JWT_REFRESH_EXPIRATION
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId,
      tokenHash: hash,
      expiresAt,
      isRevoked: false,
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);
  }

  // 3. Register (สำหรับ Admin)
  async register(userDto: RegisterDto) {
    const existingUser = await this.userService.findOneByUsername(
      userDto.username
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

  // 4. Refresh Token: ตรวจสอบและออก Token ใหม่ (Rotation)
  async refreshToken(
    userId: number,
    refreshToken: string
  ): Promise<{ access_token: string; refresh_token: string }> {
    // Hash incoming token to match with DB
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Find token in DB
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash: hash },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.isRevoked) {
      // [P2-2.1] Grace period for Token Rotation (30 seconds)
      // ป้องกัน Race Condition เมื่อ Frontend ส่ง Refresh Request ซ้อนกันในชั่วพริบตา
      const now = new Date();
      const revokedAt = new Date(storedToken.updatedAt);
      const diffMs = now.getTime() - revokedAt.getTime();

      this.logger.debug(`[DEBUG-TOKEN] user=${userId}`);
      this.logger.debug(`[DEBUG-TOKEN] now=${now.toISOString()}`);
      this.logger.debug(
        `[DEBUG-TOKEN] updatedAt=${storedToken.updatedAt ? new Date(storedToken.updatedAt).toISOString() : 'NULL'}`
      );
      this.logger.debug(`[DEBUG-TOKEN] diffMs=${diffMs}`);
      this.logger.debug(
        `[DEBUG-TOKEN] replacedBy=${storedToken.replacedByToken ? 'YES(HASHED)' : 'NULL'}`
      );

      if (diffMs <= 30000 && storedToken.replacedByToken) {
        this.logger.warn(
          `Refresh token reuse detected within grace period (${diffMs}ms) for user ${userId}. Allowing another rotation.`
        );
        // ไม่ต้อง revokeAllUserTokens และอนุญาตให้ทำงานต่อด้านล่างเพื่อออก Token ชุดใหม่
      } else {
        // Possible token theft! Invalidate all user tokens family
        await this.revokeAllUserTokens(userId);
        this.logger.error(
          `Refresh token revoked - Security alert for user ${userId}. All tokens invalidated.`
        );
        throw new UnauthorizedException(
          'Refresh token revoked - Security alert'
        );
      }
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Valid token -> Rotate it
    const user = await this.userService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const payload = { username: user.username, sub: user.user_id };

    // Generate NEW tokens
    const newAccessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRATION') ||
        '15m') as StringValue,
    });

    const newRefreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION') ||
        '7d') as StringValue,
    });

    // Revoke OLD token and point to NEW one
    const newHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');

    // [P2-2] Mark old token as revoked and rotated
    storedToken.isRevoked = true;
    storedToken.replacedByToken = newHash;
    storedToken.updatedAt = new Date(); // Fallback: Manually update instead of relying solely on @UpdateDateColumn
    await this.refreshTokenRepository.save(storedToken);

    // Save NEW token
    await this.storeRefreshToken(userId, newRefreshToken);

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  // [P2-2] Helper: Revoke all tokens for a user (Security Measure)
  private async revokeAllUserTokens(userId: number): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true }
    );
  }

  // 5. Logout: Revoke current refresh token & Blacklist Access Token
  async logout(userId: number, accessToken: string, refreshToken?: string) {
    // Blacklist Access Token
    try {
      const decoded = this.jwtService.decode<{ exp: number }>(accessToken);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.cacheManager.set(
            `blacklist:token:${accessToken}`,
            true,
            ttl * 1000
          );
        }
      }
    } catch {
      // Ignore decoding error
    }

    // [P2-2] Revoke Refresh Token if provided
    if (refreshToken) {
      const hash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');
      await this.refreshTokenRepository.update(
        { tokenHash: hash },
        { isRevoked: true }
      );
    }

    return { message: 'Logged out successfully' };
  }

  // [New] Get Active Sessions
  async getActiveSessions() {
    // Only return tokens that are NOT revoked and NOT expired
    const activeTokens = await this.refreshTokenRepository.find({
      where: {
        isRevoked: false,
      },
      relations: ['user'], // Ensure relations: ['user'] works if RefreshToken entity has relation
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    // Filter expired tokens in memory if query builder is complex, or rely on where clause if possible.
    // Filter expired tokens
    return activeTokens
      .filter((t) => new Date(t.expiresAt) > now)
      .map((t) => ({
        id: t.tokenId.toString(),
        userId: t.userId,
        user: {
          username: t.user?.username || 'Unknown',
          firstName: t.user?.firstName || '',
          lastName: t.user?.lastName || '',
        },
        deviceName: 'Unknown Device', // Not stored in DB
        ipAddress: 'Unknown IP', // Not stored in DB
        lastActive: t.createdAt.toISOString(), // Best approximation
        isCurrent: false, // Cannot determine isCurrent without current session context match
      }));
  }

  // [New] Revoke Session by ID
  async revokeSession(sessionId: number) {
    return this.refreshTokenRepository.update(
      { tokenId: sessionId },
      { isRevoked: true }
    );
  }
}

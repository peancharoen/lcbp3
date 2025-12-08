# Task: User Management Module

**Status:** Completed
**Priority:** P1 (High - Core User Features)
**Estimated Effort:** 5-7 days
**Dependencies:** TASK-BE-001 (Database), TASK-BE-002 (Auth & RBAC)
**Owner:** Backend Team

---

## 📋 Overview

สร้าง User Management Module สำหรับจัดการ Users, User Profiles, Password Management, และ User Preferences

---

## 🎯 Objectives

- ✅ User CRUD Operations
- ✅ User Profile Management
- ✅ Password Change & Reset
- ✅ User Preferences (Settings)
- ✅ User Avatar Upload
- ✅ User Search & Filter

---

## 📝 Acceptance Criteria

1. **User Management:**

   - ✅ Create user with default password
   - ✅ Update user information
   - ✅ Activate/Deactivate users
   - ✅ Soft delete users
   - ✅ Search users by name/email/username

2. **Profile Management:**

   - ✅ User can view own profile
   - ✅ User can update own profile
   - ✅ Upload avatar/profile picture
   - ✅ Change display name

3. **Password Management:**

   - ✅ Change password (authenticated)
   - ✅ Reset password (forgot password flow)
   - ✅ Password strength validation
   - ✅ Password history (prevent reuse)

4. **User Preferences:**
   - ✅ Email notification settings
   - ✅ LINE Notify token
   - ✅ Language preference (TH/EN)
   - ✅ Timezone settings

---

## 🛠️ Implementation Steps

### 1. User Service

```typescript
// File: backend/src/modules/user/user.service.ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserPreference)
    private preferenceRepo: Repository<UserPreference>,
    private fileStorage: FileStorageService
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    // Check unique username and email
    const existingUsername = await this.userRepo.findOne({
      where: { username: dto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const existingEmail = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Hash default password
    const defaultPassword = dto.password || this.generateRandomPassword();
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // Create user
    const user = this.userRepo.create({
      username: dto.username,
      email: dto.email,
      first_name: dto.first_name,
      last_name: dto.last_name,
      organization_id: dto.organization_id,
      password_hash: passwordHash,
      is_active: true,
      must_change_password: true, // Force password change on first login
    });

    await this.userRepo.save(user);

    // Create default preferences
    await this.createDefaultPreferences(user.user_id);

    return user;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Check unique email if changed
    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepo.findOne({
        where: { email: dto.email },
      });

      if (existing) {
        throw new ConflictException('Email already exists');
      }
    }

    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async findAll(query: SearchUserDto): Promise<PaginatedResult<User>> {
    const queryBuilder = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'org')
      .where('user.deleted_at IS NULL');

    // Search filters
    if (query.search) {
      queryBuilder.andWhere(
        '(user.username LIKE :search OR user.email LIKE :search OR ' +
          'user.first_name LIKE :search OR user.last_name LIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    if (query.organization_id) {
      queryBuilder.andWhere('user.organization_id = :orgId', {
        orgId: query.organization_id,
      });
    }

    if (query.is_active !== undefined) {
      queryBuilder.andWhere('user.is_active = :isActive', {
        isActive: query.is_active,
      });
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await queryBuilder
      .orderBy('user.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Remove sensitive data
    items.forEach((user) => this.sanitizeUser(user));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { user_id: id, deleted_at: IsNull() },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    return this.sanitizeUser(user);
  }

  async toggleActive(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { user_id: id } });

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    user.is_active = !user.is_active;
    return this.userRepo.save(user);
  }

  async softDelete(id: number): Promise<void> {
    const user = await this.findOne(id);

    // Prevent deletion of users with active sessions or critical roles
    const hasActiveSessions = await this.hasActiveSessions(id);
    if (hasActiveSessions) {
      throw new BadRequestException('Cannot delete user with active sessions');
    }

    await this.userRepo.softDelete(id);
  }

  private sanitizeUser(user: User): User {
    delete user.password_hash;
    return user;
  }

  private generateRandomPassword(): string {
    return (
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8)
    );
  }

  private async createDefaultPreferences(userId: number): Promise<void> {
    const preferences = this.preferenceRepo.create({
      user_id: userId,
      language: 'th',
      timezone: 'Asia/Bangkok',
      email_notifications_enabled: true,
      line_notify_enabled: false,
    });

    await this.preferenceRepo.save(preferences);
  }

  private async hasActiveSessions(userId: number): Promise<boolean> {
    // Check Redis for active sessions
    // Implementation depends on session management strategy
    return false;
  }
}
```

### 2. Profile Service

```typescript
// File: backend/src/modules/user/profile.service.ts
@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserPreference)
    private preferenceRepo: Repository<UserPreference>,
    private fileStorage: FileStorageService
  ) {}

  async getProfile(userId: number): Promise<UserProfile> {
    const user = await this.userRepo.findOne({
      where: { user_id: userId },
      relations: ['organization', 'preferences'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const preferences = await this.preferenceRepo.findOne({
      where: { user_id: userId },
    });

    return {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      display_name: user.display_name,
      organization: user.organization,
      avatar_url: user.avatar_url,
      preferences,
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<User> {
    const user = await this.userRepo.findOne({ where: { user_id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update allowed fields only
    if (dto.first_name) user.first_name = dto.first_name;
    if (dto.last_name) user.last_name = dto.last_name;
    if (dto.display_name) user.display_name = dto.display_name;
    if (dto.phone) user.phone = dto.phone;

    return this.userRepo.save(user);
  }

  async uploadAvatar(
    userId: number,
    file: Express.Multer.File
  ): Promise<string> {
    // Upload to temp storage
    const uploadResult = await this.fileStorage.uploadToTemp(file, userId);

    // Commit to permanent storage
    const attachments = await this.fileStorage.commitFiles(
      [uploadResult.temp_id],
      userId,
      'user_avatar',
      this.userRepo.manager
    );

    const avatarUrl = `/attachments/${attachments[0].id}`;

    // Update user avatar_url
    await this.userRepo.update(userId, { avatar_url: avatarUrl });

    return avatarUrl;
  }

  async updatePreferences(
    userId: number,
    dto: UpdatePreferencesDto
  ): Promise<UserPreference> {
    let preferences = await this.preferenceRepo.findOne({
      where: { user_id: userId },
    });

    if (!preferences) {
      preferences = this.preferenceRepo.create({ user_id: userId });
    }

    Object.assign(preferences, dto);
    return this.preferenceRepo.save(preferences);
  }
}
```

### 3. Password Service

```typescript
// File: backend/src/modules/user/password.service.ts
@Injectable()
export class PasswordService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(PasswordHistory)
    private passwordHistoryRepo: Repository<PasswordHistory>,
    private redis: Redis,
    private emailQueue: Queue
  ) {}

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { user_id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(
      dto.current_password,
      user.password_hash
    );

    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password strength
    this.validatePasswordStrength(dto.new_password);

    // Check password history (prevent reuse of last 5 passwords)
    await this.checkPasswordHistory(userId, dto.new_password);

    // Hash new password
    const newPasswordHash = await bcrypt.hash(dto.new_password, 10);

    // Update password
    user.password_hash = newPasswordHash;
    user.must_change_password = false;
    user.password_changed_at = new Date();
    await this.userRepo.save(user);

    // Save to password history
    await this.passwordHistoryRepo.save({
      user_id: userId,
      password_hash: newPasswordHash,
    });

    // Invalidate all existing sessions
    await this.invalidateUserSessions(userId);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists
      return;
    }

    // Generate reset token
    const resetToken = this.generateResetToken();
    const resetTokenHash = await bcrypt.hash(resetToken, 10);

    // Store token in Redis (expires in 1 hour)
    await this.redis.set(
      `password_reset:${user.user_id}`,
      resetTokenHash,
      'EX',
      3600
    );

    // Send reset email
    await this.emailQueue.add('send-password-reset', {
      to: user.email,
      resetToken,
      username: user.username,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
    });

    if (!user) {
      throw new BadRequestException('Invalid reset token');
    }

    // Verify reset token
    const storedTokenHash = await this.redis.get(
      `password_reset:${user.user_id}`
    );

    if (!storedTokenHash) {
      throw new BadRequestException('Reset token expired');
    }

    const isValid = await bcrypt.compare(dto.reset_token, storedTokenHash);

    if (!isValid) {
      throw new BadRequestException('Invalid reset token');
    }

    // Validate new password
    this.validatePasswordStrength(dto.new_password);

    // Hash and update password
    const newPasswordHash = await bcrypt.hash(dto.new_password, 10);
    user.password_hash = newPasswordHash;
    user.password_changed_at = new Date();
    await this.userRepo.save(user);

    // Delete reset token
    await this.redis.del(`password_reset:${user.user_id}`);

    // Invalidate sessions
    await this.invalidateUserSessions(user.user_id);
  }

  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    // Check for at least one uppercase, one lowercase, one number
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      throw new BadRequestException(
        'Password must contain uppercase, lowercase, and numbers'
      );
    }
  }

  private async checkPasswordHistory(
    userId: number,
    newPassword: string
  ): Promise<void> {
    const history = await this.passwordHistoryRepo.find({
      where: { user_id: userId },
      order: { changed_at: 'DESC' },
      take: 5,
    });

    for (const record of history) {
      const isSame = await bcrypt.compare(newPassword, record.password_hash);
      if (isSame) {
        throw new BadRequestException('Cannot reuse recently used passwords');
      }
    }
  }

  private generateResetToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  private async invalidateUserSessions(userId: number): Promise<void> {
    await this.redis.del(`user:${userId}:permissions`);
    await this.redis.del(`refresh_token:${userId}`);
  }
}
```

### 4. User Controller

```typescript
// File: backend/src/modules/user/user.controller.ts
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiTags('Users')
export class UserController {
  constructor(
    private userService: UserService,
    private profileService: ProfileService,
    private passwordService: PasswordService
  ) {}

  // User Management (Admin)
  @Get()
  @RequirePermission('user.view')
  async findAll(@Query() query: SearchUserDto) {
    return this.userService.findAll(query);
  }

  @Post()
  @RequirePermission('user.create')
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Put(':id')
  @RequirePermission('user.update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto
  ) {
    return this.userService.update(id, dto);
  }

  @Post(':id/toggle-active')
  @RequirePermission('user.update')
  async toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.userService.toggleActive(id);
  }

  @Delete(':id')
  @RequirePermission('user.delete')
  @HttpCode(204)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.userService.softDelete(id);
  }

  // Profile Management (Self)
  @Get('me/profile')
  async getMyProfile(@CurrentUser() user: User) {
    return this.profileService.getProfile(user.user_id);
  }

  @Put('me/profile')
  async updateMyProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto
  ) {
    return this.profileService.updateProfile(user.user_id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.profileService.uploadAvatar(user.user_id, file);
  }

  @Put('me/preferences')
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdatePreferencesDto
  ) {
    return this.profileService.updatePreferences(user.user_id, dto);
  }

  // Password Management
  @Post('me/change-password')
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto
  ) {
    return this.passwordService.changePassword(user.user_id, dto);
  }

  @Post('request-password-reset')
  @Public() // No auth required
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.passwordService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @Public() // No auth required
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordService.resetPassword(dto);
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
describe('UserService', () => {
  it('should create user with hashed password', async () => {
    const dto = {
      username: 'testuser',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      organization_id: 1,
    };

    const result = await service.create(dto);

    expect(result.username).toBe('testuser');
    expect(result.password_hash).toBeUndefined(); // Sanitized
    expect(result.must_change_password).toBe(true);
  });

  it('should prevent duplicate username', async () => {
    await expect(
      service.create({ username: 'admin', email: 'new@example.com' })
    ).rejects.toThrow(ConflictException);
  });
});

describe('PasswordService', () => {
  it('should change password successfully', async () => {
    await service.changePassword(1, {
      current_password: 'oldPassword123',
      new_password: 'NewPassword123',
    });

    // Verify password updated
  });

  it('should prevent password reuse', async () => {
    await expect(
      service.changePassword(1, {
        current_password: 'current',
        new_password: 'previouslyUsed',
      })
    ).rejects.toThrow('Cannot reuse recently used passwords');
  });

  it('should validate password strength', async () => {
    await expect(
      service.changePassword(1, {
        current_password: 'current',
        new_password: 'weak',
      })
    ).rejects.toThrow('Password must be at least 8 characters');
  });
});
```

---

## 📚 Related Documents

- [Data Model - Users](../02-architecture/data-model.md#users--rbac)
- [ADR-004: RBAC Implementation](../05-decisions/ADR-004-rbac-implementation.md)

---

## 📦 Deliverables

- [ ] UserService (CRUD)
- [ ] ProfileService (Profile & Avatar)
- [ ] PasswordService (Change & Reset)
- [ ] UserController
- [ ] DTOs (Create, Update, Profile, Password)
- [ ] Password History tracking
- [ ] Unit Tests (85% coverage)
- [ ] Integration Tests
- [ ] API Documentation

---

## 🚨 Risks & Mitigation

| Risk                 | Impact   | Mitigation                              |
| -------------------- | -------- | --------------------------------------- |
| Password reset abuse | High     | Rate limiting, token expiration         |
| Session hijacking    | Critical | Session invalidation on password change |
| Weak passwords       | High     | Password strength validation            |
| Email not delivered  | Medium   | Logging + retry mechanism               |

---

## 📌 Notes

- Default password generated on user creation
- Force password change on first login
- Password history prevents reuse (last 5 passwords)
- Reset token expires in 1 hour
- All sessions invalidated on password change
- Avatar uploaded via two-phase storage
- User preferences stored separately
- Soft delete for users
- Admin permission required for user CRUD
- Users can manage own profile without admin permission

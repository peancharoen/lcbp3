# P0-1: CASL RBAC Integration - Usage Example

## ตัวอย่างการใช้งานใน Controller

### 1. Import Required Dependencies

```typescript
import { Controller, Post, Get, UseGuards, Body, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/auth/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
```

### 2. Apply Guards and Permissions

```typescript
@Controller('correspondences')
@UseGuards(JwtAuthGuard) // Step 1: Authenticate user
export class CorrespondenceController {

  // ตัวอย่าง 1: Single Permission
  @Post()
  @UseGuards(PermissionsGuard) // Step 2: Check permissions
  @RequirePermission('correspondence.create')
  async create(@Body() dto: CreateCorrespondenceDto) {
    // Only users with 'correspondence.create' permission can access
    return this.correspondenceService.create(dto);
  }

  // ตัวอย่าง 2: View (typically everyone with access)
  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('correspondence.view')
  async findOne(@Param('id') id: string) {
    return this.correspondenceService.findOne(+id);
  }

  // ตัวอย่าง 3: Admin Edit (requires special permission)
  @Put(':id/force-update')
  @UseGuards(PermissionsGuard)
  @RequirePermission('document.admin_edit')
  async forceUpdate(@Param('id') id: string, @Body() dto: UpdateDto) {
    // Only document controllers can force update
    return this.correspondenceService.forceUpdate(+id, dto);
  }

  // ตัวอย่าง 4: Multiple Permissions (user must have ALL)
  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('correspondence.delete', 'document.admin_edit')
  async remove(@Param('id') id: string) {
    // Requires BOTH permissions
    return this.correspondenceService.remove(+id);
  }
}
```

### 3. Controller with Scope Context

Permissions guard จะ extract scope จาก request params/body/query:

```typescript
@Controller('projects/:projectId/correspondences')
@UseGuards(JwtAuthGuard)
export class ProjectCorrespondenceController {

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('correspondence.create')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCorrespondenceDto
  ) {
    // PermissionsGuard จะ extract: { projectId: projectId }
    // และตรวจสอบว่า user มี permission ใน project นี้หรือไม่
    return this.service.create({ projectId, ...dto });
  }
}
```

## หลักการทำงาน

### Scope Matching Hierarchy

1. **Global Scope**: User ที่มี assignment โดยไม่ระบุ org/project/contract
   - สามารถ access ทุกอย่างได้

2. **Organization Scope**: User ที่มี assignment ระดับ organization
   - สามารถ access resources ใน organization นั้นเท่านั้น

3. **Project Scope**: User ที่มี assignment ระดับ project
   - สามารถ access resources ใน project นั้นเท่านั้น

4. **Contract Scope**: User ที่มี assignment ระดับ contract
   - สามารถ access resources ใน contract นั้นเท่านั้น

### Permission Format

Permission ใน database ต้องเป็นรูปแบบ: `{subject}.{action}`

ตัวอย่าง:
- `correspondence.create`
- `correspondence.view`
- `correspondence.edit`
- `document.admin_edit`
- `rfa.create`
- `project.manage_members`
- `system.manage_all` (special case)

## Testing

Run unit tests:
```bash
npm run test -- ability.factory.spec
```

Expected output:
```
✓ should grant all permissions for global admin
✓ should grant permissions for matching organization
✓ should deny permissions for non-matching organization
✓ should grant permissions for matching project
✓ should grant permissions for matching contract
✓ should combine permissions from multiple assignments
```

## Next Steps

1. Update existing controllers to use `@RequirePermission()`
2. Test with different user roles
3. Verify scope matching works correctly

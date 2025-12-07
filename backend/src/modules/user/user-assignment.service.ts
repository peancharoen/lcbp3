import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAssignment } from './entities/user-assignment.entity'; // ต้องไปสร้าง Entity นี้ก่อน (ดูข้อ 3)
import { AssignRoleDto } from './dto/assign-role.dto.js';
import { User } from './entities/user.entity';

@Injectable()
export class UserAssignmentService {
  constructor(
    @InjectRepository(UserAssignment)
    private assignmentRepo: Repository<UserAssignment>,
  ) {}

  async assignRole(dto: AssignRoleDto, assigner: User) {
    // Validation: ตรวจสอบกฎเหล็ก (เลือกได้แค่ Scope เดียว)
    const scopes = [dto.organizationId, dto.projectId, dto.contractId].filter(
      (v) => v != null,
    );
    if (scopes.length > 1) {
      throw new BadRequestException(
        'Cannot assign multiple scopes at once. Choose one of Org, Project, or Contract.',
      );
    }

    // สร้าง Assignment
    const assignment = this.assignmentRepo.create({
      userId: dto.userId,
      roleId: dto.roleId,
      organizationId: dto.organizationId,
      projectId: dto.projectId,
      contractId: dto.contractId,
      assignedByUserId: assigner.user_id, // เก็บ Log ว่าใครเป็นคนให้สิทธิ์
    });

    return this.assignmentRepo.save(assignment);
  }
}

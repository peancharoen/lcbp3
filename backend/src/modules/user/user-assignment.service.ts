import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserAssignment } from './entities/user-assignment.entity';
import { AssignRoleDto } from './dto/assign-role.dto.js';
import { BulkAssignmentDto, ActionType } from './dto/bulk-assignment.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserAssignmentService {
  private readonly logger = new Logger(UserAssignmentService.name);

  constructor(
    @InjectRepository(UserAssignment)
    private assignmentRepo: Repository<UserAssignment>,
    private dataSource: DataSource
  ) {}

  async assignRole(dto: AssignRoleDto, assigner: User) {
    // Validation: ตรวจสอบกฎเหล็ก (เลือกได้แค่ Scope เดียว)
    const scopes = [dto.organizationId, dto.projectId, dto.contractId].filter(
      (v) => v != null
    );
    if (scopes.length > 1) {
      throw new BadRequestException(
        'Cannot assign multiple scopes at once. Choose one of Org, Project, or Contract.'
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

  async bulkUpdateAssignments(dto: BulkAssignmentDto, assigner: User) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];
      for (const assignmentAction of dto.assignments) {
        const { userId, roleId, action, organizationId, projectId } =
          assignmentAction;

        if (action === ActionType.ADD) {
          // Validation (Scope)
          const scopes = [organizationId, projectId].filter((v) => v != null);
          if (scopes.length > 1) {
            throw new BadRequestException(
              `User ${userId}: Cannot assign multiple scopes.`
            );
          }

          const newAssignment = queryRunner.manager.create(UserAssignment, {
            userId,
            roleId,
            organizationId,
            projectId,
            assignedByUserId: assigner.user_id,
          });
          results.push(await queryRunner.manager.save(newAssignment));
        } else if (action === ActionType.REMOVE) {
          // Construct delete criteria
          const criteria: any = { userId, roleId };
          if (organizationId) criteria.organizationId = organizationId;
          if (projectId) criteria.projectId = projectId;

          await queryRunner.manager.delete(UserAssignment, criteria);
          results.push({ ...criteria, status: 'removed' });
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Bulk assignments updated by user ${assigner.user_id}`);
      return results;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to bulk update assignments: ${(err as Error).message}`
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

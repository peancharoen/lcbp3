// File: src/modules/distribution/distribution-matrix.service.ts
// Change Log
// - 2026-05-14: Resolve public IDs internally and align CRUD with canonical schema.
// CRUD สำหรับ DistributionMatrix และ Recipients (T053)
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { validate as uuidValidate } from 'uuid';
import { DistributionMatrix } from './entities/distribution-matrix.entity';
import { DistributionRecipient } from './entities/distribution-recipient.entity';
import { Project } from '../project/entities/project.entity';
import { ResponseCode } from '../response-code/entities/response-code.entity';
import { CreateDistributionMatrixDto } from './dto/create-distribution-matrix.dto';
import { UpdateDistributionMatrixDto } from './dto/update-distribution-matrix.dto';
import { AddDistributionRecipientDto } from './dto/add-distribution-recipient.dto';

@Injectable()
export class DistributionMatrixService {
  constructor(
    @InjectRepository(DistributionMatrix)
    private readonly matrixRepo: Repository<DistributionMatrix>,
    @InjectRepository(DistributionRecipient)
    private readonly recipientRepo: Repository<DistributionRecipient>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ResponseCode)
    private readonly responseCodeRepo: Repository<ResponseCode>
  ) {}

  /**
   * ดึง Matrix ของโครงการ พร้อม global defaults.
   */
  async findByProject(projectId?: number): Promise<DistributionMatrix[]> {
    return this.matrixRepo.find({
      where:
        projectId === undefined
          ? { isActive: true }
          : [
              { projectId, isActive: true },
              { projectId: IsNull(), isActive: true },
            ],
      relations: ['recipients', 'responseCode'],
      order: { documentTypeId: 'ASC', createdAt: 'DESC' },
    });
  }

  async findByProjectPublicId(
    projectPublicId?: string
  ): Promise<DistributionMatrix[]> {
    if (!projectPublicId) return this.findByProject();
    if (!uuidValidate(projectPublicId)) {
      throw new BadRequestException(
        `Invalid projectPublicId: ${projectPublicId}`
      );
    }
    const project = await this.projectRepo.findOne({
      where: { publicId: projectPublicId },
    });
    if (!project)
      throw new NotFoundException(`Project not found: ${projectPublicId}`);
    return this.findByProject(project.id);
  }

  async findOneByDocType(
    projectId: number,
    documentTypeId: number
  ): Promise<DistributionMatrix | null> {
    return this.matrixRepo.findOne({
      where: [
        { projectId, documentTypeId, isActive: true },
        { projectId: IsNull(), documentTypeId, isActive: true },
      ],
      relations: ['recipients', 'responseCode'],
    });
  }

  async create(dto: CreateDistributionMatrixDto): Promise<DistributionMatrix> {
    const matrix = this.matrixRepo.create({
      name: dto.name,
      projectId: await this.resolveProjectId(dto.projectPublicId),
      documentTypeId: dto.documentTypeId,
      responseCodeId: await this.resolveResponseCodeId(
        dto.responseCodePublicId
      ),
      conditions: dto.conditions,
      isActive: true,
    });
    return this.matrixRepo.save(matrix);
  }

  async update(
    publicId: string,
    dto: UpdateDistributionMatrixDto
  ): Promise<DistributionMatrix> {
    const matrix = await this.findMatrix(publicId);
    if (dto.name !== undefined) matrix.name = dto.name;
    if (dto.documentTypeId !== undefined) {
      matrix.documentTypeId = dto.documentTypeId;
    }
    if (dto.projectPublicId !== undefined) {
      matrix.projectId = await this.resolveProjectId(dto.projectPublicId);
    }
    if (dto.responseCodePublicId !== undefined) {
      matrix.responseCodeId = await this.resolveResponseCodeId(
        dto.responseCodePublicId
      );
    }
    if (dto.conditions !== undefined) matrix.conditions = dto.conditions;
    return this.matrixRepo.save(matrix);
  }

  async addRecipient(
    matrixPublicId: string,
    dto: AddDistributionRecipientDto
  ): Promise<DistributionRecipient> {
    const matrix = await this.findMatrix(matrixPublicId);
    const recipient = this.recipientRepo.create({
      matrixId: matrix.id,
      recipientType: dto.recipientType,
      recipientPublicId: dto.recipientPublicId,
      deliveryMethod: dto.deliveryMethod,
      sequence: dto.sequence,
    });
    return this.recipientRepo.save(recipient);
  }

  async removeRecipient(recipientPublicId: string): Promise<void> {
    const recipient = await this.recipientRepo.findOne({
      where: { publicId: recipientPublicId },
    });
    if (!recipient) throw new NotFoundException(recipientPublicId);
    await this.recipientRepo.remove(recipient);
  }

  async remove(publicId: string): Promise<void> {
    const matrix = await this.findMatrix(publicId);
    matrix.isActive = false;
    await this.matrixRepo.save(matrix);
  }

  private async findMatrix(publicId: string): Promise<DistributionMatrix> {
    const matrix = await this.matrixRepo.findOne({ where: { publicId } });
    if (!matrix) {
      throw new NotFoundException(`Distribution Matrix not found: ${publicId}`);
    }
    return matrix;
  }

  private async resolveProjectId(
    projectPublicId?: string
  ): Promise<number | undefined> {
    if (!projectPublicId) return undefined;
    const project = await this.projectRepo.findOne({
      where: { publicId: projectPublicId },
    });
    if (!project) {
      throw new NotFoundException(`Project not found: ${projectPublicId}`);
    }
    return project.id;
  }

  private async resolveResponseCodeId(
    responseCodePublicId?: string
  ): Promise<number | undefined> {
    if (!responseCodePublicId) return undefined;
    const responseCode = await this.responseCodeRepo.findOne({
      where: { publicId: responseCodePublicId },
    });
    if (!responseCode) {
      throw new NotFoundException(
        `Response Code not found: ${responseCodePublicId}`
      );
    }
    return responseCode.id;
  }
}

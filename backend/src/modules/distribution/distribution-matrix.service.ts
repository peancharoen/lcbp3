// File: src/modules/distribution/distribution-matrix.service.ts
// CRUD สำหรับ DistributionMatrix และ Recipients (T053)
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DistributionMatrix } from './entities/distribution-matrix.entity';
import { DistributionRecipient } from './entities/distribution-recipient.entity';
import { Project } from '../project/entities/project.entity';

export interface CreateDistributionMatrixDto {
  projectId: number;
  documentTypeCode: string;
  responseCodeFilter?: string[];
}

export interface AddRecipientDto {
  recipientType: string;
  recipientId?: number;
  roleCode?: string;
  deliveryMethod?: string;
  isCc?: boolean;
}

@Injectable()
export class DistributionMatrixService {
  private readonly logger = new Logger(DistributionMatrixService.name);

  constructor(
    @InjectRepository(DistributionMatrix)
    private readonly matrixRepo: Repository<DistributionMatrix>,
    @InjectRepository(DistributionRecipient)
    private readonly recipientRepo: Repository<DistributionRecipient>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>
  ) {}

  async findByProject(projectId: number): Promise<DistributionMatrix[]> {
    return this.matrixRepo.find({
      where: { projectId, isActive: true },
      relations: ['recipients'],
      order: { documentTypeCode: 'ASC' },
    });
  }

  async findByProjectPublicId(
    projectPublicId: string
  ): Promise<DistributionMatrix[]> {
    const project = await this.projectRepo.findOne({
      where: { publicId: projectPublicId },
    });
    if (!project)
      throw new NotFoundException(`Project not found: ${projectPublicId}`);
    return this.findByProject(project.id);
  }

  async findOneByDocType(
    projectId: number,
    documentTypeCode: string
  ): Promise<DistributionMatrix | null> {
    return this.matrixRepo.findOne({
      where: { projectId, documentTypeCode, isActive: true },
      relations: ['recipients'],
    });
  }

  async create(dto: CreateDistributionMatrixDto): Promise<DistributionMatrix> {
    const matrix = this.matrixRepo.create(dto as Partial<DistributionMatrix>);
    return this.matrixRepo.save(matrix);
  }

  async addRecipient(
    matrixPublicId: string,
    dto: AddRecipientDto
  ): Promise<DistributionRecipient> {
    const matrix = await this.matrixRepo.findOne({
      where: { publicId: matrixPublicId },
    });
    if (!matrix)
      throw new NotFoundException(`Matrix not found: ${matrixPublicId}`);

    const recipient = this.recipientRepo.create({
      matrixId: matrix.id,
      ...dto,
    } as Partial<DistributionRecipient>);

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
    const matrix = await this.matrixRepo.findOne({ where: { publicId } });
    if (!matrix) throw new NotFoundException(publicId);
    matrix.isActive = false;
    await this.matrixRepo.save(matrix);
  }
}

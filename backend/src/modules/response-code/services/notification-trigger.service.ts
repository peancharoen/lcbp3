// File: src/modules/response-code/services/notification-trigger.service.ts
// ส่งการแจ้งเตือนอัตโนมัติเมื่อ Response Code มีผลกระทบสำคัญ (FR-007)
// Code 1C (Change Order), 1D (Alternative), 3 (Rejected) → notify ฝ่ายที่เกี่ยวข้อง
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseCode } from '../entities/response-code.entity';
import { NotificationService } from '../../notification/notification.service';
import { User } from '../../user/entities/user.entity';
import { ImplicationsService } from './implications.service';

@Injectable()
export class NotificationTriggerService {
  private readonly logger = new Logger(NotificationTriggerService.name);

  constructor(
    @InjectRepository(ResponseCode)
    private readonly responseCodeRepo: Repository<ResponseCode>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationService: NotificationService,
    private readonly implicationsService: ImplicationsService
  ) {}

  /**
   * Trigger notifications เมื่อ Review Task เสร็จสิ้นด้วย Code ที่มีผลกระทบ (FR-007)
   * เรียกจาก ReviewTaskService หลังจาก completeReview
   */
  async triggerIfRequired(
    responseCodePublicId: string,
    rfaPublicId: string,
    documentNumber: string,
    _reviewerUserId: number
  ): Promise<void> {
    const responseCode = await this.responseCodeRepo.findOne({
      where: { publicId: responseCodePublicId },
    });

    if (!responseCode) {
      this.logger.warn(
        `Response code not found for notification trigger: ${responseCodePublicId}`
      );
      return;
    }

    const evaluation = this.implicationsService.evaluate(responseCode);

    // ถ้า severity ต่ำ ไม่ต้อง notify เพิ่ม
    if (evaluation.severity === 'LOW') return;

    const notifyRoles = evaluation.notifyRoles;

    if (notifyRoles.length === 0) return;

    // หา Users ที่มี role ที่ต้องการแจ้งเตือน
    const targetUsers = await this.userRepo
      .createQueryBuilder('user')
      .where('user.role IN (:...roles)', { roles: notifyRoles })
      .andWhere('user.is_active = 1')
      .getMany();

    const codeLabel = responseCode.code;
    const title = `Response Code ${codeLabel} — Action Required`;
    const message = [
      `Document: ${documentNumber}`,
      `Response Code: ${codeLabel} — ${responseCode.descriptionEn}`,
      ...evaluation.actionRequired,
    ].join('\n');

    // ส่งแจ้งเตือนแบบ parallel (ADR-008: ผ่าน BullMQ)
    await Promise.all(
      targetUsers.map((user: User) =>
        this.notificationService.send({
          userId: user.user_id,
          title,
          message,
          type: 'SYSTEM',
          entityType: 'rfa',
          entityId: rfaPublicId as unknown as number,
        })
      )
    );

    this.logger.log(
      `Triggered ${notifyRoles.length} role notifications for code ${codeLabel} on document ${documentNumber}`
    );
  }
}

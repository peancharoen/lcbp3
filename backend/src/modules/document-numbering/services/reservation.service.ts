import {
  Injectable,
  NotFoundException,
  GoneException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import {
  DocumentNumberReservation,
  ReservationStatus,
} from '../entities/document-number-reservation.entity';
import {
  ReserveNumberDto,
  ReserveNumberResponseDto,
} from '../dto/reserve-number.dto';
import {
  ConfirmReservationDto,
  ConfirmReservationResponseDto,
} from '../dto/confirm-reservation.dto';
import { CounterService } from './counter.service';
import { FormatService } from './format.service';
import { buildCounterKey } from '../dto/counter-key.dto';

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);
  private readonly RESERVATION_TTL_MINUTES = 5;

  constructor(
    @InjectRepository(DocumentNumberReservation)
    private reservationRepo: Repository<DocumentNumberReservation>,
    private counterService: CounterService,
    private formatService: FormatService
  ) {}

  /**
   * Reserve a document number (Phase 1 of Two-Phase Commit)
   */
  async reserve(
    dto: ReserveNumberDto,
    userId: number,
    ipAddress: string,
    userAgent: string
  ): Promise<ReserveNumberResponseDto> {
    // Build counter key
    const counterKey = buildCounterKey({
      projectId: dto.projectId,
      originatorOrgId: dto.originatorOrganizationId,
      recipientOrgId: dto.recipientOrganizationId,
      correspondenceTypeId: dto.correspondenceTypeId,
      subTypeId: dto.subTypeId,
      rfaTypeId: dto.rfaTypeId,
      disciplineId: dto.disciplineId,
      isRFA: dto.rfaTypeId !== undefined && dto.rfaTypeId > 0,
    });

    // Increment counter
    const sequence = await this.counterService.incrementCounter(counterKey);

    // Format document number
    const documentNumber = await this.formatService.format({
      ...dto,
      sequence,
      resetScope: counterKey.resetScope,
    });

    // Create reservation
    const token = uuidv4();
    const expiresAt = new Date(
      Date.now() + this.RESERVATION_TTL_MINUTES * 60 * 1000
    );

    const reservation = await this.reservationRepo.save({
      token,
      documentNumber,
      status: ReservationStatus.RESERVED,
      expiresAt,
      userId,
      ipAddress,
      userAgent,
      projectId: dto.projectId,
      correspondenceTypeId: dto.correspondenceTypeId,
      originatorOrganizationId: dto.originatorOrganizationId,
      recipientOrganizationId: dto.recipientOrganizationId || 0,
      metadata: dto.metadata,
    });

    this.logger.log(
      `Reserved: ${documentNumber} for user ${userId} (token: ${token})`
    );

    return {
      token,
      documentNumber,
      expiresAt,
    };
  }

  /**
   * Confirm a reservation (Phase 2 of Two-Phase Commit)
   */
  async confirm(
    dto: ConfirmReservationDto,
    userId: number
  ): Promise<ConfirmReservationResponseDto> {
    const reservation = await this.reservationRepo.findOne({
      where: {
        token: dto.token,
        status: ReservationStatus.RESERVED,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found or already used');
    }

    // Check expiration
    if (new Date() > reservation.expiresAt) {
      await this.cancel(dto.token, userId, 'Expired');
      throw new GoneException(
        'Reservation expired. Please reserve a new number.'
      );
    }

    // Confirm
    reservation.status = ReservationStatus.CONFIRMED;
    reservation.documentId = dto.documentId ?? null;
    reservation.confirmedAt = new Date();
    await this.reservationRepo.save(reservation);

    this.logger.log(
      `Confirmed: ${reservation.documentNumber} → document ${dto.documentId}`
    );

    return {
      documentNumber: reservation.documentNumber,
      confirmedAt: reservation.confirmedAt,
    };
  }

  /**
   * Cancel a reservation
   */
  async cancel(token: string, userId: number, reason?: string): Promise<void> {
    const reservation = await this.reservationRepo.findOne({
      where: { token },
    });

    if (reservation && reservation.status === ReservationStatus.RESERVED) {
      reservation.status = ReservationStatus.CANCELLED;
      reservation.cancelledAt = new Date();
      reservation.metadata = {
        ...reservation.metadata,
        cancelReason: reason,
        cancelledBy: userId,
      };
      await this.reservationRepo.save(reservation);

      this.logger.log(
        `Cancelled: ${reservation.documentNumber} by user ${userId}`
      );
    }
  }

  /**
   * Cron job: Cleanup expired reservations every 5 minutes
   */
  @Cron('*/5 * * * *')
  async cleanupExpired(): Promise<void> {
    const result = await this.reservationRepo
      .createQueryBuilder()
      .update()
      .set({
        status: ReservationStatus.CANCELLED,
        cancelledAt: () => 'NOW()',
      })
      .where('document_number_status = :status', {
        status: ReservationStatus.RESERVED,
      })
      .andWhere('expires_at < NOW()')
      .execute();

    if ((result.affected ?? 0) > 0) {
      this.logger.log(`Cleaned up ${result.affected} expired reservations`);
    }
  }

  /**
   * Get reservation by token
   */
  async getByToken(token: string): Promise<DocumentNumberReservation | null> {
    return this.reservationRepo.findOne({ where: { token } });
  }
}

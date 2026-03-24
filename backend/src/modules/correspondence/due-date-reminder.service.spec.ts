import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DueDateReminderService } from './due-date-reminder.service';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';

describe('DueDateReminderService', () => {
  let service: DueDateReminderService;
  let revisionRepo: { find: jest.Mock };
  let notificationService: { send: jest.Mock };
  let userService: { findDocControlIdByOrg: jest.Mock };

  const mockRevisionRepo = () => ({
    find: jest.fn(),
  });

  const mockNotificationService = () => ({
    send: jest.fn().mockResolvedValue(undefined),
  });

  const mockUserService = () => ({
    findDocControlIdByOrg: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DueDateReminderService,
        {
          provide: getRepositoryToken(CorrespondenceRevision),
          useFactory: mockRevisionRepo,
        },
        {
          provide: NotificationService,
          useFactory: mockNotificationService,
        },
        {
          provide: UserService,
          useFactory: mockUserService,
        },
      ],
    }).compile();

    service = module.get<DueDateReminderService>(DueDateReminderService);
    revisionRepo = module.get(getRepositoryToken(CorrespondenceRevision));
    notificationService = module.get(NotificationService);
    userService = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendDueDateReminders', () => {
    it('should do nothing when no revisions are approaching due date', async () => {
      revisionRepo.find.mockResolvedValue([]);

      await service.sendDueDateReminders();

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('should skip revisions with no correspondence', async () => {
      revisionRepo.find.mockResolvedValue([
        {
          correspondence: null,
          status: { statusCode: 'DRAFT' },
          dueDate: new Date(),
        },
      ]);

      await service.sendDueDateReminders();

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('should skip cancelled correspondences', async () => {
      revisionRepo.find.mockResolvedValue([
        {
          correspondence: {
            id: 1,
            uuid: 'uuid-1',
            correspondenceNumber: 'LC-001',
            originatorId: 10,
          },
          status: { statusCode: 'CANCELLED' },
          subject: 'Test',
          dueDate: new Date(Date.now() + 86400000),
        },
      ]);

      await service.sendDueDateReminders();

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('should skip closed (CLBOWN) correspondences', async () => {
      revisionRepo.find.mockResolvedValue([
        {
          correspondence: {
            id: 1,
            uuid: 'uuid-1',
            correspondenceNumber: 'LC-001',
            originatorId: 10,
          },
          status: { statusCode: 'CLBOWN' },
          subject: 'Test',
          dueDate: new Date(Date.now() + 86400000),
        },
      ]);

      await service.sendDueDateReminders();

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('should skip when no doc-control user found for org', async () => {
      revisionRepo.find.mockResolvedValue([
        {
          correspondence: {
            id: 1,
            uuid: 'uuid-1',
            correspondenceNumber: 'LC-001',
            originatorId: 10,
          },
          status: { statusCode: 'DRAFT' },
          subject: 'Test Subject',
          dueDate: new Date(Date.now() + 86400000),
        },
      ]);
      userService.findDocControlIdByOrg.mockResolvedValue(null);

      await service.sendDueDateReminders();

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('should send EMAIL notification for a valid approaching due date', async () => {
      const dueDate = new Date(Date.now() + 86400000 * 2); // 2 days later
      revisionRepo.find.mockResolvedValue([
        {
          correspondence: {
            id: 5,
            uuid: 'corr-uuid-1',
            correspondenceNumber: 'LC-TEST-001',
            originatorId: 10,
          },
          status: { statusCode: 'SUBOWN' },
          subject: 'Design Review Request',
          dueDate,
        },
      ]);
      userService.findDocControlIdByOrg.mockResolvedValue(42);

      await service.sendDueDateReminders();

      expect(userService.findDocControlIdByOrg).toHaveBeenCalledWith(10);
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 42,
          title: 'Due Date Approaching',
          type: 'EMAIL',
          entityType: 'correspondence',
          entityId: 5,
          link: '/correspondences/corr-uuid-1',
        })
      );
    });

    it('should handle errors per revision without stopping other notifications', async () => {
      const dueDate = new Date(Date.now() + 86400000);
      revisionRepo.find.mockResolvedValue([
        {
          correspondence: {
            id: 1,
            uuid: 'uuid-1',
            correspondenceNumber: 'LC-001',
            originatorId: 10,
          },
          status: { statusCode: 'SUBOWN' },
          subject: 'First',
          dueDate,
        },
        {
          correspondence: {
            id: 2,
            uuid: 'uuid-2',
            correspondenceNumber: 'LC-002',
            originatorId: 20,
          },
          status: { statusCode: 'SUBOWN' },
          subject: 'Second',
          dueDate,
        },
      ]);
      userService.findDocControlIdByOrg
        .mockResolvedValueOnce(42)
        .mockRejectedValueOnce(new Error('DB error'));

      await service.sendDueDateReminders();

      expect(notificationService.send).toHaveBeenCalledTimes(1);
    });

    it('should correctly calculate daysLeft in the message', async () => {
      const dueDate = new Date(Date.now() + 86400000); // exactly 1 day
      revisionRepo.find.mockResolvedValue([
        {
          correspondence: {
            id: 3,
            uuid: 'uuid-3',
            correspondenceNumber: 'LC-003',
            originatorId: 5,
          },
          status: { statusCode: 'DRAFT' },
          subject: 'Urgent Document',
          dueDate,
        },
      ]);
      userService.findDocControlIdByOrg.mockResolvedValue(99);

      await service.sendDueDateReminders();

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('1 day'),
        })
      );
    });
  });
});

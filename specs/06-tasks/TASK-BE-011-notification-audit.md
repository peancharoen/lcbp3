# Task: Notification & Audit Log Services

**Status:** Not Started
**Priority:** P3 (Low - Supporting Services)
**Estimated Effort:** 3-5 days
**Dependencies:** TASK-BE-001, TASK-BE-002
**Owner:** Backend Team

---

## 📋 Overview

สร้าง Notification Service สำหรับส่งการแจ้งเตือน และ Audit Log Service สำหรับบันทึกประวัติการใช้งานระบบ

---

## 🎯 Objectives

- ✅ Email Notification
- ✅ LINE Notify Integration
- ✅ In-App Notifications
- ✅ Audit Log Recording
- ✅ Audit Log Query & Export

---

## 📝 Acceptance Criteria

1. **Notifications:**

   - ✅ Send email via queue
   - ✅ Send LINE Notify
   - ✅ Store in-app notifications
   - ✅ Mark notifications as read
   - ✅ Notification templates

2. **Audit Logs:**
   - ✅ Auto-log CRUD operations
   - ✅ Log workflow transitions
   - ✅ Query audit logs by user/entity
   - ✅ Export to CSV

---

## 🛠️ Implementation Steps

### 1. Notification Entity

```typescript
// File: backend/src/modules/notification/entities/notification.entity.ts
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ length: 100 })
  notification_type: string;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ length: 255, nullable: true })
  link: string;

  @Column({ default: false })
  is_read: boolean;

  @Column({ type: 'timestamp', nullable: true })
  read_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

### 2. Notification Service

```typescript
// File: backend/src/modules/notification/notification.service.ts
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('line-notify') private lineQueue: Queue
  ) {}

  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create({
      user_id: dto.user_id,
      notification_type: dto.type,
      title: dto.title,
      message: dto.message,
      link: dto.link,
    });

    return this.notificationRepo.save(notification);
  }

  async sendEmail(dto: SendEmailDto): Promise<void> {
    await this.emailQueue.add('send-email', {
      to: dto.to,
      subject: dto.subject,
      template: dto.template,
      context: dto.context,
    });
  }

  async sendLineNotify(dto: SendLineNotifyDto): Promise<void> {
    await this.lineQueue.add('send-line', {
      token: dto.token,
      message: dto.message,
    });
  }

  async notifyWorkflowTransition(
    workflowId: number,
    action: string,
    actorId: number
  ): Promise<void> {
    // Get relevant users to notify
    const users = await this.getRelevantUsers(workflowId);

    for (const user of users) {
      // Create in-app notification
      await this.createNotification({
        user_id: user.user_id,
        type: 'workflow_transition',
        title: `${action} completed`,
        message: `Workflow ${workflowId} has been ${action}`,
        link: `/workflows/${workflowId}`,
      });

      // Send email
      if (user.email_notifications_enabled) {
        await this.sendEmail({
          to: user.email,
          subject: `Workflow Update`,
          template: 'workflow-transition',
          context: { action, workflowId },
        });
      }

      // Send LINE
      if (user.line_notify_token) {
        await this.sendLineNotify({
          token: user.line_notify_token,
          message: `Workflow ${workflowId}: ${action}`,
        });
      }
    }
  }

  async getUserNotifications(
    userId: number,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    const query: any = { user_id: userId };
    if (unreadOnly) {
      query.is_read = false;
    }

    return this.notificationRepo.find({
      where: query,
      order: { created_at: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(notificationId: number, userId: number): Promise<void> {
    await this.notificationRepo.update(
      { id: notificationId, user_id: userId },
      { is_read: true, read_at: new Date() }
    );
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepo.update(
      { user_id: userId, is_read: false },
      { is_read: true, read_at: new Date() }
    );
  }
}
```

### 3. Email Queue Processor

```typescript
// File: backend/src/modules/notification/processors/email.processor.ts
import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';

@Processor('email')
export class EmailProcessor {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  @Process('send-email')
  async sendEmail(job: Job<any>) {
    const { to, subject, template, context } = job.data;

    // Load template
    const templatePath = `./templates/emails/${template}.hbs`;
    const templateSource = await fs.readFile(templatePath, 'utf-8');
    const compiledTemplate = handlebars.compile(templateSource);
    const html = compiledTemplate(context);

    // Send email
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
  }
}
```

### 4. LINE Notify Processor

```typescript
// File: backend/src/modules/notification/processors/line-notify.processor.ts
@Processor('line-notify')
export class LineNotifyProcessor {
  @Process('send-line')
  async sendLineNotify(job: Job<any>) {
    const { token, message } = job.data;

    await axios.post(
      'https://notify-api.line.me/api/notify',
      `message=${encodeURIComponent(message)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${token}`,
        },
      }
    );
  }
}
```

### 5. Audit Log Service

```typescript
// File: backend/src/modules/audit/audit.service.ts
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>
  ) {}

  async log(dto: CreateAuditLogDto): Promise<void> {
    const auditLog = this.auditRepo.create({
      user_id: dto.user_id,
      action: dto.action,
      entity_type: dto.entity_type,
      entity_id: dto.entity_id,
      changes: dto.changes,
      ip_address: dto.ip_address,
      user_agent: dto.user_agent,
    });

    await this.auditRepo.save(auditLog);
  }

  async findByEntity(
    entityType: string,
    entityId: number
  ): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { entity_type: entityType, entity_id: entityId },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  async findByUser(userId: number, limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async exportToCsv(query: AuditQueryDto): Promise<string> {
    const logs = await this.auditRepo.find({
      where: this.buildWhereClause(query),
      relations: ['user'],
      order: { created_at: 'DESC' },
    });

    // Generate CSV
    const csv = logs
      .map((log) =>
        [
          log.created_at,
          log.user.username,
          log.action,
          log.entity_type,
          log.entity_id,
          log.ip_address,
        ].join(',')
      )
      .join('\n');

    return `Timestamp,User,Action,Entity Type,Entity ID,IP Address\n${csv}`;
  }
}
```

### 6. Audit Interceptor

```typescript
// File: backend/src/common/interceptors/audit.interceptor.ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers } = request;

    // Only audit write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        // Extract entity info from URL
        const match = url.match(/\/(\w+)\/(\d+)?/);
        if (match) {
          const [, entityType, entityId] = match;

          await this.auditService.log({
            user_id: user?.user_id,
            action: `${method} ${entityType}`,
            entity_type: entityType,
            entity_id: entityId ? parseInt(entityId) : null,
            changes: JSON.stringify(request.body),
            ip_address: ip,
            user_agent: headers['user-agent'],
          });
        }
      })
    );
  }
}
```

### 7. Controllers

```typescript
// File: backend/src/modules/notification/notification.controller.ts
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private service: NotificationService) {}

  @Get('my')
  async getMyNotifications(
    @CurrentUser() user: User,
    @Query('unread_only') unreadOnly: boolean
  ) {
    return this.service.getUserNotifications(user.user_id, unreadOnly);
  }

  @Post(':id/read')
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User
  ) {
    return this.service.markAsRead(id, user.user_id);
  }

  @Post('read-all')
  async markAllAsRead(@CurrentUser() user: User) {
    return this.service.markAllAsRead(user.user_id);
  }
}
```

```typescript
// File: backend/src/modules/audit/audit.controller.ts
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(private service: AuditService) {}

  @Get('entity/:type/:id')
  @RequirePermission('audit.view')
  async getEntityAuditLogs(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.service.findByEntity(type, id);
  }

  @Get('export')
  @RequirePermission('audit.export')
  async exportAuditLogs(@Query() query: AuditQueryDto, @Res() res: Response) {
    const csv = await this.service.exportToCsv(query);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
describe('NotificationService', () => {
  it('should create in-app notification', async () => {
    const result = await service.createNotification({
      user_id: 1,
      type: 'info',
      title: 'Test',
      message: 'Test message',
    });

    expect(result.id).toBeDefined();
  });

  it('should queue email for sending', async () => {
    await service.sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      template: 'test',
      context: {},
    });

    expect(emailQueue.add).toHaveBeenCalled();
  });
});

describe('AuditService', () => {
  it('should log audit event', async () => {
    await service.log({
      user_id: 1,
      action: 'CREATE correspondence',
      entity_type: 'correspondence',
      entity_id: 10,
    });

    const logs = await service.findByEntity('correspondence', 10);
    expect(logs).toHaveLength(1);
  });
});
```

---

## 📚 Related Documents

- [System Architecture - Notifications](../02-architecture/system-architecture.md#notifications)

---

## 📦 Deliverables

- [ ] NotificationService (Email, LINE, In-App)
- [ ] Email & LINE Queue Processors
- [ ] Email Templates (Handlebars)
- [ ] AuditService
- [ ] Audit Interceptor
- [ ] Controllers
- [ ] Unit Tests (75% coverage)
- [ ] API Documentation

---

## 🚨 Risks & Mitigation

| Risk                  | Impact | Mitigation                 |
| --------------------- | ------ | -------------------------- |
| Email service down    | Low    | Queue retry logic          |
| LINE token expiration | Low    | Token refresh mechanism    |
| Audit log volume      | Medium | Archive old logs, indexing |

---

## 📌 Notes

- Email sent via queue (async)
- LINE Notify requires user token setup
- In-app notifications stored in DB
- Audit logs auto-generated via interceptor
- Export audit logs to CSV
- Email templates use Handlebars

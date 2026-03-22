# ADR-008: Email & Notification Strategy

**Status:** ✅ Accepted (Pending Review)
**Date:** 2026-02-24
**Decision Makers:** Backend Team, System Architect
**Related Documents:** [Backend Guidelines](../03-implementation/03-02-backend-guidelines.md), [TASK-BE-011](../06-tasks/README.md)

---

## Context and Problem Statement

ระบบ LCBP3-DMS ต้องการส่งการแจ้งเตือนให้ผู้ใช้งานผ่านหลายช่องทาง (Email, LINE Notify, In-App) เมื่อมี Events สำคัญเกิดขึ้น เช่น Correspondence ได้รับการอนุมัติ, RFA ถูก Review, Workflow เปลี่ยนสถานะ

### ปัญหาที่ต้องแก้:

1. **Multi-Channel:** รองรับหลายช่องทางการแจ้งเตือน (Email, LINE, In-app)
2. **Reliability:** ทำอย่างไรให้การส่ง Email ไม่ Block main request
3. **Retry Logic:** จัดการ Email delivery failures อย่างไร
4. **Template Management:** จัดการ Email templates อย่างไรให้ Maintainable
5. **User Preferences:** ให้ User เลือก Channel ที่ต้องการได้อย่างไร

---

## Decision Drivers

- ⚡ **Performance:** ส่ง Email ต้องไม่ทำให้ API Response ช้า
- 🔄 **Reliability:** Email ส่งไม่สำเร็จต้อง Retry ได้
- 🎨 **Branding:** Email template ต้องดูเป็นมืออาชีพ
- 🛠️ **Maintainability:** แก้ไข Template ได้ง่าย
- 📱 **Multi-Channel:** รองรับ Email, LINE, In-app notification

---

## Considered Options

### Option 1: Sync Email Sending (ส่งทันที ใน Request)

**Implementation:**

```typescript
await this.emailService.sendEmail({ to, subject, body });
return { success: true };
```

**Pros:**

- ✅ Simple implementation
- ✅ ง่ายต่อการ Debug

**Cons:**

- ❌ Block API response (slow)
- ❌ หาก SMTP server down จะ Timeout
- ❌ ไม่มี Retry mechanism

### Option 2: Async with Event Emitter (NestJS EventEmitter)

**Implementation:**

```typescript
this.eventEmitter.emit('correspondence.approved', { correspondenceId });
// Return immediately
return { success: true };

// Listener
@OnEvent('correspondence.approved')
async handleApproved(payload) {
  await this.emailService.sendEmail(...);
}
```

**Pros:**

- ✅ Non-blocking (async)
- ✅ Decoupled

**Cons:**

- ❌ ไม่มี Retry หาก Event listener fail
- ❌ Lost jobs หาก Server restart

### Option 3: Message Queue (BullMQ + Redis)

**Implementation:**

```typescript
await this.emailQueue.add('send-email', {
  to,
  subject,
  template,
  context,
});
```

**Pros:**

- ✅ Non-blocking (async)
- ✅ Persistent (Store in Redis)
- ✅ Built-in Retry mechanism
- ✅ Job monitoring & management
- ✅ Scalable (Multiple workers)

**Cons:**

- ❌ Requires Redis infrastructure
- ❌ More complex setup

---

## Decision Outcome

**Chosen Option:** **Option 3 - Message Queue (BullMQ + Redis)**

### Rationale

1. **Performance:** ไม่ Block API response, ส่ง Email แบบ Async
2. **Reliability:** Persistent jobs ใน Redis, มี Retry mechanism
3. **Scalability:** สามารถ Scale workers แยกได้
4. **Monitoring:** ดู Job status, Failed jobs ได้
5. **Infrastructure:** Redis มีอยู่แล้วสำหรับ Locking และ Caching (ADR-006)

---

## Implementation Details

### 1. Email Queue Setup

```typescript
// File: backend/src/modules/notification/notification.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email',
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
    }),
    BullModule.registerQueue({
      name: 'line-notify',
    }),
  ],
  providers: [NotificationService, EmailProcessor, LineNotifyProcessor],
})
export class NotificationModule {}
```

### 2. Queue Email Job

```typescript
// File: backend/src/modules/notification/notification.service.ts
@Injectable()
export class NotificationService {
  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('line-notify') private lineQueue: Queue
  ) {}

  async sendEmailNotification(dto: SendEmailDto): Promise<void> {
    await this.emailQueue.add(
      'send-email',
      {
        to: dto.to,
        subject: dto.subject,
        template: dto.template, // e.g., 'correspondence-approved'
        context: dto.context, // Template variables
      },
      {
        attempts: 3, // Retry 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5s delay
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24h
        },
        removeOnFail: false, // Keep failed jobs for debugging
      }
    );
  }

  async sendLineNotification(dto: SendLineDto): Promise<void> {
    await this.lineQueue.add('send-line', {
      token: dto.token,
      message: dto.message,
    });
  }
}
```

### 3. Email Processor (Worker)

```typescript
// File: backend/src/modules/notification/processors/email.processor.ts
import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs/promises';

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
  async handleSendEmail(job: Job) {
    const { to, subject, template, context } = job.data;

    try {
      // Load and compile template
      const templatePath = `./templates/emails/${template}.hbs`;
      const templateSource = await fs.readFile(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateSource);
      const html = compiledTemplate(context);

      // Send email
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        html,
      });

      console.log('Email sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error; // Will trigger retry
    }
  }
}
```

### 4. Email Template (Handlebars)

```handlebars
<!-- File: backend/templates/emails/correspondence-approved.hbs -->

<html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        background: #007bff;
        color: white;
        padding: 20px;
      }
      .content {
        padding: 20px;
      }
      .button {
        background: #007bff;
        color: white;
        padding: 10px 20px;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class='container'>
      <div class='header'>
        <h1>Correspondence Approved</h1>
      </div>
      <div class='content'>
        <p>สวัสดีคุณ {{userName}},</p>
        <p>เอกสาร <strong>{{documentNumber}}</strong> ได้รับการอนุมัติแล้ว</p>
        <p><strong>Subject:</strong> {{subject}}</p>
        <p><strong>Approved by:</strong> {{approver}}</p>
        <p><strong>Date:</strong> {{approvedDate}}</p>
        <p>
          <a href='{{documentUrl}}' class='button'>ดูเอกสาร</a>
        </p>
      </div>
    </div>
  </body>
</html>
```

### 5. Workflow Event → Email Notification

```typescript
// File: backend/src/modules/workflow/workflow.service.ts
async executeTransition(workflowId: number, action: string) {
  // ... Execute transition logic

  // Send notifications
  await this.notificationService.notifyWorkflowTransition(
    workflowId,
    action,
    currentUserId,
  );
}
```

```typescript
// File: backend/src/modules/notification/notification.service.ts
async notifyWorkflowTransition(
  workflowId: number,
  action: string,
  actorId: number,
) {
  // Get users to notify
  const users = await this.getRelevantUsers(workflowId);

  for (const user of users) {
    // In-app notification
    await this.createNotification({
      user_id: user.user_id,
      type: 'workflow_transition',
      title: `${action} completed`,
      message: `Workflow ${workflowId} has been ${action}`,
      link: `/workflows/${workflowId}`,
    });

    // Email (if enabled)
    if (user.email_notifications_enabled) {
      await this.sendEmailNotification({
        to: user.email,
        subject: `Workflow Update: ${action}`,
        template: 'workflow-transition',
        context: {
          userName: user.first_name,
          action,
          workflowId,
          documentUrl: `${process.env.FRONTEND_URL}/workflows/${workflowId}`,
        },
      });
    }

    // LINE Notify (if enabled)
    if (user.line_notify_token) {
      await this.sendLineNotification({
        token: user.line_notify_token,
        message: `[LCBP3-DMS] Workflow ${workflowId}: ${action}`,
      });
    }
  }
}
```

---

## Consequences

### Positive Consequences

1. ✅ **Performance:** API responses ไม่ถูก Block โดยการส่ง Email
2. ✅ **Reliability:** Jobs ถูกเก็บใน Redis ไม่สูญหายหาก Server restart
3. ✅ **Retry:** Automatic retry สำหรับ Failed jobs
4. ✅ **Monitoring:** ดู Job status, Failed jobs ผ่าน Bull Board
5. ✅ **Scalability:** เพิ่ม Email workers ได้ตามต้องการ
6. ✅ **Multi-Channel:** รองรับ Email, LINE, In-app notification

### Negative Consequences

1. ❌ **Delayed Delivery:** Email ส่งแบบ Async อาจมี Delay เล็กน้อย
2. ❌ **Dependency on Redis:** หาก Redis down ก็ส่ง Email ไม่ได้
3. ❌ **Template Management:** ต้อง Maintain Handlebars templates แยก

### Mitigation Strategies

- **Redis Monitoring:** ตั้ง Alert หาก Redis down
- **Template Versioning:** เก็บ Email templates ใน Git
- **Fallback:** หาก Redis ล้ม อาจ Fallback เป็น Sync sending ชั่วคราว
- **Testing:** ใช้ Mailtrap/MailHog สำหรับ Testing ใน Development

---

## Related ADRs

- [ADR-006: Redis Caching Strategy](./ADR-006-redis-caching-strategy.md) - ใช้ Redis สำหรับ Queue
- [TASK-BE-011: Notification & Audit](../06-tasks/README.md)

---

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Handlebars Documentation](https://handlebarsjs.com/)

---

**Last Updated:** 2025-12-01
**Next Review:** 2025-06-01

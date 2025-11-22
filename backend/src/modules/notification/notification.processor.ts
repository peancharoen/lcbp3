import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import axios from 'axios';

import { UserService } from '../user/user.service';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  private mailerTransport: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    super();
    // Setup Nodemailer
    this.mailerTransport = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.debug(`Processing job ${job.name} for user ${job.data.userId}`);

    switch (job.name) {
      case 'send-email':
        return this.handleSendEmail(job.data);
      case 'send-line':
        return this.handleSendLine(job.data);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async handleSendEmail(data: any) {
    const user = await this.userService.findOne(data.userId);
    if (!user || !user.email) {
      this.logger.warn(`User ${data.userId} has no email`);
      return;
    }

    await this.mailerTransport.sendMail({
      from: '"LCBP3 DMS" <no-reply@np-dms.work>',
      to: user.email,
      subject: `[DMS] ${data.title}`,
      html: `
        <h3>${data.title}</h3>
        <p>${data.message}</p>
        <br/>
        <a href="${data.link}">คลิกเพื่อดูรายละเอียด</a>
      `,
    });
    this.logger.log(`Email sent to ${user.email}`);
  }

  private async handleSendLine(data: any) {
    const user = await this.userService.findOne(data.userId);
    // ตรวจสอบว่า User มี Line ID หรือไม่ (หรือใช้ Group Token ถ้าเป็นระบบรวม)
    // ในที่นี้สมมติว่าเรายิงเข้า n8n webhook เพื่อจัดการต่อ
    const n8nWebhookUrl = this.configService.get('N8N_LINE_WEBHOOK_URL');

    if (!n8nWebhookUrl) {
      this.logger.warn('N8N_LINE_WEBHOOK_URL not configured');
      return;
    }

    try {
      await axios.post(n8nWebhookUrl, {
        userId: user.user_id, // หรือ user.lineId ถ้ามี
        message: `${data.title}\n${data.message}`,
        link: data.link,
      });
      this.logger.log(`Line notification sent via n8n for user ${data.userId}`);
    } catch (error: any) {
      throw new Error(`Failed to send Line notification: ${error.message}`);
    }
  }
}

// File: src/modules/monitoring/logger/winston.config.ts
import {
  utilities as nestWinstonUtilities,
  WinstonModuleOptions,
} from 'nest-winston';
import * as winston from 'winston';

/**
 * ฟังก์ชันสร้าง Configuration สำหรับ Winston Logger
 * - Development: แสดงผลแบบ Console อ่านง่าย
 * - Production: แสดงผลแบบ JSON พร้อม Timestamp เพื่อการทำ Log Aggregation
 */
export const winstonConfig: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        // เลือก Format ตาม Environment
        process.env.NODE_ENV === 'production'
          ? winston.format.json() // Production ใช้ JSON
          : nestWinstonUtilities.format.nestLike('LCBP3-DMS', {
              prettyPrint: true,
              colors: true,
            }),
      ),
    }),
    // สามารถเพิ่ม File Transport หรือ HTTP Transport ไปยัง Log Server ได้ที่นี่
  ],
};

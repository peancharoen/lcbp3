// File: src/modules/user/user-preference.service.ts
// บันทึกการแก้ไข: Service จัดการการตั้งค่าส่วนตัว (T1.3)

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from './entities/user-preference.entity';
import { UpdatePreferenceDto } from './dto/update-preference.dto';

@Injectable()
export class UserPreferenceService {
  constructor(
    @InjectRepository(UserPreference)
    private prefRepo: Repository<UserPreference>,
  ) {}

  // ดึง Preference ของ User (ถ้าไม่มีให้สร้าง Default)
  async findByUser(userId: number): Promise<UserPreference> {
    let pref = await this.prefRepo.findOne({ where: { userId } });

    if (!pref) {
      pref = this.prefRepo.create({
        userId,
        notifyEmail: true,
        notifyLine: true,
        digestMode: false,
        uiTheme: 'light',
      });
      await this.prefRepo.save(pref);
    }

    return pref;
  }

  // อัปเดต Preference
  async update(
    userId: number,
    dto: UpdatePreferenceDto,
  ): Promise<UserPreference> {
    const pref = await this.findByUser(userId);

    // Merge ข้อมูลใหม่
    this.prefRepo.merge(pref, dto);

    return this.prefRepo.save(pref);
  }
}

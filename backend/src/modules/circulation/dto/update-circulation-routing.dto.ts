import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum CirculationAction {
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  // IN_PROGRESS อาจจะไม่ต้องส่งมา เพราะเป็น auto state ตอนเริ่มดู
}

export class UpdateCirculationRoutingDto {
  @IsEnum(CirculationAction)
  status!: string; // สถานะที่ต้องการอัปเดต

  @IsString()
  @IsOptional()
  comments?: string; // ความคิดเห็นเพิ่มเติม
}

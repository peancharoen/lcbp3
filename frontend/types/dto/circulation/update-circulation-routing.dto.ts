export enum CirculationAction {
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  // IN_PROGRESS อาจจะไม่ต้องส่งมา เพราะเป็น auto state ตอนเริ่มดู
}

export interface UpdateCirculationRoutingDto {
  status: string; // สถานะที่ต้องการอัปเดต

  comments?: string; // ความคิดเห็นเพิ่มเติม
}

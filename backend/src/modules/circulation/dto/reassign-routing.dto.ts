import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReassignRoutingDto {
  @ApiProperty({
    description: 'publicId (UUID) ของผู้ใช้คนใหม่ที่ได้รับมอบหมาย',
  })
  @IsUUID('all')
  @IsNotEmpty()
  newAssigneeId!: string;
}

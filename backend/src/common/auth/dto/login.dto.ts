import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Username (Email)',
    example: 'admin@np-dms.work',
  })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ description: 'Password', example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AutController } from './aut/aut.controller';

@Module({
  imports: [AuthModule],
  controllers: [AutController]
})
export class CommonModule {}

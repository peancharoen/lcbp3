// File: src/modules/user/dto/update-preference.dto.ts
import { IsBoolean, IsOptional, IsString, IsIn } from 'class-validator';

export class UpdatePreferenceDto {
  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyLine?: boolean;

  @IsOptional()
  @IsBoolean()
  digestMode?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark', 'system'])
  uiTheme?: string;
}

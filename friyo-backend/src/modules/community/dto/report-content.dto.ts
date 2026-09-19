import { IsEnum, IsUUID, IsString, MinLength, MaxLength } from 'class-validator';
import { ContentType } from '../../../database/entities/content-report.entity';

export class ReportContentDto {
  @IsEnum(ContentType)
  content_type: ContentType;

  @IsUUID('4')
  content_id: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

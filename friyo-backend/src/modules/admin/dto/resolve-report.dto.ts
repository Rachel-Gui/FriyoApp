import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus } from '../../../database/entities/content-report.entity';

export class ResolveReportDto {
  @ApiProperty({ enum: [ReportStatus.RESOLVED, ReportStatus.DISMISSED] })
  @IsEnum([ReportStatus.RESOLVED, ReportStatus.DISMISSED])
  action: ReportStatus.RESOLVED | ReportStatus.DISMISSED;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgreementType } from '../../../database/entities/agreement.entity';

export class CreateAgreementDto {
  @ApiProperty({ enum: AgreementType }) @IsEnum(AgreementType) type: AgreementType;
  @ApiProperty({ example: '1.0.0' }) @IsString() @IsNotEmpty() version: string;
  @ApiProperty() @IsString() @IsNotEmpty() content: string;

  @ApiPropertyOptional({ description: 'Publish immediately and mark as current' })
  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}

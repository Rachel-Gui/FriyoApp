import { IsString, IsNotEmpty, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendPushDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsString() @IsNotEmpty() body: string;

  /** Omit to broadcast to all users */
  @ApiPropertyOptional({ type: [String], description: 'Specific user IDs; omit for broadcast' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  userIds?: string[];

  @ApiPropertyOptional({ type: Object }) @IsOptional() data?: Record<string, string>;
}

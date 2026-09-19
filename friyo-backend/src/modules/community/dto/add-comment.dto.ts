import { IsString, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';

export class AddCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @IsOptional()
  @IsUUID('4')
  parent_comment_id?: string;
}

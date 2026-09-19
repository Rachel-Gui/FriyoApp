import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// Photos come as multipart files, not in this DTO.
// This DTO captures the text fields from the multipart form body.
export class CreatePostDto {
  @IsOptional()
  @IsUUID('4')
  recipe_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;
}

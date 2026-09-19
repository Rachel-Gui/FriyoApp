import { IsUUID, IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MergeIngredientsDto {
  @ApiProperty({ description: 'The canonical ingredient to keep' })
  @IsUUID()
  targetId: string;

  @ApiProperty({ description: 'IDs of duplicate ingredients to be merged into targetId', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  sourceIds: string[];
}

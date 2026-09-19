import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({
    example: 'DELETE',
    description: 'Explicit confirmation required before permanently deleting the account.',
  })
  @IsIn(['DELETE'])
  confirmation: 'DELETE';
}

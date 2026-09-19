import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User }        from '../../database/entities/user.entity';
import { UserProfile } from '../../database/entities/user-profile.entity';

import { AuthModule }      from '../auth/auth.module';
import { UsersController } from './users.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notifications.push' }),
    TypeOrmModule.forFeature([User, UserProfile]),
    AuthModule,
  ],
  controllers: [UsersController],
})
export class UsersModule {}

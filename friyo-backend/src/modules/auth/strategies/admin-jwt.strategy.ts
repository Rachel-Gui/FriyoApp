import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminJwtPayload } from '../interfaces/jwt-payload.interface';
import { AdminUser } from '../../../database/entities/admin-user.entity';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(AdminUser) private readonly adminRepo: Repository<AdminUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.adminSecret') ?? '',
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AdminUser> {
    if (payload.type !== 'admin') {
      throw new UnauthorizedException('Invalid token type');
    }

    const admin = await this.adminRepo.findOne({
      where: { id: payload.sub, isActive: true },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin account not found or disabled');
    }

    return admin;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '../../../database/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? '',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<User> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub, isActive: true, isBanned: false },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or account disabled');
    }

    if (user.passwordChangedAt && (!payload.iat || payload.iat * 1000 <= user.passwordChangedAt.getTime())) {
      throw new UnauthorizedException('Password changed. Please sign in again');
    }

    // Expose jti so logout controller can read it from req.jti
    (req as Request & { jti: string }).jti = payload.jti;

    return user;
  }
}

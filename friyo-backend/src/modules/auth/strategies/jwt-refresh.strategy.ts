import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenService } from '../token.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '../../../database/entities/user.entity';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    private readonly tokenService: TokenService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.refreshSecret') ?? '',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<{ user: User; jti: string; token: string }> {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const incomingToken: string = (req.body as { refresh_token: string }).refresh_token;

    await this.tokenService.validateRefreshToken(payload.sub, payload.jti, incomingToken);

    const user = await this.userRepo.findOne({
      where: { id: payload.sub, isActive: true, isBanned: false },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or account disabled');
    }

    return { user, jti: payload.jti, token: incomingToken };
  }
}

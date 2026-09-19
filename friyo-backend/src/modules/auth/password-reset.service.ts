import { Injectable, Inject, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { randomBytes, createHash } from 'crypto';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as bcrypt from 'bcrypt';
import { User, AuthProvider } from '../../database/entities/user.entity';
import { TokenService } from './token.service';

@Injectable()
export class PasswordResetService {
  private readonly ses: SESClient;
  constructor(private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly tokens: TokenService) {
    this.ses = new SESClient({ region: config.get<string>('AWS_REGION') || 'us-east-1' });
  }
  private key(email: string) { return `password-reset:${createHash('sha256').update(email).digest('hex')}`; }
  async request(email: string) {
    const from = this.config.get<string>('AWS_SES_FROM_EMAIL');
    if (!from) throw new ServiceUnavailableException('Password recovery is temporarily unavailable');
    // Use the same response for existing and unknown addresses.
    const user = await this.users.findOne({ where: { email, isActive: true, isBanned: false, authProvider: AuthProvider.LOCAL } });
    if (user) {
      const code = randomBytes(16).toString('hex');
      const hash = createHash('sha256').update(code).digest('hex');
      await this.redis.set(this.key(email), JSON.stringify({ userId: user.id, hash }), 'EX', 900);
      try {
        await this.ses.send(new SendEmailCommand({ Source: from, Destination: { ToAddresses: [email] },
          Message: { Subject: { Data: 'Reset your Friyo password' }, Body: { Text: { Data:
            `Your Friyo password reset code is:\n\n${code}\n\nOpen Friyo → Forgot Password, then paste this code. It expires in 15 minutes. If you did not request this, ignore this email.` } } } }));
      } catch {
        await this.redis.del(this.key(email));
        throw new ServiceUnavailableException('Password recovery is temporarily unavailable');
      }
    }
    return { message: 'If an eligible account exists, a reset code has been sent.' };
  }
  async reset(email: string, code: string, password: string) {
    if (Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('Password must be at most 72 UTF-8 bytes');
    const key = this.key(email);
    const raw = await this.redis.get(key);
    if (!raw) throw new BadRequestException('Reset code is invalid or expired');
    const record = JSON.parse(raw);
    if (createHash('sha256').update(code).digest('hex') !== record.hash) throw new BadRequestException('Reset code is invalid or expired');
    const passwordHash = await bcrypt.hash(password, 12);
    const consumed = await this.redis.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, key, raw);
    if (!consumed) throw new BadRequestException('Reset code is invalid or expired');
    await this.tokens.deleteAllUserRefreshTokens(record.userId);
    await this.users.update(record.userId, { passwordHash, passwordChangedAt: new Date() });
    return { message: 'Password updated. Please sign in again.' };
  }
}

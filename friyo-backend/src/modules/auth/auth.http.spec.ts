import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import request = require('supertest');
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { PasswordResetService } from './password-reset.service';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';

// Real Nest / Express HTTP stack; external providers and database are replaced.
describe('authentication HTTP contract', () => {
  let app: INestApplication;
  const auth = { register: jest.fn(), login: jest.fn(), refresh: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: SocialAuthService, useValue: {} },
        { provide: PasswordResetService, useValue: {} },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  it('rejects invalid registration before reaching persistence', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: 'bad', password: 'short', name: 'Test' }).expect(400);
    expect(auth.register).not.toHaveBeenCalled();
  });
  it('wraps rotated tokens in the exact mobile response envelope', async () => {
    auth.refresh.mockResolvedValue({ access_token: 'access', refresh_token: 'refresh' });
    const res = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refresh_token: 'existing' }).expect(200);
    expect(res.body).toMatchObject({ success: true, data: { access_token: 'access', refresh_token: 'refresh' } });
  });
  it('enforces the configured login limit instead of only declaring metadata', async () => {
    auth.login.mockResolvedValue({ access_token: 'access' });
    for (let i = 0; i < 5; i++) await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'a@example.com', password: 'password' }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'a@example.com', password: 'password' }).expect(429);
    expect(auth.login).toHaveBeenCalledTimes(5);
  });
});

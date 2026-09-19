jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));
jest.mock('@aws-sdk/client-ses', () => ({ SESClient: jest.fn().mockImplementation(() => ({ send: jest.fn() })), SendEmailCommand: jest.fn() }));
import { createHash } from 'crypto';
import { PasswordResetService } from './password-reset.service';
describe('password recovery', () => {
  const users = { findOne: jest.fn(), update: jest.fn() };
  const redis = { get: jest.fn(), eval: jest.fn(), set: jest.fn() };
  const tokens = { deleteAllUserRefreshTokens: jest.fn() };
  let service: PasswordResetService;
  beforeEach(() => { jest.clearAllMocks(); service = new PasswordResetService({ get: () => 'configured' } as any, users as any, redis as any, tokens as any); });
  it('does not disclose whether an account exists', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(service.request('missing@example.com')).resolves.toEqual({ message: 'If an eligible account exists, a reset code has been sent.' });
  });
  it('rejects wrong codes without changing passwords', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ userId: 'u', hash: 'wrong' }));
    await expect(service.reset('a@example.com','code','new-password')).rejects.toThrow('invalid or expired');
    expect(users.update).not.toHaveBeenCalled();
  });
  it('consumes the code once and revokes all sessions on reset', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ userId: 'u', hash: createHash('sha256').update('code').digest('hex') }));
    redis.eval.mockResolvedValue(1);
    await service.reset('a@example.com','code','new-password');
    expect(tokens.deleteAllUserRefreshTokens).toHaveBeenCalledWith('u');
    expect(users.update).toHaveBeenCalledWith('u', { passwordHash: 'hashed-password', passwordChangedAt: expect.any(Date) });
    redis.eval.mockResolvedValue(0);
    await expect(service.reset('a@example.com','code','new-password')).rejects.toThrow('invalid or expired');
    expect(users.update).toHaveBeenCalledTimes(1);
  });
});

jest.mock('bcrypt', () => ({}));
import { TokenService } from './token.service';
describe('refresh rotation', () => {
  it('consumes an exact refresh token atomically; concurrent reuse is rejected', async () => {
    const redis = { eval: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0) };
    const service = new TokenService({} as any, {} as any, redis as any);
    await expect(service.validateRefreshToken('u','j','token')).resolves.toBeUndefined();
    await expect(service.validateRefreshToken('u','j','token')).rejects.toThrow('invalid or has expired');
    expect(redis.eval.mock.calls[0].slice(1)).toEqual([1,'refresh:u:j','token']);
  });
  it('rejects a signed token of the wrong type', () => {
    const service = new TokenService({ verify: () => ({ sub: 'u', jti: 'j', type: 'access' }) } as any, { get: () => 'secret' } as any, {} as any);
    expect(() => service.decodeRefreshPayload('token')).toThrow('Invalid refresh token');
  });
});

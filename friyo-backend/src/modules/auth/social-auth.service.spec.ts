jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('jose', () => ({ createRemoteJWKSet: jest.fn(), jwtVerify: jest.fn() }));
import { jwtVerify } from 'jose';
import { SocialAuthService } from './social-auth.service';

describe('native social authentication', () => {
  const verify = jwtVerify as jest.Mock;
  const auth = { findOrCreateOAuthUser: jest.fn(), oauthCallback: jest.fn() };
  const redis = { set: jest.fn(), eval: jest.fn() };
  let service: SocialAuthService;
  beforeEach(() => {
    jest.resetAllMocks();
    service = new SocialAuthService({ get: (key: string) => ({ GOOGLE_CLIENT_IDS: 'web-client,ios-client', APPLE_CLIENT_ID: 'com.friyo.app' }[key]) } as any, auth as any, redis as any, {} as any);
  });
  it('rejects invalid signatures without creating accounts', async () => {
    verify.mockRejectedValue(new Error('bad signature'));
    await expect(service.google('forged')).rejects.toThrow('Invalid Google');
    expect(auth.findOrCreateOAuthUser).not.toHaveBeenCalled();
  });
  it('verifies audience, issuer and algorithm before accepting a verified email', async () => {
    verify.mockResolvedValue({ payload: { sub: 'google-id', email: 'a@example.com', email_verified: true } });
    auth.findOrCreateOAuthUser.mockResolvedValue({ id: 'user' }); auth.oauthCallback.mockResolvedValue({ access_token: 'app-token' });
    await expect(service.google('valid')).resolves.toEqual({ access_token: 'app-token' });
    expect(verify.mock.calls[0][2]).toEqual({ audience: ['web-client','ios-client'], issuer: ['https://accounts.google.com','accounts.google.com'], algorithms: ['RS256'] });
  });
  it('rejects unverified Google email', async () => {
    verify.mockResolvedValue({ payload: { sub: 'google-id', email: 'a@example.com', email_verified: false } });
    await expect(service.google('token')).rejects.toThrow('Invalid Google');
  });
  it('rejects an Apple nonce mismatch before exchanging any code', async () => {
    verify.mockResolvedValue({ payload: { sub: 'apple-id', nonce: 'other' } });
    await expect(service.apple('token','code','expected')).rejects.toThrow('Invalid or expired');
    expect(redis.eval).not.toHaveBeenCalled();
  });
  it('rejects a replayed Apple challenge', async () => {
    verify.mockResolvedValue({ payload: { sub: 'apple-id', nonce: 'expected' } }); redis.eval.mockResolvedValue(null);
    await expect(service.apple('token','code','expected')).rejects.toThrow('Invalid or expired');
  });
});

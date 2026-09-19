import { validateEnvironment } from './validate-env';
describe('production environment', () => {
  it('allows a minimal local development environment', () => expect(validateEnvironment({ NODE_ENV: 'development' })).toEqual({ NODE_ENV: 'development' }));
  it('blocks missing production integration credentials', () => expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow('GOOGLE_CLIENT_IDS'));
  it('does not print secret values when validation fails', () => {
    try { validateEnvironment({ NODE_ENV: 'production', JWT_SECRET: 'private-value' }); }
    catch (error) { expect((error as Error).message).not.toContain('private-value'); }
  });
});

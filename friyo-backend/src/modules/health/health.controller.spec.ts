import { HealthController } from './health.controller';
describe('deployment readiness', () => {
  it('reports healthy only when both dependencies respond', async () => {
    const controller = new HealthController({ query: async () => [] } as any, { ping: async () => 'PONG' } as any);
    expect((await controller.check()).status).toBe('ok');
  });
  it('returns HTTP 503 if Redis is unavailable', async () => {
    const controller = new HealthController({ query: async () => [] } as any, { ping: async () => { throw Error(); } } as any);
    await expect(controller.check()).rejects.toMatchObject({ status: 503 });
  });
});

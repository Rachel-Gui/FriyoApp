import { AiUsageService } from './ai-usage.service';
describe('server AI allowance', () => {
  const create = (expires: Date | null, limit: number, accepted = 1) => {
    const redis = { get: jest.fn().mockResolvedValue('3'), eval: jest.fn().mockResolvedValue(accepted) };
    const usage = new AiUsageService({ findOneByOrFail: async () => ({ vipExpiresAt: expires }) } as any, redis as any, { get: () => limit } as any);
    return { usage, redis };
  };
  it('active VIP bypasses daily allowance but expired VIP does not', async () => {
    const vip = create(new Date(Date.now() + 60000), 5); await vip.usage.consume('a');
    expect((await vip.usage.status('a')).plan).toBe('vip'); expect(vip.redis.eval).not.toHaveBeenCalled();
    const expired = create(new Date(Date.now() - 60000), 5); await expired.usage.consume('a');
    expect((await expired.usage.status('a')).remaining).toBe(2); expect(expired.redis.eval).toHaveBeenCalled();
  });
  it('rejects exhausted allowance using the atomic server result', async () => {
    await expect(create(null, 5, 0).usage.consume('a')).rejects.toMatchObject({ status: 429 });
  });
  it('preserves existing free access until a limit is configured', async () => {
    const { usage, redis } = create(null, 0); await usage.consume('a'); expect(redis.eval).not.toHaveBeenCalled();
  });
});

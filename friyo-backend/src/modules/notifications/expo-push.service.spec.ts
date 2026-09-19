jest.mock('bcrypt', () => ({}));
import { ExpoPushService } from './expo-push.service';
describe('Expo push delivery', () => {
  let service: ExpoPushService;
  const queue = { add: jest.fn() }, tokens = { update: jest.fn() };
  const originalFetch = global.fetch;
  beforeEach(() => { jest.clearAllMocks(); service = new ExpoPushService({ get: () => undefined } as any, queue as any, tokens as any); });
  afterAll(() => { global.fetch = originalFetch; });
  function returns(data: unknown) { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }); }
  it('queues a delayed receipt check after ticket acceptance', async () => {
    returns({ status: 'ok', id: 'ticket' });
    await service.send('ExpoPushToken[token]', 'Title','Body');
    expect(queue.add).toHaveBeenCalledWith('expo-receipt', { id: 'ticket', token: 'ExpoPushToken[token]' }, expect.objectContaining({ delay: 900000, attempts: 4 }));
  });
  it('deactivates only a permanently unregistered token', async () => {
    returns({ status: 'error', details: { error: 'DeviceNotRegistered' } });
    await service.send('token','Title','Body');
    expect(tokens.update).toHaveBeenCalledWith({ token: 'token' }, { isActive: false });
  });
  it('leaves tokens active on provider credential errors and allows queue retry', async () => {
    returns({ status: 'error', details: { error: 'InvalidCredentials' } });
    await expect(service.send('token','Title','Body')).rejects.toThrow('InvalidCredentials');
    expect(tokens.update).not.toHaveBeenCalled();
  });
  it('checks eventual delivery failure, not only HTTP acceptance', async () => {
    returns({ ticket: { status: 'error', details: { error: 'DeviceNotRegistered' } } });
    await service.receipt({ data: { id: 'ticket', token: 'token' } } as any);
    expect(tokens.update).toHaveBeenCalledWith({ token: 'token' }, { isActive: false });
  });
});

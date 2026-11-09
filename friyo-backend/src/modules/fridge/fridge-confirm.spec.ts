import { FridgeService } from './fridge.service';
import { ScanSession, ScanStatus } from '../../database/entities/scan-session.entity';
import { FridgeItem } from '../../database/entities/fridge-item.entity';

function setup(session: any) {
  const service: any = Object.create(FridgeService.prototype);
  const items = [{ id: 'item', userId: 'user', scanSessionId: 'scan' }];
  const manager = { findOne: jest.fn(async () => session), find: jest.fn(async () => items), create: jest.fn((_entity, item) => ({ id: 'item', ...item })), save: jest.fn(async (_entity, item) => item), update: jest.fn(async (_entity, _id, patch) => Object.assign(session, patch)) };
  service.dataSource = { transaction: (cb: any) => cb(manager) };
  service.fridgeItemRepo = { find: async () => items };
  service.toFridgeItemResponse = (item: any) => item;
  return { service, manager };
}
describe('scan confirmation', () => {
  it('locks owned session and reuses its stock after a successful retry', async () => {
    const { service, manager } = setup({ status: ScanStatus.COMPLETED, confirmedAt: null });
    const payload = { items: [{ custom_name: 'Milk', quantity: 1, storage_type: 'fridge' }] };
    await service.confirmScan('user', 'scan', payload);
    await service.confirmScan('user', 'scan', payload);
    expect(manager.findOne).toHaveBeenCalledWith(ScanSession, { where: { id: 'scan', userId: 'user' }, lock: { mode: 'pessimistic_write' } });
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(manager.find).toHaveBeenCalledWith(FridgeItem, { where: { userId: 'user', scanSessionId: 'scan' } });
  });
  it('does not accept failed scans even when partial detections exist', async () => {
    const { service, manager } = setup({ status: ScanStatus.FAILED, aiRawResult: { detected: [{}] } });
    await expect(service.confirmScan('user', 'scan', { items: [{}] })).rejects.toThrow('not yet completed');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('cannot confirm another user’s session', async () => {
    const { service } = setup(null);
    await expect(service.confirmScan('other', 'scan', { items: [{}] })).rejects.toThrow('not found');
  });
});

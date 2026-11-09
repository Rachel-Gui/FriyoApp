import { FridgeService } from './fridge.service';

describe('real fridge inventory', () => {
  it('keeps a new or cleared fridge empty across reads without writing demo items', async () => {
    const service: any = Object.create(FridgeService.prototype);
    const qb: any = { leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) };
    service.fridgeItemRepo = { createQueryBuilder: jest.fn(() => qb), find: jest.fn().mockResolvedValue([]), save: jest.fn(), create: jest.fn() };
    expect(await service.getFridgeItems('new-user', {})).toEqual([]);
    expect(await service.getFridgeItems('new-user', {})).toEqual([]);
    expect(service.fridgeItemRepo.save).not.toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith('fi.userId = :userId', { userId: 'new-user' });
  });
});

import { ExternalRecipesService } from './external-recipes.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

describe('external recipe integration', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it('makes no requests without an API key', async () => {
    global.fetch = jest.fn();
    await new ExternalRecipesService({ get: () => undefined } as unknown as ConfigService, {} as DataSource).search('Soup');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('provider failures do not break local catalog search', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(new ExternalRecipesService({ get: () => 'test' } as unknown as ConfigService, {} as DataSource).search('Soup')).resolves.toBeUndefined();
  });
  it('preserves source, measurements and authored step order', async () => {
    const values = jest.fn(); const save = jest.fn();
    const builder: any = { insert: () => builder, into: () => builder, values: (value: unknown) => { values(value); return builder; }, orIgnore: () => builder, returning: () => builder, execute: async () => ({ raw: [{ id: 'id' }] }) };
    const manager = { createQueryBuilder: () => builder, create: (_entity: unknown, data: unknown) => data, save };
    const db = { transaction: async (fn: any) => fn(manager) } as unknown as DataSource;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ meals: [{ idMeal: '1', strMeal: 'Soup', strIngredient1: 'Tomato', strMeasure1: '1/2 cup', strInstructions: 'Chop tomatoes.\r\nSimmer soup.' }] }) });
    await new ExternalRecipesService({ get: () => 'test' } as unknown as ConfigService, db).search('Soup');
    expect(values.mock.calls[0][0].sourceUrl).toBe('https://www.themealdb.com/meal/1');
    expect(save.mock.calls[0][1]).toMatchObject({ displayName: 'Tomato', quantity: null, unit: '1/2 cup' });
    expect(save.mock.calls[1][1]).toMatchObject({ stepNumber: 1, description: 'Chop tomatoes.' });
    expect(save.mock.calls[2][1]).toMatchObject({ stepNumber: 2, description: 'Simmer soup.' });
  });
});

describe('bounded alphabet catalog imports', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it('uses documented letter discovery and rejects malformed letters before network access', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ meals: [] }) });
    const service = new ExternalRecipesService({ get: () => 'test' } as unknown as ConfigService, {} as DataSource);
    await service.importByFirstLetter('A');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('search.php?f=a'), expect.any(Object));
    await expect(service.importByFirstLetter('abc')).rejects.toThrow('single alphabet letter');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

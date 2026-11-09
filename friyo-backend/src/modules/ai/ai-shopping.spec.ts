import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
describe('AI shopping context', () => {
  const service = () => new AiService({ find: async () => [] } as any, { findOne: async () => null } as any, {} as any, {} as any, { get: () => undefined } as any, { matchRecipesToFridge: async () => [], getProfileRecommendations: async () => [] } as any);
  it('keeps unchecked purchases distinct from food already available in the fallback', async () => {
    const reply = await service().chat('user', 'What can I cook?', undefined, 'en', [{ name: 'Tomatoes', quantity: 2, unit: 'pcs' }]);
    expect(reply.message).toContain('Tomatoes (2 pcs)');
    expect(reply.message).toContain('planned purchases');
  });
  it('includes bounded shopping data in the model prompt', async () => {
    const ai = service(); const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'reply' } }] });
    (ai as any).openai = { chat: { completions: { create } } };
    await ai.chat('user', 'Dinner?', undefined, 'en', [{ name: 'Rice', quantity: 1, unit: 'bag' }]);
    expect(create.mock.calls[0][0].messages[0].content).toContain('Rice');
    expect(create.mock.calls[0][0].messages[0].content).toContain('NOT ingredients already in the fridge');
  });
  it('rejects excessive, malformed or negative shopping payloads', async () => {
    for (const shoppingList of [Array.from({ length: 51 }, () => ({ name: 'Rice', quantity: 1, unit: 'bag' })), [{ name: 'Rice', quantity: -1, unit: 'bag' }], [{ name: 'Rice', quantity: 'one', unit: 'bag' }]]) {
      expect((await validate(plainToInstance(ChatDto, { message: 'Dinner', shoppingList }))).length).toBeGreaterThan(0);
    }
  });
});

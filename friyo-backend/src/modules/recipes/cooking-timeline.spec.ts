import { RecipesService } from './recipes.service';
import { RecipeStep, StepType } from '../../database/entities/recipe-step.entity';
const step = (stepNumber: number, durationMin: number, stepType = StepType.HANDS_ON, parallelWithStepNumber: number | null = null) => ({ stepNumber, durationMin, stepType, parallelWithStepNumber, description: `Step ${stepNumber}` } as RecipeStep);
const timeline = (steps: RecipeStep[]) => (RecipesService.prototype as any).buildCookingTimeline(steps);
describe('safe cooking timeline', () => {
  it('does not infer independence from a wait step', () => {
    const result = timeline([step(1, 10, StepType.HANDS_OFF), step(2, 3)]);
    expect(result.hands_on[0].start_min).toBe(10);
    expect(result.hands_off[0].what_to_do_meanwhile).not.toContain('Step 2');
  });
  it('overlaps an explicitly independent task, then waits before dependent work', () => {
    const result = timeline([step(3, 2), step(1, 10, StepType.HANDS_OFF), step(2, 3, StepType.HANDS_ON, 1)]);
    expect(result.hands_on.map((s: any) => s.start_min)).toEqual([0, 10]);
    expect(result.hands_off[0].what_to_do_meanwhile).toContain('Step 2');
  });
  it('serializes hands-on tasks and refuses tasks too long for the wait window', () => {
    const result = timeline([step(1, 5, StepType.HANDS_OFF), step(2, 3, StepType.HANDS_ON, 1), step(3, 3, StepType.HANDS_ON, 1)]);
    expect(result.hands_on.map((s: any) => s.start_min)).toEqual([0, 5]);
    expect(result.hands_off[0].what_to_do_meanwhile).not.toContain('Step 3');
  });
});

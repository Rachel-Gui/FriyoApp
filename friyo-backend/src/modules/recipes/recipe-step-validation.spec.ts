import { validateRecipeSteps } from './recipe-step-validation';
import { StepType } from '../../database/entities/recipe-step.entity';
const step = (n: number, type = StepType.HANDS_ON, parent?: number) => ({ step_number: n, description: 'Cook', duration_min: 5, step_type: type, parallel_with_step_number: parent });
describe('recipe step import validation', () => {
  it('accepts explicit independent tasks but rejects duplicate, cyclic and missing references', () => {
    expect(() => validateRecipeSteps([step(1, StepType.HANDS_OFF), step(2, StepType.HANDS_ON, 1)])).not.toThrow();
    for (const steps of [[step(1), step(1)], [step(1, StepType.HANDS_ON, 2), step(2)], [step(1, StepType.HANDS_ON, 99)], [step(1), step(2, StepType.HANDS_ON, 1)]]) {
      expect(() => validateRecipeSteps(steps)).toThrow();
    }
  });
  it('refuses to infer overlap from unknown durations', () => {
    expect(() => validateRecipeSteps([{ ...step(1, StepType.HANDS_OFF), duration_min: undefined }, step(2, StepType.HANDS_ON, 1)])).toThrow();
  });
});

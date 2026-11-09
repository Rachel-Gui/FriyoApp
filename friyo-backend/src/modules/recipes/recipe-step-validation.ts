import { BadRequestException } from '@nestjs/common';
import { CreateRecipeStepDto } from './dto/create-recipe.dto';

export function validateRecipeSteps(steps: CreateRecipeStepDto[]): void {
  const numbers = new Set<number>();
  for (const step of steps) {
    if (numbers.has(step.step_number)) throw new BadRequestException('Step numbers must be unique.');
    numbers.add(step.step_number);
    if (!step.description.trim()) throw new BadRequestException('Step instructions cannot be blank.');
    if (step.parallel_with_step_number != null) {
      const parent = steps.find(item => item.step_number === step.parallel_with_step_number);
      if (!parent || parent.step_number >= step.step_number || parent.step_type !== 'hands_off' || (step.step_type ?? 'hands_on') !== 'hands_on') {
        throw new BadRequestException('Parallel tasks must reference an earlier hands-off step.');
      }
      if (!parent.duration_min || !step.duration_min) throw new BadRequestException('Parallel tasks require known durations.');
    }
  }
}

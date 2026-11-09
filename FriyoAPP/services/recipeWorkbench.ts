/** Portable recipe import format. Unknown durations remain unknown. */
export interface WorkbenchStep {
  step_number: number;
  description: string;
  duration_min?: number;
  step_type: 'hands_on' | 'hands_off';
  parallel_with_step_number?: number;
}
export interface WorkbenchRecipe {
  title: string;
  source_url?: string;
  servings: number;
  cuisine_type?: string;
  meal_type?: string;
  difficulty?: string;
  prep_time_min?: number;
  cook_time_min?: number;
  tags?: string[];
  diet_types?: string[];
  required_tools?: string[];
  ingredients: { display_name: string; quantity?: number; unit?: string; ingredient_id?: string }[];
  steps: WorkbenchStep[];
}
export function validateWorkbench(recipe: WorkbenchRecipe): string[] {
  const errors: string[] = [];
  if (!recipe.title.trim()) errors.push('Add a recipe title.');
  if (!Number.isInteger(recipe.servings) || recipe.servings < 1 || recipe.servings > 100) errors.push('Servings must be 1–100.');
  if (recipe.source_url && !/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(recipe.source_url)) errors.push('Source must be an HTTPS URL.');
  if (!recipe.ingredients.length || recipe.ingredients.length > 200) errors.push('Add 1–200 ingredients.');
  recipe.ingredients.forEach((line, index) => {
    if (!line.display_name.trim()) errors.push(`Ingredient ${index + 1}: add a name.`);
    if (line.quantity !== undefined && (!Number.isFinite(line.quantity) || line.quantity < 0)) errors.push(`Ingredient ${index + 1}: quantity must be nonnegative.`);
  });
  if (!recipe.steps.length || recipe.steps.length > 100) errors.push('Add 1–100 steps.');
  const numbers = new Set<number>();
  recipe.steps.forEach(step => {
    if (!Number.isInteger(step.step_number) || step.step_number < 1 || numbers.has(step.step_number)) errors.push('Step numbers must be unique positive integers.');
    numbers.add(step.step_number);
    if (!step.description.trim()) errors.push(`Step ${step.step_number}: add instructions.`);
    if (step.duration_min !== undefined && (!Number.isInteger(step.duration_min) || step.duration_min < 1 || step.duration_min > 1440)) errors.push(`Step ${step.step_number}: duration must be 1–1440 minutes or blank.`);
    if (!['hands_on', 'hands_off'].includes(step.step_type)) errors.push(`Step ${step.step_number}: invalid step type.`);
    if (step.parallel_with_step_number !== undefined) {
      const parent = recipe.steps.find(s => s.step_number === step.parallel_with_step_number);
      if (!parent || parent.step_number >= step.step_number || parent.step_type !== 'hands_off' || step.step_type !== 'hands_on') errors.push(`Step ${step.step_number}: parallel task must reference an earlier hands-off step.`);
      if (parent && (parent.duration_min === undefined || step.duration_min === undefined)) errors.push(`Step ${step.step_number}: both parallel tasks need durations.`);
    }
  });
  return errors;
}
const object = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a recipe object.');
  return value as Record<string, any>;
};
export function importRecipe(input: string): WorkbenchRecipe {
  if (input.length > 1_000_000) throw new Error('Import must be smaller than 1 MB.');
  const raw = object(JSON.parse(input));
  const source = raw.recipe ? object(raw.recipe) : raw;
  if (!Array.isArray(source.ingredients) || !Array.isArray(source.steps)) throw new Error('Recipe needs ingredients and steps arrays.');
  const recipe: WorkbenchRecipe = {
    title: String(source.title ?? ''), source_url: (source.source_url ?? source.sourceUrl) == null ? undefined : String(source.source_url ?? source.sourceUrl),
    servings: Number(source.servings ?? 2),
    cuisine_type: source.cuisine_type ?? source.cuisineType ?? undefined,
    meal_type: source.meal_type ?? source.mealType ?? undefined,
    difficulty: source.difficulty ?? undefined,
    prep_time_min: source.prep_time_min ?? source.prepTimeMin ?? undefined,
    cook_time_min: source.cook_time_min ?? source.cookTimeMin ?? undefined,
    tags: source.tags ?? [], diet_types: source.diet_types ?? source.dietTypes ?? [], required_tools: source.required_tools ?? source.requiredTools ?? [],
    ingredients: source.ingredients.map((value: unknown) => {
      const line = object(value);
      return { ingredient_id: line.ingredient_id ?? line.ingredientId ?? undefined, display_name: String(line.display_name ?? line.displayName ?? line.ingredientName ?? line.ingredient?.name ?? ''), quantity: line.quantity == null ? undefined : Number(line.quantity), unit: String(line.unit ?? '') };
    }),
    steps: source.steps.map((value: unknown) => {
      const step = object(value);
      return { step_number: Number(step.step_number ?? step.stepNumber), description: String(step.description ?? ''), duration_min: (step.duration_min ?? step.durationMin) == null ? undefined : Number(step.duration_min ?? step.durationMin), step_type: step.step_type ?? step.stepType ?? 'hands_on', parallel_with_step_number: (step.parallel_with_step_number ?? step.parallelWithStepNumber) == null ? undefined : Number(step.parallel_with_step_number ?? step.parallelWithStepNumber) };
    }).sort((a: WorkbenchStep, b: WorkbenchStep) => a.step_number - b.step_number),
  };
  const errors = validateWorkbench(recipe);
  if (errors.length) throw new Error(errors.join('\n'));
  return recipe;
}
export interface GraphNode { step: WorkbenchStep; start: number; end: number; estimated: boolean; parallel: boolean; after: number[] }
/** Same conservative overlap policy as the cooking API: one active task at a time. */
export function buildRecipeGraph(steps: WorkbenchStep[]): GraphNode[] {
  const nodes: GraphNode[] = [];
  let cursor = 0;
  for (const step of [...steps].sort((a, b) => a.step_number - b.step_number)) {
    const duration = step.duration_min ?? 5;
    const parent = nodes.find(node => node.step.step_number === step.parallel_with_step_number && node.step.step_type === 'hands_off');
    const siblings = parent ? nodes.filter(node => node.step.parallel_with_step_number === parent.step.step_number) : [];
    const parallelStart = parent ? Math.max(parent.start, ...siblings.map(node => node.end)) : cursor;
    const parallel = !!parent && step.step_type === 'hands_on' && step.duration_min !== undefined && parent.step.duration_min !== undefined && parallelStart + duration <= parent.end;
    const start = parallel ? parallelStart : cursor;
    // Fork from the same predecessors as the waiting task; join all completed work.
    const after = parallel && parent ? [...parent.after, ...siblings.map(node => node.step.step_number)] : nodes.filter(node => !nodes.some(other => other.after.includes(node.step.step_number))).map(node => node.step.step_number);
    nodes.push({ step, start, end: start + duration, estimated: step.duration_min === undefined, parallel, after });
    cursor = Math.max(cursor, start + duration);
  }
  return nodes;
}
/** Remove a row and references to it; preserve explicit identities when editing. */
export function removeWorkbenchStep(steps: WorkbenchStep[], number: number): WorkbenchStep[] {
  return steps.filter(step => step.step_number !== number).map(step => step.parallel_with_step_number === number ? { ...step, parallel_with_step_number: undefined } : step);
}
export const sampleRecipe: WorkbenchRecipe = {
  title: 'Chickpea couscous bowl', servings: 2,
  ingredients: [{ display_name: 'Couscous', quantity: 120, unit: 'g' }, { display_name: 'Water', quantity: 180, unit: 'ml' }, { display_name: 'Canned chickpeas, drained', quantity: 240, unit: 'g' }, { display_name: 'Cucumber', quantity: 150, unit: 'g' }, { display_name: 'Lemon juice', quantity: 15, unit: 'ml' }],
  steps: [
    { step_number: 1, description: 'Bring water to a boil. Pour over couscous in a heatproof bowl and cover.', duration_min: 3, step_type: 'hands_on' },
    { step_number: 2, description: 'Leave couscous covered to absorb the water.', duration_min: 8, step_type: 'hands_off' },
    { step_number: 3, description: 'While couscous rests, rinse chickpeas and dice cucumber.', duration_min: 5, step_type: 'hands_on', parallel_with_step_number: 2 },
    { step_number: 4, description: 'Fluff couscous; combine with chickpeas, cucumber and lemon juice.', duration_min: 2, step_type: 'hands_on' },
  ],
};

export function moveWorkbenchStep(steps: WorkbenchStep[], index: number, direction: -1 | 1): WorkbenchStep[] {
  const target = index + direction;
  if (target < 0 || target >= steps.length) return steps;
  const moved = [...steps];
  [moved[index], moved[target]] = [moved[target], moved[index]];
  const mapping = new Map(moved.map((step, i) => [step.step_number, i + 1]));
  return moved.map((step, i) => ({ ...step, step_number: i + 1, parallel_with_step_number: step.parallel_with_step_number === undefined ? undefined : mapping.get(step.parallel_with_step_number) }));
}

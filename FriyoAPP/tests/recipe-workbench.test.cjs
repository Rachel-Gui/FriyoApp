const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/recipeWorkbench.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: moduleValue, exports: moduleValue.exports });
const { importRecipe, validateWorkbench, buildRecipeGraph, sampleRecipe, removeWorkbenchStep, moveWorkbenchStep } = moduleValue.exports;
const sample = () => JSON.parse(JSON.stringify(sampleRecipe));
test('JSON roundtrip preserves quantities and explicit parallel references', () => {
  const recipe = importRecipe(JSON.stringify(sample()));
  assert.equal(recipe.ingredients[0].quantity, 120);
  assert.equal(recipe.steps[2].parallel_with_step_number, 2);
  assert.equal(validateWorkbench(recipe).length, 0);
});
test('imports normalized API recipes and leaves unknown duration unset', () => {
  const recipe = importRecipe(JSON.stringify({ title: 'Soup', servings: 2, ingredients: [{ ingredientName: 'Tomato', quantity: null }], steps: [{ stepNumber: 1, description: 'Prepare soup.', durationMin: null, stepType: 'hands_on' }] }));
  assert.equal(recipe.ingredients[0].display_name, 'Tomato');
  assert.equal(recipe.ingredients[0].quantity, undefined);
  assert.equal(recipe.steps[0].duration_min, undefined);
  assert.equal(buildRecipeGraph(recipe.steps)[0].estimated, true);
});
test('forks independent work and joins both branches before serving', () => {
  const nodes = buildRecipeGraph(sample().steps);
  assert.equal(nodes[1].start, 3); assert.equal(nodes[2].start, 3);
  assert.equal(nodes[3].start, 11); assert.equal(nodes[3].end, 13);
  assert.deepEqual(Array.from(nodes[3].after), [2, 3]);
});
test('does not overlap unknown durations or tasks longer than the wait window', () => {
  const steps = sample().steps; steps[2].duration_min = 20;
  assert.equal(buildRecipeGraph(steps)[2].start, 11);
  delete steps[1].duration_min;
  assert.equal(buildRecipeGraph(steps)[2].parallel, false);
  assert.ok(validateWorkbench({ ...sample(), steps }).length);
});
test('serializes multiple active tasks in a single wait window', () => {
  const steps = sample().steps.slice(0, 3);
  steps[2].duration_min = 3;
  steps.push({ ...steps[2], step_number: 4 });
  const nodes = buildRecipeGraph(steps);
  assert.equal(nodes[2].start, 3); assert.equal(nodes[3].start, 6);
});
test('rejects malformed import, duplicate steps, negative quantities and cycles', () => {
  assert.throws(() => importRecipe('not-json'));
  for (const mutate of [r => r.steps[1].step_number = 1, r => r.ingredients[0].quantity = -1, r => r.steps[1].parallel_with_step_number = 3, r => r.steps[2].parallel_with_step_number = 99]) {
    const recipe = sample(); mutate(recipe); assert.throws(() => importRecipe(JSON.stringify(recipe)));
  }
});
test('removing and moving steps preserves identities or invalidates unsafe dependencies', () => {
  assert.equal(removeWorkbenchStep(sample().steps, 2)[1].parallel_with_step_number, undefined);
  const moved = moveWorkbenchStep(sample().steps, 2, -1);
  assert.ok(validateWorkbench({ ...sample(), steps: moved }).length);
});

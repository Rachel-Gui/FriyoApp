const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const moduleValue = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../services/recipeLanguage.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { module: moduleValue, exports: moduleValue.exports, Map });
const { localizeRecipe, localizeCooking, hasRecipeTranslation, recipeText } = moduleValue.exports;
const recipe = { title:'Tomato eggs', titleZh:'番茄炒蛋', description:'Fry gently.', descriptionZh:'轻轻翻炒。', ingredients:[{ingredientName:'Tomatoes', ingredientNameZh:'番茄'}], steps:[{stepNumber:1,description:'Chop tomatoes.', descriptionZh:'切番茄。', tips:'Be careful.',tipsZh:'小心切菜。'}] };
test('switches recipe title, description, ingredients and ordered steps without mutating source', () => {
  const zh=localizeRecipe(recipe,'zh'); assert.equal(zh.title,'番茄炒蛋');assert.equal(zh.ingredients[0].ingredientName,'番茄'); assert.equal(zh.steps[0].description,'切番茄。');assert.equal(zh.steps[0].tips,'小心切菜。');assert.equal(recipe.title,'Tomato eggs');assert.equal(localizeRecipe(recipe,'en').title,'Tomato eggs');
});
test('keeps fridge match status associated with translated ingredient names', () => {
  const zh=localizeCooking({recipe, adaptation:null, fridgeStatus:[{ingredientName:'Tomatoes',inFridge:true}]},'zh');assert.equal(zh.fridgeStatus[0].ingredientName,'番茄');assert.equal(zh.fridgeStatus[0].inFridge,true);
});
test('supports Chinese originals with English translations and makes fallback detectable', () => {
  assert.equal(localizeRecipe({...recipe,title:'番茄炒蛋',titleZh:null,titleEn:'Tomato eggs'},'en').title,'Tomato eggs');
  assert.equal(localizeRecipe({...recipe,titleZh:null},'zh').title,'Tomato eggs');assert.equal(hasRecipeTranslation({...recipe,titleZh:null},'zh'),false); assert.equal(hasRecipeTranslation(recipe,'zh'),true);assert.equal(recipeText('How to Cook','zh'),'烹饪步骤');assert.equal(recipeText('How to Cook','en'),'How to Cook');
});

const {test}=require('node:test'); const assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),p=require('node:path'),vm=require('node:vm');
function load(name,dependencies={}){const m={exports:{}};const source=fs.readFileSync(p.join(__dirname,'../services/'+name+'.ts'),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module:m,exports:m.exports,Map,require:key=>dependencies[key]});return m.exports;}
const recipe=load('recipeLanguage'),dictionary=require('../services/uiTranslations.json');const {translateUI}=load('uiLanguage',{'./uiTranslations.json':dictionary,'./recipeLanguage':recipe});
test('Chinese covers auth, onboarding, inventory, meal planning, settings and consent labels',()=>{
 for(const label of ['Log in','Full name','Forgot Password?','Rice-Based Meals','Spicy','Ingredient Name','Apply Filters','Shopping List','Meal Plan','Settings','Delete Account','AI data processing','Privacy Policy','Terms of Service']) {assert.notEqual(translateUI(label,'zh'),label,label);assert.equal(translateUI(label,'en'),label);}
});
test('translation preserves unknown user data, numbers and required DELETE confirmation',()=>{
 assert.equal(translateUI('my-private-meal-name','zh'),'my-private-meal-name'); assert.equal(translateUI('DELETE','zh'),'DELETE');assert.equal(translateUI('Step 3 of 5','zh'),'步骤 3 / 5');assert.equal(translateUI('Type DELETE exactly to continue.','zh'),'请输入完整的 DELETE 以继续。');assert.equal(translateUI('  Log in  ','zh'),'  登录  ');
});
test('legal disclosure translations preserve the named AI providers and original English',()=>{
 const key=Object.keys(dictionary).find(key=>key.startsWith('When you choose AI chat'));assert.match(translateUI(key,'zh'),/Google Gemini.*OpenAI/);assert.equal(translateUI(key,'en'),key);
});

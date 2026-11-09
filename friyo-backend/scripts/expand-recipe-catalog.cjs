// Preview is read-only. Writes require an explicit target URL and --apply.
// Never loads .env or assumes the application's production database.
require('reflect-metadata');
const path = require('node:path');
const { DataSource } = require('typeorm');
const { ConfigService } = require('@nestjs/config');
const buildDir = process.env.FRIYO_CATALOG_BUILD_DIR || path.resolve(__dirname, '../dist');
// Keep discovery bounded to the documented V1 alphabet endpoint (20 per letter).
const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
(async () => {
  const key = process.env.THEMEALDB_API_KEY;
  if (!key) throw new Error('Set THEMEALDB_API_KEY (development key 1 is not for public App Store releases).');
  const ids = new Set();
  const categories = new Set();
  for (const letter of letters) {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/${encodeURIComponent(key)}/search.php?f=${letter}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Catalog preview failed: HTTP ${res.status}`);
    const { meals } = await res.json();
    for (const meal of (meals || []).slice(0, 20)) {
      if (meal.idMeal && meal.strMeal && meal.strInstructions) { ids.add(meal.idMeal); categories.add(meal.strCategory); }
    }
  }
  console.log(`Preview: ${ids.size} source recipes across ${categories.size} categories; no database writes.`);
  if (!process.argv.includes('--apply')) return;
  if (!process.env.FRIYO_CATALOG_DATABASE_URL) throw new Error('Set FRIYO_CATALOG_DATABASE_URL to the intended migrated database.');
  const { ExternalRecipesService } = require(path.join(buildDir, 'modules/recipes/external-recipes.service'));
  const { Recipe } = require(path.join(buildDir, 'database/entities/recipe.entity'));
  const db = new DataSource({ type: 'postgres', url: process.env.FRIYO_CATALOG_DATABASE_URL,
    entities: [path.join(buildDir, '**/*.entity.js')], synchronize: false });
  await db.initialize();
  try {
    const repo = db.getRepository(Recipe); const before = await repo.count();
    const provider = new ExternalRecipesService(new ConfigService({ THEMEALDB_API_KEY: key }), db);
    for (const letter of letters) await provider.importByFirstLetter(letter);
    const imported = await repo.find({ select: { id: true, sourceUrl: true }, where: { isPublished: true } });
    const availableIds = new Set(imported.map(r => r.sourceUrl?.split('/').pop()));
    const missing = [...ids].filter(id => !availableIds.has(id));
    if (missing.length) throw new Error(`${missing.length} preview recipes were not imported. Rerun safely; IDs prevent duplicates.`);
    console.log(`Verified catalog expansion: ${await repo.count() - before} new recipes; ${ids.size} preview recipes present with source links.`);
  } finally { await db.destroy(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

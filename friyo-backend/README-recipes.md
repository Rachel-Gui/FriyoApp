# Recipe catalog integration

Local search uses PostgreSQL and searches English/Chinese titles, descriptions,
cuisines, meal types, diet labels, tags, ingredient names and aliases.

Set `THEMEALDB_API_KEY` in the backend environment to enable TheMealDB search.
No external requests are made without a key. Use your production supporter key
for an App Store release; key `1` is only for development/education according to
https://www.themealdb.com/api.php. External search currently searches meal titles,
primarily English. Imported meals become durable local recipes, with deterministic
IDs, original measures, source links and sequential cooking steps. Repeated or
concurrent searches do not duplicate recipes. Remote timeouts fall back to the
local catalog. Imported recipes do not invent nutritional values or timers.

`scripts/expand-recipe-catalog.cjs` previews the documented V1 first-letter
endpoint across a–z, keeping at most 20 recipes per letter. This is a bounded
selection, not a complete copy of the provider database. Writes require
`--apply` and an explicit `FRIYO_CATALOG_DATABASE_URL`; existing source IDs are
skipped and the preview IDs are verified after import. Back up the target
database first. Test imports can use the public development key; do not configure
that key on the production service for public App Store use.

POST /recipes also accepts an HTTPS `source_url` for manually curated recipes,
including Xiaohongshu sources. Supply structured `ingredients` and `steps` using
the existing create DTO. User submissions still require review before appearing
in search. There is no Xiaohongshu crawler or automatic link extraction.

Fridge recommendations compare catalog IDs, normalized names, Chinese names and
catalog aliases, omit expired/zero-quantity items, and rank ingredient coverage
first. Coverage means ingredient presence, not a guarantee of sufficient quantities
or interchangeable units. Details and cooking mode use the same matching helper.


## Live integration verification

The local `.env` enables the public development key. Production configuration
rejects key `1`; leave the integration disabled or configure a supporter key.

The verification script never reads `.env` database credentials. It uses only
`friyo_recipe_verification` at `127.0.0.1:15432`, applies actual migrations and
checks Chinese search, categories, detail/steps, fridge aliases, consumed items,
live provider import, attribution and duplicate prevention.

```sh
docker run --detach --name friyo-recipe-verification-postgres --publish 127.0.0.1:15432:5432 --env POSTGRES_USER=friyo_test --env POSTGRES_PASSWORD=friyo_test_local --env POSTGRES_DB=friyo_recipe_verification postgres:15-alpine
npm run verify:recipes
docker stop friyo-recipe-verification-postgres
```

To repeat with the existing test container, run
`docker start friyo-recipe-verification-postgres` before `npm run verify:recipes`.
On 2026-10-02 the actual migration and live-provider checks passed. This is a
backend/database acceptance test, not a TestFlight or physical-device validation.

## Chinese and English

Migration 007 adds optional `title_en`, `description_zh`, `description_en`,
ingredient `display_name_zh` / `display_name_en`, and step `description_zh` /
`description_en` / `tips_zh` / `tips_en`. Recipe creation accepts these fields;
recipe updates accept the title/description fields. The original fields remain
available and supply the fallback when a translation is absent. The starter
catalog contains Chinese descriptions and steps; third-party text is preserved.

The recipe UI offers a persistent English/中文 switch. Shared common ingredient,
meal and category aliases allow Chinese and English keywords to find the same
local content and permit recognized Chinese names to query TheMealDB in English.
The same vocabulary handles custom-name fridge matching. This is a curated
vocabulary; arbitrary text is not machine-translated. Missing translations are
labeled in the UI. Login/onboarding and other app flows are outside this locale
implementation.

## October 25 feedback update

Migration `009_quick_recipe_catalog` adds 10 authored everyday recipes with
English/Chinese ingredients, measured quantities and three ordered cooking steps.
Nutrition is intentionally null until validated. Apply with the normal migration
release process (`npm run migration:run:prod` after building); application startup
does not automatically run migrations. No live database was changed by authoring
this migration. Link-to-recipe extraction remains a separate future feature.

Fridge ranking considers every published, approved local recipe rather than only
the 200 most popular. Main-ingredient coverage comes first; ties account for
near-expiry ingredients and profile preferences, with stable ID ordering.
Seasonings alone never produce a fridge recommendation. Profile ranking uses
cuisine, flavor tags, meal format, total cooking time, skill and health goals,
with popularity and ID as deterministic tie breakers. Missing metadata supplies
no preference bonus. This remains a rules-based ranking, without behavioral
learning. Homepage recommendations refresh when the screen regains focus.

Meal Plan hides unknown/zero calorie values and suppresses incomplete daily and
weekly totals. Available values carry an approximation mark. It does not infer
nutrition from recipe titles or unmeasured ingredients. The recipe picker expands
to the available screen height; dragging its handle or title downward collapses
it, and a second downward drag dismisses it. Verify both gestures on a device
before shipping.

## Empty fridge and completion follow-up

GET /fridge is read-only: it no longer creates or replenishes demo stock. New
accounts and cleared inventories return zero items. Existing inventory is left
intact because previously inserted samples cannot safely be distinguished from
user-entered stock. No automatic cleanup runs on existing accounts.

The homepage shows a zero-inventory explanation and preference recommendations.
Update Fridge appears in the Fridge tab, at most once per 24 hours per account on
that device. Seasonings have their own recipe-level confirmation checklist and
are excluded from main-ingredient coverage, including generic oil, pepper and
common dried spices. Checklist changes affect the missing-ingredient shopping
list without writing invented quantities to inventory.

Completion displays save progress and errors inline; photo failures preserve
the saved meal and allow photo retry. Inventory review no longer depends on a
successful history/photo save. Cooking again supplies a new session parameter
to reset steps and timers; each completion gets a fresh idempotency key. Month
history reloads on focus. Device/TestFlight acceptance remains required.

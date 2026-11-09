# Recipe workbench and AI matching acceptance

## Try the editor

Run `npm run web:local` in `FriyoAPP`, then open
http://localhost:8082/recipe-workbench. The editor and graph work without a backend
or login. The Recipe homepage and each recipe's How to Cook section also link to
it. Login is required only to submit a copy for review or load protected recipes.

1. Load the sample, or choose a JSON file on web. On native, paste JSON.
   Both the POST /recipes snake_case format and normalized GET recipe data work.
2. Edit ingredient names, quantities and units. Edit instructions, durations and
   active/wait type. Add/remove rows or reorder steps with the arrows.
3. A parallel task must reference an earlier hands-off step. Confirm independence
   yourself. Known durations are required for overlapping work. Active tasks
   serialize and must fit in the waiting window; otherwise they run afterwards.
4. The sample forks after step 1 and joins steps 2/3 before step 4: 13 minutes
   versus 18 serial minutes. Change step 3 to 10 minutes: preview becomes 23
   minutes with no overlap. Unknown durations show a marked five-minute preview
   estimate; no timer value is inserted into the exported recipe.
5. Save/restore the local draft or export JSON (download on web, share on native).
   Drafts are isolated by account, with a separate guest draft. They are not cloud
   backups and may be lost if local browser/app data is cleared.
6. Submit for review creates a new recipe copy through the existing review flow.
   It does not modify the source recipe. When every duration is known, total time
   is recomputed from the graph. Otherwise the stored total remains unknown (0).

This version handles structured JSON. It does not extract a recipe from an
arbitrary URL, photograph or free text. HTTPS source links supply attribution.
The editor exposes the existing sequential/explicit-overlap model, not arbitrary
multi-parent dependency editing. Graph cards abbreviate long text; the table
keeps the full instructions editable.

## Catalog update

Migration `010_everyday_recipe_catalog` adds 20 authored recipes across four meal
types and nine cuisines. They include measured ingredients, bilingual names and
instructions, explicit task durations and selected parallel tasks. Nutrition is
left null. They supplement the previous ten quick recipes and existing imports.
IDs are deterministic and existing IDs are skipped.

Build the backend, then apply the normal migration release process:

```sh
npm run build
npm run migration:run:prod
```

Authoring/building does not update the live database. Do not change production
connection settings merely to preview the editor. Review ingredient/tool metadata
and cooking estimates before App Store acceptance. No full catalog crawl runs.

## AI matching

Authenticated `GET /ai/status` returns configured provider names and whether local
matching is supported. It does not call a provider or return keys. The AI screen
shows this status with a tap-to-recheck control. This is configuration information,
not proof that a provider is reachable.

Chat replies return `response_source` (`local`, `gemini`, `openai`), optional
`fallback_reason` (`not_configured`, `provider_unavailable`), `matching_source`
(`fridge`, `profile`) and `matched_recipe_count`. The UI displays them beside the
reply. Local matching remains available without model credentials.

- Add Tomato/番茄 and ask “What can I cook in 30 minutes?”: ingredient presence
  determines coverage; cards list missing ingredients and open real recipe IDs.
- Clear the fridge: get profile alternatives with purchases required, rather than
  fictitious stocked ingredients. Seasonings are not counted as main coverage.
- Expired and zero-quantity items do not appear in AI fridge context.
- Time requests filter on total prep+cook time. Unknown times do not satisfy a
  time limit. Query words boost matching titles, ingredients, cuisines and tags;
  this is keyword ranking, not semantic understanding of arbitrary constraints.
- Diet restrictions now require affirmative diet metadata. Vegan recipes also
  qualify for vegetarian/pescatarian users. Equipment checks recognize onboarding
  labels for basic pans/pots. Ingredient exclusions still depend on catalog and
  profile naming; this is not certified allergen detection.
- Unknown calories stay hidden rather than appearing as zero or an invented value.
- Configure `GEMINI_API_KEY` or `OPENAI_API_KEY` in the backend environment for
  model text. Restart the backend, recheck configuration, then send a message.
  A local reply after provider failure is visibly labeled. Provider calls have
  bounded timeouts. Existing consent and daily usage limits remain enforced.

The existing staging smoke test now checks AI status, local chat when no provider
is configured, durable recipe links, and invalid graph rejection. Set
`FRIYO_SMOKE_AI=true` explicitly to include provider calls on configured staging.
It creates/deletes a disposable account and requires `FRIYO_SMOKE_STAGING=true`;
use only the intended test environment.

## Verification on 2026-11-08

- Frontend unit tests: 28 passed; TypeScript check passed.
- Backend unit/HTTP tests: 84 passed; backend build passed.
- Browser: actual JSON import, editing durations, overlap fallback, draft save and
  restore, and graph fork/join layout verified in Chrome at the local URL.
- PostgreSQL migration and staging smoke were not run locally: Docker daemon was
  unavailable. CI already runs migrations and the smoke test in disposable Postgres.
- Local backend has no usable configured provider key. Real model calls and
  native device acceptance remain unverified.

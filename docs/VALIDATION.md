# Validation record — 2026-09-18

## 实际完成的检查

| 检查 | 结果 | 边界 |
| --- | --- | --- |
| 移动端 TypeScript | 通过 | 不代表真机行为通过 |
| 移动端接口回归 | 8/8 通过 | fetch / SecureStore 使用测试替身 |
| Expo SDK 54 依赖兼容检查 | 通过 | 离线使用 SDK 内置版本表 |
| iOS Metro / Hermes export | 通过，1767 模块 | 不是签名 IPA / Xcode 编译 |
| iOS config plugin prebuild | 通过 | 用验证用 Google ID 检查 scheme；没有真实 provider 授权 |
| 原生 entitlement | 包含 Apple Sign In、aps-environment | 发布证书及 provisioning profile 尚未验证 |
| 后端 Nest 构建 | 通过 | 未连接真实数据库和 Redis |
| 后端回归 | 25/25 通过 | 认证、密码找回、刷新轮换、真实本地 HTTP/限流、真实图片解码、健康检查、Expo 回执；外部服务使用测试替身 |
| bcrypt 6 native runtime | 哈希/比对通过 | 本机运行环境 |
| 管理后台 Next.js 15.5.25 生产构建 | 通过，15 routes | 未验证真实管理员 API 登录 |
| App 图标 | 使用已有 1024×1024 RGB 图标 | 未新增或生成品牌设计 |
| 发布环境预检 | 正确拒绝缺失配置 | 当前实际环境没有 release variables |
| git diff whitespace check | 通过 | 无提交或推送 |
| 旧 Railway 公开健康地址 | 返回 Application not found | 必须恢复或更换后端地址 |

移动端及后端依赖在 `/private/tmp/friyo-release-validation/` 干净安装并验证；已有工作区依赖目录的安装和同步持续停滞，已停止这些操作；工作区的 node_modules 尚未完成更新。源码和 lockfile 才是交付依据；新机器应使用 `npm ci`。

## 未执行，不能标记通过

- PostgreSQL migration 001–005、Redis 队列及完整 API smoke：本机 Docker daemon 未启动，没有可用预发布后端。
- CI pipeline 已加入仓库，但没有推送，因此没有远程 CI 运行结果。
- Apple / Google 凭证验证、Apple token 实际撤销、SES 邮件、S3 文件删除、AI provider 实测、APNs / Expo 真机送达。
- 原生 Pods 安装、Xcode archive、EAS 云端构建、签名、TestFlight、App Store Connect 提交。
- App Store 隐私表单、真实支持邮箱、政策公开地址、审核账号、实际用户验收和备份恢复演练。

## 生产依赖审计

使用 npm 官方 registry 的 `npm audit --omit=dev`。这是依赖公告检查，不等于完整安全审计；数量会随公告更新改变。

- Backend (NestJS 11.2.5 / Firebase 14.4.0): critical 0, high 0, moderate 0, low 0.
- Admin (Next.js 15.5.25): critical 0, high 0, moderate 0, low 0.
- Mobile (Expo SDK 54, patched tooling): critical 0, high 0, moderate 0, low 0.

移动端保留 SDK 54，并通过 postinstall 的 `scripts/patch-metro.cjs` 适配新版 image-size 的 Buffer 输入及新版 URI decoder 的 ESM 导出；类型检查、URL 回归和 Hermes bundle 验证是这一兼容层的发布门槛。

后端框架升级已通过 TypeScript 构建和 25 项回归，包含真实 Nest/Express HTTP 请求。数据库迁移和第三方服务仍必须在预发布完成集成验收，不能用单元测试代替。发布 commit 应重跑审计，公告与依赖版本可能改变。

## 已确认的外部配置缺口

发布检查当前要求：`EXPO_PUBLIC_API_URL`、Google Web/iOS IDs、支持邮箱、隐私 URL。后端启动前还需真实数据库/Redis、JWT secrets、Apple key、OAuth 加密 key、S3/SES/AI 配置。

详见 [上线清单](LAUNCH_CHECKLIST.md)。本次没有发布、发邮件、给真实用户发送推送、执行生产数据库迁移或更改任何线上账号配置。


## 2026-10-02: local recipe API acceptance

- Backed up local development PostgreSQL to a private temporary file before applying migrations 005 and 006.
- Started the actual Nest application at `http://localhost:3000/api/v1`; health reported PostgreSQL and Redis connected.
- Extended `scripts/smoke-api.mjs` and passed authenticated recipe search, ingredient keyword search, recipe detail, cooking steps and custom Chinese-name fridge recommendations through the real HTTP API.
- The smoke script created only its own random development account and deleted that account on completion; existing users were not used for testing.
- Mobile TypeScript validation and all 13 frontend tests passed, including browser session token storage and server-rendering safety. Native token storage continues to use SecureStore.
- Development browser preview uses port 8082 because 8081 belongs to another project. Use `FRIYO_NO_WATCHMAN=1` only when the local watcher stalls.
- Public deployment, TestFlight/physical-device validation and Xiaohongshu automatic search are still outstanding.

- Preview startup diagnosis: Expo's automatic Chrome opener blocked in a synchronous OS command. `web:local` disables automatic browser opening and binds localhost; open the preview URL manually.

## 2026-10-04: browser recipe acceptance

- Fixed the web runtime blank screen by enabling Expo's web import-meta transform and clearing Metro's transform cache in the isolated local preview script.
- Verified login, category/keyword search and source labels in Chrome at localhost:8082. Searching 鸡肉 now finds Chicken recipes through common Chinese/English ingredient synonyms, retaining the original keyword search too.
- Opened recipe details and the How to Cook tab; ingredients and all five ordered steps rendered. Added a disposable account's 鸡胸肉 fridge item through the API and confirmed the detail's fridge match changed from 0/7 to 1/7, with Chicken Breast marked In Fridge.
- Removed the hardcoded claim of eight available fridge recipes from the home page.
- Frontend: 13 tests pass. Backend: TypeScript build passes using a temporary output directory (the old dist directory's filesystem scan stalled); the running local API uses that output. Authenticated HTTP smoke passes search, detail, cooking and custom-name fridge recommendations again.
- This is local acceptance, not a production deployment or device/TestFlight acceptance. TheMealDB is implemented; automatic Xiaohongshu search is not connected.

## 2026-10-04: Chinese/English recipe support

- Added a persisted English/中文 selection on recipe home, search, detail and cooking screens. Existing recipe titles, ingredient names, descriptions, step instructions and tips keep their original text and choose the available translation for display. Language changes preserve search filters, fridge match status, cooking progress and active timer state.
- Added nullable bilingual fields through migration 007 and create/update recipe DTOs. The five starter recipes now include Chinese descriptions and step instructions; newly seeded databases receive the same translations. Migrations preserve existing originals and supplied translations.
- Shared common keyword vocabulary supports Chinese/English search and category aliases, translates recognized Chinese provider queries to English, and matches custom Chinese fridge names to imported English ingredient labels. Unknown names are preserved. This is curated vocabulary, not general machine translation.
- Chrome acceptance: English Tomato search in Chinese mode, Chinese recipe detail and steps, English/Chinese switching, 西红柿 matching Tomatoes at 1/5, cooking timer continuing at 00:47 while switching to English, and refresh retaining Chinese. Fixed the previous-step button's Chinese text wrapping.
- Validation: frontend TypeScript check and 16 tests pass; backend TypeScript build and 42 tests pass. Isolated PostgreSQL verification passes bidirectional search, Chinese categories, bilingual field persistence, fridge aliases, live provider import and duplicate prevention.
- External recipes without a target-language translation retain the original and show an explicit translation-unavailable label. Automatic translation is not configured. These changes cover the recipe flow; login, onboarding and the rest of the app are not fully localized.
- Screenshot: `screenshots/recipe-cooking-zh-20261004.jpg`.

## 2026-10-04: app-wide Chinese/English support

- Added a global persisted language switch and localized existing UI labels across authentication, onboarding, fridge/scanning, meal planning/calendar, shopping, settings, legal disclosures and AI consent/chat. User-entered values, names, identifiers and canonical API option values remain unchanged; the account deletion token remains `DELETE`.
- Calendar dates/weekdays use the selected locale. Meal history/plans display supplied bilingual recipe titles. AI chat requests include language; catalog-backed fallback responses, quick actions and insights support Chinese/English. Insights cache keys include language and limit.
- Added authenticated, rate-limited `POST /recipes/:id/translate` and optional `GET /recipes/:id?language=en|zh`. Structured translation validates IDs, completeness and numeric tokens, preserves original measurements/timings and authored translations, saves only target-language text in a transaction, and reuses saved translations. Provider failures leave originals available. Automatic translation is off by default and restricted to published approved public source recipes.
- Configure a valid backend `OPENAI_API_KEY` and a structured-output-capable `RECIPE_TRANSLATION_MODEL` (defaults to `OPENAI_MODEL`) for online translation. Set `RECIPE_AUTO_TRANSLATE=true` only when automatic public recipe translation is wanted. Local keys are placeholders, so real provider translation has **not** been exercised; six mocked translation tests cover caching/deduplication, validation, stale-source rejection and failure handling. Reference: https://developers.openai.com/api/docs/guides/structured-outputs
- Verification: frontend TypeScript and 19 tests pass; backend TypeScript and all 48 tests pass (HTTP tests require local port access). Updated local API health is checked. Chrome login UI switches instantly between languages while retaining the entered email; screenshot: `screenshots/login-zh-20261004.jpg`. Previous recipe flow acceptance remains documented above. Full physical-device acceptance and production deployment remain outstanding.

## 2026-10-04: English-only TestFlight 1.0.1

- User requested removal of Chinese UI and upload to TestFlight. The client now fixes language to English, ignores previously persisted Chinese preference, removes all language selectors and Chinese search suggestions. Existing source/user data is preserved.
- App and package versions are 1.0.1. EAS remote iOS build number increased from 19 to 20. Local frontend TypeScript and 19 tests pass; EAS production environment release checks pass and production API health reports HTTP 200 with PostgreSQL/Redis connected.
- Build sources staged in an isolated `/tmp/friyo-testflight-1.0.1` directory; local environment files, native archives, dependencies and the unrelated parent home Git repository are excluded from upload.
- EAS build: f93aff3b-a62c-440f-9c0c-f24b5b225dd9 (https://expo.dev/accounts/rachel_gui/projects/new-expo-name/builds/f93aff3b-a62c-440f-9c0c-f24b5b225dd9).
- Initial auto-submit rejected the optional What to Test field because changelog submission requires Enterprise. Retrying the same build without that field; no duplicate build requested. Upload/Apple processing status is recorded below when verified.
- Screenshot: `screenshots/login-en-only-20261004.jpg`; English login has no language selector.
- Submission retry scheduled successfully: f3f0d59b-f0ff-4781-bdac-9ca07d774e45 (https://expo.dev/accounts/rachel_gui/projects/new-expo-name/submissions/f3f0d59b-f0ff-4781-bdac-9ca07d774e45). Initially awaiting build completion. Added and passed an English-release regression test confirming language cannot switch to Chinese or hydrate an old Chinese preference; local frontend test count is now 20. No application code changed after uploading the build sources.
- Build 20 failed in Xcode: existing App Store provisioning profile lacks Push Notifications / `aps-environment`. The scheduled submission was canceled, so no new version has reached TestFlight.
- Retried interactive credential validation (remote build number now 21). Existing Apple session expired; Keychain login succeeded, but Apple requires a six-digit 2FA code. Credential refresh is waiting for that code. No second archive has been uploaded yet. Do not remove push entitlements to bypass the signing error.

## 2026-10-06: latest TestFlight upload completed

- Rechecked the latest local source: frontend TypeScript and all 20 tests pass. Sources staged in `/private/tmp/friyo-testflight-20261006`, excluding local environment files, native projects and the unrelated parent Git repository.
- Apple account verification completed. Enabled Push Notifications for `com.friyo.app`, generated a new active App Store provisioning profile (`ZR574F7273`) and configured an APNs key in EAS. Existing push entitlements were preserved.
- Version **1.0.1, build 23** successfully built: https://expo.dev/accounts/rachel_gui/projects/new-expo-name/builds/1c09a802-ad5c-444c-95c8-4556231fa4d7 (EAS status `FINISHED`).
- Automatic TestFlight submission completed successfully: https://expo.dev/accounts/rachel_gui/projects/new-expo-name/submissions/757259a6-740d-466d-9ceb-5a91ddd7d669 (EAS status `FINISHED`, no submission error). Apple processing and tester availability were not independently verified.

## 2026-10-12: pre-launch tracker FRI-001–FRI-009

- FRI-001: splash/plugin and Android adaptive foreground use existing transparent login-mascot.png (RGBA alpha 0–255). The iOS store icon remains opaque.
- FRI-002: recipe details render the API cooking timeline. Migration 008 adds explicit parallel_with_step_number. Only authored independent hands-on steps fitting a wait window overlap; curated chicken sauce and pasta garlic steps are annotated. Other recipes remain sequential.
- FRI-003: home includes a Shopping List entry. Existing local shopping data/storage key are preserved.
- FRI-004: keyword suggestions refresh on focus from profile-ranked cuisines, meal types and tags. The bounded catalog expansion script previews six letter queries, preserves source instructions/measurements, and prevents duplicates. Import requires --apply and an explicit FRIYO_CATALOG_DATABASE_URL.
- FRI-005: tabs use back history; search-opened recipe details navigate to the existing search tab, preserving query, filters and results.
- FRI-006: bottom-right recipe action invokes native sharing with title, description and available source URL. Meal logging remains in cooking completion.
- FRI-007: home bookmark buttons save/unsave through the API, show selected/busy state and refresh the shared saved-recipes query. Bookmark and navigation buttons are separate.
- FRI-008: renewed consent permits AI chat to send at most 50 unchecked shopping items, containing only name, quantity and unit. Backend nested validation rejects malformed/oversized inputs. Provider prompts and English fallback distinguish planned purchases from food already available. Privacy disclosure includes shopping items; consent v2 requires agreement to the expanded scope.
- FRI-009 (partial): migration 009 adds server-controlled VIP expiry. GET /ai/usage reports entitlement and allowance; Settings displays status and the AI Pro entry opens Settings. Active VIP bypasses optional daily chat/suggestion/nutrition quota. Redis atomically enforces AI_FREE_DAILY_LIMIT when configured; absent/zero preserves current free access. Rate limits remain. No client action grants VIP. Store purchase, transaction verification, restore and renewal/refund handling still require subscription product/pricing decisions.

Checks completed: mobile TypeScript and 21 regression tests; backend TypeScript and 60 tests (including HTTP contracts, safe overlap, shopping validation/prompts, active/expired VIP allowance). Catalog-letter validation and recommendation-driven tag checks also passed. Live read-only TheMealDB preview found 113 source recipes across 13 categories; no database writes.

Release requirements:

1. Apply migrations 008 and 009 through the normal backed-up release migration process.
2. Build the backend, then preview with THEMEALDB_API_KEY set and node scripts/expand-recipe-catalog.cjs. Explicitly set FRIYO_CATALOG_DATABASE_URL and add --apply to import. Never commit credentials. Public App Store use requires a supporter key: https://www.themealdb.com/api.php.
3. Deploy backend before app; check search-suggestions, for-cooking and ai/usage endpoints. Rebuild native assets for splash/icon changes.
4. Accept shopping access, save/error retry, search→detail→back/hardware back, sharing, parallel cooking, AI consent/context and expired VIP on a device.
5. Configure VIP product ID, price/billing period and free allowance policy; implement verified store lifecycle before offering purchases.

Optional backend output build and iOS Metro export stalled without completion and were stopped; neither is claimed as passed. No release database migrations, catalog import, deployment, signed native build or physical-device acceptance were performed in this pass. Implemented rows are Under Review; catalog rollout and VIP purchasing are In Progress. Verified checkboxes remain false until acceptance is recorded.

## 2026-10-19: cloud release and TestFlight build 25

- User authorized bulk recipe import and a new TestFlight upload, then deferred import until a TheMealDB supporter key is available. Production has no THEMEALDB_API_KEY; local configuration uses development key 1. Read-only cloud verification found 5 recipes, none sourced from TheMealDB. No catalog import performed.
- Mobile TypeScript and all 21 tests passed. Backend build and all 60 tests passed; HTTP tests required local socket permission outside the sandbox.
- After explicit user approval, created a private local cloud database backup at `/private/tmp/friyo-release-20261019/before-release.dump` (103024 bytes, mode 0600). Applied migrations 007–009 transactionally; previous cloud migration history ended at 006.
- Deployed isolated backend sources without local environment files: Railway deployment `e5d79233-704d-4ca6-93aa-be90de0215db` reached SUCCESS. Live verification passed health (PostgreSQL/Redis), authenticated recipe list/detail/cooking, search suggestions and AI usage. Created and deleted only a disposable verification account.
- Isolated mobile release sources at `/private/tmp/friyo-release-20261019/mobile`; production EAS variables target the existing Railway cloud API. Build 24 stopped at local fingerprint computation before a cloud build was created. Retried with EAS_SKIP_AUTO_FINGERPRINT=1; version 1.0.1 build 25 entered cloud build, ID `bee6b2f5-eedd-4dea-ab13-22438dd8da05`.
- Scheduled TestFlight submission `077b088d-d903-4c0a-aeb8-e34ec2d852e1` using the existing App Store Connect API key. Final build/submission result pending verification below. Apple processing, tester availability and physical-device acceptance are not yet verified.
- Final Expo verification: build 25 status FINISHED; TestFlight submission status FINISHED with no error. Build: https://expo.dev/accounts/rachel_gui/projects/new-expo-name/builds/bee6b2f5-eedd-4dea-ab13-22438dd8da05 . Submission: https://expo.dev/accounts/rachel_gui/projects/new-expo-name/submissions/077b088d-d903-4c0a-aeb8-e34ec2d852e1 . This confirms EAS upload success; Apple processing/tester availability remain independently unverified.

## 2026-10-19: TheMealDB test catalog imported

- User explicitly selected the public development key 1 for this test import. Ran the bounded a–f catalog preview: 113 recipes across 13 categories. Did not configure key 1 on the production service; public App Store release still requires the appropriate supporter key.
- Refreshed the explicitly approved private local backup at `/private/tmp/friyo-release-20261019/before-catalog-import.dump` (105212 bytes, mode 0600).
- Ran `scripts/expand-recipe-catalog.cjs --apply` against the existing Railway cloud database, supplying the target connection privately. Script verified 113 new recipes and all 113 preview source IDs present. Cloud aggregate count is 118 total recipes, including 113 TheMealDB recipes and the original 5.
- Live cloud app API verification passed imported recipe listing, image URL, ingredients, steps and for-cooking response (sample: Flapper Pie). The API rejected unsupported limit=100; verification passed with limit=20. Disposable verification accounts were deleted. No new app build required for this server catalog update.

## 2026-10-19: expanded ready-made catalog across a–z

- User clarified they want more ready-made recipes, rather than Xiaohongshu link/screenshot import. Inspected `haokuang/xiachuji` at commit `87b81301722517615fdee13738ff4d5ce9f75068`; it is an import application, not the requested ready-made dataset. No code, accounts or services from that project were incorporated.
- Expanded the bounded TheMealDB V1 discovery script from a–f to a–z, retaining its maximum of 20 recipes per letter. Preview found 363 source recipes across 14 categories. Four existing external-recipe import tests passed.
- Refreshed the previously approved private backup at `/private/tmp/friyo-release-20261019/before-alphabet-import.dump` (222450 bytes, mode 0600). Imported with the user-selected free test key, supplied only to the one-off script, not the production service configuration.
- Import verified 250 new recipes and all 363 preview source IDs present. Final cloud count: 368 recipes (363 TheMealDB plus 5 originals). Aggregate verification found zero imported recipes missing an image URL, ingredients or steps.
- Live app API passed listing, imported detail and cooking response; sample: Zemiakové Placky. Disposable verification account deleted. No new native build or backend deployment needed for this data-only expansion; cloud app remains on the previously deployed backend and TestFlight build 25.

## 2026-10-19: additional TestFlight upload, build 26

- User explicitly requested another native upload after catalog expansion. Refreshed isolated mobile sources and built version 1.0.1 build 26 against the existing cloud API using production EAS variables and existing signing credentials.
- Build `102fd9e6-d0d5-47cf-989d-e819e50f6f93` reached FINISHED; submission `f4c90015-e4fd-4069-b01a-3399389b6a39` reached FINISHED with no error. Apple processing/tester availability remain unverified.
- During this build, user asked why imported recipes have no timer. Confirmed the importer does not set durationMin and cooking UI shows a timer only when durationMin > 0. No timer extraction or manual timer change was implemented in build 26. Cloud catalog remains 368 recipes.

## 2026-10-19: fridge and completion fixes, TestFlight build 27

- User requested uploading the latest fixes to TestFlight. Frontend TypeScript and all 21 tests passed; release configuration check passed using EAS production variables.
- Staged isolated current mobile sources without local environment files or native project folders. EAS built version 1.0.1 (27), build `974dd1cd-d869-441e-a354-30dcc46d91b3`, status FINISHED. Automatic submission `253a85ad-d352-41e6-83dd-0da99492885f` reached FINISHED with no error.
- Deployed only the changed recommendation service and seasoning helper over the previous isolated backend source. Railway deployment `58d9e342-fbf2-48d5-9079-49b98e2ab951` reached SUCCESS; live health returned HTTP 200 with database and Redis connected. No migrations or catalog changes performed.
- Changes include home update prompt removal, first-entry Fridge modal, empty inventory home, separate main-ingredient match and seasoning confirmation, clearer button treatment, explicit cooking history save feedback, correct inventory navigation and restarting cooking with selected servings. Relevant backend tests (8) passed before release.
- EAS upload success verified; Apple processing, tester availability and physical-device acceptance remain independently unverified.

## 2026-10-25: feedback follow-up, TestFlight build 29

- User explicitly requested TestFlight upload after the feedback fixes. Mobile TypeScript and all 21 tests passed again; release preflight passed using existing EAS production variables.
- Staged current mobile sources in `/private/tmp/friyo-release-20261025/mobile`, excluding environment files, native directories, repository backups and local build outputs. Application source matches the workspace (macOS metadata excluded).
- The optional local fingerprint calculation stalled before a build was created for reserved build number 28. Interrupted that invocation and used Expo's supported `EAS_SKIP_AUTO_FINGERPRINT=1`; remote version increment produced version 1.0.1 (29).
- Build `70beaaa2-efac-4bd8-8e51-5246c3eb69c0` and automatic submission `e2046242-cd62-4a4a-8027-436088bd708a` were created using existing signing credentials and App Store Connect API key. Final results are recorded below once confirmed.
- Railway status failed with expired OAuth (`invalid_grant` / unauthorized). No backend deployment or database migration was performed in this release attempt. Backend changes authored on October 25, including removal of automatic demo inventory, remain pending deployment; existing production records were not modified.
- Final Expo verification: build 29 status FINISHED and its automatic iOS submission status FINISHED, both with no error. Build: https://expo.dev/accounts/rachel_gui/projects/new-expo-name/builds/70beaaa2-efac-4bd8-8e51-5246c3eb69c0 . Submission: https://expo.dev/accounts/rachel_gui/projects/new-expo-name/submissions/e2046242-cd62-4a4a-8027-436088bd708a . This confirms successful upload; Apple processing and tester availability were not independently verified.

## 2026-10-25: production backend follow-up completed

- User requested backend deployment and confirmed the scoped Railway CLI authorization. Reauthenticated the existing CLI for Rachel Gui's Projects / friyo_backend after the earlier device code expired.
- Relevant backend build and 10 regression checks passed. Created a private pre-update PostgreSQL backup at `/private/tmp/friyo-release-20261025/before-backend-update.dump` (483470 bytes, mode 0600). Existing migrations through VipEntitlement1791800000001 and the corresponding user column were verified before deployment.
- Deployed isolated current backend sources to the existing production API service. Deployment `989e366c-3349-4f81-9728-af592b7d761b` reached SUCCESS. This activates the October 25 empty-fridge, preference ranking and seasoning changes previously pending during TestFlight build 29.
- Applied only pending additive migration QuickRecipeCatalog1792900000000 in a transaction. Verified all 10 added recipes have at least 3 ingredient lines and exactly 3 steps; catalog increased from 368 to 378 recipes. Existing user inventories were not cleared or rewritten.
- Live health reported API OK, PostgreSQL connected and Redis connected. Actual authenticated API acceptance passed: new account remains empty across repeated fridge reads; empty fridge yields no fridge matches but preference recommendations remain available; oil alone creates no fridge match; Chinese tomato/egg names yield 100% main-ingredient coverage for the new tomato egg recipe; recipe detail and cooking responses contain steps/ingredients with unknown calories kept null; saving cooking history succeeds, retry uses the same log, and month history contains it.
- The disposable verification account and its test inventory/history were deleted through the authenticated account-deletion endpoint after successful acceptance. No personal account was used for write tests.
- Production endpoint remains https://friyo-api-production.up.railway.app/api/v1 ; TestFlight version 1.0.1 (29) uses the same endpoint and needs no additional native upload for these backend changes. Physical-device acceptance remains separate.

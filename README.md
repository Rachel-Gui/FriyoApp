# Friyo — AI-Powered Food Inventory and Meal Planning

## Snapshot

- Period: 2026–Present
- Role: Full-Stack Software Engineer
- Platform: iOS application, API platform, and operations dashboard
- Status: Active MVP; deployment and production claims require final verification

## Product

Friyo is a full-stack food-management product connecting an Expo/React Native
mobile app, a NestJS API, and a Next.js operations console.

- AI-assisted fridge and receipt scanning
- Ingredient inventory, expiry tracking, filtering, and editing
- Personalized recipe discovery, adaptation, and guided cooking
- Weekly and monthly meal planning with meal logging
- AI chat with recipe recommendations and consent controls
- Community feed, posts, comments, likes, parties, and moderation
- Email/social authentication and user profile management
- Push notifications for expiry reminders and operational messages
- Admin workflows for users, recipes, ingredients, agreements, banners, reports,
  analytics, administrators, and notifications

## Contributions

- Architected an iOS application with a nine-step onboarding flow.
- Designed a modular backend and a broad REST API surface across nine domains.
- Built asynchronous image processing with Redis and Bull queues, retry policies,
  and AI/provider fallback logic.
- Implemented PostgreSQL entities, migrations, indexing, and Redis caching.
- Added token rotation, role-based access control, rate limiting, and OAuth flows.
- Created deployment definitions for Docker, Railway, AWS, and EAS.

## Repository map

| Path | Purpose | Main stack |
| --- | --- | --- |
| `FriyoAPP/` | Consumer mobile application and native iOS project | Expo 54, React Native 0.81, Expo Router, Zustand |
| `friyo-backend/` | API, jobs, database entities, and infrastructure | NestJS 11, TypeORM, PostgreSQL, Redis/Bull, AWS |
| `friyo-admin/` | Internal operations and analytics console | Next.js 15, Ant Design, React Query, NextAuth |
| `photos/` | Product-flow reference images and design exports | PNG/SVG |
| `Images/` | Additional product and presentation visuals | PNG/JPG |

## Architecture

```text
Friyo mobile app ─┐
                  ├── REST API / OpenAPI ── PostgreSQL
Admin console ────┘          │
                             ├── Redis + Bull workers
                             ├── AWS S3 / Rekognition / SES
                             ├── OpenAI
                             └── Firebase Cloud Messaging
```

The backend modules cover authentication, users, fridge, recipes, meal plans, AI,
community, notifications, administration, and health. Database entities and
migrations live under `friyo-backend/src/database`.

## Local development

### Prerequisites

- Node.js 22.12+
- npm
- PostgreSQL
- Redis
- Xcode and CocoaPods for native iOS development

### Backend

```bash
cd friyo-backend
cp .env.example .env
npm install
npm run migration:run
npm run seed:run
npm run start:dev
```

Use `docker compose up` from `friyo-backend/` for the included local service setup.

### Mobile app

```bash
cd FriyoAPP
npm install
npm start
```

Launch an Expo target, or run `npm run ios`, `npm run android`, or `npm run web`.

### Admin console

```bash
cd friyo-admin
cp .env.local.example .env.local
npm install
npm run dev
```

The admin console is available at `http://localhost:3000` by default.

## Configuration

Real credentials are excluded from version control. Start from:

- `friyo-backend/.env.example`
- `friyo-admin/.env.local.example`

Integrations include PostgreSQL, Redis, JWT, Google/Apple/Facebook authentication,
OpenAI, AWS, Firebase, and Elasticsearch.

## Deployment assets

- `friyo-backend/Dockerfile` and `docker-compose.yml`
- `friyo-backend/railway.json`
- `friyo-backend/infra/aws/` for ECS, WAF, and CloudWatch
- `friyo-backend/.github/workflows/` for deployment workflows
- `FriyoAPP/eas.json` for Expo Application Services builds

## Launch preparation

See [上线准备与验收](docs/LAUNCH_CHECKLIST.md) for configuration, deployment order,
TestFlight checks and remaining release blockers, and [validation evidence](docs/VALIDATION.md)
for checks actually run. Native social login and push require a development or release
build and real provider configuration; Expo Go is insufficient for launch acceptance.

## Open Questions / 待补充

- Confirm whether “launched” means TestFlight, App Store, internal pilot, or
  production customers.
- Add defensible endpoint counts, test coverage, user counts, latency, and
  reliability metrics.
- Add a concise explanation of individual versus team ownership.
- Link a public demo or explain any private deployment constraints.

## Security

Do not commit `.env` files, provider private keys, service-account JSON, signing
certificates, or production credentials. Example environment files contain
placeholders only.

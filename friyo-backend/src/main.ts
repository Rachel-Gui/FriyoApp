import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const port        = config.get<number>('app.port') ?? 3000;
  const nodeEnv     = config.get<string>('app.nodeEnv');
  const frontendUrl = config.get<string>('app.frontendUrl') ?? 'http://localhost:8081';
  const adminUrl    = config.get<string>('app.adminUrl')    ?? 'http://localhost:3001';

  // ── Security — Helmet ─────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc:     ["'self'"],
          scriptSrc:      ["'self'"],
          styleSrc:       ["'self'", "'unsafe-inline'"],
          imgSrc:         ["'self'", 'data:', 'https:'],
          connectSrc:     ["'self'"],
          fontSrc:        ["'self'", 'https:', 'data:'],
          objectSrc:      ["'none'"],
          mediaSrc:       ["'self'"],
          frameSrc:       ["'none'"],
          upgradeInsecureRequests: nodeEnv === 'production' ? [] : null,
        },
      },
      hidePoweredBy:  true,
      noSniff:        true,
      xssFilter:      true,
      hsts: nodeEnv === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // ── Security — CORS ───────────────────────────────────────────────────────
  const allowedOrigins =
    nodeEnv === 'production'
      ? [frontendUrl, adminUrl, 'https://friyo.app', 'https://admin.friyo.app']
      : true; // allow all in dev

  app.enableCors({
    origin:         allowedOrigins,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-RateLimit-Remaining'],
    credentials:    true,
    maxAge:         86_400, // 24h preflight cache
  });

  // ── Global prefix ──────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  // Configure trusted proxy hops explicitly for the actual hosting topology.
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (Number.isInteger(proxyHops) && proxyHops > 0) app.getHttpAdapter().getInstance().set('trust proxy', proxyHops);

  // ── Validation ─────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global interceptors & filters ─────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  // ── Swagger (dev only) ────────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Friyo API')
      .setDescription('Friyo food app backend API documentation')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('fridge', 'Fridge & ingredient inventory')
      .addTag('recipes', 'Recipe CRUD and discovery')
      .addTag('meal-plans', 'Weekly meal planning')
      .addTag('community', 'Social & community features')
      .addTag('ai', 'AI-powered recipe and fridge analysis')
      .addTag('admin', 'Admin panel endpoints')
      .addTag('notifications', 'Push & email notifications')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);
  console.log(`\n🚀  Friyo API running on: http://localhost:${port}/api/v1`);
  if (nodeEnv !== 'production') {
    console.log(`📚  Swagger docs:        http://localhost:${port}/api/docs\n`);
  }
}

bootstrap();

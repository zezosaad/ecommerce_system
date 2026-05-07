import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Capture the raw request body for webhook signature verification.
  app.use(
    express.json({
      verify: (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );

  const apiPrefix = process.env.API_PREFIX ?? '/api/v1';
  app.setGlobalPrefix(apiPrefix);

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  const gitSha = process.env.GIT_SHA ?? 'dev';
  process.env.APP_VERSION = `0.1.0+${gitSha}`;

  const config = new DocumentBuilder()
    .setTitle('VendorHub API')
    .setDescription('VendorHub Platform Foundation API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.APP_PORT ?? 3000);
}

bootstrap();

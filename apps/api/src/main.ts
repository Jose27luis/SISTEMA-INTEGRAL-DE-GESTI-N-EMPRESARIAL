import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ENTORNO } from './config/environment.module';
import type { Entorno } from './config/environment';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const entorno = app.get<Entorno>(ENTORNO);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: entorno.CORS_ORIGIN, credentials: true });
  app.enableShutdownHooks();

  await app.listen(entorno.PORT, '0.0.0.0');
}

void iniciar();

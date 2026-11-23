import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { AppModule } from './app.module';
import { FiltroExcepciones } from './common/http/exception.filter';
import type { Entorno } from './config/environment';
import { ENTORNO } from './config/environment.module';

async function iniciar(): Promise<void> {
  z.config(z.locales.es());

  const app = await NestFactory.create(AppModule);
  const entorno = app.get<Entorno>(ENTORNO);

  app.useGlobalFilters(new FiltroExcepciones());
  app.enableCors({ origin: entorno.CORS_ORIGIN, credentials: true });
  app.enableShutdownHooks();

  await app.listen(entorno.PORT, '0.0.0.0');
}

void iniciar();

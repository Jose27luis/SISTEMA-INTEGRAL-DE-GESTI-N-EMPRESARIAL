import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { TrabajadorModule } from './worker.module';

async function iniciar(): Promise<void> {
  z.config(z.locales.es());

  const app = await NestFactory.createApplicationContext(TrabajadorModule);
  app.enableShutdownHooks();
}

void iniciar();

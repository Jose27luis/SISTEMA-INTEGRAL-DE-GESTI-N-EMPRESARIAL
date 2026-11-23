import { Module } from '@nestjs/common';
import { cargarEntorno } from './environment';

export const ENTORNO = Symbol('ENTORNO');

@Module({
  providers: [
    {
      provide: ENTORNO,
      useFactory: cargarEntorno,
    },
  ],
  exports: [ENTORNO],
})
export class EntornoModule {}

import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ErrorApi } from '@sige/types';
import type { z } from 'zod';

export class ValidacionZod<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly esquema: T) {}

  transform(valor: unknown): z.output<T> {
    const resultado = this.esquema.safeParse(valor);

    if (!resultado.success) {
      const cuerpo: ErrorApi = {
        mensaje: 'Revise los datos ingresados.',
        errores: resultado.error.issues.map((problema) => ({
          campo: problema.path.map(String).join('.'),
          mensaje: problema.message,
        })),
      };

      throw new BadRequestException(cuerpo);
    }

    return resultado.data;
  }
}

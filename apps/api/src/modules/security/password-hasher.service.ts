import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

const OPCIONES_ARGON2 = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const TEXTO_REFERENCIA = 'referencia-para-igualar-tiempos';

@Injectable()
export class HashContrasenas {
  private hashReferencia: Promise<string> | null = null;

  hashear(contrasena: string): Promise<string> {
    return hash(contrasena, OPCIONES_ARGON2);
  }

  async verificar(hashGuardado: string, contrasena: string): Promise<boolean> {
    try {
      return await verify(hashGuardado, contrasena);
    } catch {
      return false;
    }
  }

  async simularVerificacion(contrasena: string): Promise<void> {
    this.hashReferencia ??= this.hashear(TEXTO_REFERENCIA);
    await this.verificar(await this.hashReferencia, contrasena);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { Entorno } from '../../config/environment';
import { ENTORNO } from '../../config/environment.module';
import { cifrarTexto, descifrarTexto } from './secret-cipher';

@Injectable()
export class CifradorSecretos {
  private readonly clave: Buffer;

  constructor(@Inject(ENTORNO) entorno: Entorno) {
    this.clave = Buffer.from(entorno.MFA_CLAVE_CIFRADO, 'hex');
  }

  cifrar(texto: string): string {
    return cifrarTexto(texto, this.clave);
  }

  descifrar(cifrado: string): string {
    return descifrarTexto(cifrado, this.clave);
  }
}

import { describe, expect, it } from 'vitest';
import { HashContrasenas } from './password-hasher.service';

describe('HashContrasenas', () => {
  const servicio = new HashContrasenas();

  it('usa Argon2id con 19 MiB de memoria y 2 iteraciones', async () => {
    const resultado = await servicio.hashear('luna verde sobre el rio');

    expect(resultado.startsWith('$argon2id$')).toBe(true);
    expect(resultado).toContain('m=19456,t=2');
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const resultado = await servicio.hashear('luna verde sobre el rio');

    await expect(servicio.verificar(resultado, 'luna verde sobre el rio')).resolves.toBe(true);
    await expect(servicio.verificar(resultado, 'luna roja sobre el rio')).resolves.toBe(false);
  });

  it('devuelve falso ante un hash con formato inválido', async () => {
    await expect(servicio.verificar('no-es-un-hash', 'cualquier cosa')).resolves.toBe(false);
  });
});

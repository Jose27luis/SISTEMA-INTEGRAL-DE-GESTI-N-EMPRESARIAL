import { describe, expect, it } from 'vitest';
import { evaluarContrasena } from './password-policy';

const contexto = { correo: 'maria.quispe@ejemplo.pe', nombre: 'María Quispe Huamán' };

describe('evaluarContrasena', () => {
  it('acepta una frase larga sin datos personales ni secuencias predecibles', () => {
    expect(evaluarContrasena('luna verde sobre el rio', contexto)).toEqual([]);
  });

  it('rechaza contraseñas de menos de 12 caracteres', () => {
    expect(evaluarContrasena('Corta#2026', contexto)).toContain('Debe tener al menos 12 caracteres.');
  });

  it('rechaza secuencias predecibles sin importar mayúsculas ni tildes', () => {
    expect(evaluarContrasena('MiContraseña-Segura-99', contexto).length).toBeGreaterThan(0);
    expect(evaluarContrasena('nubes123456altas', contexto).length).toBeGreaterThan(0);
    expect(evaluarContrasena('TorresParaSiempre!', contexto).length).toBeGreaterThan(0);
  });

  it('rechaza la contraseña que contiene el usuario del correo', () => {
    expect(evaluarContrasena('xx-maria.quispe-xx', contexto)).toContain(
      'No puede contener su usuario de correo.',
    );
  });

  it('rechaza la contraseña que contiene el nombre aunque se escriba sin tilde', () => {
    expect(evaluarContrasena('montaña-huaman-azul', contexto)).toContain('No puede contener su nombre.');
  });

  it('rechaza la repetición de un único carácter', () => {
    expect(evaluarContrasena('zzzzzzzzzzzzzz', contexto)).toContain('No puede repetir un único carácter.');
  });
});

import { describe, expect, it } from 'vitest';
import {
  accionAlRegistrarAvance,
  accionDeEnvio,
  ESTADOS_TAREA,
  estaAtrasada,
  estadoTrasAccion,
} from './task-states';

describe('estadoTrasAccion', () => {
  it('recorre el ciclo completo con aprobación y una observación', () => {
    expect(estadoTrasAccion('PENDIENTE', 'INICIAR', true)).toBe('EN_PROCESO');
    expect(estadoTrasAccion('EN_PROCESO', 'TERMINAR', true)).toBe('EN_REVISION');
    expect(estadoTrasAccion('EN_REVISION', 'OBSERVAR', true)).toBe('OBSERVADA');
    expect(estadoTrasAccion('OBSERVADA', 'CORREGIR', true)).toBe('CORREGIDA');
    expect(estadoTrasAccion('CORREGIDA', 'REENVIAR', true)).toBe('EN_REVISION');
    expect(estadoTrasAccion('EN_REVISION', 'APROBAR', true)).toBe('APROBADA');
    expect(estadoTrasAccion('APROBADA', 'FINALIZAR', true)).toBe('FINALIZADA');
  });

  it('terminar una tarea sin aprobación la finaliza directamente', () => {
    expect(estadoTrasAccion('EN_PROCESO', 'TERMINAR', false)).toBe('FINALIZADA');
  });

  it('solo permite cancelar tareas abiertas que no están en revisión', () => {
    expect(estadoTrasAccion('PENDIENTE', 'CANCELAR', true)).toBe('CANCELADA');
    expect(estadoTrasAccion('EN_PROCESO', 'CANCELAR', true)).toBe('CANCELADA');
    expect(estadoTrasAccion('OBSERVADA', 'CANCELAR', true)).toBe('CANCELADA');
    expect(estadoTrasAccion('EN_REVISION', 'CANCELAR', true)).toBeNull();
    expect(estadoTrasAccion('FINALIZADA', 'CANCELAR', true)).toBeNull();
  });

  it('rechaza toda transición no definida', () => {
    const permitidas = new Set([
      'PENDIENTE:INICIAR',
      'EN_PROCESO:TERMINAR',
      'EN_REVISION:OBSERVAR',
      'OBSERVADA:CORREGIR',
      'CORREGIDA:REENVIAR',
      'EN_REVISION:APROBAR',
      'APROBADA:FINALIZAR',
      'PENDIENTE:CANCELAR',
      'EN_PROCESO:CANCELAR',
      'OBSERVADA:CANCELAR',
    ]);
    const acciones = [
      'INICIAR',
      'TERMINAR',
      'OBSERVAR',
      'CORREGIR',
      'REENVIAR',
      'APROBAR',
      'FINALIZAR',
      'CANCELAR',
    ] as const;

    for (const estado of ESTADOS_TAREA) {
      for (const accion of acciones) {
        const resultado = estadoTrasAccion(estado, accion, true);
        expect(resultado === null).toBe(!permitidas.has(`${estado}:${accion}`));
      }
    }
  });
});

describe('estaAtrasada', () => {
  it('marca atrasada una tarea abierta con fecha límite pasada', () => {
    expect(estaAtrasada('EN_PROCESO', '2026-11-20', '2026-11-23')).toBe(true);
  });

  it('no marca atrasada la tarea que vence hoy ni las cerradas', () => {
    expect(estaAtrasada('PENDIENTE', '2026-11-23', '2026-11-23')).toBe(false);
    expect(estaAtrasada('FINALIZADA', '2026-11-01', '2026-11-23')).toBe(false);
    expect(estaAtrasada('CANCELADA', '2026-11-01', '2026-11-23')).toBe(false);
  });
});

describe('accionAlRegistrarAvance', () => {
  it('inicia una tarea pendiente y marca como corregida una observada', () => {
    expect(accionAlRegistrarAvance('PENDIENTE')).toBe('INICIAR');
    expect(accionAlRegistrarAvance('OBSERVADA')).toBe('CORREGIR');
  });

  it('no cambia el estado en los demás casos', () => {
    expect(accionAlRegistrarAvance('EN_PROCESO')).toBeNull();
    expect(accionAlRegistrarAvance('CORREGIDA')).toBeNull();
  });
});

describe('accionDeEnvio', () => {
  it('termina una tarea en proceso y reenvía una corregida', () => {
    expect(accionDeEnvio('EN_PROCESO')).toBe('TERMINAR');
    expect(accionDeEnvio('CORREGIDA')).toBe('REENVIAR');
  });

  it('no permite enviar desde otros estados', () => {
    expect(accionDeEnvio('PENDIENTE')).toBeNull();
    expect(accionDeEnvio('OBSERVADA')).toBeNull();
    expect(accionDeEnvio('EN_REVISION')).toBeNull();
  });
});

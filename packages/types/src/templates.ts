import { z } from 'zod';
import { esquemaListaItems, esquemaPrioridad, esquemaTextoItem } from './tasks';

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `Máximo ${String(maximo)} caracteres.`)
    .transform((valor) => (valor === '' ? null : valor))
    .nullable();

export const esquemaPlantillaEntrada = z
  .object({
    nombre: z.string().trim().min(3, 'Ingrese el nombre de la plantilla.').max(120),
    titulo: z.string().trim().min(3, 'Ingrese el título que tendrán las tareas.').max(200),
    instrucciones: textoOpcional(5000),
    prioridad: esquemaPrioridad,
    diasPlazo: z.number().int().min(0, 'Mínimo 0 días.').max(365, 'Máximo 365 días.'),
    requiereAprobacion: z.boolean(),
    requiereEvidencia: z.boolean(),
    evidenciaRequerida: textoOpcional(300),
    items: esquemaListaItems,
  })
  .superRefine((plantilla, contexto) => {
    if (plantilla.requiereEvidencia && plantilla.evidenciaRequerida === null) {
      contexto.addIssue({ code: 'custom', path: ['evidenciaRequerida'], message: 'Indique qué evidencia se exige.' });
    }
  });

export type PlantillaEntrada = z.infer<typeof esquemaPlantillaEntrada>;

export const esquemaPlantilla = z.object({
  id: z.uuid(),
  nombre: z.string(),
  titulo: z.string(),
  instrucciones: z.string().nullable(),
  prioridad: esquemaPrioridad,
  diasPlazo: z.number().int(),
  requiereAprobacion: z.boolean(),
  requiereEvidencia: z.boolean(),
  evidenciaRequerida: z.string().nullable(),
  items: z.array(z.string()),
  activo: z.boolean(),
  reglas: z.number().int().nonnegative(),
});

export type Plantilla = z.infer<typeof esquemaPlantilla>;

export const FRECUENCIAS = ['MENSUAL', 'SEMANAL'] as const;

export const esquemaFrecuencia = z.enum(FRECUENCIAS);

export type Frecuencia = z.infer<typeof esquemaFrecuencia>;

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

export const esquemaReglaEntrada = z
  .object({
    plantillaId: z.uuid('Seleccione la plantilla.'),
    clienteId: z.uuid().nullable(),
    responsableId: z.uuid('Seleccione al responsable.'),
    revisorId: z.uuid().nullable(),
    frecuencia: esquemaFrecuencia,
    diaDelMes: z.number().int().min(1, 'Entre 1 y 28.').max(28, 'Entre 1 y 28.').nullable(),
    diaDeSemana: z.number().int().min(1).max(7).nullable(),
    vigenteDesde: z.iso.date('Ingrese desde cuándo rige.'),
    vigenteHasta: z.iso.date().nullable(),
  })
  .superRefine((regla, contexto) => {
    if (regla.frecuencia === 'MENSUAL' && regla.diaDelMes === null) {
      contexto.addIssue({ code: 'custom', path: ['diaDelMes'], message: 'Indique el día del mes (1 a 28).' });
    }

    if (regla.frecuencia === 'SEMANAL' && regla.diaDeSemana === null) {
      contexto.addIssue({ code: 'custom', path: ['diaDeSemana'], message: 'Indique el día de la semana.' });
    }

    if (regla.vigenteHasta !== null && regla.vigenteHasta < regla.vigenteDesde) {
      contexto.addIssue({ code: 'custom', path: ['vigenteHasta'], message: 'No puede terminar antes de empezar.' });
    }

    if (regla.revisorId !== null && regla.revisorId === regla.responsableId) {
      contexto.addIssue({ code: 'custom', path: ['revisorId'], message: 'El revisor debe ser distinto del responsable.' });
    }
  });

export type ReglaEntrada = z.infer<typeof esquemaReglaEntrada>;

const esquemaPersona = z.object({ id: z.uuid(), nombre: z.string() });

export const esquemaRegla = z.object({
  id: z.uuid(),
  plantilla: z.object({ id: z.uuid(), nombre: z.string() }),
  cliente: z.object({ id: z.uuid(), razonSocial: z.string() }).nullable(),
  responsable: esquemaPersona,
  revisor: esquemaPersona.nullable(),
  frecuencia: esquemaFrecuencia,
  diaDelMes: z.number().int().nullable(),
  diaDeSemana: z.number().int().nullable(),
  vigenteDesde: z.iso.date(),
  vigenteHasta: z.iso.date().nullable(),
  activo: z.boolean(),
  proximaFecha: z.iso.date().nullable(),
  tareasGeneradas: z.number().int().nonnegative(),
});

export type Regla = z.infer<typeof esquemaRegla>;

export const esquemaItemVerificacion = z.object({
  id: z.uuid(),
  texto: z.string(),
  orden: z.number().int(),
  completado: z.boolean(),
  completadoPor: z.string().nullable(),
  completadoEn: z.iso.datetime().nullable(),
});

export type ItemVerificacion = z.infer<typeof esquemaItemVerificacion>;

export const esquemaItemEntrada = z.object({ texto: esquemaTextoItem });

export type ItemEntrada = z.infer<typeof esquemaItemEntrada>;

export const esquemaMarcaItem = z.object({ completado: z.boolean() });

export type MarcaItem = z.infer<typeof esquemaMarcaItem>;

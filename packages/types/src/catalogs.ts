import { z } from 'zod';

export const TIPOS_CATALOGO = ['areas', 'cargos', 'tipos-vinculo', 'regimenes-tributarios'] as const;

export const esquemaTipoCatalogo = z.enum(TIPOS_CATALOGO);

export type TipoCatalogo = z.infer<typeof esquemaTipoCatalogo>;

export const ETIQUETAS_CATALOGO: Record<TipoCatalogo, { plural: string; singular: string; descripcion: string }> = {
  areas: {
    plural: 'Áreas',
    singular: 'área',
    descripcion: 'Áreas de la empresa a las que pertenece cada trabajador.',
  },
  cargos: {
    plural: 'Cargos',
    singular: 'cargo',
    descripcion: 'Cargos que ocupan los trabajadores.',
  },
  'tipos-vinculo': {
    plural: 'Tipos de vínculo',
    singular: 'tipo de vínculo',
    descripcion: 'Modalidades de contratación del personal.',
  },
  'regimenes-tributarios': {
    plural: 'Regímenes tributarios',
    singular: 'régimen tributario',
    descripcion: 'Regímenes tributarios aplicables a los clientes.',
  },
};

export const esquemaElementoCatalogo = z.object({
  id: z.uuid(),
  nombre: z.string(),
  activo: z.boolean(),
  enUso: z.number().int().nonnegative(),
});

export const esquemaReferenciaCatalogo = z.object({
  id: z.uuid(),
  nombre: z.string(),
});

export const esquemaNombreCatalogo = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(80, 'Máximo 80 caracteres.'),
});

export type ElementoCatalogo = z.infer<typeof esquemaElementoCatalogo>;
export type ReferenciaCatalogo = z.infer<typeof esquemaReferenciaCatalogo>;
export type NombreCatalogo = z.infer<typeof esquemaNombreCatalogo>;

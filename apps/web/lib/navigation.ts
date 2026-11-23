import type { CodigoPermiso } from '@sige/types';

export type IconoNavegacion = 'inicio' | 'cuenta' | 'usuarios' | 'roles' | 'auditoria';

export interface ElementoNavegacion {
  ruta: string;
  etiqueta: string;
  icono: IconoNavegacion;
  permiso: CodigoPermiso | null;
}

export interface GrupoNavegacion {
  titulo: string;
  elementos: ElementoNavegacion[];
}

export const NAVEGACION: GrupoNavegacion[] = [
  {
    titulo: 'General',
    elementos: [
      { ruta: '/inicio', etiqueta: 'Inicio', icono: 'inicio', permiso: null },
      { ruta: '/mi-cuenta', etiqueta: 'Mi cuenta', icono: 'cuenta', permiso: null },
    ],
  },
  {
    titulo: 'Administración',
    elementos: [
      { ruta: '/configuracion/usuarios', etiqueta: 'Usuarios', icono: 'usuarios', permiso: 'usuario:ver' },
      { ruta: '/configuracion/roles', etiqueta: 'Roles y permisos', icono: 'roles', permiso: 'rol:ver' },
      { ruta: '/auditoria', etiqueta: 'Auditoría', icono: 'auditoria', permiso: 'auditoria:ver' },
    ],
  },
];

export function navegacionPermitida(permisos: readonly CodigoPermiso[]): GrupoNavegacion[] {
  return NAVEGACION.map((grupo) => ({
    ...grupo,
    elementos: grupo.elementos.filter(
      (elemento) => elemento.permiso === null || permisos.includes(elemento.permiso),
    ),
  })).filter((grupo) => grupo.elementos.length > 0);
}

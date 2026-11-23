import type { CodigoPermiso } from '@sige/types';

export type IconoNavegacion =
  | 'inicio'
  | 'cuenta'
  | 'mi-trabajo'
  | 'tareas'
  | 'notificaciones'
  | 'clientes'
  | 'personal'
  | 'usuarios'
  | 'roles'
  | 'catalogos'
  | 'auditoria';

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
      { ruta: '/mi-trabajo', etiqueta: 'Mi trabajo', icono: 'mi-trabajo', permiso: 'tarea:ver' },
      { ruta: '/notificaciones', etiqueta: 'Notificaciones', icono: 'notificaciones', permiso: null },
      { ruta: '/mi-cuenta', etiqueta: 'Mi cuenta', icono: 'cuenta', permiso: null },
    ],
  },
  {
    titulo: 'Operación',
    elementos: [
      { ruta: '/tareas', etiqueta: 'Tareas', icono: 'tareas', permiso: 'tarea:ver' },
      { ruta: '/clientes', etiqueta: 'Clientes', icono: 'clientes', permiso: 'cliente:ver' },
      { ruta: '/personal', etiqueta: 'Personal', icono: 'personal', permiso: 'personal:ver' },
    ],
  },
  {
    titulo: 'Administración',
    elementos: [
      { ruta: '/configuracion/usuarios', etiqueta: 'Usuarios', icono: 'usuarios', permiso: 'usuario:ver' },
      { ruta: '/configuracion/roles', etiqueta: 'Roles y permisos', icono: 'roles', permiso: 'rol:ver' },
      {
        ruta: '/configuracion/catalogos',
        etiqueta: 'Catálogos',
        icono: 'catalogos',
        permiso: 'catalogo:gestionar',
      },
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

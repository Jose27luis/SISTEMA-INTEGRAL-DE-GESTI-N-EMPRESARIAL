import type { CodigoPermiso } from '@sige/types';

export type IconoNavegacion =
  | 'inicio'
  | 'cuenta'
  | 'mi-trabajo'
  | 'tareas'
  | 'notificaciones'
  | 'historial'
  | 'por-revisar'
  | 'reportes'
  | 'obligaciones'
  | 'cronograma'
  | 'tipos-obligacion'
  | 'documentos'
  | 'tipos-documento'
  | 'recurrentes'
  | 'plantillas'
  | 'reporte-clientes'
  | 'procesos'
  | 'ingresos'
  | 'egresos'
  | 'reportes-financieros'
  | 'catalogos-financieros'
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
      { ruta: '/mi-historial', etiqueta: 'Mi historial', icono: 'historial', permiso: 'tarea:ver' },
      { ruta: '/notificaciones', etiqueta: 'Notificaciones', icono: 'notificaciones', permiso: null },
      { ruta: '/mi-cuenta', etiqueta: 'Mi cuenta', icono: 'cuenta', permiso: null },
    ],
  },
  {
    titulo: 'Operación',
    elementos: [
      { ruta: '/tareas', etiqueta: 'Tareas', icono: 'tareas', permiso: 'tarea:ver' },
      { ruta: '/por-revisar', etiqueta: 'Por revisar', icono: 'por-revisar', permiso: 'tarea:revisar' },
      {
        ruta: '/tareas/recurrentes',
        etiqueta: 'Tareas recurrentes',
        icono: 'recurrentes',
        permiso: 'plantilla:gestionar',
      },
      { ruta: '/obligaciones', etiqueta: 'Obligaciones', icono: 'obligaciones', permiso: 'obligacion:ver' },
      {
        ruta: '/configuracion/cronograma',
        etiqueta: 'Cronograma tributario',
        icono: 'cronograma',
        permiso: 'obligacion:ver',
      },
      { ruta: '/documentos', etiqueta: 'Documentos', icono: 'documentos', permiso: 'documento:ver' },
      { ruta: '/clientes', etiqueta: 'Clientes', icono: 'clientes', permiso: 'cliente:ver' },
      { ruta: '/personal', etiqueta: 'Personal', icono: 'personal', permiso: 'personal:ver' },
      { ruta: '/reportes', etiqueta: 'Reportes', icono: 'reportes', permiso: 'reporte:personal' },
      {
        ruta: '/reportes/clientes',
        etiqueta: 'Reporte de clientes',
        icono: 'reporte-clientes',
        permiso: 'reporte:clientes',
      },
    ],
  },
  {
    titulo: 'Finanzas',
    elementos: [
      { ruta: '/finanzas/ingresos', etiqueta: 'Ingresos y cobranza', icono: 'ingresos', permiso: 'comercial:ver' },
      { ruta: '/finanzas/egresos', etiqueta: 'Egresos', icono: 'egresos', permiso: 'finanza:egresos' },
      {
        ruta: '/reportes/finanzas',
        etiqueta: 'Reportes financieros',
        icono: 'reportes-financieros',
        permiso: 'finanza:ingresos',
      },
    ],
  },
  {
    titulo: 'Administración',
    elementos: [
      {
        ruta: '/configuracion/finanzas',
        etiqueta: 'Catálogos financieros',
        icono: 'catalogos-financieros',
        permiso: 'finanza:catalogos',
      },
      { ruta: '/configuracion/usuarios', etiqueta: 'Usuarios', icono: 'usuarios', permiso: 'usuario:ver' },
      { ruta: '/configuracion/roles', etiqueta: 'Roles y permisos', icono: 'roles', permiso: 'rol:ver' },
      {
        ruta: '/configuracion/catalogos',
        etiqueta: 'Catálogos',
        icono: 'catalogos',
        permiso: 'catalogo:gestionar',
      },
      {
        ruta: '/configuracion/obligaciones',
        etiqueta: 'Tipos de obligación',
        icono: 'tipos-obligacion',
        permiso: 'cronograma:gestionar',
      },
      {
        ruta: '/configuracion/tipos-documento',
        etiqueta: 'Tipos de documento',
        icono: 'tipos-documento',
        permiso: 'catalogo:gestionar',
      },
      {
        ruta: '/configuracion/plantillas',
        etiqueta: 'Plantillas de tareas',
        icono: 'plantillas',
        permiso: 'plantilla:gestionar',
      },
      { ruta: '/auditoria', etiqueta: 'Auditoría', icono: 'auditoria', permiso: 'auditoria:ver' },
      {
        ruta: '/configuracion/procesos',
        etiqueta: 'Procesos automáticos',
        icono: 'procesos',
        permiso: 'auditoria:ver',
      },
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

import {
  esquemaCargaEquipo,
  esquemaOpcionesTarea,
  esquemaPlantilla,
  esquemaProyectoDetalle,
  esquemaTareaDetalle,
} from '@sige/types';
import { cn } from '@sige/ui/cn';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { fechaHoyEnLima } from '@/lib/format';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { crearTarea } from '../actions';
import { type Borrador, ConstructorTarea } from './task-builder';

export const metadata: Metadata = { title: 'Nueva tarea · TORRES ASOCIADOS' };

interface PropiedadesPaginaNuevaTarea {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function primerValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

function sumarDias(fecha: string, dias: number): string {
  const resultado = new Date(`${fecha}T00:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

export default async function PaginaNuevaTarea({ searchParams }: PropiedadesPaginaNuevaTarea): Promise<ReactNode> {
  const perfil = await obtenerPerfil();

  if (!tienePermiso(perfil, 'tarea:crear')) {
    return <SinAcceso />;
  }

  const crudos = await searchParams;
  const clienteInicial = z.uuid().safeParse(primerValor(crudos.cliente));
  const plantillaId = primerValor(crudos.plantilla);
  const proyectoId = z.uuid().safeParse(primerValor(crudos.proyecto));
  const duplicarId = z.uuid().safeParse(primerValor(crudos.duplicar));
  const etapaId = primerValor(crudos.etapa);
  const [opciones, carga, plantillas, proyecto, original] = await Promise.all([
    solicitarApi('/tareas/opciones', { esquema: esquemaOpcionesTarea }),
    solicitarApi('/tareas/carga', { esquema: esquemaCargaEquipo }),
    solicitarApi('/plantillas', { esquema: esquemaPlantilla.array() }),
    proyectoId.success
      ? solicitarApi(`/proyectos/${proyectoId.data}`, { esquema: esquemaProyectoDetalle })
      : Promise.resolve(null),
    duplicarId.success
      ? solicitarApi(`/tareas/${duplicarId.data}`, { esquema: esquemaTareaDetalle })
      : Promise.resolve(null),
  ]);
  const hoy = fechaHoyEnLima();
  const etapa = proyecto?.ok === true ? (proyecto.datos.etapas.find(({ id }) => id === etapaId) ?? null) : null;
  const clienteDelProyecto = proyecto?.ok === true && etapa !== null ? (proyecto.datos.cliente?.id ?? null) : undefined;
  const disponibles = plantillas.ok ? plantillas.datos : [];
  const duplicada = original?.ok === true ? original.datos : null;
  const plantilla = duplicada === null ? (disponibles.find(({ id }) => id === plantillaId) ?? null) : null;
  const clienteBase =
    clienteDelProyecto !== undefined ? clienteDelProyecto : clienteInicial.success ? clienteInicial.data : null;
  const enlacePlantilla = (id: string | null): string => {
    const consulta = new URLSearchParams();

    if (clienteInicial.success) {
      consulta.set('cliente', clienteInicial.data);
    }

    if (proyectoId.success && etapa !== null) {
      consulta.set('proyecto', proyectoId.data);
      consulta.set('etapa', etapa.id);
    }

    if (id !== null) {
      consulta.set('plantilla', id);
    }

    return `/tareas/nueva?${consulta.toString()}`;
  };

  let inicial: Borrador = {
    titulo: '',
    instrucciones: '',
    clienteId: clienteBase ?? '',
    prioridad: 'MEDIA',
    fechaInicio: hoy,
    fechaLimite: '',
    responsableIds: [],
    colaboradorIds: [],
    revisorId: '',
    requiereAprobacion: false,
    requiereEvidencia: false,
    evidenciaRequerida: '',
    items: [],
  };

  if (plantilla !== null) {
    inicial = {
      ...inicial,
      titulo: plantilla.titulo,
      instrucciones: plantilla.instrucciones ?? '',
      prioridad: plantilla.prioridad,
      fechaLimite: sumarDias(hoy, plantilla.diasPlazo),
      requiereAprobacion: plantilla.requiereAprobacion,
      requiereEvidencia: plantilla.requiereEvidencia,
      evidenciaRequerida: plantilla.evidenciaRequerida ?? '',
      items: plantilla.items,
    };
  }

  if (duplicada !== null) {
    const plazo = Math.max(1, diasEntre(duplicada.fechaInicio ?? duplicada.creadoEn.slice(0, 10), duplicada.fechaLimite));

    inicial = {
      ...inicial,
      titulo: duplicada.titulo,
      instrucciones: duplicada.instrucciones ?? '',
      clienteId: duplicada.cliente?.id ?? '',
      prioridad: duplicada.prioridad,
      fechaLimite: sumarDias(hoy, plazo),
      responsableIds: [duplicada.responsable.id],
      colaboradorIds: duplicada.colaboradores.map(({ id }) => id),
      revisorId: duplicada.revisor?.id ?? '',
      requiereAprobacion: duplicada.requiereAprobacion,
      requiereEvidencia: duplicada.requiereEvidencia,
      evidenciaRequerida: duplicada.evidenciaRequerida ?? '',
      items: duplicada.items.map(({ texto }) => texto),
    };
  }

  return (
    <>
      <EncabezadoPagina
        antetitulo={
          <Link href="/tareas" className="text-sm font-medium text-marino-claro hover:underline">
            ← Tareas
          </Link>
        }
        titulo={duplicada === null ? 'Nueva tarea' : 'Duplicar tarea'}
        descripcion={
          duplicada === null
            ? 'El responsable y los colaboradores reciben una notificación al guardarla.'
            : `Copia de ${duplicada.codigo} con el mismo plazo contado desde hoy. Ajuste lo que haga falta.`
        }
      />
      <div className="flex flex-col gap-6">
        {proyecto?.ok === true && etapa !== null ? (
          <Alerta tono="info" titulo={`Proyecto ${proyecto.datos.codigo} · ${proyecto.datos.nombre}`}>
            La tarea se agregará a la etapa «{etapa.nombre}». El responsable debe ser parte del equipo del proyecto
            {proyecto.datos.cliente === null ? '.' : ` y la tarea queda para ${proyecto.datos.cliente.razonSocial}.`}
          </Alerta>
        ) : null}
        {original?.ok === false ? (
          <Alerta tono="aviso">No se pudo cargar la tarea a duplicar: {original.error.mensaje}</Alerta>
        ) : null}
        {duplicada === null && disponibles.length > 0 ? (
          <Tarjeta
            titulo="Empezar desde una plantilla"
            descripcion="Completa título, instrucciones, plazo, evidencia y lista de verificación."
          >
            <nav aria-label="Plantillas" className="flex flex-wrap gap-2">
              <Link
                href={enlacePlantilla(null)}
                aria-current={plantilla === null ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-semibold',
                  plantilla === null ? 'border-marino bg-marino text-white' : 'border-borde text-marino hover:bg-marino/5',
                )}
              >
                Sin plantilla
              </Link>
              {disponibles.map((opcion) => (
                <Link
                  key={opcion.id}
                  href={enlacePlantilla(opcion.id)}
                  aria-current={plantilla?.id === opcion.id ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-semibold',
                    plantilla?.id === opcion.id
                      ? 'border-marino bg-marino text-white'
                      : 'border-borde text-marino hover:bg-marino/5',
                  )}
                >
                  {opcion.nombre}
                </Link>
              ))}
            </nav>
          </Tarjeta>
        ) : null}
        {!opciones.ok ? (
          <Alerta tono="error">{opciones.error.mensaje}</Alerta>
        ) : !carga.ok ? (
          <Alerta tono="error">{carga.error.mensaje}</Alerta>
        ) : (
          <ConstructorTarea
            key={duplicada?.id ?? plantilla?.id ?? 'libre'}
            accion={crearTarea}
            inicial={inicial}
            origen={duplicada !== null ? 'duplicado' : plantilla !== null ? 'plantilla' : 'nuevo'}
            carga={carga.datos}
            clientes={opciones.datos.clientes}
            plantillaId={plantilla?.id ?? null}
            etapaId={etapa?.id ?? null}
            claveBorrador={`sige:borrador-tarea:${perfil.usuario.id}${etapa === null ? '' : `:${etapa.id}`}`}
          />
        )}
      </div>
    </>
  );
}

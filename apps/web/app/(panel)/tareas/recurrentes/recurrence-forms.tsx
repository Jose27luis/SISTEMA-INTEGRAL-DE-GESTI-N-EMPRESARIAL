'use client';

import { DIAS_SEMANA, type Frecuencia, type Regla } from '@sige/types';
import { Campo, Insignia, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearFecha } from '@/lib/format';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

interface Opcion {
  id: string;
  nombre: string;
}

export function describirFrecuencia(regla: Pick<Regla, 'frecuencia' | 'diaDelMes' | 'diaDeSemana'>): string {
  if (regla.frecuencia === 'MENSUAL') {
    return `Cada mes, el día ${String(regla.diaDelMes ?? '')}`;
  }

  return `Cada semana, el ${(DIAS_SEMANA[(regla.diaDeSemana ?? 1) - 1] ?? '').toLowerCase()}`;
}

export function FormularioRegla({
  accion,
  plantillas,
  clientes,
  usuarios,
  fechaHoy,
}: {
  accion: AccionFormulario;
  plantillas: Opcion[];
  clientes: Opcion[];
  usuarios: Opcion[];
  fechaHoy: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('MENSUAL');
  const valor = (campo: string, predeterminado: string): string =>
    estado.exito ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} key={estado.exito ? 'creada' : 'regla'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Seleccion
        id="plantillaId"
        name="plantillaId"
        etiqueta="Plantilla"
        required
        defaultValue={valor('plantillaId', '')}
        error={estado.errores.plantillaId}
      >
        <option value="" disabled>
          Seleccione
        </option>
        {plantillas.map((plantilla) => (
          <option key={plantilla.id} value={plantilla.id}>
            {plantilla.nombre}
          </option>
        ))}
      </Seleccion>
      <Seleccion
        id="clienteId"
        name="clienteId"
        etiqueta="Cliente"
        ayuda="Sin cliente, se generan como tareas internas."
        defaultValue={valor('clienteId', '')}
        error={estado.errores.clienteId}
      >
        <option value="">Tarea interna</option>
        {clientes.map((cliente) => (
          <option key={cliente.id} value={cliente.id}>
            {cliente.nombre}
          </option>
        ))}
      </Seleccion>
      <div className="grid gap-4 sm:grid-cols-2">
        <Seleccion
          id="responsableId"
          name="responsableId"
          etiqueta="Responsable"
          required
          defaultValue={valor('responsableId', '')}
          error={estado.errores.responsableId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {usuarios.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nombre}
            </option>
          ))}
        </Seleccion>
        <Seleccion
          id="revisorId"
          name="revisorId"
          etiqueta="Revisor"
          ayuda="Obligatorio si la plantilla requiere aprobación."
          defaultValue={valor('revisorId', '')}
          error={estado.errores.revisorId}
        >
          <option value="">Sin revisor</option>
          {usuarios.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nombre}
            </option>
          ))}
        </Seleccion>
        <Seleccion
          id="frecuencia"
          name="frecuencia"
          etiqueta="Frecuencia"
          value={frecuencia}
          onChange={(evento) => {
            setFrecuencia(evento.target.value === 'SEMANAL' ? 'SEMANAL' : 'MENSUAL');
          }}
          error={estado.errores.frecuencia}
        >
          <option value="MENSUAL">Mensual</option>
          <option value="SEMANAL">Semanal</option>
        </Seleccion>
        {frecuencia === 'MENSUAL' ? (
          <Campo
            id="diaDelMes"
            name="diaDelMes"
            type="number"
            min={1}
            max={28}
            etiqueta="Día del mes"
            required
            defaultValue={valor('diaDelMes', '1')}
            error={estado.errores.diaDelMes}
          />
        ) : (
          <Seleccion
            id="diaDeSemana"
            name="diaDeSemana"
            etiqueta="Día de la semana"
            defaultValue={valor('diaDeSemana', '1')}
            error={estado.errores.diaDeSemana}
          >
            {DIAS_SEMANA.map((dia, indice) => (
              <option key={dia} value={indice + 1}>
                {dia}
              </option>
            ))}
          </Seleccion>
        )}
        <Campo
          id="vigenteDesde"
          name="vigenteDesde"
          type="date"
          etiqueta="Desde"
          required
          defaultValue={valor('vigenteDesde', fechaHoy)}
          error={estado.errores.vigenteDesde}
        />
        <Campo
          id="vigenteHasta"
          name="vigenteHasta"
          type="date"
          etiqueta="Hasta (opcional)"
          defaultValue={valor('vigenteHasta', '')}
          error={estado.errores.vigenteHasta}
        />
      </div>
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        Crear tarea recurrente
      </BotonEnvio>
    </form>
  );
}

export function FilaRegla({
  regla,
  cambiarActivo,
}: {
  regla: Regla;
  cambiarActivo: (anterior: EstadoFormulario) => Promise<EstadoFormulario>;
}): ReactNode {
  const [estado, accion] = useActionState(cambiarActivo, ESTADO_INICIAL);

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
            {regla.plantilla.nombre}
            {regla.activo ? <Insignia tono="exito">Activa</Insignia> : <Insignia>Pausada</Insignia>}
          </p>
          <p className="text-sm text-tinta">
            {describirFrecuencia(regla)} · {regla.cliente?.razonSocial ?? 'Interna'} · {regla.responsable.nombre}
            {regla.revisor === null ? '' : ` · revisa ${regla.revisor.nombre}`}
          </p>
          <p className="text-xs text-apagado">
            Desde {formatearFecha(regla.vigenteDesde)}
            {regla.vigenteHasta === null ? '' : ` hasta ${formatearFecha(regla.vigenteHasta)}`} ·{' '}
            {regla.tareasGeneradas} generadas
            {regla.proximaFecha === null ? '' : ` · próxima el ${formatearFecha(regla.proximaFecha)}`}
          </p>
        </div>
        <form action={accion}>
          <button
            type="submit"
            className={
              regla.activo
                ? 'min-h-11 rounded-md px-3 text-sm font-semibold text-rojo hover:bg-rojo-suave'
                : 'min-h-11 rounded-md px-3 text-sm font-semibold text-verde hover:bg-verde/10'
            }
          >
            {regla.activo ? 'Pausar' : 'Reanudar'}
          </button>
        </form>
      </div>
      {estado.mensaje !== null && !estado.exito ? <MensajeFormulario estado={estado} /> : null}
    </li>
  );
}

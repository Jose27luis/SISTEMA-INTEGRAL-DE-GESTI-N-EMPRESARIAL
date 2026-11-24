'use client';

import { type Acceso, ESTADOS_ACCESO, ETIQUETAS_ESTADO_ACCESO, type Plataforma } from '@sige/types';
import { AreaTexto, Campo, Casilla, Insignia, Seleccion } from '@sige/ui/components';
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

export function FormularioAcceso({
  accion,
  plataformas,
  equipo,
  acceso,
}: {
  accion: AccionFormulario;
  plataformas: Plataforma[];
  equipo: Opcion[];
  acceso?: Acceso;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const sufijo = acceso?.id ?? 'nuevo';
  const reiniciar = estado.exito && acceso === undefined;
  const valor = (campo: string, predeterminado: string): string =>
    reiniciar ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} key={reiniciar ? 'registrado' : 'acceso'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <p className="rounded-md bg-dorado-suave px-3 py-2 text-sm text-dorado-oscuro">
        Este registro no guarda contraseñas, Clave SOL, PIN, tokens ni códigos. Guárdelos en la bóveda y anote aquí solo
        la referencia de la entrada.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Seleccion
          id={`plataformaId-${sufijo}`}
          name="plataformaId"
          etiqueta="Plataforma"
          required
          defaultValue={valor('plataformaId', acceso?.plataforma.id ?? '')}
          error={estado.errores.plataformaId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {plataformas.map((plataforma) => (
            <option key={plataforma.id} value={plataforma.id}>
              {plataforma.nombre}
            </option>
          ))}
        </Seleccion>
        <Campo
          id={`identificador-${sufijo}`}
          name="identificador"
          etiqueta="Usuario o identificador (opcional)"
          ayuda="Nunca la clave."
          maxLength={120}
          autoComplete="off"
          defaultValue={valor('identificador', acceso?.identificador ?? '')}
          error={estado.errores.identificador}
        />
        <Campo
          id={`url-${sufijo}`}
          name="url"
          type="url"
          etiqueta="Dirección (opcional)"
          maxLength={300}
          defaultValue={valor('url', acceso?.url ?? '')}
          error={estado.errores.url}
        />
        <Seleccion
          id={`responsable-${sufijo}`}
          name="responsableAutorizadoId"
          etiqueta="Responsable autorizado"
          required
          defaultValue={valor('responsableAutorizadoId', acceso?.responsableAutorizado.id ?? '')}
          error={estado.errores.responsableAutorizadoId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {equipo.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre}
            </option>
          ))}
        </Seleccion>
        <Campo
          id={`fechaRevision-${sufijo}`}
          name="fechaRevision"
          type="date"
          etiqueta="Próxima revisión"
          required
          defaultValue={valor('fechaRevision', acceso?.fechaRevision ?? '')}
          error={estado.errores.fechaRevision}
        />
        <Seleccion
          id={`estado-${sufijo}`}
          name="estado"
          etiqueta="Estado"
          defaultValue={valor('estado', acceso?.estado ?? 'ACTIVO')}
          error={estado.errores.estado}
        >
          {ESTADOS_ACCESO.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETAS_ESTADO_ACCESO[opcion]}
            </option>
          ))}
        </Seleccion>
      </div>
      <Campo
        id={`referencia-${sufijo}`}
        name="referenciaBoveda"
        etiqueta="Referencia en la bóveda"
        ayuda="Por ejemplo: Bitwarden · Clientes / Razón social / SUNAT."
        required
        maxLength={300}
        autoComplete="off"
        defaultValue={valor('referenciaBoveda', acceso?.referenciaBoveda ?? '')}
        error={estado.errores.referenciaBoveda}
      />
      <Casilla
        id={`tieneMfa-${sufijo}`}
        name="tieneMfa"
        etiqueta="Tiene verificación en dos pasos"
        defaultChecked={acceso?.tieneMfa ?? false}
      />
      <AreaTexto
        id={`notas-${sufijo}`}
        name="notas"
        etiqueta="Notas (opcional)"
        maxLength={1000}
        defaultValue={valor('notas', acceso?.notas ?? '')}
        error={estado.errores.notas}
      />
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {acceso === undefined ? 'Registrar acceso' : 'Guardar cambios'}
      </BotonEnvio>
    </form>
  );
}

export function FilaAcceso({
  acceso,
  editar,
  plataformas,
  equipo,
  puedeGestionar,
}: {
  acceso: Acceso;
  editar: AccionFormulario;
  plataformas: Plataforma[];
  equipo: Opcion[];
  puedeGestionar: boolean;
}): ReactNode {
  const [abierto, setAbierto] = useState(false);

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
            {acceso.plataforma.nombre}
            <Insignia tono={acceso.estado === 'ACTIVO' ? 'exito' : 'neutro'}>{ETIQUETAS_ESTADO_ACCESO[acceso.estado]}</Insignia>
            {acceso.tieneMfa ? <Insignia tono="info">Dos pasos</Insignia> : null}
            {acceso.revisionVencida ? <Insignia tono="peligro">Revisión vencida</Insignia> : null}
          </p>
          <p className="break-words text-tinta">
            {acceso.identificador ?? 'Sin identificador'} · Bóveda: {acceso.referenciaBoveda}
          </p>
          <p className="text-xs text-apagado">
            Autorizado: {acceso.responsableAutorizado.nombre} · Revisar el {formatearFecha(acceso.fechaRevision)}
            {acceso.url === null ? '' : ` · ${acceso.url}`}
          </p>
          {acceso.notas === null ? null : <p className="mt-1 text-xs whitespace-pre-line text-tinta">{acceso.notas}</p>}
        </div>
        {puedeGestionar ? (
          <button
            type="button"
            onClick={() => {
              setAbierto(!abierto);
            }}
            aria-expanded={abierto}
            className="min-h-11 rounded-md px-3 text-sm font-semibold text-marino hover:bg-marino/5"
          >
            {abierto ? 'Cerrar' : 'Editar'}
          </button>
        ) : null}
      </div>
      {abierto ? (
        <div className="rounded-md border border-borde p-4">
          <FormularioAcceso accion={editar} plataformas={plataformas} equipo={equipo} acceso={acceso} />
        </div>
      ) : null}
    </li>
  );
}

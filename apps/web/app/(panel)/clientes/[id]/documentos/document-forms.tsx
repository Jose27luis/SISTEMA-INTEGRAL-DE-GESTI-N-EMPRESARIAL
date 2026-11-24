'use client';

import type { DocumentoEsperado } from '@sige/types';
import { AreaTexto, Campo, Insignia, Seleccion } from '@sige/ui/components';
import Link from 'next/link';
import { type ReactNode, useActionState, useState } from 'react';
import { FormularioConfirmacion } from '@/components/confirm-action-form';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearFecha } from '@/lib/format';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

export function FormularioCarpeta({
  accion,
  carpetas,
  padreInicial,
}: {
  accion: AccionFormulario;
  carpetas: { id: string; ruta: string }[];
  padreInicial: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} key={estado.exito ? 'creada' : 'carpeta'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Campo
        id="nombre-carpeta"
        name="nombre"
        etiqueta="Nombre de la carpeta"
        required
        maxLength={80}
        defaultValue={estado.exito ? '' : estado.valores.nombre}
        error={estado.errores.nombre}
      />
      {carpetas.length > 0 ? (
        <Seleccion
          id="padreId"
          name="padreId"
          etiqueta="Dentro de"
          defaultValue={estado.exito ? padreInicial : (estado.valores.padreId ?? padreInicial)}
          error={estado.errores.padreId}
        >
          <option value="">Raíz del expediente</option>
          {carpetas.map((carpeta) => (
            <option key={carpeta.id} value={carpeta.id}>
              {carpeta.ruta}
            </option>
          ))}
        </Seleccion>
      ) : null}
      <BotonEnvio variante="secundario" textoPendiente="Creando…" className="self-start">
        Crear carpeta
      </BotonEnvio>
    </form>
  );
}

export function FormularioRenombrarCarpeta({ accion, nombre }: { accion: AccionFormulario; nombre: string }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
        }}
        className="min-h-9 rounded-md px-2 text-sm font-semibold text-marino hover:bg-marino/5"
      >
        Renombrar
      </button>
    );
  }

  return (
    <form action={accionFormulario} className="flex w-full flex-col gap-3">
      <MensajeFormulario estado={estado} />
      <Campo
        id="renombrar-carpeta"
        name="nombre"
        etiqueta="Nuevo nombre"
        required
        maxLength={80}
        defaultValue={estado.valores.nombre ?? nombre}
        error={estado.errores.nombre}
      />
      <div className="flex gap-2">
        <BotonEnvio variante="secundario" textoPendiente="Guardando…">
          Guardar
        </BotonEnvio>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
          }}
          className="min-h-11 rounded-md px-3 text-sm font-semibold text-apagado hover:bg-fondo"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function FormularioEsperado({
  accion,
  tipos,
  periodoInicial,
}: {
  accion: AccionFormulario;
  tipos: { id: string; nombre: string }[];
  periodoInicial: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const valor = (campo: string, predeterminado: string): string =>
    estado.exito ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} key={estado.exito ? 'registrado' : 'esperado'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Seleccion
        id="tipoEsperado"
        name="tipoDocumentoId"
        etiqueta="Documento"
        required
        defaultValue={valor('tipoDocumentoId', '')}
        error={estado.errores.tipoDocumentoId}
      >
        <option value="" disabled>
          Seleccione
        </option>
        {tipos.map((tipo) => (
          <option key={tipo.id} value={tipo.id}>
            {tipo.nombre}
          </option>
        ))}
      </Seleccion>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="periodoEsperado"
          name="periodo"
          type="month"
          etiqueta="Periodo"
          required
          defaultValue={valor('periodo', periodoInicial)}
          error={estado.errores.periodo}
        />
        <Campo
          id="fechaLimite"
          name="fechaLimite"
          type="date"
          etiqueta="Fecha límite de entrega"
          required
          defaultValue={valor('fechaLimite', '')}
          error={estado.errores.fechaLimite}
        />
      </div>
      <AreaTexto
        id="descripcionEsperado"
        name="descripcion"
        etiqueta="Detalle (opcional)"
        maxLength={300}
        defaultValue={valor('descripcion', '')}
        error={estado.errores.descripcion}
      />
      <BotonEnvio variante="secundario" textoPendiente="Registrando…" className="self-start">
        Registrar documento esperado
      </BotonEnvio>
    </form>
  );
}

export function FilaEsperado({
  esperado,
  anular,
}: {
  esperado: DocumentoEsperado;
  anular: AccionFormulario | null;
}): ReactNode {
  const [abierto, setAbierto] = useState(false);

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-tinta">
            {esperado.tipoDocumento.nombre} · {esperado.periodo}
          </p>
          <p className="text-xs text-apagado">
            Entrega hasta el {formatearFecha(esperado.fechaLimite)}
            {esperado.descripcion === null ? '' : ` · ${esperado.descripcion}`}
          </p>
          {esperado.documento === null ? null : (
            <Link href={`/documentos/${esperado.documento.id}`} className="text-sm font-semibold text-marino-claro hover:underline">
              {esperado.documento.titulo}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {esperado.estado === 'RECIBIDO' ? (
            <Insignia tono="exito">Recibido</Insignia>
          ) : esperado.atrasado ? (
            <Insignia tono="peligro">No recibido</Insignia>
          ) : (
            <Insignia tono="aviso">Pendiente</Insignia>
          )}
          {anular !== null && esperado.estado === 'PENDIENTE' ? (
            <button
              type="button"
              onClick={() => {
                setAbierto(!abierto);
              }}
              aria-expanded={abierto}
              className="min-h-9 rounded-md px-2 text-sm font-semibold text-rojo hover:bg-rojo-suave"
            >
              {abierto ? 'Cerrar' : 'Anular'}
            </button>
          ) : null}
        </div>
      </div>
      {abierto && anular !== null ? (
        <div className="rounded-md border border-rojo/30 p-4">
          <FormularioConfirmacion
            accion={anular}
            etiquetaBoton="Anular documento esperado"
            textoPendiente="Anulando…"
            variante="peligro"
            pedirMotivo
            consecuencia="Deja de figurar como pendiente y no genera más avisos."
          />
        </div>
      ) : null}
    </li>
  );
}

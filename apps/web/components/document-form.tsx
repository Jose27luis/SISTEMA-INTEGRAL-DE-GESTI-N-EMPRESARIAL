'use client';

import {
  CONFIDENCIALIDADES,
  type DocumentoDetalle,
  ETIQUETAS_CONFIDENCIALIDAD,
  type OpcionesDocumentos,
  TAMANO_MAXIMO_DOCUMENTO_MB,
} from '@sige/types';
import { AreaTexto, Campo, Seleccion } from '@sige/ui/components';
import { Paperclip } from 'lucide-react';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearTamano } from '@/lib/format';

const FORMATOS_ACEPTADOS = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

interface CarpetaOpcion {
  id: string;
  ruta: string;
}

export function SelectorArchivo({ error, etiqueta }: { error: string | undefined; etiqueta: string }): ReactNode {
  const [archivo, setArchivo] = useState<{ nombre: string; tamano: number } | null>(null);
  const excede = archivo !== null && archivo.tamano > TAMANO_MAXIMO_DOCUMENTO_MB * 1024 * 1024;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="archivo" className="text-sm font-semibold text-tinta">
        {etiqueta}
      </label>
      <input
        id="archivo"
        name="archivo"
        type="file"
        required
        accept={FORMATOS_ACEPTADOS}
        aria-describedby="archivo-ayuda"
        onChange={(evento) => {
          const elegido = evento.target.files?.[0];
          setArchivo(elegido === undefined ? null : { nombre: elegido.name, tamano: elegido.size });
        }}
        className="block w-full text-sm text-apagado file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-marino/10 file:px-4 file:font-semibold file:text-marino hover:file:bg-marino/15"
      />
      <p id="archivo-ayuda" className="text-sm text-apagado">
        PDF, imágenes, Word, Excel o PowerPoint, hasta {TAMANO_MAXIMO_DOCUMENTO_MB} MB.
      </p>
      {archivo === null ? null : (
        <p className={excede ? 'flex items-center gap-2 text-sm text-rojo' : 'flex items-center gap-2 text-sm text-tinta'}>
          <Paperclip aria-hidden="true" className="size-4" />
          {archivo.nombre} · {formatearTamano(archivo.tamano)}
        </p>
      )}
      {error === undefined ? null : <p className="text-sm font-medium text-rojo">{error}</p>}
    </div>
  );
}

interface PropiedadesFormularioDocumento {
  accion: AccionFormulario;
  opciones: OpcionesDocumentos;
  clienteFijo: string | null;
  carpetas: CarpetaOpcion[];
  carpetaInicial?: string;
  documento?: DocumentoDetalle;
}

export function FormularioDocumento({
  accion,
  opciones,
  clienteFijo,
  carpetas,
  carpetaInicial = '',
  documento,
}: PropiedadesFormularioDocumento): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const edicion = documento !== undefined;
  const reiniciar = estado.exito && !edicion;
  const valor = (campo: string, predeterminado: string): string =>
    reiniciar ? predeterminado : (estado.valores[campo] ?? predeterminado);
  const [tipoId, setTipoId] = useState(documento?.tipoDocumento.id ?? '');
  const admiteVencimiento = opciones.tipos.find((tipo) => tipo.id === tipoId)?.admiteVencimiento ?? false;

  return (
    <form action={accionFormulario} key={reiniciar ? 'nuevo' : 'formulario'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Campo
        id="titulo"
        name="titulo"
        etiqueta="Título"
        required
        maxLength={200}
        defaultValue={valor('titulo', documento?.titulo ?? '')}
        error={estado.errores.titulo}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Seleccion
          id="tipoDocumentoId"
          name="tipoDocumentoId"
          etiqueta="Tipo de documento"
          required
          value={tipoId}
          onChange={(evento) => {
            setTipoId(evento.target.value);
          }}
          error={estado.errores.tipoDocumentoId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {opciones.tipos.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.nombre}
            </option>
          ))}
        </Seleccion>
        {clienteFijo === null && !edicion ? (
          <Seleccion
            id="clienteId"
            name="clienteId"
            etiqueta="Cliente"
            ayuda="Sin cliente es un documento interno: lo ven quien lo sube y Gerencia."
            defaultValue={valor('clienteId', '')}
            error={estado.errores.clienteId}
          >
            <option value="">Documento interno</option>
            {opciones.clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.razonSocial}
              </option>
            ))}
          </Seleccion>
        ) : null}
        {carpetas.length > 0 ? (
          <Seleccion
            id="carpetaId"
            name="carpetaId"
            etiqueta="Carpeta"
            defaultValue={valor('carpetaId', documento?.carpeta?.id ?? carpetaInicial)}
            error={estado.errores.carpetaId}
          >
            <option value="">Sin carpeta</option>
            {carpetas.map((carpeta) => (
              <option key={carpeta.id} value={carpeta.id}>
                {carpeta.ruta}
              </option>
            ))}
          </Seleccion>
        ) : null}
        <Seleccion
          id="areaId"
          name="areaId"
          etiqueta="Área (opcional)"
          defaultValue={valor('areaId', documento?.area?.id ?? '')}
          error={estado.errores.areaId}
        >
          <option value="">Sin área</option>
          {opciones.areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.nombre}
            </option>
          ))}
        </Seleccion>
        <Campo
          id="periodo"
          name="periodo"
          type="month"
          etiqueta="Periodo (opcional)"
          ayuda="Con periodo, cumple la documentación esperada de ese mes."
          defaultValue={valor('periodo', documento?.periodo ?? '')}
          error={estado.errores.periodo}
        />
        <Campo
          id="fechaDocumento"
          name="fechaDocumento"
          type="date"
          etiqueta="Fecha del documento (opcional)"
          defaultValue={valor('fechaDocumento', documento?.fechaDocumento ?? '')}
          error={estado.errores.fechaDocumento}
        />
        {admiteVencimiento ? (
          <Campo
            id="fechaVencimiento"
            name="fechaVencimiento"
            type="date"
            etiqueta="Vence el (opcional)"
            ayuda="Se avisa 30, 15, 7 y 1 día antes."
            defaultValue={valor('fechaVencimiento', documento?.fechaVencimiento ?? '')}
            error={estado.errores.fechaVencimiento}
          />
        ) : null}
        {opciones.puedeRestringir ? (
          <Seleccion
            id="confidencialidad"
            name="confidencialidad"
            etiqueta="Confidencialidad"
            defaultValue={valor('confidencialidad', documento?.confidencialidad ?? 'NORMAL')}
            error={estado.errores.confidencialidad}
          >
            {CONFIDENCIALIDADES.map((nivel) => (
              <option key={nivel} value={nivel}>
                {ETIQUETAS_CONFIDENCIALIDAD[nivel]}
              </option>
            ))}
          </Seleccion>
        ) : null}
      </div>
      {edicion ? null : (
        <>
          <SelectorArchivo error={estado.errores.archivo} etiqueta="Archivo" />
          <AreaTexto
            id="nota"
            name="nota"
            etiqueta="Nota de la versión (opcional)"
            maxLength={500}
            defaultValue={valor('nota', '')}
            error={estado.errores.nota}
          />
        </>
      )}
      <BotonEnvio textoPendiente={edicion ? 'Guardando…' : 'Subiendo…'} className="self-start">
        {edicion ? 'Guardar cambios' : 'Subir documento'}
      </BotonEnvio>
    </form>
  );
}

export function FormularioVersion({ accion }: { accion: AccionFormulario }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} key={estado.exito ? 'subida' : 'version'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <SelectorArchivo error={estado.errores.archivo} etiqueta="Archivo de la nueva versión" />
      <AreaTexto
        id="nota-version"
        name="nota"
        etiqueta="Qué cambió (opcional)"
        maxLength={500}
        defaultValue={estado.exito ? '' : estado.valores.nota}
        error={estado.errores.nota}
      />
      <BotonEnvio textoPendiente="Subiendo…" className="self-start">
        Subir versión
      </BotonEnvio>
    </form>
  );
}

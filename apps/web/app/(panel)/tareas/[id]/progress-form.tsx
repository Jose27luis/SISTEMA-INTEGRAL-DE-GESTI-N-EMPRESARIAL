'use client';

import { MAXIMO_EVIDENCIAS_POR_AVANCE, TAMANO_MAXIMO_EVIDENCIA_MB } from '@sige/types';
import { AreaTexto, Campo, Seleccion } from '@sige/ui/components';
import { Paperclip } from 'lucide-react';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearTamano } from '@/lib/format';

const FORMATOS_ACEPTADOS = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
const LIMITE_BYTES = TAMANO_MAXIMO_EVIDENCIA_MB * 1024 * 1024;

interface AvanceCorregible {
  id: string;
  etiqueta: string;
}

interface PropiedadesFormularioAvance {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  porcentajeActual: number;
  evidenciaRequerida: string | null;
  corregibles: AvanceCorregible[];
}

export function FormularioAvance({
  accion,
  porcentajeActual,
  evidenciaRequerida,
  corregibles,
}: PropiedadesFormularioAvance): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [archivos, setArchivos] = useState<{ nombre: string; tamano: number }[]>([]);
  const total = archivos.reduce((suma, archivo) => suma + archivo.tamano, 0);
  const excede = archivos.length > MAXIMO_EVIDENCIAS_POR_AVANCE || total > LIMITE_BYTES;

  return (
    <form
      action={(datos) => {
        setArchivos([]);
        accionFormulario(datos);
      }}
      className="flex flex-col gap-4"
    >
      <MensajeFormulario estado={estado} />
      <Campo
        id="actividad"
        name="actividad"
        etiqueta="Actividad realizada"
        required
        minLength={3}
        maxLength={200}
        defaultValue={estado.valores.actividad}
        error={estado.errores.actividad}
      />
      <AreaTexto
        id="descripcion"
        name="descripcion"
        etiqueta="Detalle"
        required
        rows={3}
        minLength={3}
        maxLength={5000}
        defaultValue={estado.valores.descripcion}
        error={estado.errores.descripcion}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="porcentaje"
          name="porcentaje"
          type="number"
          etiqueta="Avance total (%)"
          ayuda={`Actual: ${String(porcentajeActual)} %`}
          required
          min={0}
          max={100}
          step={1}
          defaultValue={estado.valores.porcentaje ?? String(porcentajeActual)}
          error={estado.errores.porcentaje}
        />
        <Campo
          id="minutosDedicados"
          name="minutosDedicados"
          type="number"
          etiqueta="Minutos dedicados"
          required
          min={0}
          max={1440}
          step={5}
          defaultValue={estado.valores.minutosDedicados ?? '0'}
          error={estado.errores.minutosDedicados}
        />
      </div>
      <details className="rounded-md border border-borde px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-marino">Dificultades, observaciones y próximo paso</summary>
        <div className="mt-4 flex flex-col gap-4">
          <AreaTexto
            id="dificultades"
            name="dificultades"
            etiqueta="Dificultades"
            rows={2}
            maxLength={2000}
            defaultValue={estado.valores.dificultades}
            error={estado.errores.dificultades}
          />
          <AreaTexto
            id="observaciones"
            name="observaciones"
            etiqueta="Observaciones"
            rows={2}
            maxLength={2000}
            defaultValue={estado.valores.observaciones}
            error={estado.errores.observaciones}
          />
          <Campo
            id="proximoPaso"
            name="proximoPaso"
            etiqueta="Próximo paso"
            maxLength={1000}
            defaultValue={estado.valores.proximoPaso}
            error={estado.errores.proximoPaso}
          />
          {corregibles.length === 0 ? null : (
            <Seleccion
              id="corrigeAId"
              name="corrigeAId"
              etiqueta="Corrige un avance anterior"
              ayuda="Los avances no se editan: registre uno nuevo que lo corrija."
              defaultValue={estado.valores.corrigeAId ?? ''}
              error={estado.errores.corrigeAId}
            >
              <option value="">No corrige ninguno</option>
              {corregibles.map((avance) => (
                <option key={avance.id} value={avance.id}>
                  {avance.etiqueta}
                </option>
              ))}
            </Seleccion>
          )}
        </div>
      </details>
      <div className="flex flex-col gap-2">
        <label htmlFor="evidencias" className="text-sm font-medium text-tinta">
          Evidencias
        </label>
        {evidenciaRequerida === null ? null : (
          <p className="text-sm text-dorado-oscuro">Se espera: {evidenciaRequerida}</p>
        )}
        <input
          id="evidencias"
          name="evidencias"
          type="file"
          multiple
          accept={FORMATOS_ACEPTADOS}
          aria-describedby="evidencias-ayuda"
          onChange={(evento) => {
            setArchivos(
              Array.from(evento.target.files ?? []).map((archivo) => ({ nombre: archivo.name, tamano: archivo.size })),
            );
          }}
          className="block w-full text-sm text-apagado file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-marino/10 file:px-4 file:font-semibold file:text-marino hover:file:bg-marino/15"
        />
        <p id="evidencias-ayuda" className="text-xs text-apagado">
          PDF, imágenes, Word, Excel o PowerPoint. Hasta {MAXIMO_EVIDENCIAS_POR_AVANCE} archivos y{' '}
          {TAMANO_MAXIMO_EVIDENCIA_MB} MB en total.
        </p>
        {archivos.length === 0 ? null : (
          <ul className="flex flex-col gap-1 text-sm">
            {archivos.map((archivo) => (
              <li key={archivo.nombre} className="flex items-center gap-2 text-tinta">
                <Paperclip aria-hidden="true" className="size-4 text-apagado" />
                <span className="truncate">{archivo.nombre}</span>
                <span className="shrink-0 text-xs text-apagado">{formatearTamano(archivo.tamano)}</span>
              </li>
            ))}
          </ul>
        )}
        {excede ? (
          <p className="text-sm font-medium text-rojo">
            Supera el límite de {MAXIMO_EVIDENCIAS_POR_AVANCE} archivos o {TAMANO_MAXIMO_EVIDENCIA_MB} MB en total.
          </p>
        ) : null}
        {estado.errores.evidencias === undefined ? null : (
          <p className="text-sm font-medium text-rojo">{estado.errores.evidencias}</p>
        )}
      </div>
      <BotonEnvio textoPendiente="Registrando…" className="self-start">
        Registrar avance
      </BotonEnvio>
    </form>
  );
}

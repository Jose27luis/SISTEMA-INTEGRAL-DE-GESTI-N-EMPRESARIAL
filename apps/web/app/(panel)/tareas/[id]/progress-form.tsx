'use client';

import { MAXIMO_EVIDENCIAS_POR_AVANCE } from '@sige/types';
import { AreaTexto, Campo, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useEffect, useState } from 'react';
import { CargadorArchivos } from '@/components/file-uploader';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

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
  const [registrados, setRegistrados] = useState(0);

  useEffect(() => {
    if (estado.exito) {
      setRegistrados((cantidad) => cantidad + 1);
    }
  }, [estado]);

  return (
    <form action={accionFormulario} key={registrados} className="flex flex-col gap-4">
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
        {evidenciaRequerida === null ? null : (
          <p className="rounded-md bg-dorado-suave px-3 py-2 text-sm text-dorado-oscuro">Se espera: {evidenciaRequerida}</p>
        )}
        <CargadorArchivos
          nombre="subidaIds"
          etiqueta="Evidencias"
          maximo={MAXIMO_EVIDENCIAS_POR_AVANCE}
          error={estado.errores.subidaIds ?? estado.errores.evidencias}
        />
      </div>
      <BotonEnvio textoPendiente="Registrando…" className="self-start">
        Registrar avance
      </BotonEnvio>
    </form>
  );
}

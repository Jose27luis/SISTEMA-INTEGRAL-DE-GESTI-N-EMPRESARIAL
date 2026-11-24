'use client';

import { DIGITOS_RUC, ETIQUETAS_GRUPO_CRONOGRAMA, GRUPOS_CRONOGRAMA, type GrupoCronograma } from '@sige/types';
import { Campo, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface CronogramaInicial {
  tipoObligacionId: string;
  periodo: string;
  grupo: GrupoCronograma;
  fuente: string;
  fechas: Record<string, string>;
}

interface PropiedadesFormularioCronograma {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  tipos: { id: string; nombre: string }[];
  inicial: CronogramaInicial;
}

export function FormularioCronograma({ accion, tipos, inicial }: PropiedadesFormularioCronograma): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const valor = (campo: string, predeterminado: string): string => estado.valores[campo] ?? predeterminado;
  const errorFechas = estado.errores.fechas;

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Seleccion
          id="tipoObligacionId"
          name="tipoObligacionId"
          etiqueta="Obligación"
          required
          defaultValue={valor('tipoObligacionId', inicial.tipoObligacionId)}
          error={estado.errores.tipoObligacionId}
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
        <Campo
          id="periodo"
          name="periodo"
          type="month"
          etiqueta="Periodo tributario"
          required
          defaultValue={valor('periodo', inicial.periodo)}
          error={estado.errores.periodo}
        />
        <Seleccion
          id="grupo"
          name="grupo"
          etiqueta="Grupo"
          defaultValue={valor('grupo', inicial.grupo)}
          error={estado.errores.grupo}
        >
          {GRUPOS_CRONOGRAMA.map((grupo) => (
            <option key={grupo} value={grupo}>
              {ETIQUETAS_GRUPO_CRONOGRAMA[grupo]}
            </option>
          ))}
        </Seleccion>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-tinta">Vencimiento según el último dígito del RUC</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {DIGITOS_RUC.map((digito) => (
            <Campo
              key={digito}
              id={`digito${digito}`}
              name={`digito${digito}`}
              type="date"
              etiqueta={`Dígito ${digito}`}
              required
              defaultValue={valor(`digito${digito}`, inicial.fechas[digito] ?? '')}
              error={estado.errores[`digito${digito}`]}
            />
          ))}
        </div>
        {errorFechas === undefined ? null : <p className="text-sm font-medium text-rojo">{errorFechas}</p>}
      </fieldset>
      <Campo
        id="fuente"
        name="fuente"
        etiqueta="Fuente oficial"
        ayuda="Resolución de Superintendencia o enlace de SUNAT de donde se tomaron las fechas."
        required
        maxLength={300}
        defaultValue={valor('fuente', inicial.fuente)}
        error={estado.errores.fuente}
      />
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        Guardar cronograma
      </BotonEnvio>
      <p className="text-sm text-apagado">
        Si el periodo ya estaba cargado, se reemplazan sus fechas y se reprograman las obligaciones generadas que aún no se
        presentan.
      </p>
    </form>
  );
}

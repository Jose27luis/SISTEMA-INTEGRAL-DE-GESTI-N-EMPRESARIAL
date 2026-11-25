'use client';

import { cn } from '@sige/ui/cn';
import { Campo, CampoHora, Casilla } from '@sige/ui/components';
import { type ReactNode, useId, useState } from 'react';

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
const LARGO_MAXIMO = 120;

interface Jornada {
  dias: boolean[];
  entrada: string;
  salida: string;
  conRefrigerio: boolean;
  refrigerioDesde: string;
  refrigerioHasta: string;
}

const JORNADA_INICIAL: Jornada = {
  dias: [true, true, true, true, true, false, false],
  entrada: '08:00',
  salida: '17:00',
  conRefrigerio: true,
  refrigerioDesde: '13:00',
  refrigerioHasta: '14:00',
};

function mayuscula(texto: string): string {
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;
}

function describirDias(dias: boolean[]): string {
  const elegidos = DIAS.filter((_, indice) => dias[indice] === true);
  const indices = dias.flatMap((elegido, indice) => (elegido ? [indice] : []));
  const primero = indices[0];
  const ultimo = indices.at(-1);
  const continuos =
    primero !== undefined && ultimo !== undefined && indices.length >= 3 && ultimo - primero + 1 === indices.length;

  if (elegidos.length === 0) {
    return '';
  }

  if (continuos) {
    return `${DIAS[primero] ?? ''} a ${DIAS[ultimo] ?? ''}`;
  }

  return elegidos.length === 1 ? (elegidos[0] ?? '') : `${elegidos.slice(0, -1).join(', ')} y ${elegidos.at(-1) ?? ''}`;
}

export function componerJornada(jornada: Jornada): string {
  const dias = describirDias(jornada.dias);

  if (dias === '' || jornada.entrada === '' || jornada.salida === '') {
    return '';
  }

  const refrigerio =
    jornada.conRefrigerio && jornada.refrigerioDesde !== '' && jornada.refrigerioHasta !== ''
      ? `, refrigerio de ${jornada.refrigerioDesde} a ${jornada.refrigerioHasta}`
      : '';

  return `${mayuscula(dias)} de ${jornada.entrada} a ${jornada.salida}${refrigerio}`;
}

export function leerJornada(texto: string): Jornada | null {
  const coincidencia = /^(.+?) de (\d{2}:\d{2}) a (\d{2}:\d{2})(?:, refrigerio de (\d{2}:\d{2}) a (\d{2}:\d{2}))?$/u.exec(texto.trim());

  if (coincidencia === null) {
    return null;
  }

  const [, textoDias = '', entrada = '', salida = '', desde, hasta] = coincidencia;
  const normal = textoDias.toLowerCase();
  const rango = /^(\S+) a (\S+)$/u.exec(normal);
  let dias: boolean[];

  if (rango === null) {
    const nombres = normal.split(/, | y /u);
    dias = DIAS.map((dia) => nombres.includes(dia));

    if (nombres.some((nombre) => !(DIAS as readonly string[]).includes(nombre))) {
      return null;
    }
  } else {
    const inicio = DIAS.indexOf(rango[1] as (typeof DIAS)[number]);
    const fin = DIAS.indexOf(rango[2] as (typeof DIAS)[number]);

    if (inicio < 0 || fin < inicio) {
      return null;
    }

    dias = DIAS.map((_, indice) => indice >= inicio && indice <= fin);
  }

  return {
    dias,
    entrada,
    salida,
    conRefrigerio: desde !== undefined,
    refrigerioDesde: desde ?? JORNADA_INICIAL.refrigerioDesde,
    refrigerioHasta: hasta ?? JORNADA_INICIAL.refrigerioHasta,
  };
}

export function SelectorJornada({
  nombre,
  etiqueta,
  valorInicial,
  error,
}: {
  nombre: string;
  etiqueta: string;
  valorInicial: string | undefined;
  error: string | undefined;
}): ReactNode {
  const base = useId();
  const textoInicial = valorInicial ?? '';
  const leida = textoInicial === '' ? JORNADA_INICIAL : leerJornada(textoInicial);
  const [manual, setManual] = useState(leida === null);
  const [jornada, setJornada] = useState<Jornada>(leida ?? JORNADA_INICIAL);
  const [texto, setTexto] = useState(textoInicial);
  const compuesto = componerJornada(jornada);
  const salidaAntes = jornada.entrada !== '' && jornada.salida !== '' && jornada.salida <= jornada.entrada;
  const refrigerioFuera =
    jornada.conRefrigerio &&
    (jornada.refrigerioDesde >= jornada.refrigerioHasta ||
      jornada.refrigerioDesde < jornada.entrada ||
      jornada.refrigerioHasta > jornada.salida);
  const cambiar = (parcial: Partial<Jornada>): void => {
    setJornada((actual) => ({ ...actual, ...parcial }));
  };

  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-borde p-4">
      <legend className="px-1 text-sm font-medium text-tinta">{etiqueta}</legend>
      <input type="hidden" name={nombre} value={manual ? texto : compuesto} />

      <div role="group" aria-label="Modo" className="inline-flex self-start rounded-lg border border-borde bg-fondo p-1">
        {[
          { clave: false, texto: 'Elegir días y horas' },
          { clave: true, texto: 'Escribir otro horario' },
        ].map((opcion) => (
          <button
            key={opcion.texto}
            type="button"
            aria-pressed={manual === opcion.clave}
            onClick={() => {
              if (opcion.clave && !manual) {
                setTexto(compuesto);
              }

              setManual(opcion.clave);
            }}
            className={cn(
              'min-h-9 rounded-md px-3 text-sm font-semibold transition-colors',
              manual === opcion.clave ? 'bg-superficie text-marino shadow-sm' : 'text-apagado hover:text-marino',
            )}
          >
            {opcion.texto}
          </button>
        ))}
      </div>

      {manual ? (
        <Campo
          id={`${base}-texto`}
          etiqueta="Horario"
          ayuda="Para turnos rotativos u horarios especiales."
          maxLength={LARGO_MAXIMO}
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
          }}
          error={error}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-tinta">Días de trabajo</span>
            <div role="group" aria-label="Días de trabajo" className="flex flex-wrap gap-2">
              {DIAS.map((dia, indice) => {
                const elegido = jornada.dias[indice] === true;

                return (
                  <button
                    key={dia}
                    type="button"
                    aria-pressed={elegido}
                    aria-label={dia}
                    onClick={() => {
                      cambiar({ dias: jornada.dias.map((valor, posicion) => (posicion === indice ? !valor : valor)) });
                    }}
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full border text-sm font-semibold uppercase transition-all',
                      elegido
                        ? 'border-marino bg-marino text-white shadow-[0_4px_12px_rgb(1_41_93/0.25)]'
                        : 'border-borde bg-superficie text-apagado hover:border-marino-claro hover:text-marino',
                    )}
                  >
                    {dia.slice(0, 2)}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { texto: 'Lunes a viernes', dias: [true, true, true, true, true, false, false] },
                { texto: 'Lunes a sábado', dias: [true, true, true, true, true, true, false] },
                { texto: 'Toda la semana', dias: [true, true, true, true, true, true, true] },
              ].map((atajo) => (
                <button
                  key={atajo.texto}
                  type="button"
                  onClick={() => {
                    cambiar({ dias: atajo.dias });
                  }}
                  className="rounded-full bg-marino/8 px-3 py-1 font-semibold text-marino hover:bg-marino/15"
                >
                  {atajo.texto}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoHora
              id={`${base}-entrada`}
              etiqueta="Entrada"
              value={jornada.entrada}
              onChange={(evento) => {
                cambiar({ entrada: evento.target.value });
              }}
            />
            <CampoHora
              id={`${base}-salida`}
              etiqueta="Salida"
              value={jornada.salida}
              onChange={(evento) => {
                cambiar({ salida: evento.target.value });
              }}
              error={salidaAntes ? 'La salida debe ser posterior a la entrada.' : undefined}
            />
          </div>

          <Casilla
            id={`${base}-refrigerio`}
            etiqueta="Incluye refrigerio"
            checked={jornada.conRefrigerio}
            onChange={(evento) => {
              cambiar({ conRefrigerio: evento.target.checked });
            }}
          />
          {jornada.conRefrigerio ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoHora
                id={`${base}-refrigerio-desde`}
                etiqueta="Refrigerio desde"
                value={jornada.refrigerioDesde}
                onChange={(evento) => {
                  cambiar({ refrigerioDesde: evento.target.value });
                }}
              />
              <CampoHora
                id={`${base}-refrigerio-hasta`}
                etiqueta="Refrigerio hasta"
                value={jornada.refrigerioHasta}
                onChange={(evento) => {
                  cambiar({ refrigerioHasta: evento.target.value });
                }}
                error={refrigerioFuera ? 'Debe quedar dentro de la jornada.' : undefined}
              />
            </div>
          ) : null}

          <p className="rounded-md bg-dorado-suave px-3 py-2 text-sm text-dorado-oscuro" aria-live="polite">
            {compuesto === '' ? 'Elija al menos un día.' : `Se guardará: «${compuesto}».`}
          </p>
          {error === undefined ? null : <p className="text-sm font-medium text-rojo">{error}</p>}
        </>
      )}
    </fieldset>
  );
}

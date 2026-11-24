import { Campo, Seleccion } from '@sige/ui/components';
import type { ReactNode } from 'react';
import { PERIODOS } from '@/lib/periods';

interface OpcionFiltro {
  id: string;
  nombre: string;
}

interface PropiedadesFiltroPeriodo {
  periodo: string;
  desde: string;
  hasta: string;
  areas?: OpcionFiltro[] | undefined;
  areaId?: string | undefined;
  usuarios?: OpcionFiltro[] | undefined;
  usuarioId?: string | undefined;
  ocultos?: Record<string, string>;
}

export function FiltroPeriodo({
  periodo,
  desde,
  hasta,
  areas,
  areaId,
  usuarios,
  usuarioId,
  ocultos = {},
}: PropiedadesFiltroPeriodo): ReactNode {
  return (
    <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
      {Object.entries(ocultos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
      <Seleccion id="periodo" name="periodo" etiqueta="Periodo" defaultValue={periodo === 'personalizado' ? '' : periodo}>
        {PERIODOS.map(({ clave, etiqueta }) => (
          <option key={clave} value={clave}>
            {etiqueta}
          </option>
        ))}
        <option value="">Fechas elegidas</option>
      </Seleccion>
      <Campo id="desde" name="desde" type="date" etiqueta="Desde" ayuda="Se usa con «Fechas elegidas»." defaultValue={desde} />
      <Campo id="hasta" name="hasta" type="date" etiqueta="Hasta" defaultValue={hasta} />
      {areas === undefined ? null : (
        <Seleccion id="areaId" name="areaId" etiqueta="Área" defaultValue={areaId ?? ''}>
          <option value="">Todas</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.nombre}
            </option>
          ))}
        </Seleccion>
      )}
      {usuarios === undefined ? null : (
        <Seleccion id="usuarioId" name="usuarioId" etiqueta="Trabajador" defaultValue={usuarioId ?? ''}>
          <option value="">Todos</option>
          {usuarios.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nombre}
            </option>
          ))}
        </Seleccion>
      )}
      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center self-start rounded-md bg-marino px-5 text-sm font-semibold text-white hover:bg-marino-medio sm:mt-7"
      >
        Aplicar
      </button>
    </form>
  );
}

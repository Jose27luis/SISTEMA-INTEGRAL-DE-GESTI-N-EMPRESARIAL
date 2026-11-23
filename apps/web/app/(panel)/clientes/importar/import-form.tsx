'use client';

import { Alerta } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { BotonEnvio } from '@/components/submit-button';
import { type EstadoImportacion, importarClientes } from '../actions';

const ESTADO_INICIAL_IMPORTACION: EstadoImportacion = { mensaje: null, resultado: null };

export function FormularioImportacion(): ReactNode {
  const [estado, accion] = useActionState(importarClientes, ESTADO_INICIAL_IMPORTACION);
  const resultado = estado.resultado;

  return (
    <div className="flex flex-col gap-6">
      <form action={accion} className="flex flex-col gap-4">
        {estado.mensaje === null ? null : <Alerta tono="error">{estado.mensaje}</Alerta>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="archivo" className="text-sm font-medium text-tinta">
            Archivo Excel completado
          </label>
          <input
            id="archivo"
            name="archivo"
            type="file"
            required
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-describedby="archivo-ayuda"
            className="block w-full rounded-md border border-borde bg-superficie text-sm file:mr-4 file:min-h-11 file:border-0 file:bg-marino file:px-4 file:font-semibold file:text-white hover:file:bg-marino-medio"
          />
          <p id="archivo-ayuda" className="text-sm text-apagado">
            Formato .xlsx, hasta 5 MB y 2000 filas.
          </p>
        </div>
        <BotonEnvio textoPendiente="Importando…" className="self-start">
          Importar clientes
        </BotonEnvio>
      </form>

      {resultado === null ? null : (
        <div className="flex flex-col gap-4">
          <Alerta tono={resultado.rechazadas.length === 0 ? 'exito' : 'aviso'} titulo="Resultado de la importación">
            Filas leídas: {resultado.filasLeidas} · Clientes registrados: {resultado.creados} · Filas rechazadas:{' '}
            {resultado.rechazadas.length}
          </Alerta>
          {resultado.rechazadas.length === 0 ? null : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-borde text-xs tracking-wide text-apagado uppercase">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-semibold">Fila</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">RUC o DNI</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {resultado.rechazadas.map((fila) => (
                    <tr key={fila.fila}>
                      <td className="py-2 pr-4 font-mono">{fila.fila}</td>
                      <td className="py-2 pr-4 font-mono">{fila.documento ?? 'Sin documento'}</td>
                      <td className="py-2 pr-4">
                        <ul className="list-disc pl-4">
                          {fila.errores.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

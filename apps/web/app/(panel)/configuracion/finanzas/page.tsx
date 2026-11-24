import { type CatalogoFinanciero, esquemaElementoFinanciero, esquemaProveedor } from '@sige/types';
import { Alerta, Tarjeta } from '@sige/ui/components';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SinAcceso } from '@/components/no-access';
import { EncabezadoPagina } from '@/components/page-header';
import { solicitarApi } from '@/lib/api';
import { obtenerPerfil, tienePermiso } from '@/lib/profile';
import { cambiarActivoCatalogo, guardarElementoCatalogo, guardarProveedor } from '../../finanzas/actions';
import { FilaElemento, FilaProveedor, FormularioElemento, FormularioProveedor } from './catalog-forms';

export const metadata: Metadata = { title: 'Catálogos financieros · TORRES ASOCIADOS' };

const SECCIONES: { catalogo: CatalogoFinanciero; titulo: string; descripcion: string }[] = [
  {
    catalogo: 'servicios',
    titulo: 'Servicios',
    descripcion: 'Lo que el estudio ofrece y se contrata en la ficha comercial de cada cliente.',
  },
  { catalogo: 'medios-pago', titulo: 'Medios de pago', descripcion: 'Se usan en los cobros y en los egresos.' },
  { catalogo: 'categorias-egreso', titulo: 'Categorías de egreso', descripcion: 'Agrupan los gastos en el flujo de caja.' },
];

export default async function PaginaCatalogosFinancieros(): Promise<ReactNode> {
  const perfil = await obtenerPerfil();
  const verCatalogos = tienePermiso(perfil, 'finanza:catalogos');
  const verProveedores = tienePermiso(perfil, 'finanza:egresos');

  if (!verCatalogos && !verProveedores) {
    return <SinAcceso />;
  }

  const [listas, proveedores] = await Promise.all([
    verCatalogos
      ? Promise.all(
          SECCIONES.map(({ catalogo }) =>
            solicitarApi(`/finanzas/catalogos/${catalogo}`, { esquema: esquemaElementoFinanciero.array() }),
          ),
        )
      : Promise.resolve([]),
    verProveedores ? solicitarApi('/finanzas/proveedores', { esquema: esquemaProveedor.array() }) : Promise.resolve(null),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Catálogos financieros"
        descripcion="Los elementos en uso no se eliminan: se desactivan y dejan de aparecer en los formularios."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {SECCIONES.map((seccion, indice) => {
          const lista = listas[indice];

          if (lista === undefined) {
            return null;
          }

          const conTipo = seccion.catalogo === 'servicios';

          return (
            <Tarjeta key={seccion.catalogo} titulo={seccion.titulo} descripcion={seccion.descripcion}>
              <FormularioElemento accion={guardarElementoCatalogo.bind(null, seccion.catalogo, null)} conTipo={conTipo} />
              {lista.ok ? (
                <ul className="mt-4 flex flex-col divide-y divide-borde border-t border-borde">
                  {lista.datos.map((elemento) => (
                    <FilaElemento
                      key={elemento.id}
                      elemento={elemento}
                      conTipo={conTipo}
                      editar={guardarElementoCatalogo.bind(null, seccion.catalogo, elemento.id)}
                      activar={cambiarActivoCatalogo.bind(null, seccion.catalogo, elemento.id, !elemento.activo)}
                    />
                  ))}
                </ul>
              ) : (
                <Alerta tono="error" className="mt-4">
                  {lista.error.mensaje}
                </Alerta>
              )}
            </Tarjeta>
          );
        })}
        {proveedores === null ? null : (
          <Tarjeta titulo="Proveedores" descripcion="A quién se le paga en los egresos.">
            <FormularioProveedor accion={guardarProveedor.bind(null, null)} />
            {proveedores.ok ? (
              proveedores.datos.length === 0 ? (
                <p className="mt-4 text-sm text-apagado">No hay proveedores registrados.</p>
              ) : (
                <ul className="mt-4 flex flex-col divide-y divide-borde border-t border-borde">
                  {proveedores.datos.map((proveedor) => (
                    <FilaProveedor
                      key={proveedor.id}
                      proveedor={proveedor}
                      editar={guardarProveedor.bind(null, proveedor.id)}
                      activar={cambiarActivoCatalogo.bind(null, 'proveedores', proveedor.id, !proveedor.activo)}
                    />
                  ))}
                </ul>
              )
            ) : (
              <Alerta tono="error" className="mt-4">
                {proveedores.error.mensaje}
              </Alerta>
            )}
          </Tarjeta>
        )}
      </div>
    </>
  );
}

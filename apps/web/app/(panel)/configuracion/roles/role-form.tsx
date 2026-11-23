'use client';

import { ALCANCES_ROL, ETIQUETAS_ALCANCE, type Permiso, type RolResumen } from '@sige/types';
import { AreaTexto, Campo, Casilla, Insignia, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PropiedadesFormularioRol {
  permisos: Permiso[];
  rol: RolResumen | null;
  protegido: boolean;
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
}

function agruparPorModulo(permisos: Permiso[]): [string, Permiso[]][] {
  const grupos = new Map<string, Permiso[]>();

  for (const permiso of permisos) {
    grupos.set(permiso.modulo, [...(grupos.get(permiso.modulo) ?? []), permiso]);
  }

  return [...grupos.entries()];
}

export function FormularioRol({ permisos, rol, protegido, accion }: PropiedadesFormularioRol): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const creando = rol === null;
  const seleccionados = rol?.permisoIds ?? [];

  return (
    <form action={accionFormulario} className="flex flex-col gap-6">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-4 sm:grid-cols-2">
        {creando ? (
          <Campo
            id="codigo"
            name="codigo"
            etiqueta="Código"
            ayuda="Mayúsculas, números y guion bajo, por ejemplo AUDITOR_INTERNO. No se puede cambiar después."
            required
            maxLength={40}
            defaultValue={estado.valores.codigo}
            error={estado.errores.codigo}
          />
        ) : null}
        <Campo
          id="nombre"
          name="nombre"
          etiqueta="Nombre"
          required
          maxLength={80}
          defaultValue={estado.valores.nombre ?? rol?.nombre}
          error={estado.errores.nombre}
        />
        {creando ? (
          <Seleccion
            id="alcance"
            name="alcance"
            etiqueta="Alcance"
            ayuda="Define sobre qué clientes y registros actúan sus permisos. No se puede cambiar después."
            defaultValue={estado.valores.alcance ?? 'PROPIO'}
            error={estado.errores.alcance}
          >
            {ALCANCES_ROL.map((alcance) => (
              <option key={alcance} value={alcance}>
                {ETIQUETAS_ALCANCE[alcance]}
              </option>
            ))}
          </Seleccion>
        ) : null}
        <div className="sm:col-span-2">
          <AreaTexto
            id="descripcion"
            name="descripcion"
            etiqueta="Descripción"
            ayuda="Opcional. Explica para qué se usa el rol."
            maxLength={300}
            defaultValue={estado.valores.descripcion ?? rol?.descripcion ?? ''}
            error={estado.errores.descripcion}
          />
        </div>
      </div>

      {protegido
        ? permisos.map((permiso) => (
            <input key={permiso.id} type="hidden" name="permisoIds" value={permiso.id} />
          ))
        : null}

      <Casilla
        id="exigeMfa"
        name="exigeMfa"
        etiqueta="Exigir verificación en dos pasos"
        descripcion="Los usuarios con este rol deberán configurarla antes de usar el sistema."
        defaultChecked={rol?.exigeMfa ?? false}
      />

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-1 text-base font-semibold text-marino">Permisos</legend>
        {protegido ? (
          <p className="text-sm text-apagado">
            Gerencia General conserva siempre todos los permisos.
          </p>
        ) : null}
        {estado.errores.permisoIds === undefined ? null : (
          <p className="text-sm font-medium text-rojo">{estado.errores.permisoIds}</p>
        )}
        {agruparPorModulo(permisos).map(([modulo, delModulo]) => (
          <div key={modulo} className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-wider text-apagado uppercase">{modulo}</p>
            {delModulo.map((permiso) => (
              <div key={permiso.id} className="flex flex-wrap items-start gap-2">
                <Casilla
                  id={`permiso-${permiso.id}`}
                  name={protegido ? undefined : 'permisoIds'}
                  value={permiso.id}
                  defaultChecked={protegido || seleccionados.includes(permiso.id)}
                  disabled={protegido}
                  etiqueta={permiso.descripcion}
                  descripcion={permiso.codigo}
                />
                {permiso.sensible ? <Insignia tono="aviso">Sensible</Insignia> : null}
              </div>
            ))}
          </div>
        ))}
      </fieldset>

      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {creando ? 'Crear rol' : 'Guardar cambios'}
      </BotonEnvio>
    </form>
  );
}

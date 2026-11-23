'use client';

import type { RolResumen } from '@sige/types';
import { Casilla } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

interface PropiedadesFormularioRoles {
  roles: RolResumen[];
  asignados: string[];
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
}

export function FormularioRolesUsuario({ roles, asignados, accion }: PropiedadesFormularioRoles): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Roles del usuario</legend>
        {roles.map((rol) => (
          <Casilla
            key={rol.id}
            id={`rol-${rol.id}`}
            name="rolIds"
            value={rol.id}
            defaultChecked={asignados.includes(rol.id)}
            etiqueta={rol.nombre}
            descripcion={rol.descripcion ?? undefined}
          />
        ))}
      </fieldset>
      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        Guardar roles
      </BotonEnvio>
    </form>
  );
}

'use client';

import { type Asignacion, ETIQUETAS_ROL_EN_CLIENTE, ROLES_EN_CLIENTE } from '@sige/types';
import { Insignia, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';
import { formatearFechaHora } from '@/lib/format';

interface UsuarioOpcion {
  id: string;
  nombre: string;
  correo: string;
}

export function FormularioAsignacion({
  accion,
  usuarios,
}: {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  usuarios: UsuarioOpcion[];
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Seleccion
        id="usuarioId"
        name="usuarioId"
        etiqueta="Usuario"
        required
        defaultValue={estado.exito ? '' : (estado.valores.usuarioId ?? '')}
        error={estado.errores.usuarioId}
      >
        <option value="" disabled>
          Seleccione
        </option>
        {usuarios.map((usuario) => (
          <option key={usuario.id} value={usuario.id}>
            {usuario.nombre} ({usuario.correo})
          </option>
        ))}
      </Seleccion>
      <Seleccion
        id="rolEnCliente"
        name="rolEnCliente"
        etiqueta="Rol en el cliente"
        ayuda="Si el usuario ya está en el equipo, se actualiza su rol."
        defaultValue={estado.valores.rolEnCliente ?? 'APOYO'}
        error={estado.errores.rolEnCliente}
      >
        {ROLES_EN_CLIENTE.map((rol) => (
          <option key={rol} value={rol}>
            {ETIQUETAS_ROL_EN_CLIENTE[rol]}
          </option>
        ))}
      </Seleccion>
      <BotonEnvio textoPendiente="Asignando…" className="self-start">
        Asignar
      </BotonEnvio>
    </form>
  );
}

export function FilaAsignacion({
  asignacion,
  puedeAsignar,
  retirar,
}: {
  asignacion: Asignacion;
  puedeAsignar: boolean;
  retirar: (anterior: EstadoFormulario) => Promise<EstadoFormulario>;
}): ReactNode {
  const [estado, accion] = useActionState(retirar, ESTADO_INICIAL);

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
            {asignacion.usuario.nombre}
            <Insignia tono={asignacion.rolEnCliente === 'RESPONSABLE' ? 'info' : 'neutro'}>
              {ETIQUETAS_ROL_EN_CLIENTE[asignacion.rolEnCliente]}
            </Insignia>
          </p>
          <p className="text-xs text-apagado">
            {asignacion.usuario.correo} · Desde {formatearFechaHora(asignacion.asignadoEn)}
          </p>
        </div>
        {puedeAsignar ? (
          <form action={accion}>
            <button type="submit" className="min-h-11 rounded-md px-3 text-sm font-semibold text-rojo hover:bg-rojo-suave">
              Retirar
            </button>
          </form>
        ) : null}
      </div>
      {estado.mensaje !== null && !estado.exito ? <MensajeFormulario estado={estado} /> : null}
    </li>
  );
}

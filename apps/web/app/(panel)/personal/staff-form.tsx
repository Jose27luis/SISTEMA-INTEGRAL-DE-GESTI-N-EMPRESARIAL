'use client';

import type {
  ReferenciaCatalogo,
  RolResumen,
  TrabajadorDetalle,
  TrabajadorResumen,
  UsuarioSinFicha,
} from '@sige/types';
import { AreaTexto, Campo, Casilla, Seleccion } from '@sige/ui/components';
import Link from 'next/link';
import { type ReactNode, useActionState, useState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { CampoContrasena } from '@/components/password-field';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

export interface OpcionesFicha {
  areas: ReferenciaCatalogo[];
  cargos: ReferenciaCatalogo[];
  tiposVinculo: ReferenciaCatalogo[];
  supervisores: TrabajadorResumen[];
}

interface OpcionesCuenta {
  roles: RolResumen[];
  usuariosSinFicha: UsuarioSinFicha[];
}

interface PropiedadesFormularioTrabajador {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  opciones: OpcionesFicha;
  trabajador: TrabajadorDetalle | null;
  cuenta: OpcionesCuenta | null;
}

function SeleccionCatalogo({
  id,
  etiqueta,
  opciones,
  valor,
  error,
}: {
  id: string;
  etiqueta: string;
  opciones: ReferenciaCatalogo[];
  valor: string | undefined;
  error: string | undefined;
}): ReactNode {
  return (
    <Seleccion
      id={id}
      name={id}
      etiqueta={etiqueta}
      required
      defaultValue={valor ?? ''}
      error={error}
      {...(opciones.length === 0
        ? { ayuda: 'No hay opciones registradas. Créelas en Administración → Catálogos.' }
        : {})}
    >
      <option value="" disabled>
        Seleccione
      </option>
      {opciones.map((opcion) => (
        <option key={opcion.id} value={opcion.id}>
          {opcion.nombre}
        </option>
      ))}
    </Seleccion>
  );
}

export function FormularioTrabajador({
  accion,
  opciones,
  trabajador,
  cuenta,
}: PropiedadesFormularioTrabajador): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const [tipoCuenta, setTipoCuenta] = useState<'NUEVA' | 'EXISTENTE'>('NUEVA');
  const valor = (campo: string, actual: string | null | undefined): string | undefined =>
    estado.valores[campo] ?? actual ?? undefined;
  const faltanCatalogos =
    opciones.areas.length === 0 || opciones.cargos.length === 0 || opciones.tiposVinculo.length === 0;

  return (
    <form action={accionFormulario} className="flex flex-col gap-6">
      <MensajeFormulario estado={estado} />
      {faltanCatalogos ? (
        <p className="rounded-md border border-dorado/50 bg-dorado-suave px-4 py-3 text-sm">
          Antes de registrar personal, cree al menos un área, un cargo y un tipo de vínculo en{' '}
          <Link href="/configuracion/catalogos" className="font-semibold text-marino underline">
            Catálogos
          </Link>
          .
        </p>
      ) : null}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-marino">Datos personales</legend>
        <Campo
          id="nombres"
          name="nombres"
          etiqueta="Nombres"
          required
          maxLength={80}
          defaultValue={valor('nombres', trabajador?.nombres)}
          error={estado.errores.nombres}
        />
        <Campo
          id="apellidos"
          name="apellidos"
          etiqueta="Apellidos"
          required
          maxLength={80}
          defaultValue={valor('apellidos', trabajador?.apellidos)}
          error={estado.errores.apellidos}
        />
        <Campo
          id="dni"
          name="dni"
          etiqueta="DNI"
          inputMode="numeric"
          maxLength={8}
          required
          defaultValue={valor('dni', trabajador?.dni)}
          error={estado.errores.dni}
        />
        <Campo
          id="telefono"
          name="telefono"
          type="tel"
          etiqueta="Teléfono"
          maxLength={30}
          defaultValue={valor('telefono', trabajador?.telefono)}
          error={estado.errores.telefono}
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-marino">Puesto</legend>
        <SeleccionCatalogo
          id="areaId"
          etiqueta="Área"
          opciones={opciones.areas}
          valor={valor('areaId', trabajador?.area.id)}
          error={estado.errores.areaId}
        />
        <SeleccionCatalogo
          id="cargoId"
          etiqueta="Cargo"
          opciones={opciones.cargos}
          valor={valor('cargoId', trabajador?.cargo.id)}
          error={estado.errores.cargoId}
        />
        <SeleccionCatalogo
          id="tipoVinculoId"
          etiqueta="Tipo de vínculo"
          opciones={opciones.tiposVinculo}
          valor={valor('tipoVinculoId', trabajador?.tipoVinculo.id)}
          error={estado.errores.tipoVinculoId}
        />
        <Campo
          id="fechaIncorporacion"
          name="fechaIncorporacion"
          type="date"
          etiqueta="Fecha de incorporación"
          required
          defaultValue={valor('fechaIncorporacion', trabajador?.fechaIncorporacion)}
          error={estado.errores.fechaIncorporacion}
        />
        <Seleccion
          id="supervisorId"
          name="supervisorId"
          etiqueta="Supervisor inmediato"
          defaultValue={valor('supervisorId', trabajador?.supervisor?.id) ?? ''}
          error={estado.errores.supervisorId}
        >
          <option value="">Sin supervisor</option>
          {opciones.supervisores
            .filter((supervisor) => supervisor.id !== trabajador?.id)
            .map((supervisor) => (
              <option key={supervisor.id} value={supervisor.id}>
                {supervisor.apellidos}, {supervisor.nombres}
              </option>
            ))}
        </Seleccion>
        <Campo
          id="horario"
          name="horario"
          etiqueta="Horario o jornada"
          ayuda="Por ejemplo: lunes a viernes de 8:00 a 17:00."
          maxLength={120}
          defaultValue={valor('horario', trabajador?.horario)}
          error={estado.errores.horario}
        />
        <div className="sm:col-span-2">
          <AreaTexto
            id="funciones"
            name="funciones"
            etiqueta="Funciones"
            maxLength={1000}
            rows={4}
            defaultValue={valor('funciones', trabajador?.funciones)}
            error={estado.errores.funciones}
          />
        </div>
      </fieldset>

      {cuenta === null ? null : (
        <fieldset className="flex flex-col gap-4 rounded-lg border border-borde p-4">
          <legend className="px-1 text-base font-semibold text-marino">Cuenta de acceso</legend>
          {cuenta.usuariosSinFicha.length > 0 ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tipoCuenta"
                  value="NUEVA"
                  checked={tipoCuenta === 'NUEVA'}
                  onChange={() => {
                    setTipoCuenta('NUEVA');
                  }}
                  className="size-4 accent-marino"
                />
                Crear una cuenta nueva
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tipoCuenta"
                  value="EXISTENTE"
                  checked={tipoCuenta === 'EXISTENTE'}
                  onChange={() => {
                    setTipoCuenta('EXISTENTE');
                  }}
                  className="size-4 accent-marino"
                />
                Usar una cuenta existente sin ficha
              </label>
            </div>
          ) : (
            <input type="hidden" name="tipoCuenta" value="NUEVA" />
          )}

          {tipoCuenta === 'EXISTENTE' ? (
            <Seleccion
              id="usuarioId"
              name="usuarioId"
              etiqueta="Cuenta existente"
              required
              defaultValue={estado.valores.usuarioId ?? ''}
              error={estado.errores.usuarioId}
            >
              <option value="" disabled>
                Seleccione
              </option>
              {cuenta.usuariosSinFicha.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} ({usuario.correo})
                </option>
              ))}
            </Seleccion>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  id="correo"
                  name="correo"
                  type="email"
                  etiqueta="Correo de acceso"
                  autoComplete="off"
                  required
                  defaultValue={estado.valores.correo}
                  error={estado.errores.correo}
                />
                <CampoContrasena
                  id="contrasena"
                  name="contrasena"
                  etiqueta="Contraseña"
                  autoComplete="new-password"
                  ayuda="La define usted y se la entrega al trabajador."
                  error={estado.errores.contrasena}
                />
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-tinta">Roles</p>
                {estado.errores.rolIds === undefined ? null : (
                  <p className="text-sm font-medium text-rojo">{estado.errores.rolIds}</p>
                )}
                {cuenta.roles.map((rol) => (
                  <Casilla
                    key={rol.id}
                    id={`rol-${rol.id}`}
                    name="rolIds"
                    value={rol.id}
                    etiqueta={rol.nombre}
                    descripcion={rol.descripcion ?? undefined}
                  />
                ))}
              </div>
            </>
          )}
        </fieldset>
      )}

      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {trabajador === null ? 'Registrar trabajador' : 'Guardar ficha'}
      </BotonEnvio>
    </form>
  );
}

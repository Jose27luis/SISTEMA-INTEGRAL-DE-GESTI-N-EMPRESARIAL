'use client';

import {
  type ClienteDetalle,
  ETIQUETAS_TIPO_PERSONA,
  type ReferenciaCatalogo,
  TIPOS_PERSONA,
} from '@sige/types';
import { Campo, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

export interface UsuarioOpcion {
  id: string;
  nombre: string;
}

interface PropiedadesFormularioCliente {
  accion: (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  cliente: ClienteDetalle | null;
  regimenes: ReferenciaCatalogo[];
  usuarios: UsuarioOpcion[];
  fechaHoy: string;
}

export function FormularioCliente({
  accion,
  cliente,
  regimenes,
  usuarios,
  fechaHoy,
}: PropiedadesFormularioCliente): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const valor = (campo: string, actual: string | null | undefined): string | undefined =>
    estado.valores[campo] ?? actual ?? undefined;

  return (
    <form action={accionFormulario} className="flex flex-col gap-6">
      <MensajeFormulario estado={estado} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-marino">Identificación</legend>
        <Seleccion
          id="tipoPersona"
          name="tipoPersona"
          etiqueta="Tipo de persona"
          defaultValue={valor('tipoPersona', cliente?.tipoPersona) ?? 'JURIDICA'}
          error={estado.errores.tipoPersona}
        >
          {TIPOS_PERSONA.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETAS_TIPO_PERSONA[tipo]}
            </option>
          ))}
        </Seleccion>
        <Campo
          id="razonSocial"
          name="razonSocial"
          etiqueta="Razón social o nombres"
          required
          maxLength={200}
          defaultValue={valor('razonSocial', cliente?.razonSocial)}
          error={estado.errores.razonSocial}
        />
        <Campo
          id="ruc"
          name="ruc"
          etiqueta="RUC"
          inputMode="numeric"
          maxLength={11}
          ayuda="11 dígitos. Obligatorio para personas jurídicas."
          defaultValue={valor('ruc', cliente?.ruc)}
          error={estado.errores.ruc}
        />
        <Campo
          id="dni"
          name="dni"
          etiqueta="DNI"
          inputMode="numeric"
          maxLength={8}
          ayuda="8 dígitos. Indique el RUC o el DNI."
          defaultValue={valor('dni', cliente?.dni)}
          error={estado.errores.dni}
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-marino">Datos generales</legend>
        <div className="sm:col-span-2">
          <Campo
            id="domicilioFiscal"
            name="domicilioFiscal"
            etiqueta="Domicilio fiscal"
            maxLength={250}
            defaultValue={valor('domicilioFiscal', cliente?.domicilioFiscal)}
            error={estado.errores.domicilioFiscal}
          />
        </div>
        <Campo
          id="representanteLegal"
          name="representanteLegal"
          etiqueta="Representante legal"
          maxLength={150}
          defaultValue={valor('representanteLegal', cliente?.representanteLegal)}
          error={estado.errores.representanteLegal}
        />
        <Campo
          id="actividadEconomica"
          name="actividadEconomica"
          etiqueta="Actividad económica"
          maxLength={200}
          defaultValue={valor('actividadEconomica', cliente?.actividadEconomica)}
          error={estado.errores.actividadEconomica}
        />
        <Seleccion
          id="regimenTributarioId"
          name="regimenTributarioId"
          etiqueta="Régimen tributario"
          defaultValue={valor('regimenTributarioId', cliente?.regimenTributario?.id) ?? ''}
          error={estado.errores.regimenTributarioId}
        >
          <option value="">Sin definir</option>
          {regimenes.map((regimen) => (
            <option key={regimen.id} value={regimen.id}>
              {regimen.nombre}
            </option>
          ))}
        </Seleccion>
        <Campo
          id="fechaIncorporacion"
          name="fechaIncorporacion"
          type="date"
          etiqueta="Fecha de incorporación"
          required
          defaultValue={valor('fechaIncorporacion', cliente?.fechaIncorporacion) ?? fechaHoy}
          error={estado.errores.fechaIncorporacion}
        />
        <Seleccion
          id="responsableId"
          name="responsableId"
          etiqueta="Responsable"
          ayuda="Queda asignado automáticamente al cliente."
          defaultValue={valor('responsableId', cliente?.responsable?.id) ?? ''}
          error={estado.errores.responsableId}
        >
          <option value="">Sin responsable</option>
          {usuarios.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nombre}
            </option>
          ))}
        </Seleccion>
      </fieldset>

      <BotonEnvio textoPendiente="Guardando…" className="self-start">
        {cliente === null ? 'Registrar cliente' : 'Guardar cambios'}
      </BotonEnvio>
    </form>
  );
}

'use client';

import {
  ETIQUETAS_TIPO_COMPROBANTE,
  type OpcionesFinanzas,
  TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB,
  TIPOS_COMPROBANTE,
} from '@sige/types';
import { AreaTexto, Campo, Seleccion } from '@sige/ui/components';
import { type ReactNode, useActionState, useId } from 'react';
import { MensajeFormulario } from '@/components/form-message';
import { BotonEnvio } from '@/components/submit-button';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/form-state';

type AccionFormulario = (anterior: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

const CLASES_ARCHIVO =
  'block w-full text-sm text-apagado file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-marino/10 file:px-4 file:font-semibold file:text-marino hover:file:bg-marino/15';

function CampoAdjunto({ nombre, etiqueta, error }: { nombre: string; etiqueta: string; error: string | undefined }): ReactNode {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {etiqueta}
      </label>
      <input
        id={id}
        name={nombre}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        aria-describedby={`${id}-ayuda`}
        className={CLASES_ARCHIVO}
      />
      <p id={`${id}-ayuda`} className="text-sm text-apagado">
        PDF o imagen, hasta {TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB} MB.
      </p>
      {error === undefined ? null : <p className="text-sm font-medium text-rojo">{error}</p>}
    </div>
  );
}

function opcionesComprobante(): ReactNode {
  return (
    <>
      <option value="">Sin comprobante aún</option>
      {TIPOS_COMPROBANTE.map((tipo) => (
        <option key={tipo} value={tipo}>
          {ETIQUETAS_TIPO_COMPROBANTE[tipo]}
        </option>
      ))}
    </>
  );
}

export function FormularioIngreso({
  accion,
  opciones,
  clienteInicial,
  hoy,
}: {
  accion: AccionFormulario;
  opciones: OpcionesFinanzas;
  clienteInicial: string;
  hoy: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const valor = (campo: string, predeterminado: string): string => estado.valores[campo] ?? predeterminado;

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Seleccion
        id="clienteId"
        name="clienteId"
        etiqueta="Cliente"
        required
        defaultValue={valor('clienteId', clienteInicial)}
        error={estado.errores.clienteId}
      >
        <option value="" disabled>
          Seleccione
        </option>
        {opciones.clientes.map((cliente) => (
          <option key={cliente.id} value={cliente.id}>
            {cliente.razonSocial}
          </option>
        ))}
      </Seleccion>
      <input type="hidden" name="servicioContratadoId" value="" />
      <Campo
        id="concepto"
        name="concepto"
        etiqueta="Concepto"
        required
        maxLength={200}
        defaultValue={valor('concepto', '')}
        error={estado.errores.concepto}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="monto"
          name="monto"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          etiqueta="Monto (S/)"
          required
          defaultValue={valor('monto', '')}
          error={estado.errores.monto}
        />
        <Campo
          id="periodo"
          name="periodo"
          type="month"
          etiqueta="Periodo (opcional)"
          defaultValue={valor('periodo', '')}
          error={estado.errores.periodo}
        />
        <Campo
          id="fechaEmision"
          name="fechaEmision"
          type="date"
          etiqueta="Fecha de emisión"
          required
          defaultValue={valor('fechaEmision', hoy)}
          error={estado.errores.fechaEmision}
        />
        <Campo
          id="fechaVencimiento"
          name="fechaVencimiento"
          type="date"
          etiqueta="Vencimiento"
          required
          defaultValue={valor('fechaVencimiento', hoy)}
          error={estado.errores.fechaVencimiento}
        />
        <Seleccion
          id="tipoComprobante"
          name="tipoComprobante"
          etiqueta="Comprobante"
          defaultValue={valor('tipoComprobante', '')}
          error={estado.errores.tipoComprobante}
        >
          {opcionesComprobante()}
        </Seleccion>
        <Campo
          id="serieNumero"
          name="serieNumero"
          etiqueta="Serie y número (opcional)"
          ayuda="Tal como figura en el sistema de facturación."
          maxLength={30}
          defaultValue={valor('serieNumero', '')}
          error={estado.errores.serieNumero}
        />
      </div>
      <BotonEnvio textoPendiente="Registrando…" className="self-start">
        Registrar ingreso
      </BotonEnvio>
    </form>
  );
}

export function FormularioGenerarHonorarios({ accion, periodo }: { accion: AccionFormulario; periodo: string }): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-3">
      <MensajeFormulario estado={estado} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Campo
            id="periodo-generacion"
            name="periodo"
            type="month"
            etiqueta="Mes"
            required
            defaultValue={estado.valores.periodo ?? periodo}
            error={estado.errores.periodo}
          />
        </div>
        <BotonEnvio variante="secundario" textoPendiente="Generando…">
          Generar honorarios
        </BotonEnvio>
      </div>
    </form>
  );
}

export function FormularioCobro({
  accion,
  mediosPago,
  saldo,
  hoy,
}: {
  accion: AccionFormulario;
  mediosPago: OpcionesFinanzas['mediosPago'];
  saldo: number;
  hoy: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const valor = (campo: string, predeterminado: string): string =>
    estado.exito ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} key={estado.exito ? 'registrado' : 'cobro'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="importe"
          name="importe"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          max={saldo.toFixed(2)}
          etiqueta="Importe (S/)"
          required
          defaultValue={valor('importe', saldo.toFixed(2))}
          error={estado.errores.importe}
        />
        <Campo
          id="fecha"
          name="fecha"
          type="date"
          max={hoy}
          etiqueta="Fecha del cobro"
          required
          defaultValue={valor('fecha', hoy)}
          error={estado.errores.fecha}
        />
        <Seleccion
          id="medioPagoId"
          name="medioPagoId"
          etiqueta="Medio de pago"
          required
          defaultValue={valor('medioPagoId', '')}
          error={estado.errores.medioPagoId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {mediosPago.map((medio) => (
            <option key={medio.id} value={medio.id}>
              {medio.nombre}
            </option>
          ))}
        </Seleccion>
        <Campo
          id="operacion"
          name="operacion"
          etiqueta="N.° de operación (opcional)"
          maxLength={60}
          defaultValue={valor('operacion', '')}
          error={estado.errores.operacion}
        />
      </div>
      <CampoAdjunto nombre="voucher" etiqueta="Voucher (opcional)" error={estado.errores.voucher} />
      <BotonEnvio textoPendiente="Registrando…" className="self-start">
        Registrar cobro
      </BotonEnvio>
    </form>
  );
}

export function FormularioComprobante({
  accion,
  fechaEmision,
}: {
  accion: AccionFormulario;
  fechaEmision: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionFormulario} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Seleccion
          id="tipoComprobante-registro"
          name="tipoComprobante"
          etiqueta="Tipo"
          required
          defaultValue={estado.valores.tipoComprobante ?? 'FACTURA'}
          error={estado.errores.tipoComprobante}
        >
          {TIPOS_COMPROBANTE.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETAS_TIPO_COMPROBANTE[tipo]}
            </option>
          ))}
        </Seleccion>
        <Campo
          id="serieNumero-registro"
          name="serieNumero"
          etiqueta="Serie y número"
          required
          maxLength={30}
          defaultValue={estado.valores.serieNumero ?? ''}
          error={estado.errores.serieNumero}
        />
        <Campo
          id="fechaEmision-registro"
          name="fechaEmision"
          type="date"
          etiqueta="Emitido el"
          required
          defaultValue={estado.valores.fechaEmision ?? fechaEmision}
          error={estado.errores.fechaEmision}
        />
      </div>
      <BotonEnvio variante="secundario" textoPendiente="Guardando…" className="self-start">
        Registrar comprobante
      </BotonEnvio>
    </form>
  );
}

export function FormularioEgreso({
  accion,
  opciones,
  hoy,
  usuarioId,
}: {
  accion: AccionFormulario;
  opciones: OpcionesFinanzas;
  hoy: string;
  usuarioId: string;
}): ReactNode {
  const [estado, accionFormulario] = useActionState(accion, ESTADO_INICIAL);
  const valor = (campo: string, predeterminado: string): string =>
    estado.exito ? predeterminado : (estado.valores[campo] ?? predeterminado);

  return (
    <form action={accionFormulario} key={estado.exito ? 'registrado' : 'egreso'} className="flex flex-col gap-4">
      <MensajeFormulario estado={estado} />
      <Campo
        id="concepto-egreso"
        name="concepto"
        etiqueta="Concepto"
        required
        maxLength={200}
        defaultValue={valor('concepto', '')}
        error={estado.errores.concepto}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="importe-egreso"
          name="importe"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          etiqueta="Importe (S/)"
          required
          defaultValue={valor('importe', '')}
          error={estado.errores.importe}
        />
        <Campo
          id="fecha-egreso"
          name="fecha"
          type="date"
          max={hoy}
          etiqueta="Fecha"
          required
          defaultValue={valor('fecha', hoy)}
          error={estado.errores.fecha}
        />
        <Seleccion
          id="categoriaId"
          name="categoriaId"
          etiqueta="Categoría"
          required
          defaultValue={valor('categoriaId', '')}
          error={estado.errores.categoriaId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {opciones.categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </Seleccion>
        <Seleccion
          id="medioPagoId-egreso"
          name="medioPagoId"
          etiqueta="Medio de pago"
          required
          defaultValue={valor('medioPagoId', '')}
          error={estado.errores.medioPagoId}
        >
          <option value="" disabled>
            Seleccione
          </option>
          {opciones.mediosPago.map((medio) => (
            <option key={medio.id} value={medio.id}>
              {medio.nombre}
            </option>
          ))}
        </Seleccion>
        <Seleccion
          id="proveedorId"
          name="proveedorId"
          etiqueta="Proveedor (opcional)"
          defaultValue={valor('proveedorId', '')}
          error={estado.errores.proveedorId}
        >
          <option value="">Sin proveedor</option>
          {opciones.proveedores.map((proveedor) => (
            <option key={proveedor.id} value={proveedor.id}>
              {proveedor.razonSocial}
            </option>
          ))}
        </Seleccion>
        <Seleccion
          id="responsableId"
          name="responsableId"
          etiqueta="Responsable"
          required
          defaultValue={valor('responsableId', usuarioId)}
          error={estado.errores.responsableId}
        >
          {opciones.responsables.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre}
            </option>
          ))}
        </Seleccion>
        <Seleccion
          id="tipoComprobante-egreso"
          name="tipoComprobante"
          etiqueta="Comprobante"
          defaultValue={valor('tipoComprobante', '')}
          error={estado.errores.tipoComprobante}
        >
          {opcionesComprobante()}
        </Seleccion>
        <Campo
          id="serieNumero-egreso"
          name="serieNumero"
          etiqueta="Serie y número (opcional)"
          maxLength={30}
          defaultValue={valor('serieNumero', '')}
          error={estado.errores.serieNumero}
        />
      </div>
      <Seleccion
        id="clienteId-egreso"
        name="clienteId"
        etiqueta="Cliente al que se asigna (opcional)"
        ayuda="Sirve para calcular la rentabilidad por cliente."
        defaultValue={valor('clienteId', '')}
        error={estado.errores.clienteId}
      >
        <option value="">Gasto general del estudio</option>
        {opciones.clientes.map((cliente) => (
          <option key={cliente.id} value={cliente.id}>
            {cliente.razonSocial}
          </option>
        ))}
      </Seleccion>
      <Seleccion
        id="proyectoId-egreso"
        name="proyectoId"
        etiqueta="Proyecto (opcional)"
        ayuda="Suma al costo del proyecto; si el proyecto es de un cliente, el egreso queda asignado a ese cliente."
        defaultValue={valor('proyectoId', '')}
        error={estado.errores.proyectoId}
      >
        <option value="">Sin proyecto</option>
        {opciones.proyectos.map((proyecto) => (
          <option key={proyecto.id} value={proyecto.id}>
            {proyecto.codigo} · {proyecto.nombre}
          </option>
        ))}
      </Seleccion>
      <CampoAdjunto nombre="comprobante" etiqueta="Comprobante escaneado (opcional)" error={estado.errores.comprobante} />
      <AreaTexto
        id="observaciones-egreso"
        name="observaciones"
        etiqueta="Observaciones (opcional)"
        maxLength={1000}
        defaultValue={valor('observaciones', '')}
        error={estado.errores.observaciones}
      />
      <BotonEnvio textoPendiente="Registrando…" className="self-start">
        Registrar egreso
      </BotonEnvio>
    </form>
  );
}

import { z } from 'zod';
import { esquemaMetadatosPagina } from './common';
import { esDniValido, esRucValido } from './identity-documents';
import { esquemaPeriodo } from './obligations';

export const MONTO_MAXIMO = 99_999_999.99;

export const FINANZAS_POR_PAGINA = 25;

export const TAMANO_MAXIMO_ADJUNTO_FINANZAS_MB = 10;

export const esquemaMonto = z.coerce
  .number({ error: 'Ingrese un monto.' })
  .positive('El monto debe ser mayor a cero.')
  .max(MONTO_MAXIMO, 'Monto demasiado alto.')
  .refine((valor) => Math.abs(Math.round(valor * 100) - valor * 100) < 1e-6, 'Use como máximo dos decimales.')
  .transform((valor) => Math.round(valor * 100) / 100);

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `Máximo ${String(maximo)} caracteres.`)
    .transform((valor) => (valor === '' ? null : valor))
    .nullable();

const idOpcional = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? null : valor))
  .pipe(z.uuid().nullable())
  .nullable();

const fechaOpcional = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? null : valor))
  .pipe(z.iso.date('Fecha no válida.').nullable())
  .nullable();

export const TIPOS_SERVICIO = ['RECURRENTE', 'PROYECTO'] as const;
export const esquemaTipoServicio = z.enum(TIPOS_SERVICIO);
export type TipoServicio = z.infer<typeof esquemaTipoServicio>;
export const ETIQUETAS_TIPO_SERVICIO: Record<TipoServicio, string> = {
  RECURRENTE: 'Recurrente',
  PROYECTO: 'Por proyecto',
};

export const PERIODICIDADES = ['MENSUAL', 'ANUAL', 'UNICO'] as const;
export const esquemaPeriodicidad = z.enum(PERIODICIDADES);
export type Periodicidad = z.infer<typeof esquemaPeriodicidad>;
export const ETIQUETAS_PERIODICIDAD: Record<Periodicidad, string> = {
  MENSUAL: 'Mensual',
  ANUAL: 'Anual',
  UNICO: 'Pago único',
};

export const TIPOS_COMPROBANTE = ['FACTURA', 'BOLETA', 'RECIBO_HONORARIOS', 'NOTA_VENTA', 'TICKET', 'OTRO'] as const;
export const esquemaTipoComprobante = z.enum(TIPOS_COMPROBANTE);
export type TipoComprobante = z.infer<typeof esquemaTipoComprobante>;
export const ETIQUETAS_TIPO_COMPROBANTE: Record<TipoComprobante, string> = {
  FACTURA: 'Factura',
  BOLETA: 'Boleta',
  RECIBO_HONORARIOS: 'Recibo por honorarios',
  NOTA_VENTA: 'Nota de venta',
  TICKET: 'Ticket',
  OTRO: 'Otro',
};

export const ESTADOS_COBRANZA = ['PENDIENTE', 'PARCIAL', 'PAGADO', 'ANULADO'] as const;
export const esquemaEstadoCobranza = z.enum(ESTADOS_COBRANZA);
export type EstadoCobranza = z.infer<typeof esquemaEstadoCobranza>;
export const ETIQUETAS_ESTADO_COBRANZA: Record<EstadoCobranza, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Pago parcial',
  PAGADO: 'Pagado',
  ANULADO: 'Anulado',
};

export const CATALOGOS_FINANCIEROS = ['servicios', 'medios-pago', 'categorias-egreso'] as const;
export const esquemaCatalogoFinanciero = z.enum(CATALOGOS_FINANCIEROS);
export type CatalogoFinanciero = z.infer<typeof esquemaCatalogoFinanciero>;

export const esquemaServicioEntrada = z.object({
  nombre: z.string().trim().min(3, 'Ingrese el nombre.').max(120),
  tipo: esquemaTipoServicio,
});
export type ServicioEntrada = z.infer<typeof esquemaServicioEntrada>;

export const esquemaNombreSimple = z.object({ nombre: z.string().trim().min(2, 'Ingrese el nombre.').max(80) });
export type NombreSimple = z.infer<typeof esquemaNombreSimple>;

export const esquemaElementoFinanciero = z.object({
  id: z.uuid(),
  nombre: z.string(),
  tipo: esquemaTipoServicio.nullable(),
  activo: z.boolean(),
  enUso: z.number().int().nonnegative(),
});
export type ElementoFinanciero = z.infer<typeof esquemaElementoFinanciero>;

export const esquemaProveedorEntrada = z
  .object({
    razonSocial: z.string().trim().min(2, 'Ingrese la razón social o el nombre.').max(200),
    ruc: z
      .string()
      .trim()
      .transform((valor) => (valor === '' ? null : valor))
      .nullable(),
    contacto: textoOpcional(150),
  })
  .superRefine((proveedor, contexto) => {
    if (proveedor.ruc !== null && !esRucValido(proveedor.ruc) && !esDniValido(proveedor.ruc)) {
      contexto.addIssue({ code: 'custom', path: ['ruc'], message: 'Ingrese un RUC o DNI válido.' });
    }
  });
export type ProveedorEntrada = z.infer<typeof esquemaProveedorEntrada>;

export const esquemaProveedor = z.object({
  id: z.uuid(),
  razonSocial: z.string(),
  ruc: z.string().nullable(),
  contacto: z.string().nullable(),
  activo: z.boolean(),
  egresos: z.number().int().nonnegative(),
});
export type Proveedor = z.infer<typeof esquemaProveedor>;

export const esquemaContratoEntrada = z
  .object({
    inicio: z.iso.date('Ingrese el inicio del contrato.'),
    vencimiento: fechaOpcional,
    diaPago: z.coerce.number().int().min(1, 'Entre 1 y 28.').max(28, 'Entre 1 y 28.'),
    condicionesPago: textoOpcional(1000),
    observaciones: textoOpcional(2000),
    documentoId: idOpcional,
  })
  .superRefine((contrato, contexto) => {
    if (contrato.vencimiento !== null && contrato.vencimiento < contrato.inicio) {
      contexto.addIssue({ code: 'custom', path: ['vencimiento'], message: 'No puede vencer antes de empezar.' });
    }
  });
export type ContratoEntrada = z.infer<typeof esquemaContratoEntrada>;

export const esquemaServicioContratadoEntrada = z
  .object({
    servicioId: z.uuid('Seleccione el servicio.'),
    honorario: esquemaMonto,
    periodicidad: esquemaPeriodicidad,
    desde: z.iso.date('Ingrese desde cuándo.'),
    hasta: fechaOpcional,
    observaciones: textoOpcional(500),
  })
  .superRefine((servicio, contexto) => {
    if (servicio.hasta !== null && servicio.hasta < servicio.desde) {
      contexto.addIssue({ code: 'custom', path: ['hasta'], message: 'No puede terminar antes de empezar.' });
    }
  });
export type ServicioContratadoEntrada = z.infer<typeof esquemaServicioContratadoEntrada>;

const esquemaPersona = z.object({ id: z.uuid(), nombre: z.string() });

export const esquemaServicioContratado = z.object({
  id: z.uuid(),
  servicio: z.object({ id: z.uuid(), nombre: z.string(), tipo: esquemaTipoServicio }),
  honorario: z.number(),
  periodicidad: esquemaPeriodicidad,
  desde: z.iso.date(),
  hasta: z.iso.date().nullable(),
  observaciones: z.string().nullable(),
  activo: z.boolean(),
});
export type ServicioContratado = z.infer<typeof esquemaServicioContratado>;

export const esquemaIngresoResumen = z.object({
  id: z.uuid(),
  cliente: z.object({ id: z.uuid(), razonSocial: z.string() }),
  concepto: z.string(),
  periodo: z.string().nullable(),
  tipoComprobante: esquemaTipoComprobante.nullable(),
  serieNumero: z.string().nullable(),
  fechaEmision: z.iso.date(),
  fechaVencimiento: z.iso.date(),
  monto: z.number(),
  pagado: z.number(),
  saldo: z.number(),
  estado: esquemaEstadoCobranza,
  vencido: z.boolean(),
  diasVencido: z.number().int().nonnegative(),
  generadoAutomaticamente: z.boolean(),
});
export type IngresoResumen = z.infer<typeof esquemaIngresoResumen>;

export const esquemaFichaComercial = z.object({
  clienteId: z.uuid(),
  contrato: z
    .object({
      inicio: z.iso.date(),
      vencimiento: z.iso.date().nullable(),
      diaPago: z.number().int(),
      condicionesPago: z.string().nullable(),
      observaciones: z.string().nullable(),
      documento: z.object({ id: z.uuid(), titulo: z.string() }).nullable(),
      vencido: z.boolean(),
    })
    .nullable(),
  servicios: z.array(esquemaServicioContratado),
  honorarioMensual: z.number(),
  pagos: z.object({ facturado: z.number(), cobrado: z.number(), saldo: z.number() }),
  ingresos: z.array(esquemaIngresoResumen),
  puedeGestionar: z.boolean(),
  puedeRegistrarIngresos: z.boolean(),
});
export type FichaComercial = z.infer<typeof esquemaFichaComercial>;

export const esquemaIngresoEntrada = z
  .object({
    clienteId: z.uuid('Seleccione el cliente.'),
    servicioContratadoId: idOpcional,
    concepto: z.string().trim().min(3, 'Describa el concepto.').max(200),
    periodo: z
      .string()
      .trim()
      .transform((valor) => (valor === '' ? null : valor))
      .pipe(esquemaPeriodo.nullable())
      .nullable(),
    tipoComprobante: z
      .string()
      .trim()
      .transform((valor) => (valor === '' ? null : valor))
      .pipe(esquemaTipoComprobante.nullable())
      .nullable(),
    serieNumero: textoOpcional(30),
    fechaEmision: z.iso.date('Ingrese la fecha de emisión.'),
    fechaVencimiento: z.iso.date('Ingrese el vencimiento.'),
    monto: esquemaMonto,
  })
  .superRefine((ingreso, contexto) => {
    if (ingreso.fechaVencimiento < ingreso.fechaEmision) {
      contexto.addIssue({ code: 'custom', path: ['fechaVencimiento'], message: 'No puede vencer antes de la emisión.' });
    }

    if (ingreso.serieNumero !== null && ingreso.tipoComprobante === null) {
      contexto.addIssue({ code: 'custom', path: ['tipoComprobante'], message: 'Indique el tipo de comprobante.' });
    }
  });
export type IngresoEntrada = z.infer<typeof esquemaIngresoEntrada>;

export const esquemaComprobanteEntrada = z.object({
  tipoComprobante: esquemaTipoComprobante,
  serieNumero: z.string().trim().min(3, 'Ingrese la serie y el número.').max(30),
  fechaEmision: z.iso.date('Ingrese la fecha de emisión.'),
});
export type ComprobanteEntrada = z.infer<typeof esquemaComprobanteEntrada>;

export const esquemaCobroEntrada = z.object({
  fecha: z.iso.date('Ingrese la fecha del cobro.'),
  importe: esquemaMonto,
  medioPagoId: z.uuid('Seleccione el medio de pago.'),
  operacion: textoOpcional(60),
});
export type CobroEntrada = z.infer<typeof esquemaCobroEntrada>;

export const esquemaCobro = z.object({
  id: z.uuid(),
  fecha: z.iso.date(),
  importe: z.number(),
  medioPago: z.string(),
  operacion: z.string().nullable(),
  voucher: z.object({ id: z.uuid(), nombre: z.string() }).nullable(),
  registradoPor: z.string(),
  registradoEn: z.iso.datetime(),
  anulado: z.boolean(),
  motivoAnulacion: z.string().nullable(),
});
export type Cobro = z.infer<typeof esquemaCobro>;

export const esquemaIngresoDetalle = esquemaIngresoResumen.extend({
  servicio: z.string().nullable(),
  cobros: z.array(esquemaCobro),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
  anuladoEn: z.iso.datetime().nullable(),
  motivoAnulacion: z.string().nullable(),
  puedeCobrar: z.boolean(),
  puedeAnular: z.boolean(),
});
export type IngresoDetalle = z.infer<typeof esquemaIngresoDetalle>;

const vacioAIndefinido = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? undefined : valor));

export const esquemaFiltroIngresos = z.object({
  clienteId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
  estado: vacioAIndefinido.pipe(esquemaEstadoCobranza.optional()).optional(),
  periodo: vacioAIndefinido.pipe(esquemaPeriodo.optional()).optional(),
  vencidos: vacioAIndefinido.pipe(z.enum(['si']).optional()).optional(),
  busqueda: vacioAIndefinido.pipe(z.string().max(100).optional()).optional(),
  pagina: z.coerce.number().int().positive().default(1),
});
export type FiltroIngresos = z.infer<typeof esquemaFiltroIngresos>;

export const esquemaPaginaIngresos = esquemaMetadatosPagina.extend({
  elementos: z.array(esquemaIngresoResumen),
  totales: z.object({ monto: z.number(), pagado: z.number(), saldo: z.number() }),
});
export type PaginaIngresos = z.infer<typeof esquemaPaginaIngresos>;

export const esquemaEgresoEntrada = z
  .object({
    concepto: z.string().trim().min(3, 'Describa el concepto.').max(200),
    proveedorId: idOpcional,
    fecha: z.iso.date('Ingrese la fecha.'),
    importe: esquemaMonto,
    categoriaId: z.uuid('Seleccione la categoría.'),
    tipoComprobante: z
      .string()
      .trim()
      .transform((valor) => (valor === '' ? null : valor))
      .pipe(esquemaTipoComprobante.nullable())
      .nullable(),
    serieNumero: textoOpcional(30),
    responsableId: z.uuid('Seleccione al responsable.'),
    medioPagoId: z.uuid('Seleccione el medio de pago.'),
    clienteId: idOpcional,
    proyectoId: idOpcional.default(null),
    observaciones: textoOpcional(1000),
  })
  .superRefine((egreso, contexto) => {
    if (egreso.serieNumero !== null && egreso.tipoComprobante === null) {
      contexto.addIssue({ code: 'custom', path: ['tipoComprobante'], message: 'Indique el tipo de comprobante.' });
    }
  });
export type EgresoEntrada = z.infer<typeof esquemaEgresoEntrada>;

export const esquemaEgreso = z.object({
  id: z.uuid(),
  concepto: z.string(),
  proveedor: z.object({ id: z.uuid(), razonSocial: z.string() }).nullable(),
  fecha: z.iso.date(),
  importe: z.number(),
  categoria: z.string(),
  tipoComprobante: esquemaTipoComprobante.nullable(),
  serieNumero: z.string().nullable(),
  comprobante: z.object({ id: z.uuid(), nombre: z.string() }).nullable(),
  responsable: esquemaPersona,
  medioPago: z.string(),
  cliente: z.object({ id: z.uuid(), razonSocial: z.string() }).nullable(),
  proyecto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }).nullable(),
  observaciones: z.string().nullable(),
  registradoPor: z.string(),
  registradoEn: z.iso.datetime(),
  anulado: z.boolean(),
  anuladoEn: z.iso.datetime().nullable(),
  motivoAnulacion: z.string().nullable(),
});
export type Egreso = z.infer<typeof esquemaEgreso>;

export const esquemaFiltroEgresos = z
  .object({
    desde: vacioAIndefinido.pipe(z.iso.date().optional()).optional(),
    hasta: vacioAIndefinido.pipe(z.iso.date().optional()).optional(),
    categoriaId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
    proveedorId: vacioAIndefinido.pipe(z.uuid().optional()).optional(),
    anulados: vacioAIndefinido.pipe(z.enum(['si']).optional()).optional(),
    pagina: z.coerce.number().int().positive().default(1),
  })
  .superRefine((filtro, contexto) => {
    if (filtro.desde !== undefined && filtro.hasta !== undefined && filtro.desde > filtro.hasta) {
      contexto.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial.' });
    }
  });
export type FiltroEgresos = z.infer<typeof esquemaFiltroEgresos>;

export const esquemaPaginaEgresos = esquemaMetadatosPagina.extend({
  elementos: z.array(esquemaEgreso),
  importeTotal: z.number(),
});
export type PaginaEgresos = z.infer<typeof esquemaPaginaEgresos>;

export const esquemaOpcionesFinanzas = z.object({
  clientes: z.array(z.object({ id: z.uuid(), razonSocial: z.string() })),
  servicios: z.array(z.object({ id: z.uuid(), nombre: z.string(), tipo: esquemaTipoServicio })),
  mediosPago: z.array(z.object({ id: z.uuid(), nombre: z.string() })),
  categorias: z.array(z.object({ id: z.uuid(), nombre: z.string() })),
  proveedores: z.array(z.object({ id: z.uuid(), razonSocial: z.string() })),
  responsables: z.array(esquemaPersona),
  proyectos: z.array(z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() })),
  puedeIngresos: z.boolean(),
  puedeEgresos: z.boolean(),
  puedeAnular: z.boolean(),
});
export type OpcionesFinanzas = z.infer<typeof esquemaOpcionesFinanzas>;

export const esquemaGeneracionHonorarios = z.object({ periodo: esquemaPeriodo });
export type GeneracionHonorarios = z.infer<typeof esquemaGeneracionHonorarios>;

export const TRAMOS_ANTIGUEDAD = ['POR_VENCER', 'D0_30', 'D31_60', 'D61_90', 'D90_MAS'] as const;
export const esquemaTramoAntiguedad = z.enum(TRAMOS_ANTIGUEDAD);
export type TramoAntiguedad = z.infer<typeof esquemaTramoAntiguedad>;
export const ETIQUETAS_TRAMO_ANTIGUEDAD: Record<TramoAntiguedad, string> = {
  POR_VENCER: 'Por vencer',
  D0_30: '1 a 30 días',
  D31_60: '31 a 60 días',
  D61_90: '61 a 90 días',
  D90_MAS: 'Más de 90 días',
};

const esquemaTramos = z.object({
  POR_VENCER: z.number(),
  D0_30: z.number(),
  D31_60: z.number(),
  D61_90: z.number(),
  D90_MAS: z.number(),
});

export const esquemaCuentasPorCobrar = z.object({
  fecha: z.iso.date(),
  totales: esquemaTramos.extend({ total: z.number() }),
  clientes: z.array(
    esquemaTramos.extend({
      cliente: z.object({ id: z.uuid(), razonSocial: z.string() }),
      total: z.number(),
      comprobantes: z.number().int().nonnegative(),
      diasMaximo: z.number().int().nonnegative(),
    }),
  ),
});
export type CuentasPorCobrar = z.infer<typeof esquemaCuentasPorCobrar>;

export const esquemaFiltroRangoMeses = z
  .object({
    desde: vacioAIndefinido.pipe(esquemaPeriodo.optional()).optional(),
    hasta: vacioAIndefinido.pipe(esquemaPeriodo.optional()).optional(),
  })
  .superRefine((filtro, contexto) => {
    if (filtro.desde !== undefined && filtro.hasta !== undefined && filtro.desde > filtro.hasta) {
      contexto.addIssue({ code: 'custom', path: ['hasta'], message: 'El mes final no puede ser anterior al inicial.' });
    }
  });
export type FiltroRangoMeses = z.infer<typeof esquemaFiltroRangoMeses>;

export const MAXIMO_MESES_REPORTE = 24;

export const esquemaFlujoCaja = z.object({
  desde: z.string(),
  hasta: z.string(),
  meses: z.array(
    z.object({
      periodo: z.string(),
      cobros: z.number(),
      egresos: z.number(),
      neto: z.number(),
      acumulado: z.number(),
      egresosPorCategoria: z.array(z.object({ categoria: z.string(), importe: z.number() })),
    }),
  ),
  totales: z.object({ cobros: z.number(), egresos: z.number(), neto: z.number() }),
});
export type FlujoCaja = z.infer<typeof esquemaFlujoCaja>;

export const esquemaFilaRentabilidad = z.object({
  id: z.string(),
  nombre: z.string(),
  facturado: z.number(),
  cobrado: z.number(),
  egresos: z.number(),
  horas: z.number(),
  margen: z.number(),
  ingresoPorHora: z.number().nullable(),
});
export type FilaRentabilidad = z.infer<typeof esquemaFilaRentabilidad>;

export const esquemaRentabilidad = z.object({
  desde: z.string(),
  hasta: z.string(),
  porCliente: z.array(esquemaFilaRentabilidad),
  porServicio: z.array(esquemaFilaRentabilidad),
});
export type Rentabilidad = z.infer<typeof esquemaRentabilidad>;

export const esquemaHonorariosPorCliente = z.object({
  desde: z.string(),
  hasta: z.string(),
  filas: z.array(
    z.object({
      cliente: z.object({ id: z.uuid(), razonSocial: z.string() }),
      honorarioMensual: z.number(),
      facturado: z.number(),
      cobrado: z.number(),
      saldo: z.number(),
      ultimoPago: z.iso.date().nullable(),
    }),
  ),
  totales: z.object({ honorarioMensual: z.number(), facturado: z.number(), cobrado: z.number(), saldo: z.number() }),
});
export type HonorariosPorCliente = z.infer<typeof esquemaHonorariosPorCliente>;

export const esquemaIndicadoresFinancieros = z.object({
  periodo: z.string(),
  facturadoMes: z.number(),
  cobradoMes: z.number(),
  porCobrar: z.number(),
  vencido: z.number(),
  clientesMorosos: z.number().int().nonnegative(),
});
export type IndicadoresFinancieros = z.infer<typeof esquemaIndicadoresFinancieros>;

export const esquemaResultadoHonorarios = z.object({
  periodo: z.string(),
  generados: z.number().int().nonnegative(),
  existentes: z.number().int().nonnegative(),
});
export type ResultadoHonorarios = z.infer<typeof esquemaResultadoHonorarios>;

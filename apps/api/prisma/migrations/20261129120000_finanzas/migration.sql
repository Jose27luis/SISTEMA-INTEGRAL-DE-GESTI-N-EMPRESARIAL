-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('RECURRENTE', 'PROYECTO');

-- CreateEnum
CREATE TYPE "Periodicidad" AS ENUM ('MENSUAL', 'ANUAL', 'UNICO');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('FACTURA', 'BOLETA', 'RECIBO_HONORARIOS', 'NOTA_VENTA', 'TICKET', 'OTRO');

-- CreateTable
CREATE TABLE "servicios" (
    "id" UUID NOT NULL,
    "nombre" CITEXT NOT NULL,
    "tipo" "TipoServicio" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios_contratados" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "servicio_id" UUID NOT NULL,
    "honorario" DECIMAL(12,2) NOT NULL,
    "periodicidad" "Periodicidad" NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "servicios_contratados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos_cliente" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "inicio" DATE NOT NULL,
    "vencimiento" DATE,
    "dia_pago" INTEGER NOT NULL,
    "condiciones_pago" TEXT,
    "observaciones" TEXT,
    "documento_id" UUID,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contratos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medios_pago" (
    "id" UUID NOT NULL,
    "nombre" CITEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medios_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_egreso" (
    "id" UUID NOT NULL,
    "nombre" CITEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_egreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" UUID NOT NULL,
    "razon_social" TEXT NOT NULL,
    "ruc" VARCHAR(11),
    "contacto" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingresos" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "servicio_contratado_id" UUID,
    "concepto" TEXT NOT NULL,
    "periodo" CHAR(7),
    "tipo_comprobante" "TipoComprobante",
    "serie_numero" TEXT,
    "fecha_emision" DATE NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "monto_pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(12,2) NOT NULL,
    "generado_automaticamente" BOOLEAN NOT NULL DEFAULT false,
    "creado_por_id" UUID,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "anulado_en" TIMESTAMPTZ(3),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,

    CONSTRAINT "ingresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobros" (
    "id" UUID NOT NULL,
    "ingreso_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "medio_pago_id" UUID NOT NULL,
    "operacion" TEXT,
    "voucher_id" UUID,
    "registrado_por_id" UUID NOT NULL,
    "registrado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulado_en" TIMESTAMPTZ(3),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,

    CONSTRAINT "cobros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egresos" (
    "id" UUID NOT NULL,
    "concepto" TEXT NOT NULL,
    "proveedor_id" UUID,
    "fecha" DATE NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "categoria_id" UUID NOT NULL,
    "tipo_comprobante" "TipoComprobante",
    "serie_numero" TEXT,
    "comprobante_id" UUID,
    "responsable_id" UUID NOT NULL,
    "medio_pago_id" UUID NOT NULL,
    "cliente_id" UUID,
    "observaciones" TEXT,
    "creado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulado_en" TIMESTAMPTZ(3),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,

    CONSTRAINT "egresos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servicios_nombre_key" ON "servicios"("nombre");

-- CreateIndex
CREATE INDEX "servicios_contratados_cliente_id_activo_idx" ON "servicios_contratados"("cliente_id", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_cliente_cliente_id_key" ON "contratos_cliente"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "medios_pago_nombre_key" ON "medios_pago"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_egreso_nombre_key" ON "categorias_egreso"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_ruc_key" ON "proveedores"("ruc");

-- CreateIndex
CREATE INDEX "ingresos_cliente_id_fecha_vencimiento_idx" ON "ingresos"("cliente_id", "fecha_vencimiento");

-- CreateIndex
CREATE INDEX "ingresos_fecha_vencimiento_saldo_idx" ON "ingresos"("fecha_vencimiento", "saldo");

-- CreateIndex
CREATE INDEX "ingresos_periodo_idx" ON "ingresos"("periodo");

-- CreateIndex
CREATE INDEX "cobros_ingreso_id_idx" ON "cobros"("ingreso_id");

-- CreateIndex
CREATE INDEX "cobros_fecha_idx" ON "cobros"("fecha");

-- CreateIndex
CREATE INDEX "egresos_fecha_idx" ON "egresos"("fecha");

-- CreateIndex
CREATE INDEX "egresos_categoria_id_idx" ON "egresos"("categoria_id");

-- AddForeignKey
ALTER TABLE "servicios_contratados" ADD CONSTRAINT "servicios_contratados_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_contratados" ADD CONSTRAINT "servicios_contratados_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_cliente" ADD CONSTRAINT "contratos_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_cliente" ADD CONSTRAINT "contratos_cliente_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_servicio_contratado_id_fkey" FOREIGN KEY ("servicio_contratado_id") REFERENCES "servicios_contratados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_ingreso_id_fkey" FOREIGN KEY ("ingreso_id") REFERENCES "ingresos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_medio_pago_id_fkey" FOREIGN KEY ("medio_pago_id") REFERENCES "medios_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "archivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_egreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "archivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_medio_pago_id_fkey" FOREIGN KEY ("medio_pago_id") REFERENCES "medios_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "TipoNotificacion" ADD VALUE 'PAGO_VENCIDO';

ALTER TYPE "AccionAuditoria" ADD VALUE 'ANULAR';

ALTER TABLE "servicios_contratados" ADD CONSTRAINT "servicios_contratados_honorario_positivo" CHECK ("honorario" > 0);

ALTER TABLE "servicios_contratados" ADD CONSTRAINT "servicios_contratados_vigencia_ordenada" CHECK ("hasta" IS NULL OR "hasta" >= "desde");

ALTER TABLE "contratos_cliente" ADD CONSTRAINT "contratos_cliente_dia_pago_valido" CHECK ("dia_pago" BETWEEN 1 AND 28);

ALTER TABLE "contratos_cliente" ADD CONSTRAINT "contratos_cliente_vigencia_ordenada" CHECK ("vencimiento" IS NULL OR "vencimiento" >= "inicio");

ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_montos_validos" CHECK (
    "monto" > 0 AND "monto_pagado" >= 0 AND "monto_pagado" <= "monto" AND "saldo" = "monto" - "monto_pagado"
);

ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_vencimiento_posterior" CHECK ("fecha_vencimiento" >= "fecha_emision");

ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_periodo_valido" CHECK ("periodo" IS NULL OR "periodo" ~ '^\d{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_anulado_con_motivo" CHECK ("anulado_en" IS NULL OR length(trim(coalesce("motivo_anulacion", ''))) > 0);

ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_comprobante_con_tipo" CHECK ("serie_numero" IS NULL OR "tipo_comprobante" IS NOT NULL);

CREATE UNIQUE INDEX "ingresos_honorario_unico_key" ON "ingresos"("servicio_contratado_id", "periodo")
    WHERE "generado_automaticamente" AND "anulado_en" IS NULL;

ALTER TABLE "cobros" ADD CONSTRAINT "cobros_importe_positivo" CHECK ("importe" > 0);

ALTER TABLE "cobros" ADD CONSTRAINT "cobros_anulado_con_motivo" CHECK ("anulado_en" IS NULL OR length(trim(coalesce("motivo_anulacion", ''))) > 0);

ALTER TABLE "egresos" ADD CONSTRAINT "egresos_importe_positivo" CHECK ("importe" > 0);

ALTER TABLE "egresos" ADD CONSTRAINT "egresos_anulado_con_motivo" CHECK ("anulado_en" IS NULL OR length(trim(coalesce("motivo_anulacion", ''))) > 0);

ALTER TABLE "egresos" ADD CONSTRAINT "egresos_comprobante_con_tipo" CHECK ("serie_numero" IS NULL OR "tipo_comprobante" IS NOT NULL);

INSERT INTO "medios_pago" ("id", "nombre") VALUES
    (gen_random_uuid(), 'Efectivo'),
    (gen_random_uuid(), 'Transferencia bancaria'),
    (gen_random_uuid(), 'Depósito en cuenta'),
    (gen_random_uuid(), 'Yape'),
    (gen_random_uuid(), 'Plin'),
    (gen_random_uuid(), 'Tarjeta'),
    (gen_random_uuid(), 'Cheque');

INSERT INTO "categorias_egreso" ("id", "nombre") VALUES
    (gen_random_uuid(), 'Planilla y honorarios'),
    (gen_random_uuid(), 'Alquiler'),
    (gen_random_uuid(), 'Servicios básicos'),
    (gen_random_uuid(), 'Software y suscripciones'),
    (gen_random_uuid(), 'Útiles y suministros'),
    (gen_random_uuid(), 'Impuestos y tributos'),
    (gen_random_uuid(), 'Movilidad'),
    (gen_random_uuid(), 'Otros');

INSERT INTO "permisos" ("id", "codigo", "modulo", "descripcion", "sensible") VALUES
    (gen_random_uuid(), 'comercial:ver', 'Finanzas', 'Ver la ficha comercial y los ingresos de sus clientes', false),
    (gen_random_uuid(), 'comercial:gestionar', 'Finanzas', 'Registrar el contrato y los servicios contratados de los clientes', false),
    (gen_random_uuid(), 'finanza:ingresos', 'Finanzas', 'Registrar ingresos, comprobantes y cobros, y generar los honorarios del mes', true),
    (gen_random_uuid(), 'finanza:egresos', 'Finanzas', 'Ver y registrar egresos', true),
    (gen_random_uuid(), 'finanza:anular', 'Finanzas', 'Anular ingresos, cobros y egresos con motivo', true),
    (gen_random_uuid(), 'finanza:catalogos', 'Finanzas', 'Administrar servicios, medios de pago, categorías de egreso y proveedores', false);

INSERT INTO "roles_permisos" ("id", "rol_id", "permiso_id")
SELECT gen_random_uuid(), r."id", p."id"
FROM "roles" r
JOIN "permisos" p ON (
    (p."codigo" = 'comercial:ver' AND r."codigo" IN ('GERENCIA', 'ADMINISTRACION', 'COMERCIAL'))
    OR (p."codigo" IN ('comercial:gestionar', 'finanza:ingresos', 'finanza:egresos', 'finanza:catalogos') AND r."codigo" IN ('GERENCIA', 'ADMINISTRACION'))
    OR (p."codigo" = 'finanza:anular' AND r."codigo" = 'GERENCIA')
);


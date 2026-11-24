-- CreateEnum
CREATE TYPE "GrupoCronograma" AS ENUM ('GENERAL', 'BUENOS_CONTRIBUYENTES');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'OBLIGACION_POR_VENCER';
ALTER TYPE "TipoNotificacion" ADD VALUE 'OBLIGACION_VENCIDA';
ALTER TYPE "TipoNotificacion" ADD VALUE 'CRONOGRAMA_FALTANTE';

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "grupo_cronograma" "GrupoCronograma" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "tipos_obligacion" (
    "id" UUID NOT NULL,
    "codigo" CITEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "usa_cronograma" BOOLEAN NOT NULL DEFAULT true,
    "dia_vencimiento" INTEGER,
    "dias_alerta" INTEGER[] DEFAULT ARRAY[5, 3, 1]::INTEGER[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tipos_obligacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligaciones_cliente" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "tipo_obligacion_id" UUID NOT NULL,
    "responsable_id" UUID NOT NULL,
    "revisor_id" UUID,
    "desde_periodo" CHAR(7) NOT NULL,
    "hasta_periodo" CHAR(7),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "configurado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "obligaciones_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cronograma_vencimientos" (
    "id" UUID NOT NULL,
    "tipo_obligacion_id" UUID NOT NULL,
    "periodo" CHAR(7) NOT NULL,
    "grupo" "GrupoCronograma" NOT NULL,
    "ultimo_digito" SMALLINT NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "fuente" TEXT NOT NULL,
    "cargado_por_id" UUID NOT NULL,
    "cargado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cronograma_vencimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligaciones_periodo" (
    "id" UUID NOT NULL,
    "obligacion_cliente_id" UUID NOT NULL,
    "periodo" CHAR(7) NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "tarea_id" UUID NOT NULL,
    "fecha_presentacion" DATE,
    "numero_orden" TEXT,
    "constancia_id" UUID,
    "observaciones" TEXT,
    "generada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "obligaciones_periodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_obligacion_codigo_key" ON "tipos_obligacion"("codigo");

-- CreateIndex
CREATE INDEX "obligaciones_cliente_cliente_id_activo_idx" ON "obligaciones_cliente"("cliente_id", "activo");

-- CreateIndex
CREATE INDEX "obligaciones_cliente_tipo_obligacion_id_activo_idx" ON "obligaciones_cliente"("tipo_obligacion_id", "activo");

-- CreateIndex
CREATE INDEX "cronograma_vencimientos_periodo_idx" ON "cronograma_vencimientos"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "cronograma_vencimientos_tipo_obligacion_id_periodo_grupo_ul_key" ON "cronograma_vencimientos"("tipo_obligacion_id", "periodo", "grupo", "ultimo_digito");

-- CreateIndex
CREATE UNIQUE INDEX "obligaciones_periodo_tarea_id_key" ON "obligaciones_periodo"("tarea_id");

-- CreateIndex
CREATE INDEX "obligaciones_periodo_fecha_vencimiento_idx" ON "obligaciones_periodo"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "obligaciones_periodo_periodo_idx" ON "obligaciones_periodo"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "obligaciones_periodo_obligacion_cliente_id_periodo_key" ON "obligaciones_periodo"("obligacion_cliente_id", "periodo");

-- AddForeignKey
ALTER TABLE "obligaciones_cliente" ADD CONSTRAINT "obligaciones_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_cliente" ADD CONSTRAINT "obligaciones_cliente_tipo_obligacion_id_fkey" FOREIGN KEY ("tipo_obligacion_id") REFERENCES "tipos_obligacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_cliente" ADD CONSTRAINT "obligaciones_cliente_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_cliente" ADD CONSTRAINT "obligaciones_cliente_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_cliente" ADD CONSTRAINT "obligaciones_cliente_configurado_por_id_fkey" FOREIGN KEY ("configurado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_vencimientos" ADD CONSTRAINT "cronograma_vencimientos_tipo_obligacion_id_fkey" FOREIGN KEY ("tipo_obligacion_id") REFERENCES "tipos_obligacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronograma_vencimientos" ADD CONSTRAINT "cronograma_vencimientos_cargado_por_id_fkey" FOREIGN KEY ("cargado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_periodo" ADD CONSTRAINT "obligaciones_periodo_obligacion_cliente_id_fkey" FOREIGN KEY ("obligacion_cliente_id") REFERENCES "obligaciones_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_periodo" ADD CONSTRAINT "obligaciones_periodo_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_periodo" ADD CONSTRAINT "obligaciones_periodo_constancia_id_fkey" FOREIGN KEY ("constancia_id") REFERENCES "archivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tipos_obligacion" ALTER COLUMN "dias_alerta" SET NOT NULL;

ALTER TABLE "tipos_obligacion" ADD CONSTRAINT "tipos_obligacion_dia_vencimiento_valido" CHECK ("dia_vencimiento" IS NULL OR "dia_vencimiento" BETWEEN 1 AND 28);

ALTER TABLE "tipos_obligacion" ADD CONSTRAINT "tipos_obligacion_vencimiento_definido" CHECK ("usa_cronograma" OR "dia_vencimiento" IS NOT NULL);

ALTER TABLE "tipos_obligacion" ADD CONSTRAINT "tipos_obligacion_dias_alerta_validos" CHECK (cardinality("dias_alerta") <= 5 AND 1 <= ALL("dias_alerta") AND 30 >= ALL("dias_alerta"));

ALTER TABLE "obligaciones_cliente" ADD CONSTRAINT "obligaciones_cliente_periodos_validos" CHECK (
    "desde_periodo" ~ '^\d{4}-(0[1-9]|1[0-2])$'
    AND ("hasta_periodo" IS NULL OR ("hasta_periodo" ~ '^\d{4}-(0[1-9]|1[0-2])$' AND "hasta_periodo" >= "desde_periodo"))
);

ALTER TABLE "obligaciones_cliente" ADD CONSTRAINT "obligaciones_cliente_revisor_distinto" CHECK ("revisor_id" IS NULL OR "revisor_id" <> "responsable_id");

CREATE UNIQUE INDEX "obligaciones_cliente_vigente_key" ON "obligaciones_cliente"("cliente_id", "tipo_obligacion_id") WHERE "activo";

ALTER TABLE "cronograma_vencimientos" ADD CONSTRAINT "cronograma_vencimientos_periodo_valido" CHECK ("periodo" ~ '^\d{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "cronograma_vencimientos" ADD CONSTRAINT "cronograma_vencimientos_digito_valido" CHECK ("ultimo_digito" BETWEEN 0 AND 9);

ALTER TABLE "obligaciones_periodo" ADD CONSTRAINT "obligaciones_periodo_periodo_valido" CHECK ("periodo" ~ '^\d{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "obligaciones_periodo" ADD CONSTRAINT "obligaciones_periodo_presentada_con_constancia" CHECK ("fecha_presentacion" IS NULL OR "constancia_id" IS NOT NULL);

INSERT INTO "tipos_obligacion" ("id", "codigo", "nombre", "descripcion", "usa_cronograma", "dia_vencimiento", "activo", "actualizado_en") VALUES
    (gen_random_uuid(), 'PDT621', 'Declaración mensual IGV-Renta (PDT 621)', 'Declaración y pago mensual del IGV y pagos a cuenta del Impuesto a la Renta.', true, NULL, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'PLAME', 'Planilla mensual (PDT PLAME)', 'Planilla mensual de pagos: remuneraciones, retenciones y aportes.', true, NULL, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'RVIE', 'Registro de Ventas e Ingresos Electrónico', 'Registro de ventas del SIRE.', true, NULL, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'RCE', 'Registro de Compras Electrónico', 'Registro de compras del SIRE.', true, NULL, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'LE', 'Libros electrónicos', 'Libros y registros electrónicos del PLE según el cronograma de SUNAT.', true, NULL, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'CONCILIACION', 'Conciliación bancaria', 'Plazo interno: Gerencia define el día y activa el tipo antes de usarlo.', false, 10, false, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'PLANILLA', 'Cálculo de planilla', 'Plazo interno: Gerencia define el día y activa el tipo antes de usarlo.', false, 10, false, CURRENT_TIMESTAMP);

INSERT INTO "permisos" ("id", "codigo", "modulo", "descripcion", "sensible") VALUES
    (gen_random_uuid(), 'obligacion:ver', 'Obligaciones', 'Ver el calendario tributario, el control mensual y las obligaciones de sus clientes', false),
    (gen_random_uuid(), 'obligacion:gestionar', 'Obligaciones', 'Configurar las obligaciones de los clientes y generar las del periodo', false),
    (gen_random_uuid(), 'cronograma:gestionar', 'Obligaciones', 'Administrar los tipos de obligación y cargar el cronograma oficial de vencimientos', true);

INSERT INTO "roles_permisos" ("id", "rol_id", "permiso_id")
SELECT gen_random_uuid(), r."id", p."id"
FROM "roles" r
JOIN "permisos" p ON (
    (p."codigo" = 'obligacion:ver' AND r."codigo" IN ('GERENCIA', 'CONTABILIDAD', 'ASISTENTE_CONTABLE', 'ADMINISTRACION'))
    OR (p."codigo" = 'obligacion:gestionar' AND r."codigo" IN ('GERENCIA', 'CONTABILIDAD'))
    OR (p."codigo" = 'cronograma:gestionar' AND r."codigo" = 'GERENCIA')
);


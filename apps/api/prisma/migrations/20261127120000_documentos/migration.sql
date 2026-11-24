-- CreateEnum
CREATE TYPE "Confidencialidad" AS ENUM ('NORMAL', 'RESTRINGIDO');

-- AlterEnum
ALTER TYPE "AccionAuditoria" ADD VALUE 'ARCHIVAR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'DOCUMENTO_POR_VENCER';
ALTER TYPE "TipoNotificacion" ADD VALUE 'DOCUMENTO_VENCIDO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'DOCUMENTACION_FALTANTE';

-- CreateTable
CREATE TABLE "tipos_documento" (
    "id" UUID NOT NULL,
    "nombre" CITEXT NOT NULL,
    "admite_vencimiento" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpetas" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "padre_id" UUID,
    "nombre" CITEXT NOT NULL,
    "creado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo_documento_id" UUID NOT NULL,
    "cliente_id" UUID,
    "area_id" UUID,
    "carpeta_id" UUID,
    "periodo" CHAR(7),
    "fecha_documento" DATE,
    "fecha_vencimiento" DATE,
    "version_actual" INTEGER NOT NULL DEFAULT 1,
    "confidencialidad" "Confidencialidad" NOT NULL DEFAULT 'NORMAL',
    "creado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "archivado_en" TIMESTAMPTZ(3),
    "archivado_por_id" UUID,
    "motivo_archivo" TEXT,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versiones_documento" (
    "id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "archivo_id" UUID NOT NULL,
    "nota" TEXT,
    "cargado_por_id" UUID NOT NULL,
    "cargado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versiones_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_esperados" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "tipo_documento_id" UUID NOT NULL,
    "periodo" CHAR(7) NOT NULL,
    "fecha_limite" DATE NOT NULL,
    "descripcion" TEXT,
    "documento_id" UUID,
    "recibido_en" TIMESTAMPTZ(3),
    "anulado_en" TIMESTAMPTZ(3),
    "creado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_esperados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_documento_nombre_key" ON "tipos_documento"("nombre");

-- CreateIndex
CREATE INDEX "carpetas_cliente_id_padre_id_idx" ON "carpetas"("cliente_id", "padre_id");

-- CreateIndex
CREATE INDEX "documentos_cliente_id_archivado_en_idx" ON "documentos"("cliente_id", "archivado_en");

-- CreateIndex
CREATE INDEX "documentos_carpeta_id_idx" ON "documentos"("carpeta_id");

-- CreateIndex
CREATE INDEX "documentos_fecha_vencimiento_idx" ON "documentos"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "documentos_tipo_documento_id_idx" ON "documentos"("tipo_documento_id");

-- CreateIndex
CREATE INDEX "versiones_documento_archivo_id_idx" ON "versiones_documento"("archivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "versiones_documento_documento_id_numero_key" ON "versiones_documento"("documento_id", "numero");

-- CreateIndex
CREATE INDEX "documentos_esperados_cliente_id_periodo_idx" ON "documentos_esperados"("cliente_id", "periodo");

-- CreateIndex
CREATE INDEX "documentos_esperados_fecha_limite_idx" ON "documentos_esperados"("fecha_limite");

-- AddForeignKey
ALTER TABLE "carpetas" ADD CONSTRAINT "carpetas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpetas" ADD CONSTRAINT "carpetas_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "carpetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpetas" ADD CONSTRAINT "carpetas_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipos_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_carpeta_id_fkey" FOREIGN KEY ("carpeta_id") REFERENCES "carpetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_archivado_por_id_fkey" FOREIGN KEY ("archivado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versiones_documento" ADD CONSTRAINT "versiones_documento_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versiones_documento" ADD CONSTRAINT "versiones_documento_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versiones_documento" ADD CONSTRAINT "versiones_documento_cargado_por_id_fkey" FOREIGN KEY ("cargado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_esperados" ADD CONSTRAINT "documentos_esperados_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_esperados" ADD CONSTRAINT "documentos_esperados_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipos_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_esperados" ADD CONSTRAINT "documentos_esperados_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_esperados" ADD CONSTRAINT "documentos_esperados_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "carpetas_raiz_nombre_key" ON "carpetas"("cliente_id", "nombre") WHERE "padre_id" IS NULL;

CREATE UNIQUE INDEX "carpetas_hija_nombre_key" ON "carpetas"("padre_id", "nombre") WHERE "padre_id" IS NOT NULL;

ALTER TABLE "carpetas" ADD CONSTRAINT "carpetas_no_es_su_propia_padre" CHECK ("padre_id" IS NULL OR "padre_id" <> "id");

ALTER TABLE "documentos" ADD CONSTRAINT "documentos_version_positiva" CHECK ("version_actual" > 0);

ALTER TABLE "documentos" ADD CONSTRAINT "documentos_periodo_valido" CHECK ("periodo" IS NULL OR "periodo" ~ '^\d{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "documentos" ADD CONSTRAINT "documentos_carpeta_con_cliente" CHECK ("carpeta_id" IS NULL OR "cliente_id" IS NOT NULL);

ALTER TABLE "documentos" ADD CONSTRAINT "documentos_vencimiento_posterior" CHECK ("fecha_documento" IS NULL OR "fecha_vencimiento" IS NULL OR "fecha_vencimiento" >= "fecha_documento");

ALTER TABLE "documentos" ADD CONSTRAINT "documentos_archivado_con_motivo" CHECK ("archivado_en" IS NULL OR length(trim(coalesce("motivo_archivo", ''))) > 0);

ALTER TABLE "versiones_documento" ADD CONSTRAINT "versiones_documento_numero_positivo" CHECK ("numero" > 0);

ALTER TABLE "documentos_esperados" ADD CONSTRAINT "documentos_esperados_periodo_valido" CHECK ("periodo" ~ '^\d{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "documentos_esperados" ADD CONSTRAINT "documentos_esperados_recibido_con_documento" CHECK ("recibido_en" IS NULL OR "documento_id" IS NOT NULL);

CREATE UNIQUE INDEX "documentos_esperados_vigente_key" ON "documentos_esperados"("cliente_id", "tipo_documento_id", "periodo") WHERE "anulado_en" IS NULL;

INSERT INTO "tipos_documento" ("id", "nombre", "admite_vencimiento") VALUES
    (gen_random_uuid(), 'Ficha RUC', false),
    (gen_random_uuid(), 'Contrato', true),
    (gen_random_uuid(), 'Poder', true),
    (gen_random_uuid(), 'Licencia', true),
    (gen_random_uuid(), 'Declaración', false),
    (gen_random_uuid(), 'Constancia', false),
    (gen_random_uuid(), 'Estado financiero', false),
    (gen_random_uuid(), 'Comprobante', false),
    (gen_random_uuid(), 'Informe', false),
    (gen_random_uuid(), 'Acta', false),
    (gen_random_uuid(), 'Documento laboral', false),
    (gen_random_uuid(), 'Documento administrativo', false),
    (gen_random_uuid(), 'Documento comercial', false);

INSERT INTO "permisos" ("id", "codigo", "modulo", "descripcion", "sensible") VALUES
    (gen_random_uuid(), 'documento:ver', 'Documentos', 'Ver y descargar los documentos de sus clientes', false),
    (gen_random_uuid(), 'documento:gestionar', 'Documentos', 'Subir documentos y versiones, organizar carpetas y registrar la documentación esperada', false);

INSERT INTO "roles_permisos" ("id", "rol_id", "permiso_id")
SELECT gen_random_uuid(), r."id", p."id"
FROM "roles" r
JOIN "permisos" p ON p."codigo" IN ('documento:ver', 'documento:gestionar')
WHERE r."codigo" IN ('GERENCIA', 'CONTABILIDAD', 'ASISTENTE_CONTABLE', 'ADMINISTRACION');


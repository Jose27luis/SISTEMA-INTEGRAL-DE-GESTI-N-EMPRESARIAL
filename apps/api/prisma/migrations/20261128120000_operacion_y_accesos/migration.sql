-- CreateEnum
CREATE TYPE "Frecuencia" AS ENUM ('MENSUAL', 'SEMANAL');

-- CreateEnum
CREATE TYPE "EstadoAcceso" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'DADO_DE_BAJA');

-- CreateEnum
CREATE TYPE "EstadoIncidencia" AS ENUM ('ABIERTA', 'EN_ATENCION', 'RESUELTA', 'ANULADA');

-- AlterEnum
ALTER TYPE "AccionAuditoria" ADD VALUE 'CONSULTAR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'ACCESO_POR_REVISAR';
ALTER TYPE "TipoNotificacion" ADD VALUE 'INCIDENCIA_ASIGNADA';

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "fecha_ocurrencia" DATE,
ADD COLUMN     "plantilla_id" UUID,
ADD COLUMN     "regla_id" UUID;

-- CreateTable
CREATE TABLE "rectificaciones" (
    "id" UUID NOT NULL,
    "obligacion_periodo_id" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha_presentacion" DATE NOT NULL,
    "numero_orden" TEXT,
    "constancia_id" UUID NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "registrado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rectificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_tarea" (
    "id" UUID NOT NULL,
    "nombre" CITEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "instrucciones" TEXT,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "dias_plazo" INTEGER NOT NULL DEFAULT 0,
    "requiere_aprobacion" BOOLEAN NOT NULL DEFAULT false,
    "requiere_evidencia" BOOLEAN NOT NULL DEFAULT false,
    "evidencia_requerida" TEXT,
    "items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plantillas_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_recurrencia" (
    "id" UUID NOT NULL,
    "plantilla_id" UUID NOT NULL,
    "cliente_id" UUID,
    "responsable_id" UUID NOT NULL,
    "revisor_id" UUID,
    "frecuencia" "Frecuencia" NOT NULL,
    "dia_del_mes" INTEGER,
    "dia_de_semana" INTEGER,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reglas_recurrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_verificacion" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "completado_en" TIMESTAMPTZ(3),
    "completado_por_id" UUID,

    CONSTRAINT "items_verificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plataformas" (
    "id" UUID NOT NULL,
    "nombre" CITEXT NOT NULL,
    "url_por_defecto" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plataformas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accesos_plataforma" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "plataforma_id" UUID NOT NULL,
    "url" TEXT,
    "identificador" TEXT,
    "responsable_autorizado_id" UUID NOT NULL,
    "fecha_revision" DATE NOT NULL,
    "estado" "EstadoAcceso" NOT NULL DEFAULT 'ACTIVO',
    "tiene_mfa" BOOLEAN NOT NULL DEFAULT false,
    "referencia_boveda" TEXT NOT NULL,
    "notas" TEXT,
    "actualizado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accesos_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencias" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "responsable_id" UUID NOT NULL,
    "estado" "EstadoIncidencia" NOT NULL DEFAULT 'ABIERTA',
    "resolucion" TEXT,
    "resuelta_en" TIMESTAMPTZ(3),
    "registrada_por_id" UUID NOT NULL,
    "registrada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "incidencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rectificaciones_obligacion_periodo_id_registrado_en_idx" ON "rectificaciones"("obligacion_periodo_id", "registrado_en");

-- CreateIndex
CREATE UNIQUE INDEX "plantillas_tarea_nombre_key" ON "plantillas_tarea"("nombre");

-- CreateIndex
CREATE INDEX "reglas_recurrencia_activo_idx" ON "reglas_recurrencia"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "items_verificacion_tarea_id_orden_key" ON "items_verificacion"("tarea_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "plataformas_nombre_key" ON "plataformas"("nombre");

-- CreateIndex
CREATE INDEX "accesos_plataforma_cliente_id_estado_idx" ON "accesos_plataforma"("cliente_id", "estado");

-- CreateIndex
CREATE INDEX "accesos_plataforma_fecha_revision_idx" ON "accesos_plataforma"("fecha_revision");

-- CreateIndex
CREATE INDEX "incidencias_cliente_id_estado_idx" ON "incidencias"("cliente_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "tareas_regla_id_fecha_ocurrencia_key" ON "tareas"("regla_id", "fecha_ocurrencia");

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_tarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_regla_id_fkey" FOREIGN KEY ("regla_id") REFERENCES "reglas_recurrencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rectificaciones" ADD CONSTRAINT "rectificaciones_obligacion_periodo_id_fkey" FOREIGN KEY ("obligacion_periodo_id") REFERENCES "obligaciones_periodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rectificaciones" ADD CONSTRAINT "rectificaciones_constancia_id_fkey" FOREIGN KEY ("constancia_id") REFERENCES "archivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rectificaciones" ADD CONSTRAINT "rectificaciones_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_tarea" ADD CONSTRAINT "plantillas_tarea_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_recurrencia" ADD CONSTRAINT "reglas_recurrencia_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_tarea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_recurrencia" ADD CONSTRAINT "reglas_recurrencia_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_recurrencia" ADD CONSTRAINT "reglas_recurrencia_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_recurrencia" ADD CONSTRAINT "reglas_recurrencia_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_recurrencia" ADD CONSTRAINT "reglas_recurrencia_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_verificacion" ADD CONSTRAINT "items_verificacion_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_verificacion" ADD CONSTRAINT "items_verificacion_completado_por_id_fkey" FOREIGN KEY ("completado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_plataforma" ADD CONSTRAINT "accesos_plataforma_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_plataforma" ADD CONSTRAINT "accesos_plataforma_plataforma_id_fkey" FOREIGN KEY ("plataforma_id") REFERENCES "plataformas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_plataforma" ADD CONSTRAINT "accesos_plataforma_responsable_autorizado_id_fkey" FOREIGN KEY ("responsable_autorizado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accesos_plataforma" ADD CONSTRAINT "accesos_plataforma_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_registrada_por_id_fkey" FOREIGN KEY ("registrada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE "rectificaciones" ADD CONSTRAINT "rectificaciones_motivo_presente" CHECK (length(trim("motivo")) >= 5);

ALTER TABLE "plantillas_tarea" ADD CONSTRAINT "plantillas_tarea_dias_plazo_validos" CHECK ("dias_plazo" BETWEEN 0 AND 365);

ALTER TABLE "plantillas_tarea" ADD CONSTRAINT "plantillas_tarea_evidencia_descrita" CHECK (NOT "requiere_evidencia" OR length(trim(coalesce("evidencia_requerida", ''))) > 0);

ALTER TABLE "plantillas_tarea" ADD CONSTRAINT "plantillas_tarea_items_limitados" CHECK (cardinality("items") <= 30);

ALTER TABLE "reglas_recurrencia" ADD CONSTRAINT "reglas_recurrencia_dia_valido" CHECK (
    ("frecuencia" = 'MENSUAL' AND "dia_del_mes" BETWEEN 1 AND 28 AND "dia_de_semana" IS NULL)
    OR ("frecuencia" = 'SEMANAL' AND "dia_de_semana" BETWEEN 1 AND 7 AND "dia_del_mes" IS NULL)
);

ALTER TABLE "reglas_recurrencia" ADD CONSTRAINT "reglas_recurrencia_vigencia_ordenada" CHECK ("vigente_hasta" IS NULL OR "vigente_hasta" >= "vigente_desde");

ALTER TABLE "reglas_recurrencia" ADD CONSTRAINT "reglas_recurrencia_revisor_distinto" CHECK ("revisor_id" IS NULL OR "revisor_id" <> "responsable_id");

ALTER TABLE "items_verificacion" ADD CONSTRAINT "items_verificacion_orden_valido" CHECK ("orden" >= 0);

ALTER TABLE "items_verificacion" ADD CONSTRAINT "items_verificacion_completado_con_autor" CHECK (("completado_en" IS NULL) = ("completado_por_id" IS NULL));

ALTER TABLE "tareas" ADD CONSTRAINT "tareas_ocurrencia_con_regla" CHECK (("regla_id" IS NULL) = ("fecha_ocurrencia" IS NULL));

ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_cierre_con_texto" CHECK ("estado" NOT IN ('RESUELTA', 'ANULADA') OR length(trim(coalesce("resolucion", ''))) > 0);

INSERT INTO "plataformas" ("id", "nombre", "url_por_defecto") VALUES
    (gen_random_uuid(), 'SUNAT', 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm'),
    (gen_random_uuid(), 'SUNARP', 'https://www.sunarp.gob.pe'),
    (gen_random_uuid(), 'Banco', NULL),
    (gen_random_uuid(), 'AFP', 'https://www.afpnet.com.pe'),
    (gen_random_uuid(), 'EsSalud', 'https://www.essalud.gob.pe'),
    (gen_random_uuid(), 'Sistema contable', NULL),
    (gen_random_uuid(), 'Correo', NULL),
    (gen_random_uuid(), 'Otra', NULL);

INSERT INTO "permisos" ("id", "codigo", "modulo", "descripcion", "sensible") VALUES
    (gen_random_uuid(), 'acceso:ver', 'Accesos', 'Ver los accesos de plataformas de sus clientes; cada consulta se audita', true),
    (gen_random_uuid(), 'acceso:gestionar', 'Accesos', 'Registrar y actualizar accesos de plataformas (sin contraseñas)', true),
    (gen_random_uuid(), 'incidencia:gestionar', 'Clientes', 'Registrar incidencias del cliente y cambiar su estado', false),
    (gen_random_uuid(), 'plantilla:gestionar', 'Tareas', 'Administrar plantillas de tareas y tareas recurrentes', false),
    (gen_random_uuid(), 'reporte:clientes', 'Reportes', 'Ver y exportar el reporte de clientes', false);

INSERT INTO "roles_permisos" ("id", "rol_id", "permiso_id")
SELECT gen_random_uuid(), r."id", p."id"
FROM "roles" r
JOIN "permisos" p ON (
    (p."codigo" IN ('acceso:ver', 'acceso:gestionar') AND r."codigo" IN ('GERENCIA', 'CONTABILIDAD'))
    OR (p."codigo" = 'incidencia:gestionar' AND r."codigo" IN ('GERENCIA', 'CONTABILIDAD', 'ASISTENTE_CONTABLE', 'ADMINISTRACION'))
    OR (p."codigo" = 'plantilla:gestionar' AND r."codigo" IN ('GERENCIA', 'CONTABILIDAD', 'ADMINISTRACION'))
    OR (p."codigo" = 'reporte:clientes' AND r."codigo" = 'GERENCIA')
);


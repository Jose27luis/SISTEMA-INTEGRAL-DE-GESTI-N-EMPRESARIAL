-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'EN_REVISION', 'OBSERVADA', 'CORREGIDA', 'APROBADA', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('TAREA_ASIGNADA', 'TAREA_MODIFICADA', 'TAREA_POR_VENCER', 'TAREA_ATRASADA', 'AVANCE_REGISTRADO', 'MENCION', 'TAREA_REASIGNADA');

-- CreateEnum
CREATE TYPE "ResultadoEjecucion" AS ENUM ('EN_CURSO', 'CORRECTO', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionAuditoria" ADD VALUE 'CAMBIAR_ESTADO';
ALTER TYPE "AccionAuditoria" ADD VALUE 'DESCARGAR';

-- CreateTable
CREATE TABLE "tareas" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "instrucciones" TEXT,
    "cliente_id" UUID,
    "responsable_id" UUID NOT NULL,
    "revisor_id" UUID,
    "asignado_por_id" UUID NOT NULL,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "estado" "EstadoTarea" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_inicio" DATE,
    "fecha_limite" DATE NOT NULL,
    "requiere_aprobacion" BOOLEAN NOT NULL DEFAULT true,
    "requiere_evidencia" BOOLEAN NOT NULL DEFAULT false,
    "evidencia_requerida" TEXT,
    "porcentaje_avance" INTEGER NOT NULL DEFAULT 0,
    "minutos_registrados" INTEGER NOT NULL DEFAULT 0,
    "motivo_cancelacion" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas_colaboradores" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "agregado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retirado_en" TIMESTAMPTZ(3),

    CONSTRAINT "tareas_colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transiciones_tarea" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "desde" "EstadoTarea",
    "hacia" "EstadoTarea" NOT NULL,
    "usuario_id" UUID NOT NULL,
    "comentario" TEXT,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transiciones_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avances" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "registrado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actividad" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "porcentaje" INTEGER NOT NULL,
    "minutos_dedicados" INTEGER NOT NULL DEFAULT 0,
    "dificultades" TEXT,
    "observaciones" TEXT,
    "proximo_paso" TEXT,
    "corrige_a_id" UUID,

    CONSTRAINT "avances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archivos" (
    "id" UUID NOT NULL,
    "ruta_almacen" TEXT NOT NULL,
    "nombre_original" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "cliente_id" UUID,
    "subido_por_id" UUID NOT NULL,
    "subido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencias" (
    "id" UUID NOT NULL,
    "avance_id" UUID NOT NULL,
    "archivo_id" UUID NOT NULL,

    CONSTRAINT "evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios_tarea" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "contenido" TEXT NOT NULL,
    "mencionados" UUID[] DEFAULT ARRAY[]::UUID[],
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enlace" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "clave_deduplicacion" TEXT,
    "leida_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejecuciones_proceso" (
    "id" UUID NOT NULL,
    "proceso" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMPTZ(3),
    "resultado" "ResultadoEjecucion" NOT NULL DEFAULT 'EN_CURSO',
    "registros" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "ejecuciones_proceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tareas_codigo_key" ON "tareas"("codigo");

-- CreateIndex
CREATE INDEX "tareas_responsable_id_estado_fecha_limite_idx" ON "tareas"("responsable_id", "estado", "fecha_limite");

-- CreateIndex
CREATE INDEX "tareas_cliente_id_estado_idx" ON "tareas"("cliente_id", "estado");

-- CreateIndex
CREATE INDEX "tareas_estado_fecha_limite_idx" ON "tareas"("estado", "fecha_limite");

-- CreateIndex
CREATE INDEX "tareas_colaboradores_usuario_id_retirado_en_idx" ON "tareas_colaboradores"("usuario_id", "retirado_en");

-- CreateIndex
CREATE INDEX "tareas_colaboradores_tarea_id_retirado_en_idx" ON "tareas_colaboradores"("tarea_id", "retirado_en");

-- CreateIndex
CREATE INDEX "transiciones_tarea_tarea_id_fecha_idx" ON "transiciones_tarea"("tarea_id", "fecha");

-- CreateIndex
CREATE INDEX "avances_tarea_id_registrado_en_idx" ON "avances"("tarea_id", "registrado_en");

-- CreateIndex
CREATE UNIQUE INDEX "archivos_ruta_almacen_key" ON "archivos"("ruta_almacen");

-- CreateIndex
CREATE INDEX "evidencias_avance_id_idx" ON "evidencias"("avance_id");

-- CreateIndex
CREATE INDEX "evidencias_archivo_id_idx" ON "evidencias"("archivo_id");

-- CreateIndex
CREATE INDEX "comentarios_tarea_tarea_id_creado_en_idx" ON "comentarios_tarea"("tarea_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "notificaciones_clave_deduplicacion_key" ON "notificaciones"("clave_deduplicacion");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_creado_en_idx" ON "notificaciones"("usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "ejecuciones_proceso_proceso_inicio_idx" ON "ejecuciones_proceso"("proceso", "inicio");

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_asignado_por_id_fkey" FOREIGN KEY ("asignado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_colaboradores" ADD CONSTRAINT "tareas_colaboradores_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_colaboradores" ADD CONSTRAINT "tareas_colaboradores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transiciones_tarea" ADD CONSTRAINT "transiciones_tarea_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transiciones_tarea" ADD CONSTRAINT "transiciones_tarea_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances" ADD CONSTRAINT "avances_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances" ADD CONSTRAINT "avances_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances" ADD CONSTRAINT "avances_corrige_a_id_fkey" FOREIGN KEY ("corrige_a_id") REFERENCES "avances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_avance_id_fkey" FOREIGN KEY ("avance_id") REFERENCES "avances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_tarea" ADD CONSTRAINT "comentarios_tarea_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_tarea" ADD CONSTRAINT "comentarios_tarea_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE SEQUENCE "tareas_codigo_seq" START 1;

ALTER TABLE "tareas" ADD CONSTRAINT "tareas_porcentaje_rango" CHECK ("porcentaje_avance" BETWEEN 0 AND 100);

ALTER TABLE "tareas" ADD CONSTRAINT "tareas_minutos_no_negativos" CHECK ("minutos_registrados" >= 0);

ALTER TABLE "tareas" ADD CONSTRAINT "tareas_fechas_ordenadas" CHECK ("fecha_inicio" IS NULL OR "fecha_inicio" <= "fecha_limite");

ALTER TABLE "tareas" ADD CONSTRAINT "tareas_revisor_distinto" CHECK ("revisor_id" IS NULL OR "revisor_id" <> "responsable_id");

ALTER TABLE "avances" ADD CONSTRAINT "avances_porcentaje_rango" CHECK ("porcentaje" BETWEEN 0 AND 100);

ALTER TABLE "avances" ADD CONSTRAINT "avances_minutos_rango" CHECK ("minutos_dedicados" BETWEEN 0 AND 1440);

ALTER TABLE "archivos" ADD CONSTRAINT "archivos_tamano_positivo" CHECK ("tamano_bytes" > 0);

CREATE UNIQUE INDEX "tareas_colaboradores_vigente_key" ON "tareas_colaboradores"("tarea_id", "usuario_id") WHERE "retirado_en" IS NULL;

CREATE INDEX "notificaciones_no_leidas_idx" ON "notificaciones"("usuario_id") WHERE "leida_en" IS NULL;

INSERT INTO "permisos" ("id", "codigo", "modulo", "descripcion", "sensible") VALUES
    (gen_random_uuid(), 'tarea:ver', 'Tareas', 'Ver tareas según su alcance: propias, de sus clientes asignados o todas', false),
    (gen_random_uuid(), 'tarea:crear', 'Tareas', 'Crear, asignar y modificar tareas', false);

INSERT INTO "roles_permisos" ("id", "rol_id", "permiso_id")
SELECT gen_random_uuid(), r."id", p."id"
FROM "roles" r
JOIN "permisos" p ON (
    (p."codigo" = 'tarea:ver' AND r."codigo" IN ('GERENCIA', 'CONTABILIDAD', 'ASISTENTE_CONTABLE', 'ADMINISTRACION', 'COMERCIAL'))
    OR (p."codigo" = 'tarea:crear' AND r."codigo" IN ('GERENCIA', 'CONTABILIDAD', 'ADMINISTRACION', 'COMERCIAL'))
);


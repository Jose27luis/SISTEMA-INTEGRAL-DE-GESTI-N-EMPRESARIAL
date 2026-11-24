-- CreateEnum
CREATE TYPE "DecisionRevision" AS ENUM ('APROBADA', 'OBSERVADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'TAREA_POR_REVISAR';
ALTER TYPE "TipoNotificacion" ADD VALUE 'TRABAJO_OBSERVADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'TRABAJO_APROBADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'TAREA_CANCELADA';

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "completada_en" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "rondas_revision" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "revisor_id" UUID NOT NULL,
    "decision" "DecisionRevision" NOT NULL,
    "comentario" TEXT,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rondas_revision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rondas_revision_fecha_idx" ON "rondas_revision"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "rondas_revision_tarea_id_numero_key" ON "rondas_revision"("tarea_id", "numero");

-- CreateIndex
CREATE INDEX "tareas_completada_en_idx" ON "tareas"("completada_en");

-- AddForeignKey
ALTER TABLE "rondas_revision" ADD CONSTRAINT "rondas_revision_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rondas_revision" ADD CONSTRAINT "rondas_revision_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rondas_revision" ADD CONSTRAINT "rondas_revision_numero_positivo" CHECK ("numero" > 0);

ALTER TABLE "rondas_revision" ADD CONSTRAINT "rondas_revision_observacion_con_comentario" CHECK ("decision" <> 'OBSERVADA' OR length(trim(coalesce("comentario", ''))) > 0);

ALTER TABLE "tareas" ADD CONSTRAINT "tareas_cancelada_con_motivo" CHECK ("estado" <> 'CANCELADA' OR length(trim(coalesce("motivo_cancelacion", ''))) > 0);

UPDATE "tareas" t
SET "completada_en" = c."fecha"
FROM (
    SELECT "tarea_id", min("fecha") AS "fecha"
    FROM "transiciones_tarea"
    WHERE "hacia" IN ('APROBADA', 'FINALIZADA')
    GROUP BY "tarea_id"
) c
WHERE c."tarea_id" = t."id" AND t."estado" IN ('APROBADA', 'FINALIZADA');

INSERT INTO "permisos" ("id", "codigo", "modulo", "descripcion", "sensible") VALUES
    (gen_random_uuid(), 'tarea:revisar', 'Tareas', 'Aprobar u observar el trabajo de las tareas que revisa', false),
    (gen_random_uuid(), 'reporte:personal', 'Reportes', 'Ver el tablero del equipo y exportar reportes de personal', false);

INSERT INTO "roles_permisos" ("id", "rol_id", "permiso_id")
SELECT gen_random_uuid(), r."id", p."id"
FROM "roles" r
JOIN "permisos" p ON (
    (p."codigo" = 'tarea:revisar' AND r."codigo" IN ('GERENCIA', 'CONTABILIDAD', 'ADMINISTRACION'))
    OR (p."codigo" = 'reporte:personal' AND r."codigo" = 'GERENCIA')
);


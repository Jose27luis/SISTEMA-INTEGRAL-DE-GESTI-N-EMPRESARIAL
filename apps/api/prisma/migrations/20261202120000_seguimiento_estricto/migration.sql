-- CreateEnum
CREATE TYPE "EstadoProrroga" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'TAREA_SIN_ACUSE';
ALTER TYPE "TipoNotificacion" ADD VALUE 'TAREA_SIN_REPORTE';
ALTER TYPE "TipoNotificacion" ADD VALUE 'TAREA_ESCALADA';
ALTER TYPE "TipoNotificacion" ADD VALUE 'PRORROGA_SOLICITADA';
ALTER TYPE "TipoNotificacion" ADD VALUE 'PRORROGA_RESUELTA';

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "recibida_en" TIMESTAMPTZ(3),
ADD COLUMN     "seguimiento_estricto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ultimo_reporte_en" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "prorrogas_tarea" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "fecha_anterior" DATE NOT NULL,
    "fecha_propuesta" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoProrroga" NOT NULL DEFAULT 'PENDIENTE',
    "solicitada_por_id" UUID NOT NULL,
    "solicitada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelta_por_id" UUID,
    "resuelta_en" TIMESTAMPTZ(3),
    "respuesta" TEXT,

    CONSTRAINT "prorrogas_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prorrogas_tarea_tarea_id_solicitada_en_idx" ON "prorrogas_tarea"("tarea_id", "solicitada_en");

-- AddForeignKey
ALTER TABLE "prorrogas_tarea" ADD CONSTRAINT "prorrogas_tarea_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prorrogas_tarea" ADD CONSTRAINT "prorrogas_tarea_solicitada_por_id_fkey" FOREIGN KEY ("solicitada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prorrogas_tarea" ADD CONSTRAINT "prorrogas_tarea_resuelta_por_id_fkey" FOREIGN KEY ("resuelta_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prorrogas_tarea" ADD CONSTRAINT "prorrogas_tarea_fecha_posterior" CHECK ("fecha_propuesta" > "fecha_anterior");

ALTER TABLE "prorrogas_tarea" ADD CONSTRAINT "prorrogas_tarea_motivo_suficiente" CHECK (length(trim("motivo")) >= 10);

ALTER TABLE "prorrogas_tarea" ADD CONSTRAINT "prorrogas_tarea_resolucion_completa" CHECK (
    ("estado" = 'PENDIENTE' AND "resuelta_por_id" IS NULL AND "resuelta_en" IS NULL)
    OR ("estado" <> 'PENDIENTE' AND "resuelta_por_id" IS NOT NULL AND "resuelta_en" IS NOT NULL)
);

ALTER TABLE "prorrogas_tarea" ADD CONSTRAINT "prorrogas_tarea_rechazo_explicado" CHECK (
    "estado" <> 'RECHAZADA' OR length(trim(coalesce("respuesta", ''))) >= 5
);

CREATE UNIQUE INDEX "prorrogas_tarea_una_pendiente_key" ON "prorrogas_tarea"("tarea_id") WHERE "estado" = 'PENDIENTE';

CREATE INDEX "tareas_seguimiento_idx" ON "tareas"("seguimiento_estricto", "estado");

UPDATE "tareas" t
SET "ultimo_reporte_en" = a."ultimo"
FROM (SELECT "tarea_id", max("registrado_en") AS "ultimo" FROM "avances" GROUP BY "tarea_id") a
WHERE a."tarea_id" = t."id";


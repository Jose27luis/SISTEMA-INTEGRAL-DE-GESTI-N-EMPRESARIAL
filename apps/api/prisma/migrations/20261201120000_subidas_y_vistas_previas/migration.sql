-- CreateEnum
CREATE TYPE "EstadoSubida" AS ENUM ('EN_CURSO', 'COMPLETA', 'USADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "EstadoVistaPrevia" AS ENUM ('PENDIENTE', 'PROCESANDO', 'LISTA', 'ERROR', 'NO_APLICA');

-- CreateTable
CREATE TABLE "subidas" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "recibidos" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoSubida" NOT NULL DEFAULT 'EN_CURSO',
    "ruta_temporal" TEXT NOT NULL,
    "ruta_final" TEXT,
    "mime" TEXT,
    "sha256" CHAR(64),
    "archivo_id" UUID,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vistas_previas" (
    "archivo_id" UUID NOT NULL,
    "estado" "EstadoVistaPrevia" NOT NULL DEFAULT 'PENDIENTE',
    "ruta_pdf" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vistas_previas_pkey" PRIMARY KEY ("archivo_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subidas_ruta_temporal_key" ON "subidas"("ruta_temporal");

-- CreateIndex
CREATE UNIQUE INDEX "subidas_ruta_final_key" ON "subidas"("ruta_final");

-- CreateIndex
CREATE UNIQUE INDEX "subidas_archivo_id_key" ON "subidas"("archivo_id");

-- CreateIndex
CREATE INDEX "subidas_estado_expira_en_idx" ON "subidas"("estado", "expira_en");

-- CreateIndex
CREATE INDEX "subidas_usuario_id_estado_idx" ON "subidas"("usuario_id", "estado");

-- CreateIndex
CREATE INDEX "vistas_previas_estado_actualizado_en_idx" ON "vistas_previas"("estado", "actualizado_en");

-- AddForeignKey
ALTER TABLE "subidas" ADD CONSTRAINT "subidas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subidas" ADD CONSTRAINT "subidas_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vistas_previas" ADD CONSTRAINT "vistas_previas_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subidas" ADD CONSTRAINT "subidas_tamano_valido" CHECK ("tamano_bytes" > 0 AND "tamano_bytes" <= 209715200);

ALTER TABLE "subidas" ADD CONSTRAINT "subidas_recibidos_validos" CHECK ("recibidos" >= 0 AND "recibidos" <= "tamano_bytes");

ALTER TABLE "subidas" ADD CONSTRAINT "subidas_completa_con_datos" CHECK (
    "estado" NOT IN ('COMPLETA', 'USADA') OR ("ruta_final" IS NOT NULL AND "mime" IS NOT NULL AND "sha256" IS NOT NULL AND "recibidos" = "tamano_bytes")
);

ALTER TABLE "subidas" ADD CONSTRAINT "subidas_usada_con_archivo" CHECK ("estado" <> 'USADA' OR "archivo_id" IS NOT NULL);

ALTER TABLE "vistas_previas" ADD CONSTRAINT "vistas_previas_lista_con_pdf" CHECK ("estado" <> 'LISTA' OR "ruta_pdf" IS NOT NULL);

INSERT INTO "vistas_previas" ("archivo_id", "estado", "actualizado_en")
SELECT "id", 'PENDIENTE', CURRENT_TIMESTAMP
FROM "archivos"
WHERE "mime" IN (
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
);


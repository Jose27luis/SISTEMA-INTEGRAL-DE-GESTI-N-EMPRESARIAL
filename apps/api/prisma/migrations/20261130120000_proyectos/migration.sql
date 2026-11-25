-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('PLANIFICADO', 'EN_CURSO', 'EN_PAUSA', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoEtapa" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "EstadoEntregable" AS ENUM ('PENDIENTE', 'ENTREGADO', 'OBSERVADO', 'APROBADO');

-- AlterTable
ALTER TABLE "egresos" ADD COLUMN     "proyecto_id" UUID;

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "etapa_id" UUID;

-- CreateTable
CREATE TABLE "proyectos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cliente_id" UUID,
    "servicio_id" UUID,
    "descripcion" TEXT,
    "objetivo" TEXT,
    "responsable_id" UUID NOT NULL,
    "presupuesto" DECIMAL(12,2),
    "honorarios" DECIMAL(12,2),
    "fecha_inicio" DATE NOT NULL,
    "fecha_entrega" DATE NOT NULL,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'PLANIFICADO',
    "con_dificultades" BOOLEAN NOT NULL DEFAULT false,
    "detalle_dificultad" TEXT,
    "resultado_final" TEXT,
    "cerrado_en" TIMESTAMPTZ(3),
    "creado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "miembros_proyecto" (
    "id" UUID NOT NULL,
    "proyecto_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "agregado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retirado_en" TIMESTAMPTZ(3),

    CONSTRAINT "miembros_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas_proyecto" (
    "id" UUID NOT NULL,
    "proyecto_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "inicio" DATE NOT NULL,
    "fin" DATE NOT NULL,
    "estado" "EstadoEtapa" NOT NULL DEFAULT 'PENDIENTE',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etapas_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregables" (
    "id" UUID NOT NULL,
    "etapa_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_compromiso" DATE NOT NULL,
    "estado" "EstadoEntregable" NOT NULL DEFAULT 'PENDIENTE',
    "archivo_id" UUID,
    "entregado_por_id" UUID,
    "entregado_en" TIMESTAMPTZ(3),
    "revisado_por_id" UUID,
    "revisado_en" TIMESTAMPTZ(3),
    "comentario" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entregables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_codigo_key" ON "proyectos"("codigo");

-- CreateIndex
CREATE INDEX "proyectos_estado_idx" ON "proyectos"("estado");

-- CreateIndex
CREATE INDEX "proyectos_cliente_id_idx" ON "proyectos"("cliente_id");

-- CreateIndex
CREATE INDEX "proyectos_responsable_id_idx" ON "proyectos"("responsable_id");

-- CreateIndex
CREATE INDEX "miembros_proyecto_usuario_id_retirado_en_idx" ON "miembros_proyecto"("usuario_id", "retirado_en");

-- CreateIndex
CREATE INDEX "miembros_proyecto_proyecto_id_retirado_en_idx" ON "miembros_proyecto"("proyecto_id", "retirado_en");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_proyecto_proyecto_id_orden_key" ON "etapas_proyecto"("proyecto_id", "orden");

-- CreateIndex
CREATE INDEX "entregables_etapa_id_idx" ON "entregables"("etapa_id");

-- CreateIndex
CREATE INDEX "egresos_proyecto_id_idx" ON "egresos"("proyecto_id");

-- CreateIndex
CREATE INDEX "tareas_etapa_id_idx" ON "tareas"("etapa_id");

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas_proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembros_proyecto" ADD CONSTRAINT "miembros_proyecto_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembros_proyecto" ADD CONSTRAINT "miembros_proyecto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_proyecto" ADD CONSTRAINT "etapas_proyecto_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregables" ADD CONSTRAINT "entregables_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas_proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregables" ADD CONSTRAINT "entregables_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregables" ADD CONSTRAINT "entregables_entregado_por_id_fkey" FOREIGN KEY ("entregado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregables" ADD CONSTRAINT "entregables_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "TipoNotificacion" ADD VALUE 'PROYECTO_ASIGNADO';

ALTER TYPE "TipoNotificacion" ADD VALUE 'ENTREGABLE_POR_REVISAR';

ALTER TYPE "TipoNotificacion" ADD VALUE 'ENTREGABLE_REVISADO';

CREATE SEQUENCE "proyectos_codigo_seq" START 1;

ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_fechas_ordenadas" CHECK ("fecha_entrega" >= "fecha_inicio");

ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_montos_validos" CHECK (
    ("presupuesto" IS NULL OR "presupuesto" > 0) AND ("honorarios" IS NULL OR "honorarios" > 0)
);

ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_cierre_con_resultado" CHECK (
    "estado" NOT IN ('FINALIZADO', 'CANCELADO') OR ("cerrado_en" IS NOT NULL AND length(trim(coalesce("resultado_final", ''))) > 0)
);

ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_dificultad_con_detalle" CHECK (
    NOT "con_dificultades" OR length(trim(coalesce("detalle_dificultad", ''))) > 0
);

CREATE UNIQUE INDEX "miembros_proyecto_vigente_key" ON "miembros_proyecto"("proyecto_id", "usuario_id") WHERE "retirado_en" IS NULL;

ALTER TABLE "etapas_proyecto" ADD CONSTRAINT "etapas_proyecto_fechas_ordenadas" CHECK ("fin" >= "inicio");

ALTER TABLE "entregables" ADD CONSTRAINT "entregables_entregado_con_archivo" CHECK (
    "estado" = 'PENDIENTE' OR ("archivo_id" IS NOT NULL AND "entregado_en" IS NOT NULL)
);

ALTER TABLE "entregables" ADD CONSTRAINT "entregables_observado_con_comentario" CHECK (
    "estado" <> 'OBSERVADO' OR length(trim(coalesce("comentario", ''))) > 0
);

INSERT INTO "permisos" ("id", "codigo", "modulo", "descripcion", "sensible") VALUES
    (gen_random_uuid(), 'proyecto:ver', 'Proyectos', 'Ver los proyectos en los que participa, o todos con alcance global', false),
    (gen_random_uuid(), 'proyecto:crear', 'Proyectos', 'Crear proyectos y quedar como su responsable', false);

INSERT INTO "roles_permisos" ("id", "rol_id", "permiso_id")
SELECT gen_random_uuid(), r."id", p."id"
FROM "roles" r
JOIN "permisos" p ON (
    p."codigo" = 'proyecto:ver'
    OR (p."codigo" = 'proyecto:crear' AND r."codigo" IN ('GERENCIA', 'CONTABILIDAD', 'ADMINISTRACION'))
)
WHERE r."codigo" IN ('GERENCIA', 'CONTABILIDAD', 'ASISTENTE_CONTABLE', 'ADMINISTRACION', 'COMERCIAL');


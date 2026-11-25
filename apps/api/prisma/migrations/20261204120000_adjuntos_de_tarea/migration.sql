-- CreateTable
CREATE TABLE "adjuntos_tarea" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "archivo_id" UUID NOT NULL,
    "agregado_por_id" UUID NOT NULL,
    "agregado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjuntos_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adjuntos_tarea_archivo_id_idx" ON "adjuntos_tarea"("archivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "adjuntos_tarea_tarea_id_archivo_id_key" ON "adjuntos_tarea"("tarea_id", "archivo_id");

-- AddForeignKey
ALTER TABLE "adjuntos_tarea" ADD CONSTRAINT "adjuntos_tarea_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos_tarea" ADD CONSTRAINT "adjuntos_tarea_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos_tarea" ADD CONSTRAINT "adjuntos_tarea_agregado_por_id_fkey" FOREIGN KEY ("agregado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


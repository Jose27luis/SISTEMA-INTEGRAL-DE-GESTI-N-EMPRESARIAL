-- AlterTable
ALTER TABLE "prorrogas_tarea" ADD COLUMN     "hora_anterior" VARCHAR(5),
ADD COLUMN     "hora_propuesta" VARCHAR(5);

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "hora_inicio" VARCHAR(5),
ADD COLUMN     "hora_limite" VARCHAR(5);


ALTER TABLE "tareas" ADD CONSTRAINT "tareas_hora_inicio_valida" CHECK ("hora_inicio" IS NULL OR "hora_inicio" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "tareas" ADD CONSTRAINT "tareas_hora_limite_valida" CHECK ("hora_limite" IS NULL OR "hora_limite" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "tareas" ADD CONSTRAINT "tareas_hora_inicio_con_fecha" CHECK ("hora_inicio" IS NULL OR "fecha_inicio" IS NOT NULL);

ALTER TABLE "prorrogas_tarea" ADD CONSTRAINT "prorrogas_tarea_hora_anterior_valida" CHECK ("hora_anterior" IS NULL OR "hora_anterior" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "prorrogas_tarea" ADD CONSTRAINT "prorrogas_tarea_hora_propuesta_valida" CHECK ("hora_propuesta" IS NULL OR "hora_propuesta" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "prorrogas_tarea" DROP CONSTRAINT "prorrogas_tarea_fecha_posterior";

ALTER TABLE "prorrogas_tarea" ADD CONSTRAINT "prorrogas_tarea_fecha_posterior" CHECK (
    ("fecha_propuesta", coalesce("hora_propuesta", '24:00')) > ("fecha_anterior", coalesce("hora_anterior", '24:00'))
);

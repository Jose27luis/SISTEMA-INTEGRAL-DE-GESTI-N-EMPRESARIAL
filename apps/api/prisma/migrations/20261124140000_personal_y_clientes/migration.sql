-- CreateEnum
CREATE TYPE "EstadoTrabajador" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "TipoPersona" AS ENUM ('NATURAL', 'JURIDICA');

-- CreateEnum
CREATE TYPE "EstadoCliente" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "RolEnCliente" AS ENUM ('RESPONSABLE', 'APOYO', 'REVISOR', 'CONSULTA');

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "nombre" CITEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" UUID NOT NULL,
    "nombre" CITEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_vinculo" (
    "id" UUID NOT NULL,
    "nombre" CITEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regimenes_tributarios" (
    "id" UUID NOT NULL,
    "nombre" CITEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regimenes_tributarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trabajadores" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "dni" CHAR(8) NOT NULL,
    "cargo_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "tipo_vinculo_id" UUID NOT NULL,
    "fecha_incorporacion" DATE NOT NULL,
    "horario" TEXT,
    "telefono" TEXT,
    "funciones" TEXT,
    "supervisor_id" UUID,
    "estado" "EstadoTrabajador" NOT NULL DEFAULT 'ACTIVO',
    "fecha_cese" DATE,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trabajadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "tipo_persona" "TipoPersona" NOT NULL,
    "razon_social" TEXT NOT NULL,
    "ruc" CHAR(11),
    "dni" CHAR(8),
    "domicilio_fiscal" TEXT,
    "representante_legal" TEXT,
    "actividad_economica" TEXT,
    "regimen_tributario_id" UUID,
    "fecha_incorporacion" DATE NOT NULL,
    "estado" "EstadoCliente" NOT NULL DEFAULT 'ACTIVO',
    "responsable_id" UUID,
    "creado_por_id" UUID,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos_cliente" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "correo" CITEXT,
    "telefono" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contactos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_cliente" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "rol_en_cliente" "RolEnCliente" NOT NULL,
    "asignado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asignado_por_id" UUID,
    "retirado_en" TIMESTAMPTZ(3),
    "retirado_por_id" UUID,

    CONSTRAINT "asignaciones_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "areas_nombre_key" ON "areas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "cargos_nombre_key" ON "cargos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_vinculo_nombre_key" ON "tipos_vinculo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "regimenes_tributarios_nombre_key" ON "regimenes_tributarios"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "trabajadores_usuario_id_key" ON "trabajadores"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "trabajadores_dni_key" ON "trabajadores"("dni");

-- CreateIndex
CREATE INDEX "trabajadores_estado_idx" ON "trabajadores"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_ruc_key" ON "clientes"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_dni_key" ON "clientes"("dni");

-- CreateIndex
CREATE INDEX "clientes_estado_razon_social_idx" ON "clientes"("estado", "razon_social");

-- CreateIndex
CREATE INDEX "contactos_cliente_cliente_id_activo_idx" ON "contactos_cliente"("cliente_id", "activo");

-- CreateIndex
CREATE INDEX "asignaciones_cliente_usuario_id_retirado_en_idx" ON "asignaciones_cliente"("usuario_id", "retirado_en");

-- CreateIndex
CREATE INDEX "asignaciones_cliente_cliente_id_retirado_en_idx" ON "asignaciones_cliente"("cliente_id", "retirado_en");

-- AddForeignKey
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_tipo_vinculo_id_fkey" FOREIGN KEY ("tipo_vinculo_id") REFERENCES "tipos_vinculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "trabajadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_regimen_tributario_id_fkey" FOREIGN KEY ("regimen_tributario_id") REFERENCES "regimenes_tributarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_cliente" ADD CONSTRAINT "contactos_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_cliente" ADD CONSTRAINT "asignaciones_cliente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_cliente" ADD CONSTRAINT "asignaciones_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_cliente" ADD CONSTRAINT "asignaciones_cliente_asignado_por_id_fkey" FOREIGN KEY ("asignado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_cliente" ADD CONSTRAINT "asignaciones_cliente_retirado_por_id_fkey" FOREIGN KEY ("retirado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clientes" ADD CONSTRAINT "clientes_documento_requerido" CHECK ("ruc" IS NOT NULL OR "dni" IS NOT NULL);

ALTER TABLE "clientes" ADD CONSTRAINT "clientes_ruc_formato" CHECK ("ruc" IS NULL OR "ruc" ~ '^(10|15|16|17|20)[0-9]{9}$');

ALTER TABLE "clientes" ADD CONSTRAINT "clientes_dni_formato" CHECK ("dni" IS NULL OR "dni" ~ '^[0-9]{8}$');

ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_dni_formato" CHECK ("dni" ~ '^[0-9]{8}$');

CREATE UNIQUE INDEX "asignaciones_cliente_vigente_key" ON "asignaciones_cliente"("usuario_id", "cliente_id") WHERE "retirado_en" IS NULL;

INSERT INTO "regimenes_tributarios" ("id", "nombre") VALUES
    (gen_random_uuid(), 'Nuevo RUS'),
    (gen_random_uuid(), 'Régimen Especial de Renta'),
    (gen_random_uuid(), 'Régimen MYPE Tributario'),
    (gen_random_uuid(), 'Régimen General');

INSERT INTO "permisos" ("id", "codigo", "modulo", "descripcion", "sensible") VALUES
    (gen_random_uuid(), 'personal:ver', 'Personal', 'Ver fichas del personal', false),
    (gen_random_uuid(), 'personal:gestionar', 'Personal', 'Registrar, editar, dar de baja y reactivar personal', true),
    (gen_random_uuid(), 'cliente:ver', 'Clientes', 'Ver clientes según su alcance y asignaciones', false),
    (gen_random_uuid(), 'cliente:gestionar', 'Clientes', 'Registrar, editar, importar y cambiar el estado de clientes y contactos', false),
    (gen_random_uuid(), 'cliente:asignar', 'Clientes', 'Asignar y retirar usuarios del equipo de un cliente', true),
    (gen_random_uuid(), 'catalogo:gestionar', 'Configuración', 'Administrar áreas, cargos, tipos de vínculo y regímenes tributarios', false);

INSERT INTO "roles_permisos" ("id", "rol_id", "permiso_id")
SELECT gen_random_uuid(), r."id", p."id"
FROM "roles" r
JOIN "permisos" p ON (
    (r."codigo" = 'GERENCIA' AND p."codigo" IN ('personal:ver', 'personal:gestionar', 'cliente:ver', 'cliente:gestionar', 'cliente:asignar', 'catalogo:gestionar'))
    OR (r."codigo" = 'CONTABILIDAD' AND p."codigo" IN ('personal:ver', 'cliente:ver'))
    OR (r."codigo" = 'ASISTENTE_CONTABLE' AND p."codigo" IN ('cliente:ver'))
    OR (r."codigo" = 'ADMINISTRACION' AND p."codigo" IN ('personal:ver', 'cliente:ver'))
    OR (r."codigo" = 'COMERCIAL' AND p."codigo" IN ('cliente:ver'))
);


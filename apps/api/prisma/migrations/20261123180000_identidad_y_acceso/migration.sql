-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "AlcanceRol" AS ENUM ('GLOBAL', 'ASIGNADO', 'PROPIO');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('CREAR', 'MODIFICAR', 'ACTIVAR', 'DESACTIVAR', 'INGRESAR', 'INGRESO_FALLIDO', 'SALIR', 'REVOCAR_SESION', 'PERMISO_DENEGADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" CITEXT NOT NULL,
    "hash_contrasena" TEXT NOT NULL,
    "debe_cambiar_contrasena" BOOLEAN NOT NULL DEFAULT true,
    "mfa_activo" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secreto_cifrado" TEXT,
    "mfa_secreto_pendiente_cifrado" TEXT,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_ingreso" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "alcance" "AlcanceRol" NOT NULL,
    "exige_mfa" BOOLEAN NOT NULL DEFAULT false,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "sensible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_roles" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "asignado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asignado_por_id" UUID,
    "retirado_en" TIMESTAMPTZ(3),
    "retirado_por_id" UUID,

    CONSTRAINT "usuarios_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permisos" (
    "id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "otorgado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retirado_en" TIMESTAMPTZ(3),

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "hash_token" TEXT NOT NULL,
    "ip" TEXT,
    "agente_usuario" TEXT,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "revocada_en" TIMESTAMPTZ(3),
    "revocada_por_id" UUID,
    "motivo_revocacion" TEXT,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desafios_mfa" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "usado_en" TIMESTAMPTZ(3),

    CONSTRAINT "desafios_mfa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_recuperacion" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "hash_codigo" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usado_en" TIMESTAMPTZ(3),
    "invalidado_en" TIMESTAMPTZ(3),

    CONSTRAINT "codigos_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" BIGSERIAL NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID,
    "sesion_id" UUID,
    "ip" TEXT,
    "accion" "AccionAuditoria" NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "antes" JSONB,
    "despues" JSONB,
    "motivo" TEXT,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "roles_codigo_key" ON "roles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE INDEX "usuarios_roles_usuario_id_retirado_en_idx" ON "usuarios_roles"("usuario_id", "retirado_en");

-- CreateIndex
CREATE INDEX "usuarios_roles_rol_id_retirado_en_idx" ON "usuarios_roles"("rol_id", "retirado_en");

-- CreateIndex
CREATE INDEX "roles_permisos_rol_id_retirado_en_idx" ON "roles_permisos"("rol_id", "retirado_en");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_hash_token_key" ON "sesiones"("hash_token");

-- CreateIndex
CREATE INDEX "sesiones_usuario_id_revocada_en_idx" ON "sesiones"("usuario_id", "revocada_en");

-- CreateIndex
CREATE INDEX "codigos_recuperacion_usuario_id_hash_codigo_idx" ON "codigos_recuperacion"("usuario_id", "hash_codigo");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidad_id_fecha_idx" ON "auditoria"("entidad", "entidad_id", "fecha");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_fecha_idx" ON "auditoria"("usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "auditoria_fecha_idx" ON "auditoria"("fecha");

-- AddForeignKey
ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_asignado_por_id_fkey" FOREIGN KEY ("asignado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_retirado_por_id_fkey" FOREIGN KEY ("retirado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_revocada_por_id_fkey" FOREIGN KEY ("revocada_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desafios_mfa" ADD CONSTRAINT "desafios_mfa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_recuperacion" ADD CONSTRAINT "codigos_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "usuarios_roles_vigente_key" ON "usuarios_roles"("usuario_id", "rol_id") WHERE "retirado_en" IS NULL;

CREATE UNIQUE INDEX "roles_permisos_vigente_key" ON "roles_permisos"("rol_id", "permiso_id") WHERE "retirado_en" IS NULL;

CREATE FUNCTION "auditoria_rechazar_cambios"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'La auditoría es de solo inserción: % no está permitido', TG_OP;
END;
$$;

CREATE TRIGGER "auditoria_sin_modificaciones"
BEFORE UPDATE OR DELETE ON "auditoria"
FOR EACH ROW EXECUTE FUNCTION "auditoria_rechazar_cambios"();

CREATE TRIGGER "auditoria_sin_vaciado"
BEFORE TRUNCATE ON "auditoria"
FOR EACH STATEMENT EXECUTE FUNCTION "auditoria_rechazar_cambios"();

INSERT INTO "permisos" ("id", "codigo", "modulo", "descripcion", "sensible") VALUES
    (gen_random_uuid(), 'usuario:ver', 'Usuarios', 'Ver usuarios, sus roles y sesiones', false),
    (gen_random_uuid(), 'usuario:gestionar', 'Usuarios', 'Asignar roles, activar, desactivar y restablecer MFA de usuarios', true),
    (gen_random_uuid(), 'sesion:revocar', 'Usuarios', 'Revocar sesiones de otros usuarios', true),
    (gen_random_uuid(), 'rol:ver', 'Roles y permisos', 'Ver roles y permisos', false),
    (gen_random_uuid(), 'rol:gestionar', 'Roles y permisos', 'Crear, editar, activar y desactivar roles', true),
    (gen_random_uuid(), 'auditoria:ver', 'Auditoría', 'Consultar el registro de auditoría', false);

INSERT INTO "roles" ("id", "codigo", "nombre", "descripcion", "alcance", "exige_mfa", "es_sistema", "actualizado_en") VALUES
    (gen_random_uuid(), 'GERENCIA', 'Gerencia General', 'Acceso integral, administración de usuarios, aprobaciones y configuración general.', 'GLOBAL', true, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'CONTABILIDAD', 'Contabilidad', 'Clientes asignados, operaciones, obligaciones, documentos y avances.', 'ASIGNADO', false, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'ASISTENTE_CONTABLE', 'Asistente contable', 'Clientes y tareas asignadas, evidencias; sin aprobación de operaciones sensibles.', 'ASIGNADO', false, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'ADMINISTRACION', 'Administración', 'Pagos, ingresos, egresos, gestión documental y seguimiento administrativo.', 'ASIGNADO', true, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'COMERCIAL', 'Comercial', 'Prospectos, seguimiento comercial, cotizaciones, reuniones y resultados.', 'PROPIO', false, true, CURRENT_TIMESTAMP);

INSERT INTO "roles_permisos" ("id", "rol_id", "permiso_id")
SELECT gen_random_uuid(), r."id", p."id"
FROM "roles" r
CROSS JOIN "permisos" p
WHERE r."codigo" = 'GERENCIA';


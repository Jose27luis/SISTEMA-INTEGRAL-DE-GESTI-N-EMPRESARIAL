ALTER TABLE "usuarios" ALTER COLUMN "debe_cambiar_contrasena" SET DEFAULT false;

UPDATE "usuarios" SET "debe_cambiar_contrasena" = false WHERE "debe_cambiar_contrasena" = true;

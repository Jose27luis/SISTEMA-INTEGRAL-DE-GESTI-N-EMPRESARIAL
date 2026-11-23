UPDATE "roles" SET "exige_mfa" = false, "actualizado_en" = CURRENT_TIMESTAMP WHERE "codigo" IN ('GERENCIA', 'ADMINISTRACION') AND "exige_mfa" = true;

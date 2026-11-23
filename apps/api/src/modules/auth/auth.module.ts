import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { EntornoModule } from '../../config/environment.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ControlAccesoModule } from '../access-control/access-control.module';
import { AuditoriaModule } from '../audit/audit.module';
import { SeguridadModule } from '../security/security.module';
import { PerfilAccesoService } from './access-profile.service';
import { AuthController } from './auth.controller';
import { GuardiaLimiteIngreso } from './login-rate-limit.guard';
import { IngresoService } from './login.service';
import { ConfiguracionMfaService } from './mfa-setup.service';
import { CambioContrasenaService } from './password-change.service';
import { GuardiaSesion } from './session.guard';
import { SesionesService } from './sessions.service';

const INTENTOS_DE_INGRESO_POR_MINUTO = 10;

@Module({
  imports: [
    EntornoModule,
    PrismaModule,
    SeguridadModule,
    AuditoriaModule,
    ControlAccesoModule,
    ThrottlerModule.forRoot([{ name: 'ingreso', ttl: 60_000, limit: INTENTOS_DE_INGRESO_POR_MINUTO }]),
  ],
  controllers: [AuthController],
  providers: [
    SesionesService,
    PerfilAccesoService,
    IngresoService,
    ConfiguracionMfaService,
    CambioContrasenaService,
    GuardiaSesion,
    GuardiaLimiteIngreso,
  ],
  exports: [SesionesService, PerfilAccesoService],
})
export class AuthModule {}

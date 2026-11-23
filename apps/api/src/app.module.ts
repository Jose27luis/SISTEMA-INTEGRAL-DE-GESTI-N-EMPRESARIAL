import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EntornoModule } from './config/environment.module';
import { ControlAccesoModule } from './modules/access-control/access-control.module';
import { GuardiaPermisos } from './modules/access-control/permission.guard';
import { AuditoriaModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { GuardiaSesion } from './modules/auth/session.guard';
import { CatalogosModule } from './modules/catalogs/catalogs.module';
import { ClientesModule } from './modules/clients/clients.module';
import { HealthModule } from './modules/health/health.module';
import { NotificacionesModule } from './modules/notifications/notifications.module';
import { PersonalModule } from './modules/staff/staff.module';
import { TareasModule } from './modules/tasks/tasks.module';
import { UsuariosModule } from './modules/users/users.module';

@Module({
  imports: [
    EntornoModule,
    HealthModule,
    AuditoriaModule,
    ControlAccesoModule,
    AuthModule,
    UsuariosModule,
    CatalogosModule,
    PersonalModule,
    ClientesModule,
    TareasModule,
    NotificacionesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: GuardiaSesion },
    { provide: APP_GUARD, useClass: GuardiaPermisos },
  ],
})
export class AppModule {}

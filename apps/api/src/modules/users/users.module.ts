import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ControlAccesoModule } from '../access-control/access-control.module';
import { AuditoriaModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificacionesNucleoModule } from '../notifications/notifications-core.module';
import { SeguridadModule } from '../security/security.module';
import { TareasModule } from '../tasks/tasks.module';
import { GestionUsuariosService } from './users-management.service';
import { ConsultaUsuariosService } from './users-query.service';
import { UsuariosController } from './users.controller';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    AuthModule,
    SeguridadModule,
    ControlAccesoModule,
    TareasModule,
    NotificacionesNucleoModule,
  ],
  controllers: [UsuariosController],
  providers: [ConsultaUsuariosService, GestionUsuariosService],
  exports: [GestionUsuariosService],
})
export class UsuariosModule {}

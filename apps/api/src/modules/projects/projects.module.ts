import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ControlAccesoModule } from '../access-control/access-control.module';
import { AuditoriaModule } from '../audit/audit.module';
import { ClientesModule } from '../clients/clients.module';
import { NotificacionesNucleoModule } from '../notifications/notifications-core.module';
import { AlmacenamientoModule } from '../storage/storage.module';
import { TareasModule } from '../tasks/tasks.module';
import { EtapasProyectoService } from './project-stages.service';
import { GestionProyectosService } from './projects-command.service';
import { ProyectosController } from './projects.controller';
import { ConsultaProyectosService } from './projects-query.service';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    ControlAccesoModule,
    ClientesModule,
    NotificacionesNucleoModule,
    AlmacenamientoModule,
    TareasModule,
  ],
  controllers: [ProyectosController],
  providers: [ConsultaProyectosService, GestionProyectosService, EtapasProyectoService],
})
export class ProyectosModule {}

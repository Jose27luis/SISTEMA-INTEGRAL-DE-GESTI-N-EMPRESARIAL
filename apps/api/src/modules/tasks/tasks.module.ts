import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ControlAccesoModule } from '../access-control/access-control.module';
import { AuditoriaModule } from '../audit/audit.module';
import { NotificacionesNucleoModule } from '../notifications/notifications-core.module';
import { AlmacenamientoModule } from '../storage/storage.module';
import { SubidasNucleoModule } from '../uploads/uploads-core.module';
import { ArchivosController } from './files.controller';
import { AccesoTareasService } from './task-access.service';
import { ListaVerificacionService } from './task-checklist.service';
import { ArchivosTareaService } from './task-files.service';
import { AvancesTareaService } from './task-progress.service';
import { ReasignacionTareasService } from './task-reassignment.service';
import { RevisionTareasService } from './task-review.service';
import { SeguimientoTareasService } from './task-tracking.service';
import { GestionTareasService } from './tasks-command.service';
import { TareasController } from './tasks.controller';
import { ConsultaTareasService } from './tasks-query.service';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    ControlAccesoModule,
    NotificacionesNucleoModule,
    AlmacenamientoModule,
    SubidasNucleoModule,
  ],
  controllers: [TareasController, ArchivosController],
  providers: [
    AccesoTareasService,
    ConsultaTareasService,
    GestionTareasService,
    AvancesTareaService,
    ArchivosTareaService,
    ReasignacionTareasService,
    RevisionTareasService,
    ListaVerificacionService,
    SeguimientoTareasService,
  ],
  exports: [ReasignacionTareasService, AccesoTareasService, AvancesTareaService, RevisionTareasService],
})
export class TareasModule {}

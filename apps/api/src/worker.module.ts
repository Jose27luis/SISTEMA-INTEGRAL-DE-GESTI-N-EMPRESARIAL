import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EntornoModule } from './config/environment.module';
import { FinanzasNucleoModule } from './modules/finance/finance-core.module';
import { NotificacionesNucleoModule } from './modules/notifications/notifications-core.module';
import { ObligacionesNucleoModule } from './modules/obligations/obligations-core.module';
import { RevisionAccesosJob } from './modules/scheduler/access-review.job';
import { AlertasDocumentosJob } from './modules/scheduler/document-alerts.job';
import { MantenimientoArchivosJob } from './modules/scheduler/file-maintenance.job';
import { HonorariosMensualesJob } from './modules/scheduler/monthly-fees.job';
import { AlertasObligacionesJob } from './modules/scheduler/obligation-alerts.job';
import { GeneracionObligacionesJob } from './modules/scheduler/obligation-generation.job';
import { PagosVencidosJob } from './modules/scheduler/overdue-payments.job';
import { TareasRecurrentesJob } from './modules/scheduler/recurring-tasks.job';
import { AlertasTareasJob } from './modules/scheduler/task-alerts.job';
import { PlantillasNucleoModule } from './modules/templates/templates-core.module';
import { SubidasNucleoModule } from './modules/uploads/uploads-core.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    EntornoModule,
    PrismaModule,
    NotificacionesNucleoModule,
    ObligacionesNucleoModule,
    PlantillasNucleoModule,
    FinanzasNucleoModule,
    SubidasNucleoModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    AlertasTareasJob,
    GeneracionObligacionesJob,
    AlertasObligacionesJob,
    AlertasDocumentosJob,
    TareasRecurrentesJob,
    RevisionAccesosJob,
    HonorariosMensualesJob,
    PagosVencidosJob,
    MantenimientoArchivosJob,
  ],
})
export class TrabajadorModule {}

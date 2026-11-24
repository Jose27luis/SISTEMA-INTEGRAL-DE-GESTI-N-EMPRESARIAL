import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EntornoModule } from './config/environment.module';
import { NotificacionesNucleoModule } from './modules/notifications/notifications-core.module';
import { ObligacionesNucleoModule } from './modules/obligations/obligations-core.module';
import { AlertasDocumentosJob } from './modules/scheduler/document-alerts.job';
import { AlertasObligacionesJob } from './modules/scheduler/obligation-alerts.job';
import { GeneracionObligacionesJob } from './modules/scheduler/obligation-generation.job';
import { AlertasTareasJob } from './modules/scheduler/task-alerts.job';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [EntornoModule, PrismaModule, NotificacionesNucleoModule, ObligacionesNucleoModule, ScheduleModule.forRoot()],
  providers: [AlertasTareasJob, GeneracionObligacionesJob, AlertasObligacionesJob, AlertasDocumentosJob],
})
export class TrabajadorModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EntornoModule } from './config/environment.module';
import { NotificacionesNucleoModule } from './modules/notifications/notifications-core.module';
import { AlertasTareasJob } from './modules/scheduler/task-alerts.job';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [EntornoModule, PrismaModule, NotificacionesNucleoModule, ScheduleModule.forRoot()],
  providers: [AlertasTareasJob],
})
export class TrabajadorModule {}

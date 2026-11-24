import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { NotificacionesNucleoModule } from '../notifications/notifications-core.module';
import { GeneracionRecurrenteService } from './recurrence-generation.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, NotificacionesNucleoModule],
  providers: [GeneracionRecurrenteService],
  exports: [GeneracionRecurrenteService],
})
export class PlantillasNucleoModule {}

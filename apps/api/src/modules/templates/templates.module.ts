import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ControlAccesoModule } from '../access-control/access-control.module';
import { AuditoriaModule } from '../audit/audit.module';
import { ClientesModule } from '../clients/clients.module';
import { TareasModule } from '../tasks/tasks.module';
import { RecurrenciaService } from './recurrence.service';
import { PlantillasController } from './templates.controller';
import { PlantillasService } from './templates.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, ControlAccesoModule, ClientesModule, TareasModule],
  controllers: [PlantillasController],
  providers: [PlantillasService, RecurrenciaService],
})
export class PlantillasModule {}

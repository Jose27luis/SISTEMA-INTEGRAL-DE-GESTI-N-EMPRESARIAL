import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ControlAccesoModule } from '../access-control/access-control.module';
import { AuditoriaModule } from '../audit/audit.module';
import { ClientesModule } from '../clients/clients.module';
import { AlmacenamientoModule } from '../storage/storage.module';
import { TareasModule } from '../tasks/tasks.module';
import { ObligacionesClienteService } from './client-obligations.service';
import { PresentacionObligacionesService } from './obligation-filing.service';
import { TiposObligacionService } from './obligation-types.service';
import { ObligacionesController } from './obligations.controller';
import { ObligacionesNucleoModule } from './obligations-core.module';
import { ConsultaObligacionesService } from './obligations-query.service';
import { CronogramaService } from './schedule.service';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    ControlAccesoModule,
    ClientesModule,
    TareasModule,
    AlmacenamientoModule,
    ObligacionesNucleoModule,
  ],
  controllers: [ObligacionesController],
  providers: [
    TiposObligacionService,
    CronogramaService,
    ObligacionesClienteService,
    ConsultaObligacionesService,
    PresentacionObligacionesService,
  ],
  exports: [ConsultaObligacionesService],
})
export class ObligacionesModule {}

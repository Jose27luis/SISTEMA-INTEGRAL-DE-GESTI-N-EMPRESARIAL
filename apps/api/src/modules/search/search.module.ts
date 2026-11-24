import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClientesModule } from '../clients/clients.module';
import { TareasModule } from '../tasks/tasks.module';
import { ProcesosService } from './processes.service';
import { BusquedaController } from './search.controller';
import { BusquedaService } from './search.service';

@Module({
  imports: [PrismaModule, ClientesModule, TareasModule],
  controllers: [BusquedaController],
  providers: [BusquedaService, ProcesosService],
})
export class BusquedaModule {}

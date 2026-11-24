import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { ClientesModule } from '../clients/clients.module';
import { NotificacionesNucleoModule } from '../notifications/notifications-core.module';
import { TareasModule } from '../tasks/tasks.module';
import { OperacionClienteController } from './client-operations.controller';
import { OperacionClienteService } from './client-operations.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, ClientesModule, TareasModule, NotificacionesNucleoModule],
  controllers: [OperacionClienteController],
  providers: [OperacionClienteService],
})
export class OperacionClienteModule {}

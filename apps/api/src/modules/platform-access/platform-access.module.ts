import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { ClientesModule } from '../clients/clients.module';
import { TareasModule } from '../tasks/tasks.module';
import { AccesosPlataformaController } from './platform-access.controller';
import { AccesosPlataformaService } from './platform-access.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, ClientesModule, TareasModule],
  controllers: [AccesosPlataformaController],
  providers: [AccesosPlataformaService],
})
export class AccesosPlataformaModule {}

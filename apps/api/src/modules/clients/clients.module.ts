import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { CatalogosModule } from '../catalogs/catalogs.module';
import { AccesoClientesService } from './client-access.service';
import { EquipoClienteService } from './client-team.service';
import { GestionClientesService } from './clients-command.service';
import { ClientesController } from './clients.controller';
import { ConsultaClientesService } from './clients-query.service';
import { ImportacionClientesService } from './import/client-import.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, CatalogosModule],
  controllers: [ClientesController],
  providers: [
    AccesoClientesService,
    ConsultaClientesService,
    GestionClientesService,
    EquipoClienteService,
    ImportacionClientesService,
  ],
})
export class ClientesModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { CatalogosModule } from '../catalogs/catalogs.module';
import { SeguridadModule } from '../security/security.module';
import { UsuariosModule } from '../users/users.module';
import { GestionPersonalService } from './staff-command.service';
import { PersonalController } from './staff.controller';
import { ConsultaPersonalService } from './staff-query.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, CatalogosModule, SeguridadModule, UsuariosModule],
  controllers: [PersonalController],
  providers: [ConsultaPersonalService, GestionPersonalService],
})
export class PersonalModule {}

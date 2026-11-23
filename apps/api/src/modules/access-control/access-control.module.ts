import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { PermisosEfectivosService } from './effective-permissions.service';
import { ContinuidadGerenciaService } from './management-continuity.service';
import { GuardiaPermisos } from './permission.guard';
import { GestionRolesService } from './roles-command.service';
import { RolesController } from './roles.controller';
import { ConsultaRolesService } from './roles-query.service';

@Module({
  imports: [PrismaModule, AuditoriaModule],
  controllers: [RolesController],
  providers: [
    PermisosEfectivosService,
    ConsultaRolesService,
    GestionRolesService,
    GuardiaPermisos,
    ContinuidadGerenciaService,
  ],
  exports: [PermisosEfectivosService, ConsultaRolesService, GuardiaPermisos, ContinuidadGerenciaService],
})
export class ControlAccesoModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SeguridadModule } from '../security/security.module';
import { GestionUsuariosService } from './users-management.service';
import { ConsultaUsuariosService } from './users-query.service';
import { UsuariosController } from './users.controller';

@Module({
  imports: [PrismaModule, AuditoriaModule, AuthModule, SeguridadModule],
  controllers: [UsuariosController],
  providers: [ConsultaUsuariosService, GestionUsuariosService],
})
export class UsuariosModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { NotificacionesNucleoModule } from '../notifications/notifications-core.module';
import { GeneracionObligacionesService } from './obligation-generation.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, NotificacionesNucleoModule],
  providers: [GeneracionObligacionesService],
  exports: [GeneracionObligacionesService],
})
export class ObligacionesNucleoModule {}

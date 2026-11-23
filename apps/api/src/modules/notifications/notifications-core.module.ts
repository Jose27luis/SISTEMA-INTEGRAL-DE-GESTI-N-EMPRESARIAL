import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificacionesService } from './notifications.service';

@Module({
  imports: [PrismaModule],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesNucleoModule {}

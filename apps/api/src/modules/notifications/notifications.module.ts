import { Module } from '@nestjs/common';
import { EntornoModule } from '../../config/environment.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificacionesNucleoModule } from './notifications-core.module';
import { NotificacionesController } from './notifications.controller';
import { ConsultaNotificacionesService } from './notifications-query.service';
import { FlujoNotificacionesService } from './notifications-stream.service';

@Module({
  imports: [EntornoModule, PrismaModule, NotificacionesNucleoModule],
  controllers: [NotificacionesController],
  providers: [ConsultaNotificacionesService, FlujoNotificacionesService],
})
export class NotificacionesModule {}

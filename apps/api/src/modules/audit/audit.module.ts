import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaController } from './audit.controller';
import { ConsultaAuditoriaService } from './audit-query.service';
import { AuditoriaService } from './audit.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, ConsultaAuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}

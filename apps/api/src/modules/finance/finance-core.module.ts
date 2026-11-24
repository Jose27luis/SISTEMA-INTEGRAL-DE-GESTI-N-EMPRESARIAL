import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { GeneracionHonorariosService } from './fee-generation.service';

@Module({
  imports: [PrismaModule, AuditoriaModule],
  providers: [GeneracionHonorariosService],
  exports: [GeneracionHonorariosService],
})
export class FinanzasNucleoModule {}

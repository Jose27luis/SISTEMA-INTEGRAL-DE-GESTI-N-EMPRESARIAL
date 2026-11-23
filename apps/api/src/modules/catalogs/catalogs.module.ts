import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { CatalogosController } from './catalogs.controller';
import { CatalogosService } from './catalogs.service';

@Module({
  imports: [PrismaModule, AuditoriaModule],
  controllers: [CatalogosController],
  providers: [CatalogosService],
  exports: [CatalogosService],
})
export class CatalogosModule {}

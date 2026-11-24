import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ControlAccesoModule } from '../access-control/access-control.module';
import { AuditoriaModule } from '../audit/audit.module';
import { AlmacenamientoModule } from '../storage/storage.module';
import { FichaComercialService } from './commercial.service';
import { EgresosService } from './expenses.service';
import { FinanzasNucleoModule } from './finance-core.module';
import { CatalogosFinancierosService } from './finance-catalogs.service';
import { ReportesFinancierosService } from './finance-reports.service';
import { FinanzasController } from './finance.controller';
import { IngresosService } from './income.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, ControlAccesoModule, AlmacenamientoModule, FinanzasNucleoModule],
  controllers: [FinanzasController],
  providers: [CatalogosFinancierosService, FichaComercialService, IngresosService, EgresosService, ReportesFinancierosService],
})
export class FinanzasModule {}

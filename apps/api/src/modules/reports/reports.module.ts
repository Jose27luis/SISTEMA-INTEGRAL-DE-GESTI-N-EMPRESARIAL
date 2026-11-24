import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { TareasModule } from '../tasks/tasks.module';
import { ReporteClientesService } from './client-report.service';
import { TableroService } from './dashboard.service';
import { DatosReportesService } from './report-data.service';
import { ReportesController } from './reports.controller';
import { ReportesService } from './reports.service';
import { HistorialTrabajadorService } from './staff-history.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, TareasModule],
  controllers: [ReportesController],
  providers: [DatosReportesService, TableroService, HistorialTrabajadorService, ReportesService, ReporteClientesService],
})
export class ReportesModule {}

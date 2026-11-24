import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditoriaModule } from '../audit/audit.module';
import { ClientesModule } from '../clients/clients.module';
import { AlmacenamientoModule } from '../storage/storage.module';
import { TareasModule } from '../tasks/tasks.module';
import { AccesoDocumentosService } from './document-access.service';
import { TiposDocumentoService } from './document-types.service';
import { GestionDocumentosService } from './documents-command.service';
import { DocumentosController } from './documents.controller';
import { ConsultaDocumentosService } from './documents-query.service';
import { DocumentosEsperadosService } from './expected-documents.service';
import { CarpetasService } from './folders.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, ClientesModule, TareasModule, AlmacenamientoModule],
  controllers: [DocumentosController],
  providers: [
    AccesoDocumentosService,
    TiposDocumentoService,
    CarpetasService,
    DocumentosEsperadosService,
    GestionDocumentosService,
    ConsultaDocumentosService,
  ],
})
export class DocumentosModule {}

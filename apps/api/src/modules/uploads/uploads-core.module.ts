import { Module } from '@nestjs/common';
import { EntornoModule } from '../../config/environment.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AlmacenamientoModule } from '../storage/storage.module';
import { VistasPreviasService } from './previews.service';
import { SubidasService } from './uploads.service';

@Module({
  imports: [PrismaModule, AlmacenamientoModule, EntornoModule],
  providers: [SubidasService, VistasPreviasService],
  exports: [SubidasService, VistasPreviasService],
})
export class SubidasNucleoModule {}

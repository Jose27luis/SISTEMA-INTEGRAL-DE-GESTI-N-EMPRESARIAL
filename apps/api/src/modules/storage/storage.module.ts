import { Module } from '@nestjs/common';
import { EntornoModule } from '../../config/environment.module';
import { AlmacenArchivos } from './file-storage';
import { AlmacenArchivosLocal } from './local-file-storage';

@Module({
  imports: [EntornoModule],
  providers: [{ provide: AlmacenArchivos, useClass: AlmacenArchivosLocal }],
  exports: [AlmacenArchivos],
})
export class AlmacenamientoModule {}

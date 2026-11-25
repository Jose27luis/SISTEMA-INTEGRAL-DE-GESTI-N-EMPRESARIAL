import { Module } from '@nestjs/common';
import { ControlAccesoModule } from '../access-control/access-control.module';
import { SubidasNucleoModule } from './uploads-core.module';
import { SubidasController } from './uploads.controller';

@Module({
  imports: [SubidasNucleoModule, ControlAccesoModule],
  controllers: [SubidasController],
})
export class SubidasModule {}

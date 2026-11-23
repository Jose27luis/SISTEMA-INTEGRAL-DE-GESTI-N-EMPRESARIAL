import { Module } from '@nestjs/common';
import { EntornoModule } from '../config/environment.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [EntornoModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

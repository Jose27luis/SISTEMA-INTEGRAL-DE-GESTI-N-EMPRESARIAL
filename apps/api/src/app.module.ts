import { Module } from '@nestjs/common';
import { EntornoModule } from './config/environment.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [EntornoModule, HealthModule],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { EntornoModule } from '../../config/environment.module';
import { HashContrasenas } from './password-hasher.service';
import { CifradorSecretos } from './secret-cipher.service';

@Module({
  imports: [EntornoModule],
  providers: [HashContrasenas, CifradorSecretos],
  exports: [HashContrasenas, CifradorSecretos],
})
export class SeguridadModule {}

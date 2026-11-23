import { Controller, Get, Query } from '@nestjs/common';
import { esquemaFiltroAuditoria, type FiltroAuditoria } from '@sige/types';
import { RequierePermiso } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { ConsultaAuditoriaService, type PaginaAuditoriaRespuesta } from './audit-query.service';

@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly consulta: ConsultaAuditoriaService) {}

  @Get()
  @RequierePermiso('auditoria:ver')
  listar(
    @Query(new ValidacionZod(esquemaFiltroAuditoria)) filtro: FiltroAuditoria,
  ): Promise<PaginaAuditoriaRespuesta> {
    return this.consulta.listar(filtro);
  }
}

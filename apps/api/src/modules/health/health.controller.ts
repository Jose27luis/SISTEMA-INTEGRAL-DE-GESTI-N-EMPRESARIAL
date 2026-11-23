import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { EstadoSalud } from '@sige/types';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async verificar(): Promise<EstadoSalud> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      const estado: EstadoSalud = { servicio: 'ok', baseDatos: 'error' };
      throw new ServiceUnavailableException(estado);
    }

    return { servicio: 'ok', baseDatos: 'ok' };
  }
}

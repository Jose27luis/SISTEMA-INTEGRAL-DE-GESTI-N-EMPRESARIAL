import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

export async function asegurarClienteExiste(prisma: PrismaService, clienteId: string): Promise<void> {
  const existe = await prisma.cliente.count({ where: { id: clienteId } });

  if (existe === 0) {
    throw new NotFoundException({ mensaje: 'El cliente no existe.', errores: [] });
  }
}

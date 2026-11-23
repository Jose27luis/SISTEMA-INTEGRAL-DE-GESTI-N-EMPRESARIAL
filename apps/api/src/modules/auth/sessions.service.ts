import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import type { SesionResumen } from '@sige/types';
import type { ContextoCliente } from '../../common/auth/authenticated-request';
import { aIso } from '../../common/dates';
import type { Entorno } from '../../config/environment';
import { ENTORNO } from '../../config/environment.module';
import { PrismaService } from '../../prisma/prisma.service';
import type { ClienteBaseDatos } from '../audit/audit.service';
import { generarTokenSesion, resumirSecreto } from '../security/tokens';

const INTERVALO_ACTUALIZACION_USO_MS = 60_000;

export interface SesionCreada {
  sesionId: string;
  token: string;
  expiraEn: Date;
}

export interface SesionValida {
  sesionId: string;
  usuario: Usuario;
}

@Injectable()
export class SesionesService {
  private readonly duracionMs: number;
  private readonly inactividadMs: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENTORNO) entorno: Entorno,
  ) {
    this.duracionMs = entorno.SESION_DURACION_HORAS * 3_600_000;
    this.inactividadMs = entorno.SESION_INACTIVIDAD_MINUTOS * 60_000;
  }

  async crear(
    usuarioId: string,
    cliente: ContextoCliente,
    db: ClienteBaseDatos = this.prisma,
  ): Promise<SesionCreada> {
    const token = generarTokenSesion();
    const expiraEn = new Date(Date.now() + this.duracionMs);

    const sesion = await db.sesion.create({
      data: {
        usuarioId,
        hashToken: resumirSecreto(token),
        ip: cliente.ip,
        agenteUsuario: cliente.agenteUsuario,
        expiraEn,
      },
    });

    return { sesionId: sesion.id, token, expiraEn };
  }

  async validar(token: string): Promise<SesionValida | null> {
    const ahora = new Date();
    const sesion = await this.prisma.sesion.findUnique({
      where: { hashToken: resumirSecreto(token) },
      include: { usuario: true },
    });

    if (sesion === null || sesion.revocadaEn !== null || !sesion.usuario.activo) {
      return null;
    }

    if (sesion.expiraEn.getTime() <= ahora.getTime()) {
      return null;
    }

    const inactiva = ahora.getTime() - sesion.ultimoUso.getTime();

    if (inactiva > this.inactividadMs) {
      await this.prisma.sesion.update({
        where: { id: sesion.id },
        data: { revocadaEn: ahora, motivoRevocacion: 'Cierre automático por inactividad' },
      });
      return null;
    }

    if (inactiva > INTERVALO_ACTUALIZACION_USO_MS) {
      await this.prisma.sesion.update({ where: { id: sesion.id }, data: { ultimoUso: ahora } });
    }

    return { sesionId: sesion.id, usuario: sesion.usuario };
  }

  async listarVigentes(usuarioId: string, sesionActualId: string | null): Promise<SesionResumen[]> {
    const ahora = Date.now();
    const sesiones = await this.prisma.sesion.findMany({
      where: {
        usuarioId,
        revocadaEn: null,
        expiraEn: { gt: new Date(ahora) },
        ultimoUso: { gt: new Date(ahora - this.inactividadMs) },
      },
      orderBy: { ultimoUso: 'desc' },
    });

    return sesiones.map((sesion) => ({
      id: sesion.id,
      ip: sesion.ip,
      agenteUsuario: sesion.agenteUsuario,
      creadaEn: aIso(sesion.creadaEn),
      ultimoUso: aIso(sesion.ultimoUso),
      expiraEn: aIso(sesion.expiraEn),
      actual: sesion.id === sesionActualId,
    }));
  }

  async revocarPropia(
    sesionId: string,
    usuarioId: string,
    motivo: string,
    db: ClienteBaseDatos = this.prisma,
  ): Promise<void> {
    const resultado = await db.sesion.updateMany({
      where: { id: sesionId, usuarioId, revocadaEn: null },
      data: { revocadaEn: new Date(), revocadaPorId: usuarioId, motivoRevocacion: motivo },
    });

    if (resultado.count === 0) {
      throw new NotFoundException({ mensaje: 'La sesión no existe o ya fue cerrada.', errores: [] });
    }
  }

  async revocarDeUsuario(
    usuarioId: string,
    revocadaPorId: string | null,
    motivo: string,
    db: ClienteBaseDatos = this.prisma,
    exceptoSesionId: string | null = null,
  ): Promise<number> {
    const resultado = await db.sesion.updateMany({
      where: {
        usuarioId,
        revocadaEn: null,
        ...(exceptoSesionId === null ? {} : { id: { not: exceptoSesionId } }),
      },
      data: { revocadaEn: new Date(), revocadaPorId, motivoRevocacion: motivo },
    });

    return resultado.count;
  }
}

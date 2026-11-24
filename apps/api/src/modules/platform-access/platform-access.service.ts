import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AccesoEntrada, AccesosCliente, Plataforma } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aIso, fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { AccesoClientesService } from '../clients/client-access.service';
import { AccesoTareasService } from '../tasks/task-access.service';

@Injectable()
export class AccesosPlataformaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly accesoClientes: AccesoClientesService,
    private readonly accesoTareas: AccesoTareasService,
  ) {}

  async plataformas(): Promise<Plataforma[]> {
    return this.prisma.plataforma.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, urlPorDefecto: true, activo: true },
    });
  }

  async listar(clienteId: string, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<AccesosCliente> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const hoy = fechaHoyEnLima();
    const accesos = await this.prisma.accesoPlataforma.findMany({
      where: { clienteId },
      orderBy: [{ estado: 'asc' }, { plataforma: { nombre: 'asc' } }],
      include: {
        plataforma: { select: { id: true, nombre: true } },
        responsableAutorizado: { select: { id: true, nombre: true } },
      },
    });

    await this.auditoria.registrar({
      actor: actorDesde(usuario, contexto),
      accion: 'CONSULTAR',
      entidad: 'acceso_plataforma',
      entidadId: clienteId,
      despues: { clienteId, accesos: accesos.length },
    });

    return {
      clienteId,
      accesos: accesos.map((acceso) => {
        const fechaRevision = aFechaIso(acceso.fechaRevision);

        return {
          id: acceso.id,
          plataforma: acceso.plataforma,
          url: acceso.url,
          identificador: acceso.identificador,
          responsableAutorizado: acceso.responsableAutorizado,
          fechaRevision,
          revisionVencida: acceso.estado === 'ACTIVO' && fechaRevision < hoy,
          estado: acceso.estado,
          tieneMfa: acceso.tieneMfa,
          referenciaBoveda: acceso.referenciaBoveda,
          notas: acceso.notas,
          actualizadoEn: aIso(acceso.actualizadoEn),
        };
      }),
      puedeGestionar: usuario.permisos.has('acceso:gestionar'),
    };
  }

  async guardar(
    clienteId: string,
    accesoId: string | null,
    entrada: AccesoEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    await this.accesoClientes.asegurarAcceso(usuario, clienteId, contexto);
    const plataforma = await this.prisma.plataforma.findUnique({ where: { id: entrada.plataformaId }, select: { activo: true } });

    if (plataforma?.activo !== true) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [{ campo: 'plataformaId', mensaje: 'Seleccione una plataforma activa.' }],
      });
    }

    await this.accesoTareas.asegurarParticipante(entrada.responsableAutorizadoId, clienteId, 'responsableAutorizadoId', this.prisma);

    const anterior =
      accesoId === null ? null : await this.prisma.accesoPlataforma.findFirst({ where: { id: accesoId, clienteId } });

    if (accesoId !== null && anterior === null) {
      throw new NotFoundException({ mensaje: 'El acceso no existe en este cliente.', errores: [] });
    }

    const datos = {
      plataformaId: entrada.plataformaId,
      url: entrada.url,
      identificador: entrada.identificador,
      responsableAutorizadoId: entrada.responsableAutorizadoId,
      fechaRevision: aFechaDb(entrada.fechaRevision),
      estado: entrada.estado,
      tieneMfa: entrada.tieneMfa,
      referenciaBoveda: entrada.referenciaBoveda,
      notas: entrada.notas,
      actualizadoPorId: usuario.usuarioId,
    };

    await this.prisma.$transaction(async (tx) => {
      const acceso =
        accesoId === null
          ? await tx.accesoPlataforma.create({ data: { ...datos, clienteId } })
          : await tx.accesoPlataforma.update({ where: { id: accesoId }, data: datos });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: anterior === null ? 'CREAR' : 'MODIFICAR',
          entidad: 'acceso_plataforma',
          entidadId: acceso.id,
          ...(anterior === null
            ? {}
            : {
                antes: {
                  plataformaId: anterior.plataformaId,
                  identificador: anterior.identificador,
                  responsableAutorizadoId: anterior.responsableAutorizadoId,
                  fechaRevision: aFechaIso(anterior.fechaRevision),
                  estado: anterior.estado,
                  tieneMfa: anterior.tieneMfa,
                  referenciaBoveda: anterior.referenciaBoveda,
                },
              }),
          despues: { clienteId, ...entrada },
        },
        tx,
      );
    });
  }
}

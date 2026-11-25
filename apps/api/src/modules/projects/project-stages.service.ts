import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type EntregableEntrada,
  type EtapaEntrada,
  MAXIMO_ETAPAS,
  type OrdenEtapa,
  type RevisionEntregable,
  TAMANO_MAXIMO_ENTREGABLE_MB,
} from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { NotificacionesService } from '../notifications/notifications.service';
import { detectarTipoArchivo, nombreSeguro } from '../storage/file-signature';
import { AlmacenArchivos } from '../storage/file-storage';
import { GestionProyectosService } from './projects-command.service';
import { ConsultaProyectosService } from './projects-query.service';

export interface ArchivoRecibido {
  nombre: string;
  contenido: Buffer;
}

function errorCampo(campo: string, mensaje: string): BadRequestException {
  return new BadRequestException({ mensaje: 'Revise los datos ingresados.', errores: [{ campo, mensaje }] });
}

@Injectable()
export class EtapasProyectoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
    private readonly almacen: AlmacenArchivos,
    private readonly consulta: ConsultaProyectosService,
    private readonly gestion: GestionProyectosService,
  ) {}

  async guardarEtapa(
    proyectoId: string,
    etapaId: string | null,
    entrada: EtapaEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const proyecto = await this.gestion.asegurarGestion(proyectoId, usuario, contexto);
    this.gestion.asegurarAbierto(proyecto);
    const anterior = etapaId === null ? null : await this.etapaDelProyecto(proyectoId, etapaId);

    if (etapaId === null && (await this.prisma.etapaProyecto.count({ where: { proyectoId } })) >= MAXIMO_ETAPAS) {
      throw errorCampo('nombre', `Un proyecto admite como máximo ${String(MAXIMO_ETAPAS)} etapas.`);
    }

    await this.prisma.$transaction(async (tx) => {
      const datos = { nombre: entrada.nombre, inicio: aFechaDb(entrada.inicio), fin: aFechaDb(entrada.fin), estado: entrada.estado };
      let id = etapaId;

      if (id === null) {
        const ultima = await tx.etapaProyecto.aggregate({ where: { proyectoId }, _max: { orden: true } });
        id = (await tx.etapaProyecto.create({ data: { ...datos, proyectoId, orden: (ultima._max.orden ?? 0) + 1 } })).id;
      } else {
        await tx.etapaProyecto.update({ where: { id }, data: datos });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: anterior === null ? 'CREAR' : 'MODIFICAR',
          entidad: 'etapa_proyecto',
          entidadId: id,
          ...(anterior === null
            ? {}
            : {
                antes: {
                  nombre: anterior.nombre,
                  inicio: aFechaIso(anterior.inicio),
                  fin: aFechaIso(anterior.fin),
                  estado: anterior.estado,
                },
              }),
          despues: { proyectoId, ...entrada },
        },
        tx,
      );
    });
  }

  async ordenarEtapa(
    proyectoId: string,
    etapaId: string,
    entrada: OrdenEtapa,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const proyecto = await this.gestion.asegurarGestion(proyectoId, usuario, contexto);
    this.gestion.asegurarAbierto(proyecto);
    const etapa = await this.etapaDelProyecto(proyectoId, etapaId);
    const vecina = await this.prisma.etapaProyecto.findFirst({
      where:
        entrada.direccion === 'subir'
          ? { proyectoId, orden: { lt: etapa.orden } }
          : { proyectoId, orden: { gt: etapa.orden } },
      orderBy: { orden: entrada.direccion === 'subir' ? 'desc' : 'asc' },
    });

    if (vecina === null) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.etapaProyecto.update({ where: { id: etapa.id }, data: { orden: -etapa.orden } });
      await tx.etapaProyecto.update({ where: { id: vecina.id }, data: { orden: etapa.orden } });
      await tx.etapaProyecto.update({ where: { id: etapa.id }, data: { orden: vecina.orden } });
      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'etapa_proyecto',
          entidadId: etapa.id,
          antes: { orden: etapa.orden },
          despues: { orden: vecina.orden },
        },
        tx,
      );
    });
  }

  async crearEntregable(
    proyectoId: string,
    etapaId: string,
    entrada: EntregableEntrada,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const proyecto = await this.gestion.asegurarGestion(proyectoId, usuario, contexto);
    this.gestion.asegurarAbierto(proyecto);
    await this.etapaDelProyecto(proyectoId, etapaId);

    await this.prisma.$transaction(async (tx) => {
      const entregable = await tx.entregable.create({
        data: { etapaId, nombre: entrada.nombre, fechaCompromiso: aFechaDb(entrada.fechaCompromiso) },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'entregable',
          entidadId: entregable.id,
          despues: { proyectoId, etapaId, ...entrada },
        },
        tx,
      );
    });
  }

  async entregar(
    proyectoId: string,
    entregableId: string,
    archivos: readonly ArchivoRecibido[],
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const proyecto = await this.consulta.obtenerVisible(proyectoId, usuario, contexto);
    this.gestion.asegurarAbierto(proyecto);

    if (!usuario.alcanceGlobal && !proyecto.equipo.has(usuario.usuarioId)) {
      throw new ForbiddenException({ mensaje: 'Solo el equipo del proyecto puede entregar.', errores: [] });
    }

    const entregable = await this.entregableDelProyecto(proyectoId, entregableId);

    if (entregable.estado === 'APROBADO') {
      throw new ConflictException({ mensaje: 'El entregable ya está aprobado.', errores: [] });
    }

    const [archivo, ...sobrantes] = archivos;

    if (archivo === undefined || sobrantes.length > 0) {
      throw errorCampo('archivo', 'Adjunte un archivo.');
    }

    if (archivo.contenido.length > TAMANO_MAXIMO_ENTREGABLE_MB * 1024 * 1024) {
      throw errorCampo('archivo', `El archivo supera ${String(TAMANO_MAXIMO_ENTREGABLE_MB)} MB.`);
    }

    const nombre = nombreSeguro(archivo.nombre);
    const tipo = detectarTipoArchivo(archivo.contenido, nombre);

    if (tipo === null) {
      throw errorCampo('archivo', 'Formato no admitido: use PDF, imagen, Word, Excel o PowerPoint.');
    }

    const guardado = await this.almacen.guardar(
      archivo.contenido,
      proyecto.clienteId === null ? `proyectos/${proyectoId}` : `clientes/${proyecto.clienteId}/proyectos`,
      tipo.extension,
    );
    const notificados: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      const registro = await tx.archivo.create({
        data: {
          rutaAlmacen: guardado.ruta,
          nombreOriginal: nombre,
          mime: tipo.mime,
          tamanoBytes: guardado.tamanoBytes,
          sha256: guardado.sha256,
          clienteId: proyecto.clienteId,
          subidoPorId: usuario.usuarioId,
        },
      });

      await tx.entregable.update({
        where: { id: entregableId },
        data: {
          estado: 'ENTREGADO',
          archivoId: registro.id,
          entregadoPorId: usuario.usuarioId,
          entregadoEn: new Date(),
          revisadoPorId: null,
          revisadoEn: null,
          comentario: null,
        },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'MODIFICAR',
          entidad: 'entregable',
          entidadId: entregableId,
          antes: { estado: entregable.estado },
          despues: { estado: 'ENTREGADO', archivo: nombre },
        },
        tx,
      );

      notificados.push(
        ...(await this.notificaciones.crear(
          {
            destinatarios: [proyecto.responsableId],
            tipo: 'ENTREGABLE_POR_REVISAR',
            titulo: `Entregable por revisar: ${entregable.nombre}`,
            mensaje: `${proyecto.codigo} · ${proyecto.nombre}`,
            enlace: `/proyectos/${proyectoId}`,
            entidad: 'entregable',
            entidadId: entregableId,
          },
          usuario.usuarioId,
          tx,
        )),
      );
    });

    await this.notificaciones.publicar(notificados);
  }

  async revisar(
    proyectoId: string,
    entregableId: string,
    entrada: RevisionEntregable,
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const proyecto = await this.gestion.asegurarGestion(proyectoId, usuario, contexto);
    const entregable = await this.entregableDelProyecto(proyectoId, entregableId);

    if (entregable.estado !== 'ENTREGADO') {
      throw new ConflictException({ mensaje: 'Solo se revisan los entregables que están por aprobar.', errores: [] });
    }

    const estado = entrada.decision === 'APROBAR' ? 'APROBADO' : 'OBSERVADO';
    const notificados: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.entregable.updateMany({
        where: { id: entregableId, estado: 'ENTREGADO' },
        data: { estado, revisadoPorId: usuario.usuarioId, revisadoEn: new Date(), comentario: entrada.comentario },
      });

      if (count === 0) {
        throw new ConflictException({ mensaje: 'El entregable cambió mientras lo revisaba. Recargue la página.', errores: [] });
      }

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CAMBIAR_ESTADO',
          entidad: 'entregable',
          entidadId: entregableId,
          antes: { estado: 'ENTREGADO' },
          despues: { estado },
          ...(entrada.comentario === null ? {} : { motivo: entrada.comentario }),
        },
        tx,
      );

      if (entregable.entregadoPorId !== null) {
        notificados.push(
          ...(await this.notificaciones.crear(
            {
              destinatarios: [entregable.entregadoPorId],
              tipo: 'ENTREGABLE_REVISADO',
              titulo: `${entregable.nombre}: ${estado === 'APROBADO' ? 'aprobado' : 'observado'}`,
              mensaje: entrada.comentario ?? `${proyecto.codigo} · ${proyecto.nombre}`,
              enlace: `/proyectos/${proyectoId}`,
              entidad: 'entregable',
              entidadId: entregableId,
            },
            usuario.usuarioId,
            tx,
          )),
        );
      }
    });

    await this.notificaciones.publicar(notificados);
  }

  private async etapaDelProyecto(
    proyectoId: string,
    etapaId: string,
  ): Promise<{ id: string; nombre: string; orden: number; inicio: Date; fin: Date; estado: EtapaEntrada['estado'] }> {
    const etapa = await this.prisma.etapaProyecto.findFirst({ where: { id: etapaId, proyectoId } });

    if (etapa === null) {
      throw new NotFoundException({ mensaje: 'La etapa no pertenece a este proyecto.', errores: [] });
    }

    return etapa;
  }

  private async entregableDelProyecto(
    proyectoId: string,
    entregableId: string,
  ): Promise<{ nombre: string; estado: string; entregadoPorId: string | null }> {
    const entregable = await this.prisma.entregable.findFirst({
      where: { id: entregableId, etapa: { proyectoId } },
      select: { nombre: true, estado: true, entregadoPorId: true },
    });

    if (entregable === null) {
      throw new NotFoundException({ mensaje: 'El entregable no pertenece a este proyecto.', errores: [] });
    }

    return entregable;
  }
}

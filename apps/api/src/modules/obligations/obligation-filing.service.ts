import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ESTADOS_CON_AVANCE, type PresentacionEntrada } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, fechaHoyEnLima, formatearFechaPeruana } from '../../common/dates';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { detectarTipoArchivo, nombreSeguro } from '../storage/file-signature';
import { type ArchivoRecibido, AvancesTareaService } from '../tasks/task-progress.service';
import { RevisionTareasService } from '../tasks/task-review.service';
import { ConsultaObligacionesService } from './obligations-query.service';

const MIME_CONSTANCIA = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

@Injectable()
export class PresentacionObligacionesService {
  constructor(
    private readonly consulta: ConsultaObligacionesService,
    private readonly avances: AvancesTareaService,
    private readonly revision: RevisionTareasService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async presentar(
    id: string,
    entrada: PresentacionEntrada,
    archivos: readonly ArchivoRecibido[],
    usuario: UsuarioAutenticado,
    contexto: ContextoCliente,
  ): Promise<void> {
    const obligacion = await this.consulta.obtenerVisible(id, usuario, contexto);

    if (!ESTADOS_CON_AVANCE.includes(obligacion.tarea.estado)) {
      throw new ConflictException({
        mensaje:
          obligacion.tarea.estado === 'EN_REVISION'
            ? 'La presentación ya está en revisión.'
            : 'La obligación ya está cerrada y no admite otra presentación.',
        errores: [],
      });
    }

    const [constancia, ...sobrantes] = archivos;

    if (constancia === undefined || sobrantes.length > 0) {
      throw new BadRequestException({
        mensaje: 'Adjunte la constancia de presentación.',
        errores: [{ campo: 'constancia', mensaje: 'Adjunte un solo archivo: la constancia en PDF o imagen.' }],
      });
    }

    const tipo = detectarTipoArchivo(constancia.contenido, nombreSeguro(constancia.nombre));

    if (tipo === null || !MIME_CONSTANCIA.has(tipo.mime)) {
      throw new BadRequestException({
        mensaje: 'La constancia tiene un formato no permitido.',
        errores: [{ campo: 'constancia', mensaje: 'Adjunte la constancia en PDF o imagen (JPG, PNG o WEBP).' }],
      });
    }

    const hoy = fechaHoyEnLima();

    if (entrada.fechaPresentacion > hoy || entrada.fechaPresentacion < `${obligacion.periodo}-01`) {
      throw new BadRequestException({
        mensaje: 'Revise los datos ingresados.',
        errores: [
          {
            campo: 'fechaPresentacion',
            mensaje: 'La fecha de presentación no puede ser futura ni anterior al periodo declarado.',
          },
        ],
      });
    }

    const nombreTipo = obligacion.obligacionCliente.tipoObligacion.nombre;
    const detalle = [
      `Presentada el ${formatearFechaPeruana(entrada.fechaPresentacion)}`,
      entrada.numeroOrden === null ? null : `N.° de orden ${entrada.numeroOrden}`,
    ]
      .filter((parte): parte is string => parte !== null)
      .join(' · ');
    const anterior = {
      fechaPresentacion: obligacion.fechaPresentacion?.toISOString().slice(0, 10) ?? null,
      numeroOrden: obligacion.numeroOrden,
      constanciaId: obligacion.constanciaId,
    };

    await this.avances.registrar(
      obligacion.tareaId,
      {
        actividad: `Presentación de ${nombreTipo} ${obligacion.periodo}`,
        descripcion: `${detalle}.`,
        porcentaje: 100,
        minutosDedicados: 0,
        dificultades: null,
        observaciones: entrada.observaciones,
        proximoPaso: null,
        corrigeAId: null,
      },
      [constancia],
      usuario,
      contexto,
      async (tx, archivoIds) => {
        const constanciaId = archivoIds[0];

        if (constanciaId === undefined) {
          throw new Error('No se guardó la constancia de la obligación');
        }

        await tx.obligacionPeriodo.update({
          where: { id },
          data: {
            fechaPresentacion: aFechaDb(entrada.fechaPresentacion),
            numeroOrden: entrada.numeroOrden,
            constanciaId,
            observaciones: entrada.observaciones,
          },
        });

        await this.auditoria.registrar(
          {
            actor: actorDesde(usuario, contexto),
            accion: 'MODIFICAR',
            entidad: 'obligacion_periodo',
            entidadId: id,
            antes: anterior,
            despues: {
              fechaPresentacion: entrada.fechaPresentacion,
              numeroOrden: entrada.numeroOrden,
              constanciaId,
            },
            motivo: 'Presentación registrada',
          },
          tx,
        );
      },
    );

    await this.revision.enviar(obligacion.tareaId, { comentario: detalle }, usuario, contexto);
  }
}

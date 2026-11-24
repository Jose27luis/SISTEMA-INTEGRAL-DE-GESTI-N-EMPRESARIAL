import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Regla, ReglaEntrada } from '@sige/types';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { aFechaDb, aFechaIso, aFechaIsoONula, fechaHoyEnLima } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { PermisosEfectivosService } from '../access-control/effective-permissions.service';
import { actorDesde, AuditoriaService } from '../audit/audit.service';
import { AccesoClientesService } from '../clients/client-access.service';
import { AccesoTareasService } from '../tasks/task-access.service';
import { proximaOcurrencia, sumarDias } from './recurrence-rules';

function errorCampo(campo: string, mensaje: string): BadRequestException {
  return new BadRequestException({ mensaje: 'Revise los datos ingresados.', errores: [{ campo, mensaje }] });
}

@Injectable()
export class RecurrenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly accesoClientes: AccesoClientesService,
    private readonly accesoTareas: AccesoTareasService,
    private readonly permisos: PermisosEfectivosService,
  ) {}

  async listar(usuario: UsuarioAutenticado): Promise<Regla[]> {
    const hoy = fechaHoyEnLima();
    const reglas = await this.prisma.reglaRecurrencia.findMany({
      where: usuario.alcanceGlobal
        ? {}
        : {
            OR: [
              { creadoPorId: usuario.usuarioId },
              { responsableId: usuario.usuarioId },
              { cliente: this.accesoClientes.filtroVisible(usuario) },
            ],
          },
      orderBy: [{ activo: 'desc' }, { creadoEn: 'desc' }],
      include: {
        plantilla: { select: { id: true, nombre: true } },
        cliente: { select: { id: true, razonSocial: true } },
        responsable: { select: { id: true, nombre: true } },
        revisor: { select: { id: true, nombre: true } },
        _count: { select: { tareas: true } },
        tareas: { orderBy: { fechaOcurrencia: 'desc' }, take: 1, select: { fechaOcurrencia: true } },
      },
    });

    return reglas.map((regla) => {
      const ultima = regla.tareas[0]?.fechaOcurrencia;
      const siguienteALaUltima = ultima === undefined || ultima === null ? hoy : sumarDias(aFechaIso(ultima), 1);
      const desde = siguienteALaUltima > hoy ? siguienteALaUltima : hoy;
      const fechas = {
        frecuencia: regla.frecuencia,
        diaDelMes: regla.diaDelMes,
        diaDeSemana: regla.diaDeSemana,
        vigenteDesde: aFechaIso(regla.vigenteDesde),
        vigenteHasta: aFechaIsoONula(regla.vigenteHasta),
      };

      return {
        id: regla.id,
        plantilla: regla.plantilla,
        cliente: regla.cliente,
        responsable: regla.responsable,
        revisor: regla.revisor,
        ...fechas,
        activo: regla.activo,
        proximaFecha: regla.activo ? proximaOcurrencia(fechas, desde) : null,
        tareasGeneradas: regla._count.tareas,
      };
    });
  }

  async crear(entrada: ReglaEntrada, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const plantilla = await this.prisma.plantillaTarea.findUnique({
      where: { id: entrada.plantillaId },
      select: { activo: true, requiereAprobacion: true },
    });

    if (plantilla?.activo !== true) {
      throw errorCampo('plantillaId', 'Seleccione una plantilla activa.');
    }

    if (plantilla.requiereAprobacion && entrada.revisorId === null) {
      throw errorCampo('revisorId', 'La plantilla requiere aprobación: seleccione un revisor.');
    }

    if (entrada.clienteId !== null) {
      await this.accesoClientes.asegurarAcceso(usuario, entrada.clienteId, contexto);
    }

    await this.accesoTareas.asegurarParticipante(entrada.responsableId, entrada.clienteId, 'responsableId', this.prisma);

    if (entrada.revisorId !== null) {
      const nombre = await this.accesoTareas.asegurarParticipante(entrada.revisorId, entrada.clienteId, 'revisorId', this.prisma);

      if (!(await this.permisos.resolver(entrada.revisorId)).permisos.has('tarea:revisar')) {
        throw errorCampo('revisorId', `${nombre} no tiene permiso para aprobar u observar tareas.`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const regla = await tx.reglaRecurrencia.create({
        data: {
          plantillaId: entrada.plantillaId,
          clienteId: entrada.clienteId,
          responsableId: entrada.responsableId,
          revisorId: entrada.revisorId,
          frecuencia: entrada.frecuencia,
          diaDelMes: entrada.frecuencia === 'MENSUAL' ? entrada.diaDelMes : null,
          diaDeSemana: entrada.frecuencia === 'SEMANAL' ? entrada.diaDeSemana : null,
          vigenteDesde: aFechaDb(entrada.vigenteDesde),
          vigenteHasta: entrada.vigenteHasta === null ? null : aFechaDb(entrada.vigenteHasta),
          creadoPorId: usuario.usuarioId,
        },
      });

      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: 'CREAR',
          entidad: 'regla_recurrencia',
          entidadId: regla.id,
          despues: { ...entrada },
        },
        tx,
      );
    });
  }

  async cambiarActivo(id: string, activo: boolean, usuario: UsuarioAutenticado, contexto: ContextoCliente): Promise<void> {
    const regla = await this.prisma.reglaRecurrencia.findUnique({
      where: { id },
      select: { activo: true, creadoPorId: true, plantilla: { select: { activo: true } } },
    });

    if (regla === null) {
      throw new NotFoundException({ mensaje: 'La tarea recurrente no existe.', errores: [] });
    }

    if (!usuario.alcanceGlobal && regla.creadoPorId !== usuario.usuarioId) {
      throw new BadRequestException({ mensaje: 'Solo quien la creó o Gerencia puede cambiarla.', errores: [] });
    }

    if (activo && !regla.plantilla.activo) {
      throw new BadRequestException({ mensaje: 'Active primero la plantilla.', errores: [] });
    }

    if (regla.activo === activo) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reglaRecurrencia.update({ where: { id }, data: { activo } });
      await this.auditoria.registrar(
        {
          actor: actorDesde(usuario, contexto),
          accion: activo ? 'ACTIVAR' : 'DESACTIVAR',
          entidad: 'regla_recurrencia',
          entidadId: id,
          antes: { activo: regla.activo },
          despues: { activo },
        },
        tx,
      );
    });
  }
}

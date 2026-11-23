import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type AsignacionEntrada,
  type CambioEstadoCliente,
  type ClienteDetalle,
  type ClienteEntrada,
  type ContactoEntrada,
  esquemaAsignacionEntrada,
  esquemaCambioEstadoCliente,
  esquemaClienteEntrada,
  esquemaContactoEntrada,
  esquemaFiltroClientes,
  type FiltroClientes,
  type PaginaClientes,
  type ResultadoImportacion,
} from '@sige/types';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { ContextoCliente, UsuarioAutenticado } from '../../common/auth/authenticated-request';
import { Cliente, RequierePermiso, UsuarioActual } from '../../common/auth/decorators';
import { ValidacionZod } from '../../common/validation/zod-validation.pipe';
import { actorDesde } from '../audit/audit.service';
import { AccesoClientesService } from './client-access.service';
import { EquipoClienteService } from './client-team.service';
import { GestionClientesService } from './clients-command.service';
import { ConsultaClientesService, type UsuarioAsignable } from './clients-query.service';
import { ImportacionClientesService } from './import/client-import.service';

const validarId = new ValidacionZod(z.uuid());
const TAMANO_MAXIMO_EXCEL = 5 * 1024 * 1024;
const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

interface RegistroHistorialRespuesta {
  id: string;
  fecha: string;
  usuario: string | null;
  accion: string;
  entidad: string;
  motivo: string | null;
  despues: Prisma.JsonValue;
}

@Controller('clientes')
export class ClientesController {
  constructor(
    private readonly acceso: AccesoClientesService,
    private readonly consulta: ConsultaClientesService,
    private readonly gestion: GestionClientesService,
    private readonly equipo: EquipoClienteService,
    private readonly importacion: ImportacionClientesService,
  ) {}

  @Get()
  @RequierePermiso('cliente:ver')
  listar(
    @Query(new ValidacionZod(esquemaFiltroClientes)) filtro: FiltroClientes,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<PaginaClientes> {
    return this.consulta.listar(filtro, usuario);
  }

  @Get('opciones')
  @RequierePermiso('cliente:ver')
  opciones(@UsuarioActual() usuario: UsuarioAutenticado): Promise<{ id: string; nombre: string }[]> {
    return this.consulta.opciones(usuario);
  }

  @Get('usuarios-asignables')
  @RequierePermiso('cliente:ver')
  usuariosAsignables(): Promise<UsuarioAsignable[]> {
    return this.consulta.usuariosAsignables();
  }

  @Get('importacion/plantilla')
  @RequierePermiso('cliente:gestionar')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="plantilla-clientes.xlsx"')
  async plantilla(): Promise<StreamableFile> {
    return new StreamableFile(await this.importacion.generarPlantilla());
  }

  @Post('importacion')
  @HttpCode(200)
  @RequierePermiso('cliente:gestionar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO_EXCEL, files: 1 } }))
  importar(
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ResultadoImportacion> {
    if (archivo === undefined || !archivo.buffer.subarray(0, 4).equals(FIRMA_ZIP)) {
      throw new BadRequestException({
        mensaje: 'Adjunte un archivo Excel (.xlsx) de hasta 5 MB.',
        errores: [{ campo: 'archivo', mensaje: 'Seleccione la plantilla completada.' }],
      });
    }

    return this.importacion.importar(archivo.buffer, usuario, actorDesde(usuario, cliente));
  }

  @Get(':id')
  @RequierePermiso('cliente:ver')
  async obtener(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ClienteDetalle> {
    await this.acceso.asegurarAcceso(usuario, id, cliente);
    return this.consulta.obtener(id, usuario);
  }

  @Get(':id/historial')
  @RequierePermiso('cliente:ver')
  async historial(
    @Param('id', validarId) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<RegistroHistorialRespuesta[]> {
    await this.acceso.asegurarAcceso(usuario, id, cliente);
    return this.consulta.historial(id);
  }

  @Post()
  @RequierePermiso('cliente:gestionar')
  async crear(
    @Body(new ValidacionZod(esquemaClienteEntrada)) datos: ClienteEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ClienteDetalle> {
    const id = await this.gestion.crear(datos, usuario, actorDesde(usuario, cliente));
    return this.consulta.obtener(id, usuario);
  }

  @Put(':id')
  @RequierePermiso('cliente:gestionar')
  async editar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaClienteEntrada)) datos: ClienteEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ClienteDetalle> {
    await this.acceso.asegurarAcceso(usuario, id, cliente);
    await this.gestion.editar(id, datos, actorDesde(usuario, cliente));
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/estado')
  @HttpCode(200)
  @RequierePermiso('cliente:gestionar')
  async cambiarEstado(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaCambioEstadoCliente)) datos: CambioEstadoCliente,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ClienteDetalle> {
    await this.acceso.asegurarAcceso(usuario, id, cliente);
    await this.gestion.cambiarEstado(id, datos, actorDesde(usuario, cliente));
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/contactos')
  @RequierePermiso('cliente:gestionar')
  async agregarContacto(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaContactoEntrada)) datos: ContactoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ClienteDetalle> {
    await this.acceso.asegurarAcceso(usuario, id, cliente);
    await this.equipo.agregarContacto(id, datos, actorDesde(usuario, cliente));
    return this.consulta.obtener(id, usuario);
  }

  @Put(':id/contactos/:contactoId')
  @RequierePermiso('cliente:gestionar')
  async editarContacto(
    @Param('id', validarId) id: string,
    @Param('contactoId', validarId) contactoId: string,
    @Body(new ValidacionZod(esquemaContactoEntrada)) datos: ContactoEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ClienteDetalle> {
    await this.acceso.asegurarAcceso(usuario, id, cliente);
    await this.equipo.editarContacto(id, contactoId, datos, actorDesde(usuario, cliente));
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/contactos/:contactoId/desactivacion')
  @HttpCode(200)
  @RequierePermiso('cliente:gestionar')
  async desactivarContacto(
    @Param('id', validarId) id: string,
    @Param('contactoId', validarId) contactoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ClienteDetalle> {
    await this.acceso.asegurarAcceso(usuario, id, cliente);
    await this.equipo.desactivarContacto(id, contactoId, actorDesde(usuario, cliente));
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/asignaciones')
  @RequierePermiso('cliente:asignar')
  async asignar(
    @Param('id', validarId) id: string,
    @Body(new ValidacionZod(esquemaAsignacionEntrada)) datos: AsignacionEntrada,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ClienteDetalle> {
    await this.acceso.asegurarAcceso(usuario, id, cliente);
    await this.equipo.asignar(id, datos, actorDesde(usuario, cliente));
    return this.consulta.obtener(id, usuario);
  }

  @Post(':id/asignaciones/:asignacionId/retiro')
  @HttpCode(200)
  @RequierePermiso('cliente:asignar')
  async retirar(
    @Param('id', validarId) id: string,
    @Param('asignacionId', validarId) asignacionId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Cliente() cliente: ContextoCliente,
  ): Promise<ClienteDetalle> {
    await this.acceso.asegurarAcceso(usuario, id, cliente);
    await this.equipo.retirar(id, asignacionId, actorDesde(usuario, cliente));
    return this.consulta.obtener(id, usuario);
  }
}

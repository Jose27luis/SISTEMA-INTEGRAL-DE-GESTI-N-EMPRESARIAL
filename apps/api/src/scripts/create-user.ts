import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { cargarEntorno } from '../config/environment';
import { HashContrasenas } from '../modules/security/password-hasher.service';
import { esquemaContrasena } from '@sige/types';

const esquemaArgumentos = z.object({
  nombre: z.string().trim().min(3).max(120),
  correo: z.email().trim().toLowerCase(),
  rol: z.string().trim().toUpperCase(),
  contrasena: esquemaContrasena,
});

async function crearUsuario(): Promise<void> {
  z.config(z.locales.es());

  const { values } = parseArgs({
    options: {
      nombre: { type: 'string' },
      correo: { type: 'string' },
      rol: { type: 'string' },
      contrasena: { type: 'string' },
    },
  });

  const argumentos = esquemaArgumentos.parse(values);
  const entorno = cargarEntorno();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: entorno.DATABASE_URL }),
  });

  try {
    const rol = await prisma.rol.findUnique({ where: { codigo: argumentos.rol } });

    if (rol === null || !rol.activo) {
      throw new Error(`El rol ${argumentos.rol} no existe o está desactivado.`);
    }

    if ((await prisma.usuario.count({ where: { correo: argumentos.correo } })) > 0) {
      throw new Error(`Ya existe un usuario con el correo ${argumentos.correo}.`);
    }

    const hashContrasena = await new HashContrasenas().hashear(argumentos.contrasena);

    await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nombre: argumentos.nombre,
          correo: argumentos.correo,
          hashContrasena,
          roles: { create: { rolId: rol.id } },
        },
      });

      await tx.auditoria.create({
        data: {
          accion: 'CREAR',
          entidad: 'usuario',
          entidadId: usuario.id,
          despues: { nombre: argumentos.nombre, correo: argumentos.correo, roles: [rol.codigo] },
          motivo: 'Creado desde la consola del servidor',
        },
      });
    });

    process.stdout.write(`Usuario creado: ${argumentos.correo}\nRol: ${rol.nombre}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

crearUsuario().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

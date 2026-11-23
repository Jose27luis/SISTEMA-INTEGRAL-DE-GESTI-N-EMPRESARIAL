# SIGE Torres Asociados — Reglas del proyecto

Repositorio: https://github.com/Jose27luis/SISTEMA-INTEGRAL-DE-GESTI-N-EMPRESARIAL
Stack: Next.js 16 + NestJS 12 + Prisma 7 + PostgreSQL 16, monorepo pnpm + Turborepo, ejecución en Docker.
Estas reglas son obligatorias y priman sobre cualquier convención por defecto.

## Documentación

- Toda la documentación vive en `README.md`: requerimientos, arquitectura, modelo de datos,
  procesos, plan de trabajo y puesta en marcha. No se crean archivos de documentación separados.
- Todo cambio que altere lo documentado (stack, estructura, puertos, decisiones, despliegue)
  actualiza el README en el mismo trabajo.
- Los requerimientos se citan por su código (`RF-TAR-04`, `RNF-SEG-05`) y las decisiones por
  `D-NN`.

## Tipado fuerte

- `strict: true` en todos los `tsconfig.json`, con `noImplicitAny`, `strictNullChecks`,
  `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` activados.
- Prohibido `any`, `as any`, `@ts-ignore` y `@ts-expect-error`. Si un tipo no calza se
  corrige el tipo, no se silencia al compilador.
- Nada de `unknown` sin estrechar: todo dato externo (petición HTTP, respuesta de la API,
  variable de entorno) se valida con Zod o `class-validator` antes de usarse.
- Parámetros y retornos explícitamente tipados en toda función exportada.
- Los contratos compartidos entre `apps/web` y `apps/api` viven en `packages/types` como
  esquemas Zod con sus tipos inferidos. No se duplican interfaces entre aplicaciones.
- Prisma es la fuente de verdad del modelo: se usan los tipos generados, no copias a mano.
- Las variables de entorno se leen mediante un esquema tipado, nunca con `process.env.X!`.

## HTML y JSX sin placeholders

- Prohibido el atributo `placeholder` en `input`, `textarea` y `select`. Cada campo lleva
  su `label` visible y, si necesita guía, un texto auxiliar debajo del campo.
- Nada de contenido de relleno: sin lorem ipsum, sin "Título aquí", sin `href="#"`, sin
  `src=""`, sin bloques de color simulando imágenes.
- Si falta un dato real (logotipo, colores oficiales, datos de clientes) se omite el elemento
  y se consulta; no se inventa.
- Sin componentes stub ni funciones a medias: lo que entra al repositorio está implementado.

## Datos

- Ningún registro de negocio se elimina físicamente: se desactiva, archiva o anula con motivo
  y usuario (RNF-INT-01). No se escribe `delete` de Prisma sobre modelos de negocio.
- La tabla de auditoría es de solo inserción.
- Montos en `Decimal(12,2)`; fechas en UTC y presentadas en America/Lima.
- El sistema nunca almacena contraseñas, Clave SOL, claves bancarias, PIN, CVV ni tokens de
  plataformas de clientes (RF-ACC-02).

## Secretos

- `.env` y todas sus variantes quedan fuera del control de versiones. Sólo se versiona
  `.env.example`, con valores de ejemplo, nunca reales.
- Ninguna credencial, token, clave ni cadena de conexión real en el código, en los archivos
  de Compose ni en la documentación.
- Antes de cada commit se verifica que no entre ningún `.env` ni certificado.

## Commits

- Identidad del repositorio: `jose27luis <18121040@unamad.edu.pe>`, configurada a nivel local.
- Un commit por archivo modificado. No se agrupan archivos aunque compartan motivo.
- Convencionales, de una sola línea y sin cuerpo: `tipo(scope): descripción en infinitivo`.
- Tipos permitidos: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`, `build`,
  `ci`, `perf`.
- En español, máximo 72 caracteres, sin punto final.
- Sin firmas, co-autores ni referencias a herramientas de IA.
- Nunca `--no-verify`: si un hook falla se corrige la causa.
- Se trabaja directo en `main` salvo pedido explícito.

## Código

- Sin comentarios. El nombre de la función, del tipo y de la variable explican la
  intención; el porqué de un cambio va en el mensaje del commit.
- Nombres de archivos y carpetas en inglés; identificadores de dominio, textos de interfaz y
  mensajes en español.
- Principios SOLID, con énfasis en responsabilidad única: un módulo NestJS por dominio y un
  servicio por responsabilidad, nunca una clase que resuelve todo el módulo.
- La autorización se valida en el servidor en cada petición: permiso del rol y asignación
  al cliente (RNF-SEG-05). La interfaz solo oculta opciones.
- Sin soluciones temporales ni parches. Si algo no se puede resolver bien, se detiene el
  trabajo y se discute antes de codear.
- Componentes de servidor por defecto en Next.js; `"use client"` sólo donde hay estado,
  efectos o eventos del navegador.

## Flujo de trabajo

- El servidor tiene Node 18; el proyecto exige Node 22 y pnpm 11. Instalar, verificar y
  ejecutar siempre dentro de contenedores (`node:22-alpine` o los servicios de Compose),
  nunca con el Node o pnpm del sistema.
- Verificación antes de entregar: `pnpm typecheck`, `pnpm lint`, `pnpm audit --audit-level
  high` y `pnpm build` sin errores.
- Migraciones: `prisma migrate dev` durante el desarrollo, `prisma migrate deploy` en el
  arranque del contenedor.
- nginx del servidor atiende otros sitios en producción: todo cambio al vhost se valida con
  `nginx -t` antes de recargar y requiere autorización explícita.

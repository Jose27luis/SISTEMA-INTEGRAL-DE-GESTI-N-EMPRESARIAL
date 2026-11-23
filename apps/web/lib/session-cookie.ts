import 'server-only';
import { cookies } from 'next/headers';
import { COOKIE_DESAFIO, COOKIE_SESION } from './session-constants';

const SEGUNDOS_DESAFIO = 300;

const OPCIONES_BASE = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
} as const;

export async function guardarSesion(token: string, expiraEn: string): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, token, { ...OPCIONES_BASE, expires: new Date(expiraEn) });
}

export async function leerSesion(): Promise<string | null> {
  const almacen = await cookies();
  return almacen.get(COOKIE_SESION)?.value ?? null;
}

export async function eliminarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
}

export async function guardarDesafio(desafioId: string): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE_DESAFIO, desafioId, { ...OPCIONES_BASE, maxAge: SEGUNDOS_DESAFIO });
}

export async function leerDesafio(): Promise<string | null> {
  const almacen = await cookies();
  return almacen.get(COOKIE_DESAFIO)?.value ?? null;
}

export async function eliminarDesafio(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(COOKIE_DESAFIO);
}

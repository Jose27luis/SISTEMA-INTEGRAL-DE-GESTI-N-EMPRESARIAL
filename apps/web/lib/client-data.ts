import 'server-only';
import { esquemaClienteDetalle } from '@sige/types';
import { cache } from 'react';
import { type ResultadoApi, solicitarApi } from './api';
import type { ClienteDetalle } from '@sige/types';

export const obtenerCliente = cache(
  (id: string): Promise<ResultadoApi<ClienteDetalle>> =>
    solicitarApi(`/clientes/${id}`, { esquema: esquemaClienteDetalle }),
);

import type { ConfiguracionMfa } from '@sige/types';

export interface EstadoConfiguracionMfa {
  etapa: 'inicio' | 'escaneo' | 'activada';
  configuracion: ConfiguracionMfa | null;
  codigos: string[];
  mensaje: string | null;
  errorCodigo: string | null;
}

export const ESTADO_INICIAL_MFA: EstadoConfiguracionMfa = {
  etapa: 'inicio',
  configuracion: null,
  codigos: [],
  mensaje: null,
  errorCodigo: null,
};

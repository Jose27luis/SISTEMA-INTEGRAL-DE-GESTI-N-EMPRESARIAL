import { Alerta } from '@sige/ui/components';
import type { ReactNode } from 'react';

export function SinAcceso(): ReactNode {
  return (
    <Alerta tono="aviso" titulo="Sin acceso">
      Su rol no tiene permiso para ver esta sección. Si lo necesita para sus funciones, solicítelo a Gerencia
      General.
    </Alerta>
  );
}

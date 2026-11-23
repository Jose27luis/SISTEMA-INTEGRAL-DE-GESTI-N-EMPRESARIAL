import type { ReactNode } from 'react';
import { TarjetaAcceso } from '@/components/auth/access-card';

interface PropiedadesPlantillaAcceso {
  children: ReactNode;
}

export default function PlantillaAcceso({ children }: PropiedadesPlantillaAcceso): ReactNode {
  return <TarjetaAcceso>{children}</TarjetaAcceso>;
}

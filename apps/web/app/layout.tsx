import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'TORRES ASOCIADOS – Sistema de Gestión Empresarial',
  description: 'Sistema Integral de Gestión Empresarial de TORRES ASOCIADOS S.A.C.',
  robots: { index: false, follow: false },
};

interface PropiedadesLayout {
  children: ReactNode;
}

export default function LayoutRaiz({ children }: PropiedadesLayout): ReactNode {
  return (
    <html lang="es">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}

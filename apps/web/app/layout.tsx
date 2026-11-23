import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--fuente-jakarta',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--fuente-fraunces',
  display: 'swap',
});

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
    <html lang="es" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}

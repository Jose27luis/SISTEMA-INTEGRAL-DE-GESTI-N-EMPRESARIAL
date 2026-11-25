import { extensionDeNombre } from '@sige/types';
import { cn } from '@sige/ui/cn';
import { File, FileArchive, FileImage, FileSpreadsheet, FileText, FileType, type LucideIcon, Presentation } from 'lucide-react';
import type { ReactNode } from 'react';

interface EstiloArchivo {
  icono: LucideIcon;
  fondo: string;
  color: string;
  etiqueta: string;
}

const ESTILOS: Record<string, EstiloArchivo> = {
  pdf: { icono: FileType, fondo: 'bg-[#fdecea]', color: 'text-[#c5221f]', etiqueta: 'PDF' },
  doc: { icono: FileText, fondo: 'bg-[#e8f0fe]', color: 'text-[#1a56c4]', etiqueta: 'Word' },
  docx: { icono: FileText, fondo: 'bg-[#e8f0fe]', color: 'text-[#1a56c4]', etiqueta: 'Word' },
  xls: { icono: FileSpreadsheet, fondo: 'bg-[#e6f4ea]', color: 'text-[#137333]', etiqueta: 'Excel' },
  xlsx: { icono: FileSpreadsheet, fondo: 'bg-[#e6f4ea]', color: 'text-[#137333]', etiqueta: 'Excel' },
  csv: { icono: FileSpreadsheet, fondo: 'bg-[#e6f4ea]', color: 'text-[#137333]', etiqueta: 'CSV' },
  ppt: { icono: Presentation, fondo: 'bg-[#fef0e6]', color: 'text-[#c25400]', etiqueta: 'PowerPoint' },
  pptx: { icono: Presentation, fondo: 'bg-[#fef0e6]', color: 'text-[#c25400]', etiqueta: 'PowerPoint' },
  png: { icono: FileImage, fondo: 'bg-[#f3e8fd]', color: 'text-[#7b2fbf]', etiqueta: 'Imagen' },
  jpg: { icono: FileImage, fondo: 'bg-[#f3e8fd]', color: 'text-[#7b2fbf]', etiqueta: 'Imagen' },
  jpeg: { icono: FileImage, fondo: 'bg-[#f3e8fd]', color: 'text-[#7b2fbf]', etiqueta: 'Imagen' },
  webp: { icono: FileImage, fondo: 'bg-[#f3e8fd]', color: 'text-[#7b2fbf]', etiqueta: 'Imagen' },
  zip: { icono: FileArchive, fondo: 'bg-[#eef0f3]', color: 'text-[#4a5568]', etiqueta: 'ZIP' },
  txt: { icono: FileText, fondo: 'bg-[#eef0f3]', color: 'text-[#4a5568]', etiqueta: 'Texto' },
};

const GENERICO: EstiloArchivo = { icono: File, fondo: 'bg-fondo', color: 'text-apagado', etiqueta: 'Archivo' };

export function estiloArchivo(nombre: string): EstiloArchivo {
  return ESTILOS[extensionDeNombre(nombre)] ?? GENERICO;
}

export function IconoArchivo({ nombre, tamano = 'md' }: { nombre: string; tamano?: 'sm' | 'md' | 'lg' }): ReactNode {
  const { icono: Icono, fondo, color } = estiloArchivo(nombre);

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        fondo,
        color,
        tamano === 'sm' ? 'size-8' : tamano === 'md' ? 'size-10' : 'size-12',
      )}
      aria-hidden="true"
    >
      <Icono className={tamano === 'lg' ? 'size-6' : tamano === 'md' ? 'size-5' : 'size-4'} />
    </span>
  );
}

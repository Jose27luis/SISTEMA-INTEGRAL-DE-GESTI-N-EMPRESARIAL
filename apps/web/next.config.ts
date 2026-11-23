import path from 'node:path';
import type { NextConfig } from 'next';

const configuracion: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  transpilePackages: ['@sige/ui'],
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
};

export default configuracion;

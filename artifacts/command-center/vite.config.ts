import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { CLIENT } from './src/lib/client.config';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

/**
 * Injects client branding into index.html at build/serve time so that
 * index.html and index.css never need hand-editing for a new client.
 *
 * Replaces every %CLIENT_APP_NAME% placeholder and prepends a <style>
 * block that sets the --primary CSS variable from client.config.ts.
 */
function clientBrandingPlugin(): Plugin {
  return {
    name: 'client-branding',
    transformIndexHtml(html: string) {
      const branded = html.replaceAll('%CLIENT_APP_NAME%', CLIENT.appName);
      const styleBlock = `
  <style>
    /* Injected from src/lib/client.config.ts — do not edit here */
    :root { --primary: ${CLIENT.primaryHsl}; }
    .dark { --primary: ${CLIENT.primaryHslDark}; }
  </style>`;
      return branded.replace('</head>', `${styleBlock}\n  </head>`);
    },
  };
}

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    clientBrandingPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});

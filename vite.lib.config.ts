import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build del SDK.
 *  - mode "lib":   módulo ES para proyectos con bundler (React como peer dependency).
 *  - mode "embed": bundle IIFE autocontenido (incluye React) para usar con una etiqueta <script>.
 */
export default defineConfig(({ mode }) => {
  const isEmbed = mode === 'embed';
  return {
    plugins: [react()],
    define: isEmbed ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {},
    build: {
      outDir: isEmbed ? 'dist/embed' : 'dist/lib',
      emptyOutDir: true,
      sourcemap: true,
      lib: {
        entry: resolve(import.meta.dirname, isEmbed ? 'src/embed.ts' : 'src/index.ts'),
        name: 'AGIChat',
        formats: isEmbed ? ['iife'] : ['es'],
        fileName: () => (isEmbed ? 'agichat-widget.iife.js' : 'agichat-widget.js'),
        cssFileName: 'agichat-widget',
      },
      rollupOptions: {
        // En modo lib las dependencias no se empaquetan: las instala el proyecto del cliente.
        external: isEmbed
          ? []
          : [/^react(\/.*)?$/, /^react-dom(\/.*)?$/, 'react-markdown', 'remark-gfm'],
      },
    },
  };
});

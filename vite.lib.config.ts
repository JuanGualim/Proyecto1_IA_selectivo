import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Escapa los caracteres no ASCII del JS generado (`ó` → `ó`).
 * El widget se incrusta en sitios de terceros que pueden no declarar `<meta charset="utf-8">`;
 * sin esto, los textos en español y los emojis se verían corruptos.
 */
export function asciiOnly(): Plugin {
  return {
    name: 'agichat-ascii-only',
    // Se aplica en generateBundle (después de minificar), porque el minificador revierte los escapes.
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue;
        file.code = file.code.replace(
          /[\u0080-\uffff]/g,
          (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
        );
      }
    },
  };
}

/**
 * Build del SDK.
 *  - mode "lib":   módulo ES para proyectos con bundler (React como peer dependency).
 *  - mode "embed": bundle IIFE autocontenido (incluye React) para usar con una etiqueta <script>.
 */
export default defineConfig(({ mode }) => {
  const isEmbed = mode === 'embed';
  return {
    plugins: [react(), asciiOnly()],
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

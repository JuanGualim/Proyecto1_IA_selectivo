/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración de la aplicación demo (dev server + build para GitHub Pages) y de Vitest.
export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist/demo',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'mock-server/**/*.test.ts',
      'mcp-servers/**/*.test.ts',
      'agent-server/**/*.test.ts',
      'evals/**/*.test.ts',
    ],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: [
        'src/**/*.{ts,tsx}',
        'mock-server/**/*.ts',
        'mcp-servers/**/*.ts',
        'agent-server/**/*.ts',
        'evals/**/*.ts',
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/**/*.d.ts',
        'mock-server/server.ts',
        'mock-server/**/*.test.ts',
        // Puntos de entrada (solo arrancan procesos; la lógica está en módulos probados).
        'mcp-servers/*/main.ts',
        'agent-server/main.ts',
        'evals/main.ts',
        '**/*.test.ts',
        'src/embed.ts',
        'src/index.ts',
        'src/transports/index.ts',
        'src/core/types.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});

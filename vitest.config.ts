import { defineConfig } from 'vitest/config';

// Vitest "projects" replace the old vitest.workspace file.
// - packages: pure TS libraries, node environment
// - main:     Electron main/shared code, node environment
// - renderer: React code, jsdom environment
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'packages',
          environment: 'node',
          include: ['packages/*/src/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'main',
          environment: 'node',
          include: ['apps/desktop/src/{main,shared}/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['apps/desktop/src/renderer/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});

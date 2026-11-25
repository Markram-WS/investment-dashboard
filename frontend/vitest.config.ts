import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    css: true,
    // Playwright owns e2e/*.spec.ts; Vitest would mistake them for unit tests.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
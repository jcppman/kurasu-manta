import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['build/**', 'node_modules/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})

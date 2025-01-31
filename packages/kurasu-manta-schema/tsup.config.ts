import { defineConfig } from 'tsup'
export default defineConfig({
  entry: ['src/chat.ts'],
  format: ['cjs', 'esm'],
  outDir: 'build',
  dts: true,
})

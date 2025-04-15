import { defineConfig } from 'tsup'
export default defineConfig({
  entry: [
    'src/zod/**/*.ts',
    'src/drizzle/**/*.ts',
    'src/mapper/**/*.ts',
    'src/repository/**/*.ts',
    'src/service/**/*.ts',
  ],
  format: ['cjs', 'esm'],
  outDir: 'build',
  dts: true,
})

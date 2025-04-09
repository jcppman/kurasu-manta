import { defineConfig } from 'tsup'
export default defineConfig({
  entry: [
    'src/zod/**/*.ts',
    'src/drizzle/**/*.ts',
    'src/mappers/**/*.ts',
    'src/repository/**/*.ts',
  ],
  format: ['cjs', 'esm'],
  outDir: 'build',
  dts: true,
})

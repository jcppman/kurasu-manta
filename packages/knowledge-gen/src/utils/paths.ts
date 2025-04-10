import path from 'node:path'

// Resolve paths relative to project root
export const resolveDataPath = (...paths: string[]) => {
  return path.join(__dirname, '../../data', ...paths)
}

import env from './env'

export const generateAPIUrl = (relativePath: string) => {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`

  return env.EXPO_PUBLIC_MANTA_API_URL.concat(path)
}

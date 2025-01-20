import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export default createEnv({
  clientPrefix: 'EXPO_PUBLIC',
  client: {
    EXPO_PUBLIC_MANTA_API_URL: z.string(),
  },
  runtimeEnvStrict: {
    EXPO_PUBLIC_MANTA_API_URL: process.env.EXPO_PUBLIC_MANTA_API_URL,
  },
})

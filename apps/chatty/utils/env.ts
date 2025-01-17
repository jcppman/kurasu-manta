import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export default createEnv({
  clientPrefix: 'EXPO_PUBLIC',
  client: {
    EXPO_PUBLIC_CHATTY_API_URL: z.string(),
  },
  runtimeEnv: process.env,
})

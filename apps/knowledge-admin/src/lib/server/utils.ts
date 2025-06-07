import 'server-only'
import pino from 'pino'
import { LOG_LEVEL } from './constants'

export const logger = pino({
  level: LOG_LEVEL || 'info',
})

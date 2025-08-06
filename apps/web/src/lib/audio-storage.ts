import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './env'

function calculateSHA1(buffer: Buffer): string {
  const hash = createHash('sha1')
  hash.update(buffer)
  return hash.digest('hex')
}

export interface AudioStorage {
  getAudioFile(hash: string): Promise<Buffer | null>
  storeAudioFile(hash: string, content: Buffer): Promise<void>
  storeAudioWithHash(content: Buffer): Promise<string>
}

export class LocalAudioStorage implements AudioStorage {
  constructor(private baseDir: string) {}

  async getAudioFile(hash: string): Promise<Buffer | null> {
    const filePath = this.getFilePath(hash)

    if (!existsSync(filePath)) {
      return null
    }

    try {
      return readFileSync(filePath)
    } catch (error) {
      console.error(`Failed to read audio file ${hash}:`, error)
      return null
    }
  }

  async storeAudioFile(hash: string, content: Buffer): Promise<void> {
    const filePath = this.getFilePath(hash)
    const dir = join(this.baseDir, hash.slice(0, 2))

    // Ensure directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    try {
      writeFileSync(filePath, content)
    } catch (error) {
      console.error(`Failed to store audio file ${hash}:`, error)
      throw error
    }
  }

  async storeAudioWithHash(content: Buffer): Promise<string> {
    const hash = calculateSHA1(content)
    await this.storeAudioFile(hash, content)
    return hash
  }

  private getFilePath(hash: string): string {
    const prefix = hash.slice(0, 2)
    const filename = `${hash}.mp3`
    return join(this.baseDir, prefix, filename)
  }
}

export class S3AudioStorage implements AudioStorage {
  async getAudioFile(hash: string): Promise<Buffer | null> {
    // TODO: Implement S3 retrieval
    throw new Error('S3 storage not implemented yet')
  }

  async storeAudioFile(hash: string, content: Buffer): Promise<void> {
    // TODO: Implement S3 storage
    throw new Error('S3 storage not implemented yet')
  }

  async storeAudioWithHash(content: Buffer): Promise<string> {
    const hash = calculateSHA1(content)
    await this.storeAudioFile(hash, content)
    return hash
  }
}

export function getAudioStorage(): AudioStorage {
  if (config.audio.useS3InProduction) {
    // TODO: Enable S3 storage in production
    // return new S3AudioStorage()
    throw new Error('Production storage not implemented yet - using local storage')
  }

  return new LocalAudioStorage(config.audio.localStorageDir)
}

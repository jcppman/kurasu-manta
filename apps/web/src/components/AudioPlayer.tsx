'use client'

import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface AudioPlayerProps {
  audioHash: string
  className?: string
  preload?: boolean
}

export function AudioPlayer({ audioHash, className = '', preload = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const audioUrl = `/api/audio/${audioHash}`

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return

    try {
      if (isPlaying) {
        audio.pause()
      } else {
        setIsLoading(true)
        await audio.play()
      }
    } catch (error) {
      console.error('Audio playback error:', error)
      setHasError(true)
      setIsPlaying(false)
      setIsLoading(false)
    }
  }

  const getIcon = () => {
    if (hasError) return VolumeX
    if (isPlaying) return Pause
    return Play
  }

  const Icon = getIcon()

  return (
    <div className={`inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={togglePlayback}
        disabled={isLoading || hasError}
        className={`
          p-1 rounded-full transition-colors
          ${
            hasError
              ? 'text-red-400 cursor-not-allowed'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          }
          ${isLoading ? 'opacity-50 cursor-wait' : ''}
        `}
        title={hasError ? 'Audio not available' : isPlaying ? 'Pause audio' : 'Play audio'}
      >
        <Icon size={16} />
      </button>

      {/* biome-ignore lint/a11y/useMediaCaption: Pronunciation audio doesn't need captions */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload={preload ? 'auto' : 'none'}
        aria-label="Pronunciation audio"
        onLoadStart={() => {
          setIsLoading(true)
        }}
        onCanPlay={() => {
          setIsLoading(false)
        }}
        onPlaying={() => {
          setIsPlaying(true)
          setIsLoading(false)
        }}
        onPause={() => {
          setIsPlaying(false)
        }}
        onEnded={() => {
          setIsPlaying(false)
        }}
        onError={(e) => {
          setHasError(true)
          setIsLoading(false)
        }}
        onSuspend={() => {
          setIsPlaying(false)
          setIsLoading(false)
        }}
      />
    </div>
  )
}

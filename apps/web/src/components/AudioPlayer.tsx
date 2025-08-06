'use client'

import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface AudioPlayerProps {
  audioHash: string
  className?: string
}

export function AudioPlayer({ audioHash, className = '' }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const audioUrl = `/api/audio/${audioHash}`

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadStart = () => setIsLoading(true)
    const handleCanPlay = () => {
      setIsLoading(false)
      setHasError(false)
    }
    const handleError = () => {
      setIsLoading(false)
      setHasError(true)
      setIsPlaying(false)
    }
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('error', handleError)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return

    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        await audio.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error('Audio playback error:', error)
      setHasError(true)
      setIsPlaying(false)
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
      <audio ref={audioRef} src={audioUrl} preload="none" aria-label="Pronunciation audio" />
    </div>
  )
}

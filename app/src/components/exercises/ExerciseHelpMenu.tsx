// C:\Users\kitin\Documents\GitHub\academy\app\src\components\exercises\ExerciseHelpMenu.tsx

import { useEffect, useRef, useState } from 'react'
import { HelpCircle, Image as ImageIcon, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildGoogleImagesUrl, buildYouTubeUrl } from '@/lib/exerciseHelp'

type ExerciseHelpMenuProps = {
  exerciseName: string
  aliases?: string[] | null
  className?: string
  buttonLabel?: string
  buttonClassName?: string
}

export function ExerciseHelpMenu({
  exerciseName,
  aliases,
  className = '',
  buttonLabel = 'Como fazer',
  buttonClassName = '',
}: ExerciseHelpMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpenImages = () => {
    const url = buildGoogleImagesUrl(exerciseName, aliases)
    window.open(url, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  const handleOpenVideo = () => {
    const url = buildYouTubeUrl(exerciseName, aliases)
    window.open(url, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className={`relative inline-flex ${className}`}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={`gap-2 ${buttonClassName}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <HelpCircle className="h-4 w-4" />
        {buttonLabel}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-xl border border-border bg-card p-2 shadow-2xl">
          <button
            type="button"
            onClick={handleOpenImages}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white transition hover:bg-muted/40"
          >
            <ImageIcon className="h-4 w-4 text-primary" />
            Ver imagens
          </button>

          <button
            type="button"
            onClick={handleOpenVideo}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white transition hover:bg-muted/40"
          >
            <Video className="h-4 w-4 text-primary" />
            Ver vídeo
          </button>
        </div>
      )}
    </div>
  )
}

export default ExerciseHelpMenu

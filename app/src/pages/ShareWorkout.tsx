import { useEffect, useMemo, useRef, useState } from 'react'
import { Share2, Download, Camera, User, Dumbbell, Heart, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { WorkoutSession, CardioSession, WeekDay } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { calculateWorkoutVolume } from '@/lib/calculations'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { parseLocalDate } from '@/lib/date'

interface ShareWorkoutProps {
  workouts: WorkoutSession[]
  cardio?: CardioSession[]
  selectedUserId?: string | null
  selectedUserLabel?: string | null
}

type DbWorkoutRow = {
  id: string
  user_id: string
  session_date: string
  weekday: number | null
  total_volume: number | null
  exercises: any[] | null
  created_at: string | null
}

function safeNumber(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : 0
}

function weekdayNumberToLabel(weekday?: number | null): WeekDay {
  const map: Record<number, WeekDay> = {
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado',
    7: 'Domingo',
  }
  return map[weekday ?? 1] ?? 'Segunda'
}

function safeDate(date?: string | null) {
  return parseLocalDate(date)
}

function formatDateSafe(date?: string | null, pattern = "dd 'de' MMMM") {
  const parsed = safeDate(date)
  if (!parsed) return '--'
  return format(parsed, pattern, { locale: ptBR })
}

export function ShareWorkout({
  workouts,
  selectedUserId,
  selectedUserLabel,
}: ShareWorkoutProps) {
  const { user } = useAuth()

  const effectiveUserId = selectedUserId || user?.id || null
  const isStudentMode = !!selectedUserId

  const [selectedWorkoutId, setSelectedWorkoutId] = useState('')
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'blue' | 'purple' | 'green'>('dark')
  const [dbWorkouts, setDbWorkouts] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadStudentWorkouts = async () => {
      if (!effectiveUserId) return

      if (!isStudentMode) {
        setDbWorkouts([])
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('workout_sessions')
          .select('id,user_id,session_date,weekday,total_volume,exercises,created_at')
          .eq('user_id', effectiveUserId)
          .order('session_date', { ascending: false })

        if (error) throw error

        const mapped: WorkoutSession[] = ((data ?? []) as DbWorkoutRow[]).map((row) => ({
          id: row.id,
          date: row.session_date,
          weekDay: weekdayNumberToLabel(row.weekday),
          exercises: Array.isArray(row.exercises) ? row.exercises : [],
          totalVolume: safeNumber(row.total_volume),
          duration: undefined,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        }))

        setDbWorkouts(mapped)
      } catch (e: any) {
        toast.error(e?.message ?? 'Erro ao carregar treinos para compartilhamento.')
        setDbWorkouts([])
      } finally {
        setLoading(false)
      }
    }

    void loadStudentWorkouts()
  }, [effectiveUserId, isStudentMode])

  const effectiveWorkouts = isStudentMode ? dbWorkouts : workouts

  const recentWorkouts = useMemo(() => {
    return [...effectiveWorkouts]
      .sort((a, b) => {
        const da = safeDate(a.date)?.getTime() ?? 0
        const db = safeDate(b.date)?.getTime() ?? 0
        return db - da
      })
      .slice(0, 10)
  }, [effectiveWorkouts])

  const selectedWorkout = useMemo(() => {
    return effectiveWorkouts.find((w) => w.id === selectedWorkoutId)
  }, [effectiveWorkouts, selectedWorkoutId])

  const selectedWorkoutVolume = useMemo(() => {
    if (!selectedWorkout) return 0
    return calculateWorkoutVolume(selectedWorkout)
  }, [selectedWorkout])

  const totalSets = useMemo(() => {
    if (!selectedWorkout) return 0
    return selectedWorkout.exercises.reduce((sum, e) => sum + e.sets.length, 0)
  }, [selectedWorkout])

  const avgRpe = useMemo(() => {
    if (!selectedWorkout || selectedWorkout.exercises.length === 0) return 0
    const total = selectedWorkout.exercises.reduce((sum, e) => sum + (Number.isFinite(e.rpe) ? e.rpe : 0), 0)
    return Math.round((total / selectedWorkout.exercises.length) * 10) / 10
  }, [selectedWorkout])

  const topExercises = useMemo(() => {
    if (!selectedWorkout) return []
    return selectedWorkout.exercises.slice(0, 4)
  }, [selectedWorkout])

  const themeStyles = {
    dark: 'bg-gradient-to-br from-gray-950 via-slate-900 to-black text-white',
    blue: 'bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950 text-white',
    purple: 'bg-gradient-to-br from-purple-700 via-fuchsia-700 to-slate-950 text-white',
    green: 'bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-950 text-white',
  }

  const handleDownload = async () => {
    if (!selectedWorkout) return

    try {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
          <rect width="100%" height="100%" fill="url(#grad)"/>
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${selectedTheme === 'blue' ? '#1d4ed8' : selectedTheme === 'purple' ? '#7e22ce' : selectedTheme === 'green' ? '#047857' : '#111827'}" />
              <stop offset="100%" stop-color="${selectedTheme === 'blue' ? '#020617' : selectedTheme === 'purple' ? '#111827' : selectedTheme === 'green' ? '#0f172a' : '#000000'}" />
            </linearGradient>
          </defs>

          <text x="80" y="110" fill="white" font-size="42" font-family="Arial" font-weight="700">
            FITTRACK
          </text>

          <text x="80" y="190" fill="rgba(255,255,255,0.72)" font-size="30" font-family="Arial">
            TREINO ${selectedWorkout.weekDay.toUpperCase()}
          </text>

          <text x="80" y="245" fill="white" font-size="68" font-family="Arial" font-weight="700">
            ${(selectedWorkoutVolume / 1000).toFixed(1)}k kg
          </text>

          <text x="80" y="292" fill="rgba(255,255,255,0.72)" font-size="28" font-family="Arial">
            volume total
          </text>

          <rect x="80" y="350" rx="24" ry="24" width="920" height="150" fill="rgba(255,255,255,0.08)"/>
          <text x="140" y="415" fill="white" font-size="42" font-family="Arial" font-weight="700">${selectedWorkout.exercises.length}</text>
          <text x="140" y="455" fill="rgba(255,255,255,0.72)" font-size="24" font-family="Arial">exercícios</text>

          <text x="430" y="415" fill="white" font-size="42" font-family="Arial" font-weight="700">${totalSets}</text>
          <text x="430" y="455" fill="rgba(255,255,255,0.72)" font-size="24" font-family="Arial">séries</text>

          <text x="720" y="415" fill="white" font-size="42" font-family="Arial" font-weight="700">${avgRpe || '--'}</text>
          <text x="720" y="455" fill="rgba(255,255,255,0.72)" font-size="24" font-family="Arial">RPE médio</text>

          <text x="80" y="585" fill="rgba(255,255,255,0.72)" font-size="26" font-family="Arial">
            ${formatDateSafe(selectedWorkout.date)}
          </text>

          ${topExercises
            .map((exercise, index) => {
              const y = 660 + index * 125
              const sets = exercise.sets.length
              const reps = exercise.sets[0]?.reps ?? '-'
              const weight = exercise.sets[0]?.weight ?? 0
              return `
                <rect x="80" y="${y - 48}" rx="20" ry="20" width="920" height="92" fill="rgba(255,255,255,0.06)"/>
                <text x="110" y="${y}" fill="white" font-size="30" font-family="Arial" font-weight="700">
                  ${String(exercise.exerciseName || 'Exercício').slice(0, 38)}
                </text>
                <text x="110" y="${y + 34}" fill="rgba(255,255,255,0.72)" font-size="22" font-family="Arial">
                  ${sets} séries • ${reps} reps • ${weight} kg
                </text>
              `
            })
            .join('')}

          <text x="80" y="1260" fill="rgba(255,255,255,0.52)" font-size="24" font-family="Arial">
            Compartilhado via FitTrack
          </text>
        </svg>
      `

      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `treino-${selectedWorkout.date || 'hoje'}.svg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Imagem baixada!')
    } catch {
      toast.error('Erro ao gerar imagem')
    }
  }

  const handleShareText = async () => {
    if (!selectedWorkout) return

    const text = `💪 Treino de ${selectedWorkout.weekDay} finalizado!

📅 ${formatDateSafe(selectedWorkout.date)}
📊 Volume: ${(selectedWorkoutVolume / 1000).toFixed(1)}k kg
🏋️ ${selectedWorkout.exercises.length} exercícios
🔥 ${totalSets} séries
⚡ RPE médio: ${avgRpe || '--'}

${selectedWorkout.exercises
  .slice(0, 6)
  .map((e) => `• ${e.exerciseName}: ${e.sets.length}x${e.sets[0]?.reps ?? '-'} @ ${e.sets[0]?.weight ?? 0}kg`)
  .join('\n')}`

    try {
      await navigator.clipboard.writeText(text)
      toast.success('Texto copiado! Cole no Instagram/WhatsApp')
    } catch {
      toast.error('Não foi possível copiar o texto.')
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Compartilhar Treino</h1>
          <p className="text-muted-foreground">
            {isStudentMode
              ? 'Monte um card com os treinos do aluno selecionado'
              : 'Monte um card para compartilhar seu treino'}
          </p>

          {isStudentMode && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              <User className="h-4 w-4" />
              <span>
                Visualizando dados de: <strong>{selectedUserLabel || 'Aluno selecionado'}</strong>
              </span>
            </div>
          )}

          {isStudentMode && loading && (
            <p className="mt-2 text-sm text-muted-foreground">Carregando treinos do aluno...</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Camera className="w-5 h-5 text-primary" />
              Configuração
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Selecionar treino</Label>
              <Select value={selectedWorkoutId} onValueChange={setSelectedWorkoutId}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Escolha um treino" />
                </SelectTrigger>
                <SelectContent>
                  {recentWorkouts.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {formatDateSafe(w.date, 'dd/MM')} • {w.weekDay} • {w.exercises.length} exercícios
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Tema</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['dark', 'blue', 'purple', 'green'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setSelectedTheme(theme)}
                    className={`h-12 rounded-lg transition-all ${themeStyles[theme]} ${
                      selectedTheme === theme ? 'scale-105 ring-2 ring-white' : 'opacity-70'
                    }`}
                  />
                ))}
              </div>
            </div>

            {selectedWorkout && (
              <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-white">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{formatDateSafe(selectedWorkout.date)}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <div className="text-lg font-bold text-white">{selectedWorkout.exercises.length}</div>
                    <div className="text-[11px] text-muted-foreground">Exercícios</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <div className="text-lg font-bold text-white">{totalSets}</div>
                    <div className="text-[11px] text-muted-foreground">Séries</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <div className="text-lg font-bold text-white">{avgRpe || '--'}</div>
                    <div className="text-[11px] text-muted-foreground">RPE</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleDownload}
                className="flex-1 gap-2"
                disabled={!selectedWorkout}
              >
                <Download className="w-4 h-4" />
                Baixar
              </Button>

              <Button
                onClick={handleShareText}
                variant="outline"
                className="flex-1 gap-2"
                disabled={!selectedWorkout}
              >
                <Share2 className="w-4 h-4" />
                Copiar texto
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white">Preview</CardTitle>
          </CardHeader>

          <CardContent>
            {selectedWorkout ? (
              <div
                ref={canvasRef}
                className={`mx-auto w-full max-w-[520px] rounded-[28px] p-6 md:p-8 ${themeStyles[selectedTheme]}`}
              >
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/60">FitTrack</p>
                      <h2 className="mt-2 text-2xl font-bold">Treino {selectedWorkout.weekDay}</h2>
                      <p className="mt-1 text-sm text-white/70">{formatDateSafe(selectedWorkout.date)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3">
                      <Dumbbell className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/10 p-5">
                    <div className="text-sm text-white/70">Volume total</div>
                    <div className="mt-2 text-4xl font-bold">
                      {(selectedWorkoutVolume / 1000).toFixed(1)}k
                    </div>
                    <div className="text-sm text-white/70">kg</div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-white/8 p-4 text-center">
                      <div className="text-2xl font-bold">{selectedWorkout.exercises.length}</div>
                      <div className="mt-1 text-xs text-white/65">Exercícios</div>
                    </div>
                    <div className="rounded-2xl bg-white/8 p-4 text-center">
                      <div className="text-2xl font-bold">{totalSets}</div>
                      <div className="mt-1 text-xs text-white/65">Séries</div>
                    </div>
                    <div className="rounded-2xl bg-white/8 p-4 text-center">
                      <div className="text-2xl font-bold">{avgRpe || '--'}</div>
                      <div className="mt-1 text-xs text-white/65">RPE Médio</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {topExercises.map((exercise, index) => (
                      <div
                        key={`${exercise.id}-${index}`}
                        className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {exercise.exerciseName}
                            </div>
                            <div className="mt-1 text-xs text-white/65">
                              {exercise.sets.length} séries • {exercise.sets[0]?.reps ?? '-'} reps • {exercise.sets[0]?.weight ?? 0} kg
                            </div>
                          </div>
                          <Badge variant="secondary" className="shrink-0 bg-white/10 text-white border-white/10">
                            #{index + 1}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Heart className="h-4 w-4" />
                      <span>Resumo</span>
                    </div>
                    <p className="mt-2 text-sm text-white/90">
                      {selectedWorkout.exercises.length} exercícios realizados com {totalSets} séries no total.
                    </p>
                  </div>

                  <div className="text-center text-xs text-white/45">
                    Compartilhado via FitTrack
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center rounded-2xl bg-muted">
                <p className="text-muted-foreground">
                  {loading ? 'Carregando treinos...' : 'Selecione um treino para ver o preview'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedWorkout && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white">Legendas prontas</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="mb-2 text-sm text-muted-foreground">Instagram</p>
              <p className="whitespace-pre-line text-white">
                {`💪 Treino ${selectedWorkout.weekDay} finalizado!

📅 ${formatDateSafe(selectedWorkout.date)}
📊 Volume: ${(selectedWorkoutVolume / 1000).toFixed(1)}k kg
🏋️ ${selectedWorkout.exercises.length} exercícios
🔥 ${totalSets} séries

#fitness #academia #treino #fittrack`}
              </p>
            </div>

            <div className="rounded-lg bg-muted p-4">
              <p className="mb-2 text-sm text-muted-foreground">WhatsApp</p>
              <p className="whitespace-pre-line text-white">
                {`Treino de ${selectedWorkout.weekDay}: ${selectedWorkout.exercises.map((e) => e.exerciseName).join(', ')}
Volume total: ${(selectedWorkoutVolume / 1000).toFixed(1)}k kg 💪`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && recentWorkouts.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum treino encontrado para compartilhar
          </CardContent>
        </Card>
      )}
    </div>
  )
}
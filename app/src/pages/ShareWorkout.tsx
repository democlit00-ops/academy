//academy\app\src\pages\ShareWorkout.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Share2,
  Download,
  Camera,
  User,
  Dumbbell,
  Heart,
  CalendarDays,
  Bot,
  MessageCircle,
  CheckSquare,
} from 'lucide-react'
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

function normalizeWeekDayLabel(value?: string | number | null, date?: string | null): string {
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim()
    const numeric = Number(trimmed)
    if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= 7) {
      return weekdayNumberToLabel(numeric)
    }
    return trimmed
  }

  if (typeof value === 'number' && value >= 1 && value <= 7) {
    return weekdayNumberToLabel(value)
  }

  const parsed = safeDate(date)
  if (parsed) {
    const jsDay = parsed.getDay()
    const iso = jsDay === 0 ? 7 : jsDay
    return weekdayNumberToLabel(iso)
  }

  return 'Segunda'
}

function safeDate(date?: string | null) {
  return parseLocalDate(date)
}

function formatDateSafe(date?: string | null, pattern = "dd 'de' MMMM") {
  const parsed = safeDate(date)
  if (!parsed) return '--'
  return format(parsed, pattern, { locale: ptBR })
}

function getWorkoutTitle(workout?: WorkoutSession | null) {
  if (!workout) return 'Treino do dia'
  const weekDay = normalizeWeekDayLabel((workout as any).weekDay, workout.date)
  return `Treino ${weekDay.toLowerCase()}`
}

function getWorkoutDisplayDay(workout?: WorkoutSession | null) {
  if (!workout) return '--'
  return normalizeWeekDayLabel((workout as any).weekDay, workout.date)
}

function escapeXml(text: string) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function ShareWorkout({
  workouts,
  cardio = [],
  selectedUserId,
  selectedUserLabel,
}: ShareWorkoutProps) {
  const { user } = useAuth()

  const effectiveUserId = selectedUserId || user?.id || null
  const isStudentMode = !!selectedUserId

  const [selectedWorkoutId, setSelectedWorkoutId] = useState('')
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<string[]>([])
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

  useEffect(() => {
    if (!selectedWorkoutId && recentWorkouts.length > 0) {
      const firstId = recentWorkouts[0].id
      setSelectedWorkoutId(firstId)
      setSelectedWorkoutIds([firstId])
    }
  }, [recentWorkouts, selectedWorkoutId])

  const selectedWorkout = useMemo(() => {
    return effectiveWorkouts.find((w) => w.id === selectedWorkoutId) ?? null
  }, [effectiveWorkouts, selectedWorkoutId])

  const selectedWorkoutTitle = useMemo(() => getWorkoutTitle(selectedWorkout), [selectedWorkout])



  const totalSets = useMemo(() => {
    if (!selectedWorkout) return 0
    return selectedWorkout.exercises.reduce((sum, e) => sum + (e.sets?.length ?? 0), 0)
  }, [selectedWorkout])

  const avgRpe = useMemo(() => {
    if (!selectedWorkout || selectedWorkout.exercises.length === 0) return 0
    const total = selectedWorkout.exercises.reduce((sum, e) => sum + (Number.isFinite(e.rpe) ? e.rpe : 0), 0)
    return Math.round((total / selectedWorkout.exercises.length) * 10) / 10
  }, [selectedWorkout])

  const matchedCardio = useMemo(() => {
    if (!selectedWorkout) return null
    return cardio.find((c) => c.date === selectedWorkout.date) ?? null
  }, [cardio, selectedWorkout])

  const selectedWorkoutsForCard = useMemo(() => {
    const set = new Set(selectedWorkoutIds)
    return recentWorkouts.filter((w) => set.has(w.id))
  }, [recentWorkouts, selectedWorkoutIds])

  const combinedStats = useMemo(() => {
    if (selectedWorkoutsForCard.length === 0) {
      return {
        workoutCount: 0,
        totalExercises: 0,
        totalSets: 0,
        totalVolume: 0,
        avgRpe: 0,
        startDate: null as string | null,
        endDate: null as string | null,
      }
    }

    const sorted = [...selectedWorkoutsForCard].sort((a, b) => {
      const da = safeDate(a.date)?.getTime() ?? 0
      const db = safeDate(b.date)?.getTime() ?? 0
      return da - db
    })

    const totalExercises = selectedWorkoutsForCard.reduce(
      (sum, workout) => sum + workout.exercises.length,
      0
    )

    const totalSets = selectedWorkoutsForCard.reduce(
      (sum, workout) =>
        sum + workout.exercises.reduce((inner, exercise) => inner + (exercise.sets?.length ?? 0), 0),
      0
    )

    const totalVolume = selectedWorkoutsForCard.reduce(
      (sum, workout) => sum + calculateWorkoutVolume(workout),
      0
    )

    const allRpes = selectedWorkoutsForCard.flatMap((workout) =>
      workout.exercises
        .map((exercise) => (Number.isFinite(exercise?.rpe) ? exercise.rpe : null))
        .filter((value): value is number => value !== null)
    )

    const avgRpe =
      allRpes.length > 0
        ? Math.round((allRpes.reduce((sum, value) => sum + value, 0) / allRpes.length) * 10) / 10
        : 0

    return {
      workoutCount: selectedWorkoutsForCard.length,
      totalExercises,
      totalSets,
      totalVolume,
      avgRpe,
      startDate: sorted[0]?.date ?? null,
      endDate: sorted[sorted.length - 1]?.date ?? null,
    }
  }, [selectedWorkoutsForCard])

  const groupedCardioForSelected = useMemo(() => {
    const byDate = new Map<string, CardioSession>()
    for (const c of cardio) {
      if (!byDate.has(c.date)) byDate.set(c.date, c)
    }
    return selectedWorkoutsForCard
      .map((workout) => ({
        workout,
        cardio: byDate.get(workout.date) ?? null,
      }))
  }, [cardio, selectedWorkoutsForCard])

  const themeStyles = {
    dark: 'bg-gradient-to-br from-[#020617] via-[#08112b] to-[#000000] text-white',
    blue: 'bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950 text-white',
    purple: 'bg-gradient-to-br from-purple-700 via-fuchsia-700 to-slate-950 text-white',
    green: 'bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-950 text-white',
  }

  const toggleWorkoutSelection = (workoutId: string) => {
    setSelectedWorkoutIds((prev) => {
      if (prev.includes(workoutId)) {
        const next = prev.filter((id) => id !== workoutId)
        return next.length === 0 ? [workoutId] : next
      }
      return [...prev, workoutId]
    })
  }

  const periodText =
    combinedStats.startDate && combinedStats.endDate
      ? combinedStats.startDate === combinedStats.endDate
        ? formatDateSafe(combinedStats.startDate)
        : `${formatDateSafe(combinedStats.startDate, 'dd/MM')} até ${formatDateSafe(combinedStats.endDate, 'dd/MM')}`
      : '--'

  const handleDownload = async () => {
    if (selectedWorkoutsForCard.length === 0) return

    try {
      const workoutLines = selectedWorkoutsForCard
        .slice(0, 6)
        .map((workout, index) => {
          const y = 720 + index * 90
          const volume = calculateWorkoutVolume(workout)
          return `
            <rect x="80" y="${y - 42}" rx="18" ry="18" width="920" height="68" fill="rgba(255,255,255,0.06)"/>
            <text x="110" y="${y - 2}" fill="white" font-size="26" font-family="Arial" font-weight="700">
              ${escapeXml(`${index + 1}. ${String(getWorkoutTitle(workout)).slice(0, 34)}`)}
            </text>
            <text x="110" y="${y + 24}" fill="rgba(255,255,255,0.70)" font-size="18" font-family="Arial">
              ${escapeXml(`${formatDateSafe(workout.date, 'dd/MM')} • ${workout.exercises.length} exercícios • ${(volume / 1000).toFixed(1)}k kg`)}
            </text>
          `
        })
        .join('')

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
          <rect width="100%" height="100%" fill="url(#grad)"/>
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${selectedTheme === 'blue' ? '#1d4ed8' : selectedTheme === 'purple' ? '#7e22ce' : selectedTheme === 'green' ? '#047857' : '#020617'}" />
              <stop offset="100%" stop-color="${selectedTheme === 'blue' ? '#020617' : selectedTheme === 'purple' ? '#111827' : selectedTheme === 'green' ? '#0f172a' : '#000000'}" />
            </linearGradient>
          </defs>

          <text x="80" y="110" fill="white" font-size="42" font-family="Arial" font-weight="700">
            ACADEMYK
          </text>

          <text x="80" y="180" fill="rgba(255,255,255,0.72)" font-size="30" font-family="Arial">
            RESUMO DE TREINOS
          </text>

          <text x="80" y="235" fill="white" font-size="64" font-family="Arial" font-weight="700">
            ${combinedStats.workoutCount} treinos
          </text>

          <text x="80" y="280" fill="rgba(255,255,255,0.72)" font-size="24" font-family="Arial">
            ${escapeXml(periodText)}
          </text>

          <rect x="80" y="340" rx="24" ry="24" width="920" height="210" fill="rgba(255,255,255,0.08)"/>

          <text x="130" y="410" fill="white" font-size="40" font-family="Arial" font-weight="700">${combinedStats.totalExercises}</text>
          <text x="130" y="448" fill="rgba(255,255,255,0.72)" font-size="22" font-family="Arial">exercícios</text>

          <text x="360" y="410" fill="white" font-size="40" font-family="Arial" font-weight="700">${combinedStats.totalSets}</text>
          <text x="360" y="448" fill="rgba(255,255,255,0.72)" font-size="22" font-family="Arial">séries</text>

          <text x="590" y="410" fill="white" font-size="40" font-family="Arial" font-weight="700">${(combinedStats.totalVolume / 1000).toFixed(1)}k</text>
          <text x="590" y="448" fill="rgba(255,255,255,0.72)" font-size="22" font-family="Arial">kg total</text>

          <text x="820" y="410" fill="white" font-size="40" font-family="Arial" font-weight="700">${combinedStats.avgRpe || '--'}</text>
          <text x="820" y="448" fill="rgba(255,255,255,0.72)" font-size="22" font-family="Arial">RPE médio</text>

          <text x="80" y="635" fill="rgba(255,255,255,0.72)" font-size="26" font-family="Arial">
            Treinos incluídos
          </text>

          ${workoutLines}

          <text x="80" y="1280" fill="rgba(255,255,255,0.52)" font-size="24" font-family="Arial">
            Compartilhado via AcademyK
          </text>
        </svg>
      `

      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)

      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 1080
        canvas.height = 1350

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          toast.error('Erro ao gerar PNG')
          return
        }

        ctx.drawImage(img, 0, 0)

        canvas.toBlob((pngBlob) => {
          if (!pngBlob) {
            URL.revokeObjectURL(url)
            toast.error('Erro ao gerar PNG')
            return
          }

          const pngUrl = URL.createObjectURL(pngBlob)
          const a = document.createElement('a')
          a.href = pngUrl
          a.download = `resumo-treinos-${combinedStats.workoutCount}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)

          URL.revokeObjectURL(pngUrl)
          URL.revokeObjectURL(url)
          toast.success('Card social em PNG baixado!')
        }, 'image/png')
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        toast.error('Erro ao converter imagem para PNG')
      }

      img.src = url
    } catch {
      toast.error('Erro ao gerar imagem')
    }
  }

  const handleShareText = async () => {
    if (selectedWorkoutsForCard.length === 0) return

    const treinoLines = selectedWorkoutsForCard.map((workout) => {
      const volume = calculateWorkoutVolume(workout)
      return `• ${getWorkoutTitle(workout)} (${formatDateSafe(workout.date, 'dd/MM')}): ${workout.exercises.length} exercícios • ${(volume / 1000).toFixed(1)}k kg`
    })

    const text = `💪 Resumo de ${combinedStats.workoutCount} treino(s)!

📅 ${periodText}
📊 Volume: ${(combinedStats.totalVolume / 1000).toFixed(1)}k kg
🏋️ ${combinedStats.totalExercises} exercícios
🔥 ${combinedStats.totalSets} séries
⚡ RPE médio: ${combinedStats.avgRpe || '--'}

${treinoLines.join('\n')}`

    try {
      await navigator.clipboard.writeText(text)
      toast.success('Texto copiado! Cole no WhatsApp/Instagram')
    } catch {
      toast.error('Não foi possível copiar o texto.')
    }
  }

  const handleCopyAiText = async () => {
  if (selectedWorkoutsForCard.length === 0) return

  const workoutsText = groupedCardioForSelected
    .map(({ workout, cardio: cardioEntry }, workoutIndex) => {
      const exerciseDetails = workout.exercises.map((exercise, exerciseIndex) => {
        const sets = Array.isArray(exercise?.sets) ? exercise.sets : []

        const exerciseVolume = sets.reduce((sum: number, set: any) => {
          const reps = Number(set?.reps ?? 0)
          const weight = Number(set?.weight ?? 0)
          if (!Number.isFinite(reps) || !Number.isFinite(weight)) return sum
          return sum + reps * weight
        }, 0)

        const setLines = sets
          .map((set: any, setIndex: number) => {
            const reps = set?.reps ?? '-'
            const weight = set?.weight ?? 0
            return `   - Série ${setIndex + 1}: ${reps} reps x ${weight} kg`
          })
          .join('\n')

        const notes: string[] = []

        const name = String(exercise?.exerciseName || '').toLowerCase()

        if (
          name.includes('agach') ||
          name.includes('levantamento terra') ||
          name.includes('stiff') ||
          name.includes('remada curvada') ||
          name.includes('good morning')
        ) {
          notes.push('Exercício que pode aumentar demanda sobre lombar/postura, observar técnica, dor e tolerância.')
        }

        if (
          name.includes('desenvolvimento') ||
          name.includes('militar') ||
          name.includes('elevação lateral') ||
          name.includes('supino')
        ) {
          notes.push('Observar conforto em ombros, escápulas e amplitude de movimento.')
        }

        if (
          name.includes('leg press') ||
          name.includes('agach') ||
          name.includes('avanço') ||
          name.includes('afundo')
        ) {
          notes.push('Observar joelhos, quadril e alinhamento durante execução.')
        }

        if (exerciseVolume > 0 && exerciseVolume >= 3000) {
          notes.push('Volume alto neste exercício, avaliar fadiga local e recuperação.')
        }

        const rpeLine =
          Number.isFinite(exercise?.rpe) && exercise.rpe > 0
            ? `   - RPE do exercício: ${exercise.rpe}\n`
            : ''

        const noteLine =
          notes.length > 0
            ? `   - Pontos de atenção: ${notes.join(' ')}\n`
            : ''

        return `${exerciseIndex + 1}. ${exercise.exerciseName || 'Exercício'}
   - Séries: ${sets.length}
   - Volume do exercício: ${exerciseVolume} kg
${rpeLine}${noteLine}${setLines}`
      })

      const workoutVolume = calculateWorkoutVolume(workout)
      const workoutTotalSets = workout.exercises.reduce((sum, e) => sum + (e.sets?.length ?? 0), 0)

      const workoutAvgRpe =
        workout.exercises.length > 0
          ? Math.round(
              (workout.exercises.reduce((sum, e) => sum + (Number.isFinite(e.rpe) ? e.rpe : 0), 0) /
                workout.exercises.length) *
                10
            ) / 10
          : '--'

      const cardioText = cardioEntry
        ? `Cardio do mesmo dia:
- Tipo: ${cardioEntry.type}
- Duração: ${cardioEntry.duration} min
- Distância: ${cardioEntry.distance !== undefined ? `${cardioEntry.distance} km` : 'Não informado'}
- Velocidade média: ${cardioEntry.avgSpeed !== undefined ? `${cardioEntry.avgSpeed} km/h` : 'Não informado'}
- FC média: ${cardioEntry.avgHeartRate ?? 'Não informado'}
- FC máxima: ${cardioEntry.maxHeartRate ?? 'Não informado'}
- Zona cardíaca: ${cardioEntry.heartRateZone ?? 'Não informado'}
- Observações cardio: ${cardioEntry.notes || 'Nenhuma'}`
        : `Cardio do mesmo dia:
- Nenhum cardio encontrado para esta data.`

      return `${workoutIndex + 1}) ${getWorkoutTitle(workout)}
Data: ${workout.date}
Dia da semana: ${getWorkoutDisplayDay(workout)}
Exercícios: ${workout.exercises.length}
Séries totais: ${workoutTotalSets}
Volume total: ${workoutVolume} kg
RPE médio: ${workoutAvgRpe}

Exercícios realizados:
${exerciseDetails.join('\n\n')}

${cardioText}`
    })
    .join('\n\n====================\n\n')

  const text = `Análise de treinos AcademyK

Objetivo deste texto:
- permitir análise de treino, progressão de carga, fadiga, esforço cardiovascular e possíveis pontos de atenção musculoesqueléticos
- considerar também segurança para pessoas com dor, limitação articular, histórico de coluna, ombro, joelho ou restrição para altas cargas

Resumo geral:
- Período: ${periodText}
- Treinos selecionados: ${combinedStats.workoutCount}
- Total de exercícios: ${combinedStats.totalExercises}
- Total de séries: ${combinedStats.totalSets}
- Volume total combinado: ${combinedStats.totalVolume} kg
- RPE médio geral: ${combinedStats.avgRpe || '--'}

Orientação para análise:
- avaliar distribuição de volume, intensidade e recuperação
- observar se há exercícios potencialmente sensíveis para lombar, ombros, joelhos e quadril
- verificar se a combinação de carga, reps e RPE sugere excesso, progressão adequada ou necessidade de ajuste
- considerar dados de cardio, FC média, FC máxima e zona cardíaca para interpretar esforço cardiovascular
- apontar riscos, cuidados e sugestões de adaptação quando houver possibilidade de dor, limitação articular ou sobrecarga

Dados dos treinos:
${workoutsText}`

  try {
    await navigator.clipboard.writeText(text)
    toast.success('Texto para IA copiado ✅')
  } catch {
    toast.error('Não foi possível copiar o texto para IA.')
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
              : 'Monte um card para compartilhar seus treinos'}
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
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Camera className="h-5 w-5 text-primary" />
                Configuração
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Treino principal</Label>
                <Select value={selectedWorkoutId} onValueChange={setSelectedWorkoutId}>
                  <SelectTrigger className="border-border bg-background">
                    <SelectValue placeholder="Escolha um treino" />
                  </SelectTrigger>
                  <SelectContent>
                    {recentWorkouts.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {formatDateSafe(w.date, 'dd/MM')} • {getWorkoutDisplayDay(w)} • {w.exercises.length} exercícios
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
                      className={`h-12 rounded-xl transition-all ${themeStyles[theme]} ${
                        selectedTheme === theme ? 'scale-[1.03] ring-2 ring-white' : 'opacity-70'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <CheckSquare className="h-5 w-5 text-primary" />
                Card social
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Marque os treinos que quer incluir no card
              </p>

              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {recentWorkouts.map((workout) => {
                  const checked = selectedWorkoutIds.includes(workout.id)
                  const volume = calculateWorkoutVolume(workout)

                  return (
                    <button
                      key={workout.id}
                      type="button"
                      onClick={() => toggleWorkoutSelection(workout.id)}
                      className={`w-full rounded-xl border p-3 text-left transition-all ${
                        checked
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                          : 'border-border bg-background/40 hover:bg-background/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">
                            {getWorkoutTitle(workout)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatDateSafe(workout.date, 'dd/MM')} • {getWorkoutDisplayDay(workout)} • {workout.exercises.length} exercícios • {(volume / 1000).toFixed(1)}k kg
                          </div>
                        </div>

                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-white/20 bg-transparent'
                          }`}
                        >
                          {checked ? '✓' : ''}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="rounded-xl border border-border bg-background/40 p-4">
                <div className="mb-3 text-sm font-medium text-white">Resumo do card</div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <div className="text-lg font-bold text-white">{combinedStats.workoutCount}</div>
                    <div className="text-[11px] text-muted-foreground">Treinos</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <div className="text-lg font-bold text-white">{combinedStats.totalExercises}</div>
                    <div className="text-[11px] text-muted-foreground">Exercícios</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <div className="text-lg font-bold text-white">{combinedStats.totalSets}</div>
                    <div className="text-[11px] text-muted-foreground">Séries</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <div className="text-lg font-bold text-white">
                      {(combinedStats.totalVolume / 1000).toFixed(1)}k
                    </div>
                    <div className="text-[11px] text-muted-foreground">Volume</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedWorkout && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Análise do treino principal
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border bg-background/40 p-4">
                  <div className="text-sm font-medium text-white">{selectedWorkoutTitle}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatDateSafe(selectedWorkout.date)} • {getWorkoutDisplayDay(selectedWorkout)}
                  </div>
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

                {matchedCardio && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                      <Heart className="h-4 w-4 text-primary" />
                      Cardio do mesmo dia
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        Tipo: <span className="text-white">{matchedCardio.type}</span>
                      </div>
                      <div>
                        Duração: <span className="text-white">{matchedCardio.duration} min</span>
                      </div>
                      <div>
                        FC média: <span className="text-white">{matchedCardio.avgHeartRate ?? '--'}</span>
                      </div>
                      <div>
                        FC máxima: <span className="text-white">{matchedCardio.maxHeartRate ?? '--'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Share2 className="h-5 w-5 text-primary" />
                Ações
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <Button
                onClick={handleDownload}
                className="w-full gap-2"
                disabled={selectedWorkoutsForCard.length === 0}
              >
                <Download className="h-4 w-4" />
                Baixar card social PNG
              </Button>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Button
                  onClick={handleShareText}
                  variant="outline"
                  className="w-full gap-2"
                  disabled={selectedWorkoutsForCard.length === 0}
                >
                  <MessageCircle className="h-4 w-4" />
                  Copiar WhatsApp
                </Button>

                <Button
                  onClick={handleCopyAiText}
                  variant="secondary"
                  className="w-full gap-2"
                  disabled={selectedWorkoutsForCard.length === 0}
                >
                  <Bot className="h-4 w-4" />
                  Copiar para IA
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-white">Preview do card social</CardTitle>
          </CardHeader>

          <CardContent>
            {selectedWorkoutsForCard.length > 0 ? (
              <div className="flex justify-center">
                <div
                  ref={canvasRef}
                  className={`w-full max-w-[480px] rounded-[28px] p-6 md:p-7 ${themeStyles[selectedTheme]}`}
                >
                  <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-white/60">AcademyK</p>
                        <h2 className="mt-2 text-2xl font-bold">Resumo de treinos</h2>
                        <p className="mt-1 text-sm text-white/70">{periodText}</p>
                      </div>

                      <div className="rounded-2xl bg-white/10 p-3">
                        <Dumbbell className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="rounded-3xl bg-white/10 p-5">
                      <div className="text-sm text-white/70">Volume total</div>
                      <div className="mt-2 text-4xl font-bold">
                        {(combinedStats.totalVolume / 1000).toFixed(1)}k
                      </div>
                      <div className="text-sm text-white/70">kg</div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="rounded-2xl bg-white/8 p-4 text-center">
                        <div className="text-2xl font-bold">{combinedStats.workoutCount}</div>
                        <div className="mt-1 text-xs text-white/65">Treinos</div>
                      </div>
                      <div className="rounded-2xl bg-white/8 p-4 text-center">
                        <div className="text-2xl font-bold">{combinedStats.totalExercises}</div>
                        <div className="mt-1 text-xs text-white/65">Exercícios</div>
                      </div>
                      <div className="rounded-2xl bg-white/8 p-4 text-center">
                        <div className="text-2xl font-bold">{combinedStats.totalSets}</div>
                        <div className="mt-1 text-xs text-white/65">Séries</div>
                      </div>
                      <div className="rounded-2xl bg-white/8 p-4 text-center">
                        <div className="text-2xl font-bold">{combinedStats.avgRpe || '--'}</div>
                        <div className="mt-1 text-xs text-white/65">RPE</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {selectedWorkoutsForCard.slice(0, 6).map((workout, index) => {
                        const volume = calculateWorkoutVolume(workout)

                        return (
                          <div
                            key={`${workout.id}-${index}`}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">
                                  {getWorkoutTitle(workout)}
                                </div>
                                <div className="mt-1 text-xs text-white/65">
                                  {formatDateSafe(workout.date, 'dd/MM')} • {getWorkoutDisplayDay(workout)} • {workout.exercises.length} exercícios • {(volume / 1000).toFixed(1)}k kg
                                </div>
                              </div>
                              <Badge variant="secondary" className="shrink-0 border-white/10 bg-white/10 text-white">
                                #{index + 1}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="text-center text-xs text-white/45">
                      Compartilhado via AcademyK
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center rounded-2xl bg-muted">
                <p className="text-muted-foreground">
                  {loading ? 'Carregando treinos...' : 'Marque os treinos para ver o preview do card'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedWorkout && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-white">Legendas prontas</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
  <p className="mb-2 text-sm text-muted-foreground">Texto para IA</p>
  <p className="whitespace-pre-line text-white">
    {`Resumo geral:
- Período: ${periodText}
- Treinos selecionados: ${combinedStats.workoutCount}
- Total de exercícios: ${combinedStats.totalExercises}
- Total de séries: ${combinedStats.totalSets}
- Volume total combinado: ${combinedStats.totalVolume} kg
- RPE médio geral: ${combinedStats.avgRpe || '--'}

Use este texto para analisar:
- progressão de treino
- volume e intensidade
- tolerância ao esforço
- pontos de atenção para lombar, joelho, ombro e outras articulações
- resposta cardiovascular com base em FC média, FC máxima e zona cardíaca

Os detalhes completos saem no botão "Copiar para IA".`}
  </p>
</div>
          </CardContent>
        </Card>
      )}

      {!loading && recentWorkouts.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum treino encontrado para compartilhar
          </CardContent>
        </Card>
      )}
    </div>
  )
}
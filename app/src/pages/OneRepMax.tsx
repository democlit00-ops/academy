import { useEffect, useMemo, useState } from 'react'
import { Calculator, TrendingUp, Info, Share2, Trophy, User, Target, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { WorkoutSession, WeekDay } from '@/types'
import { EXERCISE_DEFINITIONS } from '@/data/exercises'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatLocalDate } from '@/lib/date'

interface OneRepMaxProps {
  workouts: WorkoutSession[]
  selectedUserId?: string | null
  selectedUserLabel?: string | null
}

const formulas = {
  epley: (weight: number, reps: number) => weight * (1 + reps / 30),
  brzycki: (weight: number, reps: number) => weight / (1.0278 - 0.0278 * reps),
  lombardi: (weight: number, reps: number) => weight * Math.pow(reps, 0.1),
  mayhew: (weight: number, reps: number) => weight * 100 / (52.2 + 41.9 * Math.exp(-0.055 * reps)),
  oconner: (weight: number, reps: number) => weight * (1 + reps / 40),
}

type FormulaKey = keyof typeof formulas

interface FormulaInfo {
  key: FormulaKey
  name: string
  description: string
  bestFor: string
}

const formulaInfo: FormulaInfo[] = [
  { key: 'epley', name: 'Epley', description: 'A mais popular e simples', bestFor: '1-10 repetições' },
  { key: 'brzycki', name: 'Brzycki', description: 'Mais conservadora', bestFor: '1-10 repetições' },
  { key: 'lombardi', name: 'Lombardi', description: 'Mais otimista', bestFor: '1-10 repetições' },
  { key: 'mayhew', name: 'Mayhew', description: 'Boa para avançados', bestFor: 'Atletas experientes' },
  { key: 'oconner', name: "O'Conner", description: 'Alternativa conservadora', bestFor: '1-10 repetições' },
]

const rmPercentages = [
  { reps: 1, percentage: 100 },
  { reps: 2, percentage: 95 },
  { reps: 3, percentage: 93 },
  { reps: 4, percentage: 90 },
  { reps: 5, percentage: 87 },
  { reps: 6, percentage: 85 },
  { reps: 7, percentage: 83 },
  { reps: 8, percentage: 80 },
  { reps: 9, percentage: 77 },
  { reps: 10, percentage: 75 },
  { reps: 11, percentage: 73 },
  { reps: 12, percentage: 70 },
]

type DbWorkoutRow = {
  id: string
  user_id: string
  session_date: string
  weekday: number | null
  total_volume: number | null
  exercises: any[] | null
  created_at: string | null
}

type PersonalRecord = {
  exerciseKey: string
  exerciseId: string | null
  exerciseName: string
  muscleGroup: string
  weight: number
  reps: number
  date: string
  estimated1RM: number
}

type ExerciseHistoryPoint = {
  date: string
  weight: number
  reps: number
  estimated1RM: number
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

function normalizeKey(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function findDefinitionByIdOrName(exerciseId?: string | null, exerciseName?: string | null) {
  const normalizedId = normalizeKey(exerciseId)
  const normalizedName = normalizeKey(exerciseName)

  return EXERCISE_DEFINITIONS.find((exercise) => {
    const defId = normalizeKey(exercise.id)
    const defName = normalizeKey(exercise.name)
    return (!!normalizedId && defId === normalizedId) || (!!normalizedName && defName === normalizedName)
  })
}

function getExerciseDisplayName(exercise: any) {
  const definition = findDefinitionByIdOrName(exercise?.exerciseId, exercise?.exerciseName)
  return (
    definition?.name ||
    String(exercise?.exerciseName || '').trim() ||
    String(exercise?.exerciseId || '').trim() ||
    'Exercício'
  )
}

function getExerciseMuscleGroup(exercise: any) {
  const definition = findDefinitionByIdOrName(exercise?.exerciseId, exercise?.exerciseName)
  return (
    definition?.muscleGroup ||
    String(exercise?.muscleGroup || '').trim() ||
    '—'
  )
}

function buildExerciseKey(exercise: any) {
  const name = normalizeKey(exercise?.exerciseName)
  const id = normalizeKey(exercise?.exerciseId)

  if (name) return `name:${name}`
  if (id) return `id:${id}`
  return `unknown:${Math.random()}`
}

export function OneRepMax({
  workouts,
  selectedUserId,
  selectedUserLabel,
}: OneRepMaxProps) {
  const { user } = useAuth()

  const effectiveUserId = selectedUserId || user?.id || null
  const isStudentMode = !!selectedUserId

  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState(5)
  const [selectedFormula, setSelectedFormula] = useState<FormulaKey>('epley')
  const [dbWorkouts, setDbWorkouts] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRecordKey, setSelectedRecordKey] = useState<string>('')

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
          .order('session_date', { ascending: true })

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
        toast.error(e?.message ?? 'Erro ao carregar records do aluno.')
        setDbWorkouts([])
      } finally {
        setLoading(false)
      }
    }

    void loadStudentWorkouts()
  }, [effectiveUserId, isStudentMode])

  const effectiveWorkouts = isStudentMode ? dbWorkouts : workouts

  const oneRepMax = useMemo(() => {
    const w = parseFloat(weight)
    if (!w || reps < 1) return 0
    return formulas[selectedFormula](w, reps)
  }, [weight, reps, selectedFormula])

  const loadTable = useMemo(() => {
    if (!oneRepMax) return []
    return rmPercentages.map((r) => ({
      reps: r.reps,
      weight: oneRepMax * (r.percentage / 100),
      percentage: r.percentage,
    }))
  }, [oneRepMax])

  const personalRecords = useMemo<PersonalRecord[]>(() => {
    const records = new Map<string, PersonalRecord>()

    effectiveWorkouts.forEach((workout) => {
      workout.exercises.forEach((ex: any) => {
        if (ex?.trackingMode === 'mobility') return
        const sets = Array.isArray(ex?.sets) ? ex.sets : []
        const exerciseName = getExerciseDisplayName(ex)
        const muscleGroup = getExerciseMuscleGroup(ex)
        const exerciseKey = buildExerciseKey(ex)
        const exerciseId = ex?.exerciseId ? String(ex.exerciseId) : null

        sets.forEach((set: any) => {
          const setWeight = safeNumber(set?.weight)
          const setReps = safeNumber(set?.reps)
          if (setWeight <= 0 || setReps <= 0) return

          const estimated1RM = formulas.epley(setWeight, setReps)
          const current = records.get(exerciseKey)

          if (!current || estimated1RM > current.estimated1RM) {
            records.set(exerciseKey, {
              exerciseKey,
              exerciseId,
              exerciseName,
              muscleGroup,
              weight: setWeight,
              reps: setReps,
              date: workout.date,
              estimated1RM,
            })
          }
        })
      })
    })

    return Array.from(records.values()).sort((a, b) => b.estimated1RM - a.estimated1RM)
  }, [effectiveWorkouts])

  const exerciseHistory = useMemo<Record<string, ExerciseHistoryPoint[]>>(() => {
    const historyMap: Record<string, ExerciseHistoryPoint[]> = {}

    effectiveWorkouts.forEach((workout) => {
      workout.exercises.forEach((ex: any) => {
        if (ex?.trackingMode === 'mobility') return
        const sets = Array.isArray(ex?.sets) ? ex.sets : []
        const exerciseKey = buildExerciseKey(ex)

        const points = sets
          .map((set: any) => {
            const setWeight = safeNumber(set?.weight)
            const setReps = safeNumber(set?.reps)
            if (setWeight <= 0 || setReps <= 0) return null

            return {
              date: workout.date,
              weight: setWeight,
              reps: setReps,
              estimated1RM: formulas.epley(setWeight, setReps),
            }
          })
          .filter(Boolean) as ExerciseHistoryPoint[]

        if (!historyMap[exerciseKey]) historyMap[exerciseKey] = []
        historyMap[exerciseKey].push(...points)
      })
    })

    Object.keys(historyMap).forEach((key) => {
      historyMap[key] = historyMap[key]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    })

    return historyMap
  }, [effectiveWorkouts])

  useEffect(() => {
    if (personalRecords.length === 0) {
      setSelectedRecordKey('')
      return
    }

    if (!selectedRecordKey || !personalRecords.some((record) => record.exerciseKey === selectedRecordKey)) {
      setSelectedRecordKey(personalRecords[0].exerciseKey)
    }
  }, [personalRecords, selectedRecordKey])

  const selectedRecord = useMemo(() => {
    return personalRecords.find((record) => record.exerciseKey === selectedRecordKey) ?? null
  }, [personalRecords, selectedRecordKey])

  const selectedExerciseHistory = useMemo(() => {
    if (!selectedRecord) return []
    return exerciseHistory[selectedRecord.exerciseKey] ?? []
  }, [selectedRecord, exerciseHistory])

  const previousBest = useMemo(() => {
    if (selectedExerciseHistory.length < 2) return null
    const sorted = [...selectedExerciseHistory].sort((a, b) => b.estimated1RM - a.estimated1RM)
    return sorted[1] ?? null
  }, [selectedExerciseHistory])

  const evolutionDelta = useMemo(() => {
    if (!selectedRecord || !previousBest) return null
    return selectedRecord.estimated1RM - previousBest.estimated1RM
  }, [selectedRecord, previousBest])

  const handleShare = async () => {
    const text = `💪 Meu 1RM estimado: ${oneRepMax.toFixed(1)}kg\n📊 ${formulaInfo.find((f) => f.key === selectedFormula)?.name}\n🏋️ ${reps} reps com ${weight}kg`

    try {
      await navigator.clipboard.writeText(text)
      toast.success('Resultado copiado!')
    } catch {
      toast.error('Não foi possível copiar o resultado.')
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calculadora 1RM</h1>
          <p className="text-muted-foreground">
            {isStudentMode ? 'Estime a força máxima do aluno selecionado' : 'Estime sua força máxima'}
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
            <p className="mt-2 text-sm text-muted-foreground">Carregando dados do aluno...</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Calculator className="w-5 h-5 text-primary" />
              Calcular 1RM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Fórmula</Label>
              <Select value={selectedFormula} onValueChange={(v) => setSelectedFormula(v as FormulaKey)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formulaInfo.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formulaInfo.find((f) => f.key === selectedFormula)?.description} • {formulaInfo.find((f) => f.key === selectedFormula)?.bestFor}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Peso Levantado (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.5"
                placeholder="Ex: 80"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-background border-border text-lg"
              />
            </div>

            <div className="space-y-4">
              <Label>Repetições: {reps}</Label>
              <Slider
                value={[reps]}
                onValueChange={([v]) => setReps(v)}
                min={1}
                max={12}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>6</span>
                <span>12</span>
              </div>
            </div>

            {oneRepMax > 0 && (
              <div className="rounded-xl bg-gradient-to-r from-primary/20 to-purple-600/20 p-6 text-center">
                <p className="mb-2 text-sm text-muted-foreground">Seu 1RM Estimado</p>
                <p className="text-5xl font-bold text-white">
                  {oneRepMax.toFixed(1)}
                  <span className="ml-1 text-xl text-muted-foreground">kg</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Baseado em {weight}kg × {reps} reps
                </p>
                <Button onClick={handleShare} variant="outline" className="mt-4 gap-2">
                  <Share2 className="w-4 h-4" />
                  Copiar Resultado
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Tabela de Cargas
            </CardTitle>
            <CardDescription>
              Cargas equivalentes baseadas no seu 1RM
            </CardDescription>
          </CardHeader>
          <CardContent>
            {oneRepMax > 0 ? (
              <div className="space-y-2">
                {loadTable.map((row) => (
                  <div
                    key={row.reps}
                    className={`flex items-center justify-between rounded-lg p-3 ${
                      row.reps === reps ? 'border border-primary/30 bg-primary/20' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {row.reps}
                      </span>
                      <span className="text-muted-foreground">reps</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-white">{row.weight.toFixed(1)} kg</span>
                      <span className="ml-2 text-xs text-muted-foreground">({row.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Info className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>Insira peso e repetições para ver a tabela</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {personalRecords.length > 0 && (
        <>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Target className="w-5 h-5 text-primary" />
                Analisar exercício
              </CardTitle>
              <CardDescription>
                Escolha um exercício para ver sua melhor marca estimada e a evolução
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Exercício</Label>
                <Select value={selectedRecordKey} onValueChange={setSelectedRecordKey}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione um exercício" />
                  </SelectTrigger>
                  <SelectContent>
                    {personalRecords.map((record) => (
                      <SelectItem key={record.exerciseKey} value={record.exerciseKey}>
                        {record.exerciseName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRecord && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Exercício</p>
                    <p className="mt-1 font-medium text-white">{selectedRecord.exerciseName}</p>
                    <p className="text-xs text-muted-foreground">{selectedRecord.muscleGroup}</p>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Melhor 1RM estimado</p>
                    <p className="mt-1 text-2xl font-bold text-primary">{selectedRecord.estimated1RM.toFixed(1)} kg</p>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Melhor série base</p>
                    <p className="mt-1 font-medium text-white">
                      {selectedRecord.weight} kg × {selectedRecord.reps} reps
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Data da melhor marca</p>
                    <p className="mt-1 font-medium text-white">
                      {formatLocalDate(selectedRecord.date, (d) => format(d, 'dd/MM/yyyy'))}
                    </p>
                  </div>
                </div>
              )}

              {selectedRecord && selectedExerciseHistory.length > 0 && (
                <div className="space-y-3 rounded-lg bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Histórico: {selectedExerciseHistory.length} registro(s)</Badge>

                    {evolutionDelta !== null && (
                      <Badge className={evolutionDelta >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {evolutionDelta >= 0 ? '+' : ''}
                        {evolutionDelta.toFixed(1)} kg vs. melhor anterior
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    {selectedExerciseHistory
                      .slice()
                      .sort((a, b) => b.estimated1RM - a.estimated1RM)
                      .slice(0, 5)
                      .map((point, index) => (
                        <div key={`${point.date}-${point.weight}-${point.reps}-${index}`} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-sm font-medium">
                              {index + 1}
                            </span>
                            <div>
                              <div className="text-sm font-medium text-white">
                                {point.weight} kg × {point.reps} reps
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatLocalDate(point.date, (d) => format(d, 'dd/MM/yyyy', { locale: ptBR }))}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-semibold text-primary">{point.estimated1RM.toFixed(1)} kg</div>
                            <div className="text-xs text-muted-foreground">1RM estimado</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Seus Records (1RM Estimado)
              </CardTitle>
              <CardDescription>
                Agora mostrando o nome real do exercício e o melhor 1RM estimado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {personalRecords.slice(0, 6).map((record, index) => (
                  <div
                    key={record.exerciseKey}
                    className="relative overflow-hidden rounded-lg bg-muted/30 p-4"
                  >
                    {index === 0 && (
                      <div className="absolute right-2 top-2">
                        <Badge className="bg-yellow-500/20 text-yellow-400">
                          <Trophy className="mr-1 h-3 w-3" />
                          TOP 1
                        </Badge>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground">{record.muscleGroup || '—'}</p>
                    <p className="font-medium text-white">{record.exerciseName}</p>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">
                        {record.estimated1RM.toFixed(1)}
                      </span>
                      <span className="text-sm text-muted-foreground">kg</span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Baseado em {record.weight}kg × {record.reps} reps
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      <CalendarDays className="mr-1 inline h-3 w-3" />
                      {formatLocalDate(record.date, (d) => format(d, 'dd/MM/yyyy'))}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!loading && personalRecords.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum treino encontrado para calcular records
          </CardContent>
        </Card>
      )}
    </div>
  )
}
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, Dumbbell, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { WorkoutSession, WorkoutExercise, WorkoutSet, WeekDay, MuscleGroup } from '@/types'
import { calculateExerciseVolume } from '@/lib/calculations'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { parseLocalDate, getTodayLocalDateString } from '@/lib/date'
import { ExercisePicker, type ExercisePickerOption } from '@/components/exercises/ExercisePicker'

interface WorkoutFormProps {
  onSave: (workout: WorkoutSession) => void
  selectedUserId?: string | null
  selectedUserLabel?: string | null
}

type DbExercise = {
  id: string
  name: string
  muscle_group: string
  category: 'Força' | 'Cardio' | 'Core' | 'Mobilidade'
  type: 'strength' | 'cardio'
  equipment?: string | null
  aliases?: string[] | null
  notes?: string | null
  is_active: boolean
}

type DbPlanItem = {
  id: string
  block: 'strength' | 'cardio'
  sets: number | null
  reps: string | null
  target_weight: number | null
  notes: string | null
  duration_min: number | null
  sort_order: number
  custom_exercise_name: string | null
  exercises?: { name: string } | null
  exercise_id: string | null
  muscle_group: string | null
}

type DbSplitPlan = {
  id: string
  title: string
  description: string | null
  visibility: 'public' | 'private'
}

type DbSplitDay = {
  id: string
  plan_id: string
  weekday: number
  day_title: string | null
  muscle_groups: string[] | null
}

type ExerciseSourceMode = 'bank' | 'custom'

const WEEK_DAYS: WeekDay[] = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
] as WeekDay[]

function getWeekDayFromDateString(date: string): WeekDay {
  const parsed = parseLocalDate(date)
  if (!parsed) return 'Segunda'
  return normalizeWeekDayLabel(format(parsed, 'EEEE', { locale: ptBR }))
}

function weekDayToNumber(day: WeekDay): number {
  const map: Record<string, number> = {
    Segunda: 1,
    Terça: 2,
    Quarta: 3,
    Quinta: 4,
    Sexta: 5,
    Sábado: 6,
    Domingo: 7,
  }
  return map[day] ?? 1
}

function normalizeWeekDayLabel(value: string): WeekDay {
  const normalized = value
    .toLowerCase()
    .replace('-feira', '')
    .trim()

  const map: Record<string, WeekDay> = {
    segunda: 'Segunda',
    terça: 'Terça',
    terca: 'Terça',
    quarta: 'Quarta',
    quinta: 'Quinta',
    sexta: 'Sexta',
    sábado: 'Sábado',
    sabado: 'Sábado',
    domingo: 'Domingo',
  }

  return map[normalized] ?? 'Segunda'
}

function parseRepsToNumber(repsText: string | null): number {
  if (!repsText) return 10
  const m = repsText.match(/\d+/)
  if (!m) return 10
  const n = parseInt(m[0], 10)
  return Number.isFinite(n) ? n : 10
}

function normalizeMuscleGroup(value?: string | null): MuscleGroup {
  const raw = String(value ?? '').trim().toLowerCase()

  const map: Record<string, MuscleGroup> = {
    peito: 'Peito',
    costas: 'Costas',
    ombros: 'Ombros',
    bíceps: 'Bíceps',
    biceps: 'Bíceps',
    tríceps: 'Tríceps',
    triceps: 'Tríceps',
    pernas: 'Pernas',
    glúteos: 'Glúteos',
    gluteos: 'Glúteos',
    posterior: 'Posterior',
    core: 'Core',
    cardio: 'Cardio',
    mobilidade: 'Mobilidade',
    cervical: 'Mobilidade',
    panturrilhas: 'Pernas',
    adutores: 'Pernas',
  }

  return map[raw] ?? 'Peito'
}

function inferSourceMode(exercise: WorkoutExercise) {
  return exercise.sourceMode ?? (exercise.exerciseId ? 'bank' : 'custom')
}

export function WorkoutForm({
  onSave,
  selectedUserId,
  selectedUserLabel,
}: WorkoutFormProps) {
  const { user } = useAuth()
  const isStudentMode = !!selectedUserId
  const targetUserId = user?.id || null

  const [date, setDate] = useState(getTodayLocalDateString())
  const [weekDay, setWeekDay] = useState<WeekDay>(getWeekDayFromDateString(getTodayLocalDateString()))

  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [dbExercises, setDbExercises] = useState<DbExercise[]>([])
  const [lastAutoLoadedKey, setLastAutoLoadedKey] = useState<string | null>(null)
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null)
  const [activeSplit, setActiveSplit] = useState<DbSplitPlan | null>(null)
  const [activeSplitDay, setActiveSplitDay] = useState<DbSplitDay | null>(null)

  const exercisePickerOptions = useMemo<ExercisePickerOption[]>(
  () =>
    dbExercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      category: exercise.category,
      type: exercise.type,
      equipment: exercise.equipment ?? null,
      aliases: exercise.aliases ?? [],
      notes: exercise.notes ?? null,
      is_active: exercise.is_active,
    })),
  [dbExercises]
)

  const dbExercisesById = useMemo(() => {
    const map = new Map<string, DbExercise>()
    dbExercises.forEach((e) => map.set(e.id, e))
    return map
  }, [dbExercises])

  useEffect(() => {
    const loadExercises = async () => {
      try {
        const { data, error } = await supabase
          .from('exercises')
          .select('id,name,muscle_group,category,type,equipment,aliases,notes,is_active')
          .eq('is_active', true)
          .order('name', { ascending: true })

        if (error) throw error
        setDbExercises((data ?? []) as DbExercise[])
      } catch (e: any) {
        toast.error(e?.message ?? 'Erro ao carregar lista de exercícios.')
      }
    }

    void loadExercises()
  }, [])

  useEffect(() => {
    setExercises([])
    setLastAutoLoadedKey(null)
    setActiveProgramId(null)
    setActiveSplit(null)
    setActiveSplitDay(null)
  }, [targetUserId])

  useEffect(() => {
    if (!targetUserId) return

    const loadPlanForDay = async () => {
      setLoadingPlan(true)
      try {
        const { data: active, error: activeErr } = await supabase
          .from('user_active_plan')
          .select('active_split_id, active_program_id')
          .eq('user_id', targetUserId)
          .maybeSingle()

        if (activeErr) throw activeErr

        const activeSplitId = active?.active_split_id ?? null
        const nextActiveProgramId = active?.active_program_id ?? null
        setActiveProgramId(nextActiveProgramId)

        const weekdayNum = weekDayToNumber(weekDay)

        if (activeSplitId) {
          const [{ data: splitPlan, error: splitPlanErr }, { data: splitDay, error: splitDayErr }] = await Promise.all([
            supabase
              .from('plans')
              .select('id,title,description,visibility')
              .eq('id', activeSplitId)
              .maybeSingle(),
            supabase
              .from('plan_days')
              .select('id,plan_id,weekday,day_title,muscle_groups')
              .eq('plan_id', activeSplitId)
              .eq('weekday', weekdayNum)
              .maybeSingle(),
          ])

          if (splitPlanErr) throw splitPlanErr
          if (splitDayErr) throw splitDayErr

          setActiveSplit((splitPlan ?? null) as DbSplitPlan | null)
          setActiveSplitDay((splitDay ?? null) as DbSplitDay | null)
        } else {
          setActiveSplit(null)
          setActiveSplitDay(null)
        }

        if (!nextActiveProgramId) {
          setLoadingPlan(false)
          return
        }

        const { data: dayRow, error: dayErr } = await supabase
          .from('plan_days')
          .select('id,weekday,day_title')
          .eq('plan_id', nextActiveProgramId)
          .eq('weekday', weekdayNum)
          .maybeSingle()

        if (dayErr) throw dayErr
        if (!dayRow?.id) {
          setLoadingPlan(false)
          return
        }

        const { data: items, error: itemsErr } = await supabase
          .from('plan_items')
          .select(`
            id,block,sets,reps,target_weight,notes,duration_min,sort_order,custom_exercise_name,exercise_id,muscle_group,
            exercises:exercise_id ( name )
          `)
          .eq('plan_day_id', dayRow.id)
          .order('sort_order', { ascending: true })

        if (itemsErr) throw itemsErr

        const planItems = (items ?? []) as unknown as DbPlanItem[]
        const strengthItems = planItems.filter((it) => it.block === 'strength')

        const mapped: WorkoutExercise[] = strengthItems.map((it) => {
          const exId = it.exercise_id ?? ''
          const exName = it.exercises?.name ?? it.custom_exercise_name ?? 'Exercício'
          const mg = normalizeMuscleGroup(it.muscle_group || dbExercisesById.get(exId)?.muscle_group || 'Peito')

          const setsCount = Math.max(it.sets ?? 1, 1)
          const repsN = parseRepsToNumber(it.reps)
          const weight = typeof it.target_weight === 'number' ? Number(it.target_weight) : 0

          const sets: WorkoutSet[] = Array.from({ length: setsCount }).map(() => ({
            reps: repsN,
            weight,
          }))

          return {
            id: crypto.randomUUID(),
            exerciseId: exId,
            exerciseName: exName,
            muscleGroup: mg,
            sets,
            rpe: 7,
            notes: it.notes ?? undefined,
          }
        })

        const autoLoadKey = `${targetUserId}:${nextActiveProgramId}:${weekdayNum}`

        setExercises((prev) => {
          if (prev.length > 0 && lastAutoLoadedKey !== autoLoadKey) return prev
          return mapped
        })

        setLastAutoLoadedKey(autoLoadKey)
      } catch (e: any) {
        toast.error(e?.message ?? 'Erro ao carregar treino do dia do programa ativo.')
      } finally {
        setLoadingPlan(false)
      }
    }

    void loadPlanForDay()
  }, [targetUserId, weekDay, dbExercisesById, lastAutoLoadedKey])

  const addExercise = () => {
    const newExercise: WorkoutExercise = {
  id: crypto.randomUUID(),
  exerciseId: '',
  exerciseName: '',
  muscleGroup: 'Peito' as MuscleGroup,
  sourceMode: 'bank',
  sets: [{ reps: 10, weight: 0 }],
  rpe: 7,
}
    setExercises([...exercises, newExercise])
  }

  const removeExercise = (id: string) => {
    setExercises(exercises.filter((e) => e.id !== id))
  }

  const updateExercise = (id: string, updates: Partial<WorkoutExercise>) => {
    setExercises(exercises.map((e) => (e.id === id ? { ...e, ...updates } : e)))
  }

  const addSet = (exerciseId: string) => {
    setExercises(
      exercises.map((e) => {
        if (e.id === exerciseId) {
          const lastSet = e.sets[e.sets.length - 1]
          return {
            ...e,
            sets: [...e.sets, { reps: lastSet?.reps || 10, weight: lastSet?.weight || 0 }],
          }
        }
        return e
      })
    )
  }

  const removeSet = (exerciseId: string, setIndex: number) => {
    setExercises(
      exercises.map((e) => {
        if (e.id === exerciseId) {
          return {
            ...e,
            sets: e.sets.filter((_, i) => i !== setIndex),
          }
        }
        return e
      })
    )
  }

  const updateSet = (exerciseId: string, setIndex: number, updates: Partial<WorkoutSet>) => {
    setExercises(
      exercises.map((e) => {
        if (e.id === exerciseId) {
          return {
            ...e,
            sets: e.sets.map((s, i) => (i === setIndex ? { ...s, ...updates } : s)),
          }
        }
        return e
      })
    )
  }

  const handleExerciseSelect = (exerciseId: string, workoutExerciseId: string) => {
  const ex = dbExercisesById.get(exerciseId)
  if (ex) {
    updateExercise(workoutExerciseId, {
      sourceMode: 'bank',
      exerciseId: ex.id,
      exerciseName: ex.name,
      muscleGroup: normalizeMuscleGroup(ex.muscle_group),
    })
  }
}

  const handleCustomExerciseNameChange = (workoutExerciseId: string, exerciseName: string) => {
  updateExercise(workoutExerciseId, {
    sourceMode: 'custom',
    exerciseId: '',
    exerciseName,
  })
}

  const handleSourceModeChange = (workoutExerciseId: string, mode: ExerciseSourceMode) => {
  const current = exercises.find((exercise) => exercise.id === workoutExerciseId)
  if (!current) return

  if (mode === 'bank') {
    updateExercise(workoutExerciseId, {
      sourceMode: 'bank',
      exerciseId: '',
      exerciseName: '',
    })
    return
  }

  updateExercise(workoutExerciseId, {
    sourceMode: 'custom',
    exerciseId: '',
    exerciseName: current.exerciseName || '',
  })
}

  const handleDateChange = (value: string) => {
    setDate(value)
    setWeekDay(getWeekDayFromDateString(value))
    setLastAutoLoadedKey(null)
  }

  const todaySplitGroups = (activeSplitDay?.muscle_groups ?? []).filter(Boolean)
  const isSplitRestDay =
    !!activeSplitDay &&
    todaySplitGroups.length === 0 &&
    (activeSplitDay.day_title ?? '').toLowerCase().includes('descanso')

  const canSuggestFromSplit =
    !activeProgramId &&
    !!activeSplitDay &&
    !isSplitRestDay &&
    todaySplitGroups.length > 0 &&
    exercises.length === 0

  const applySplitSuggestions = () => {
    if (!canSuggestFromSplit) return

    const suggestedExercises: WorkoutExercise[] = todaySplitGroups.map((group) => {
      const matchedExercise = dbExercises.find(
        (exercise) => exercise.type === 'strength' && exercise.muscle_group === group
      )

      return {
        id: crypto.randomUUID(),
        exerciseId: matchedExercise?.id ?? '',
        exerciseName: matchedExercise?.name ?? '',
        muscleGroup: normalizeMuscleGroup(group),
        sets: [{ reps: 10, weight: 0 }],
        rpe: 7,
        notes: `Sugestão do split: ${group}`,
      }
    })

    setExercises(suggestedExercises)
    toast.success('Sugestões do split aplicadas!')
  }

  const handleSubmit = () => {
    if (exercises.length === 0) {
      toast.error('Adicione pelo menos um exercício')
      return
    }

    if (exercises.some((e) => !e.exerciseId && !e.exerciseName.trim())) {
      toast.error('Selecione ou preencha todos os exercícios')
      return
    }

    const totalVolume = exercises.reduce((total, ex) => total + calculateExerciseVolume(ex), 0)

    const workout: WorkoutSession = {
      id: crypto.randomUUID(),
      date,
      weekDay: weekDay as WeekDay,
      exercises,
      totalVolume,
      createdAt: Date.now(),
    }

    onSave(workout)
    toast.success(
      activeProgramId
        ? 'Treino salvo! O histórico já pode ser usado no progresso do programa.'
        : 'Treino salvo com sucesso!'
    )

    const today = getTodayLocalDateString()
    setDate(today)
    setWeekDay(getWeekDayFromDateString(today))
    setExercises([])
    setLastAutoLoadedKey(null)
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Registrar Treino</h1>
          <p className="text-muted-foreground">
            {loadingPlan ? 'Carregando treino do dia do programa ativo...' : 'Registre seus exercícios e cargas'}
          </p>

          {isStudentMode && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              <User className="h-4 w-4" />
              <span>
                Modo Aluno ativo para: <strong>{selectedUserLabel || 'Aluno selecionado'}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {isStudentMode && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-300">
                  Consulta do plano do aluno
                </Badge>
              </div>
              <p className="text-sm text-amber-100">
                Com o <strong>Modo Aluno</strong> ativo, esta tela passa a carregar automaticamente os
                <strong> exercícios do programa ativo do aluno selecionado</strong> para consulta e registro.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSplit && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-primary/30 bg-primary/20 text-primary">Split ativo</Badge>
                <h3 className="text-base font-semibold text-white">{activeSplit.title}</h3>
                <Badge variant="outline">{activeSplit.visibility === 'public' ? 'Público' : 'Privado'}</Badge>
              </div>

              <div>
                <div className="text-sm text-muted-foreground">Foco de hoje</div>
                <div className="font-medium text-white">
                  {activeSplitDay
                    ? isSplitRestDay
                      ? 'Descanso'
                      : (activeSplitDay.day_title || 'Treino do dia')
                    : 'Nenhum dia configurado para hoje'}
                </div>
              </div>

              {activeSplitDay && (
                <div className="flex flex-wrap gap-2">
                  {isSplitRestDay ? (
                    <Badge variant="secondary">Descanso</Badge>
                  ) : todaySplitGroups.length > 0 ? (
                    todaySplitGroups.map((group) => (
                      <Badge key={group} variant="secondary">{group}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Sem grupos musculares definidos.</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {canSuggestFromSplit && (
        <Card className="border-blue-500/30 bg-blue-500/10">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="border-blue-500/30 bg-blue-500/20 text-blue-300">Sugestão do split</Badge>
                </div>
                <p className="text-sm text-blue-100">
                  Não há programa ativo para este dia. Posso montar um rascunho de treino com base no <strong>split ativo</strong>.
                </p>
                <div className="flex flex-wrap gap-2">
                  {todaySplitGroups.map((group) => (
                    <Badge key={group} variant="secondary">{group}</Badge>
                  ))}
                </div>
              </div>

              <Button onClick={applySplitSuggestions} className="gap-2">
                <Plus className="w-4 h-4" />
                Usar sugestões do split
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Dumbbell className="w-5 h-5 text-primary" />
            Informações do Treino
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekDay">Dia da Semana</Label>
              <Select value={weekDay} onValueChange={(v) => setWeekDay(v as WeekDay)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-white/50">
            Dica: se você já ativou um <strong>Programa</strong>, os exercícios do dia aparecem automaticamente aqui.
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Exercícios</h2>
          <Button onClick={addExercise} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Adicionar Exercício
          </Button>
        </div>

        {exercises.length === 0 && (
          <Card className="border-border border-dashed bg-card">
            <CardContent className="py-8 text-center">
              <Dumbbell className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                Nenhum exercício adicionado. Clique no botão acima para começar.
              </p>
            </CardContent>
          </Card>
        )}

        {exercises.map((exercise, exIndex) => {
          const sourceMode = inferSourceMode(exercise)

          return (
            <Card key={exercise.id} className="border-border bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-white">Exercício {exIndex + 1}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExercise(exercise.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Origem do exercício</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={sourceMode === 'bank' ? 'default' : 'outline'}
                      onClick={() => handleSourceModeChange(exercise.id, 'bank')}
                    >
                      Usar banco de exercícios
                    </Button>
                    <Button
                      type="button"
                      variant={sourceMode === 'custom' ? 'default' : 'outline'}
                      onClick={() => handleSourceModeChange(exercise.id, 'custom')}
                    >
                      Exercício personalizado
                    </Button>
                  </div>
                </div>

                {sourceMode === 'bank' ? (
                  <div className="space-y-2">
                    <Label>Exercício</Label>
                    <ExercisePicker
                      options={exercisePickerOptions}
                      value={exercise.exerciseId || null}
                      onValueChange={(exerciseId) => handleExerciseSelect(exerciseId, exercise.id)}
                      placeholder="Buscar por nome, grupo, equipamento..."
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nome do exercício</Label>
                      <Input
                        value={exercise.exerciseName || ''}
                        onChange={(e) => handleCustomExerciseNameChange(exercise.id, e.target.value)}
                        placeholder="Ex: Dead bug com pausa"
                        className="bg-background border-border"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Grupo muscular</Label>
                      <Select
                        value={exercise.muscleGroup}
                        onValueChange={(value) =>
                          updateExercise(exercise.id, { muscleGroup: value as MuscleGroup })
                        }
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Peito">Peito</SelectItem>
                          <SelectItem value="Costas">Costas</SelectItem>
                          <SelectItem value="Ombros">Ombros</SelectItem>
                          <SelectItem value="Bíceps">Bíceps</SelectItem>
                          <SelectItem value="Tríceps">Tríceps</SelectItem>
                          <SelectItem value="Pernas">Pernas</SelectItem>
                          <SelectItem value="Glúteos">Glúteos</SelectItem>
                          <SelectItem value="Posterior">Posterior</SelectItem>
                          <SelectItem value="Core">Core</SelectItem>
                          <SelectItem value="Cardio">Cardio</SelectItem>
                          <SelectItem value="Mobilidade">Mobilidade</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Séries</Label>
                  <div className="space-y-2">
                    {exercise.sets.map((set, setIndex) => (
                      <div key={setIndex} className="flex items-center gap-2">
                        <span className="w-12 text-sm text-muted-foreground">Série {setIndex + 1}</span>
                        <Input
                          type="number"
                          placeholder="Reps"
                          value={set.reps || ''}
                          onChange={(e) =>
                            updateSet(exercise.id, setIndex, { reps: parseInt(e.target.value) || 0 })
                          }
                          className="w-20 bg-background border-border"
                        />
                        <span className="text-muted-foreground">x</span>
                        <Input
                          type="number"
                          placeholder="Kg"
                          value={set.weight || ''}
                          onChange={(e) =>
                            updateSet(exercise.id, setIndex, { weight: parseFloat(e.target.value) || 0 })
                          }
                          className="w-24 bg-background border-border"
                        />
                        <span className="text-muted-foreground">kg</span>
                        {exercise.sets.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSet(exercise.id, setIndex)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button variant="outline" size="sm" onClick={() => addSet(exercise.id)} className="mt-2">
                    <Plus className="mr-1 h-4 w-4" />
                    Adicionar Série
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>RPE (1-10): {exercise.rpe}</Label>
                    <Slider
                      value={[exercise.rpe]}
                      onValueChange={([v]) => updateExercise(exercise.id, { rpe: v })}
                      min={1}
                      max={10}
                      step={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>FC Média (bpm)</Label>
                    <Input
                      type="number"
                      placeholder="Opcional"
                      value={exercise.avgHeartRate || ''}
                      onChange={(e) =>
                        updateExercise(exercise.id, {
                          avgHeartRate: parseInt(e.target.value) || undefined,
                        })
                      }
                      className="bg-background border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>FC Máxima (bpm)</Label>
                    <Input
                      type="number"
                      placeholder="Opcional"
                      value={exercise.maxHeartRate || ''}
                      onChange={(e) =>
                        updateExercise(exercise.id, {
                          maxHeartRate: parseInt(e.target.value) || undefined,
                        })
                      }
                      className="bg-background border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input
                    placeholder="Notas sobre o exercício..."
                    value={exercise.notes || ''}
                    onChange={(e) => updateExercise(exercise.id, { notes: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {exercises.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSubmit} size="lg" className="gap-2">
            <Save className="w-5 h-5" />
            Salvar Treino
          </Button>
        </div>
      )}
    </div>
  )
}
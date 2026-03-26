import { useEffect, useMemo, useState } from 'react'
import { Calendar, Filter, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LineChart } from '@/components/charts'
import type { WorkoutSession, WeekDay, MuscleGroup, WorkoutExercise } from '@/types'
import { MUSCLE_GROUPS } from '@/data/exercises'
import { calculateWorkoutVolume, calculateExerciseProgress, formatWeight } from '@/lib/calculations'
import { format, startOfDay, endOfDay } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { parseLocalDate, formatLocalDate } from '@/lib/date'

type DbWorkoutSession = {
  id: string
  user_id: string
  session_date: string
  weekday: number
  total_volume: number
  exercises: any
  created_at: string
}

type DbExercise = {
  id: string
  name: string
  muscle_group: string
  is_active: boolean
}

const weekdayLabel = (n: number): WeekDay => {
  const map: Record<number, WeekDay> = {
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado',
    7: 'Domingo',
  }
  return map[n] ?? 'Segunda'
}

function coerceNumber(v: any, fallback = 0) {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : fallback
}


function mapDbToWorkoutSession(row: DbWorkoutSession): WorkoutSession {
  const exercisesRaw = Array.isArray(row.exercises) ? row.exercises : []

  const exercises: WorkoutExercise[] = exercisesRaw.map((ex: any) => ({
    id: ex.id ?? crypto.randomUUID(),
    exerciseId: ex.exerciseId ?? '',
    exerciseName: ex.exerciseName ?? ex.name ?? '',
    muscleGroup: (ex.muscleGroup ?? 'Peito') as MuscleGroup,
    sets: Array.isArray(ex.sets)
      ? ex.sets.map((s: any) => ({
          reps: coerceNumber(s.reps, 0),
          weight: coerceNumber(s.weight, 0),
        }))
      : [{ reps: 0, weight: 0 }],
    rpe: coerceNumber(ex.rpe, 7),
    avgHeartRate: ex.avgHeartRate ?? undefined,
    maxHeartRate: ex.maxHeartRate ?? undefined,
    notes: ex.notes ?? undefined,
  }))

  return {
    id: row.id,
    date: row.session_date,
    weekDay: weekdayLabel(row.weekday),
    exercises,
    totalVolume: row.total_volume ?? 0,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  }
}

type WorkoutHistoryProps = {
  selectedUserId?: string
}

export function WorkoutHistory({ selectedUserId }: WorkoutHistoryProps) {
  const { user, profile } = useAuth()
  const role = profile?.role ?? 'user'

  const effectiveUserId = selectedUserId || user?.id || ''

  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([])
  const [dbExercises, setDbExercises] = useState<DbExercise[]>([])

  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('all')
  const [selectedExercise, setSelectedExercise] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const canViewTarget =
    !!user &&
    !!effectiveUserId &&
    (effectiveUserId === user.id || role === 'coach' || role === 'admin')

  useEffect(() => {
    const loadExercises = async () => {
      try {
        const { data, error } = await supabase
          .from('exercises')
          .select('id,name,muscle_group,is_active')
          .eq('is_active', true)
          .order('name', { ascending: true })

        if (error) throw error
        setDbExercises((data ?? []) as DbExercise[])
      } catch {
        setDbExercises([])
      }
    }

    void loadExercises()
  }, [])

  useEffect(() => {
    if (!user) return

    const loadWorkouts = async () => {
      setLoading(true)
      try {
        if (!canViewTarget) {
          setWorkouts([])
          return
        }

        const { data, error } = await supabase
          .from('workout_sessions')
          .select('id,user_id,session_date,weekday,total_volume,exercises,created_at')
          .eq('user_id', effectiveUserId)
          .order('session_date', { ascending: false })

        if (error) throw error

        const mapped = (data ?? []).map((r: any) => mapDbToWorkoutSession(r as DbWorkoutSession))
        setWorkouts(mapped)
      } catch {
        setWorkouts([])
      } finally {
        setLoading(false)
      }
    }

    void loadWorkouts()
  }, [user, effectiveUserId, canViewTarget])

  const filteredWorkouts = useMemo(() => {
    return workouts
      .filter((workout) => {
        if (selectedMuscleGroup !== 'all') {
          const hasMuscleGroup = workout.exercises.some((e) => e.muscleGroup === selectedMuscleGroup)
          if (!hasMuscleGroup) return false
        }

        if (selectedExercise !== 'all') {
          const hasExercise = workout.exercises.some((e) => e.exerciseId === selectedExercise)
          if (!hasExercise) return false
        }

        if (startDate || endDate) {
          const workoutDate = parseLocalDate(workout.date)
          const start = startDate ? startOfDay(parseLocalDate(startDate) ?? new Date('invalid')) : null
          const end = endDate ? endOfDay(parseLocalDate(endDate) ?? new Date('invalid')) : null

          if (!workoutDate) return false
          if (start && workoutDate < start) return false
          if (end && workoutDate > end) return false
        }

        return true
      })
      .sort((a, b) => {
        const da = parseLocalDate(a.date)?.getTime() ?? 0
        const db = parseLocalDate(b.date)?.getTime() ?? 0
        return db - da
      })
  }, [workouts, selectedMuscleGroup, selectedExercise, startDate, endDate])

  const progressData = useMemo(() => {
    if (selectedExercise === 'all') return []

    const progress = calculateExerciseProgress(workouts, selectedExercise)
    if (progress.length === 0) return []

    return progress[0].history.map((h) => ({
      date: h.date,
      label: formatLocalDate(h.date, (d) => format(d, 'dd/MM')),
      maxWeight: h.maxWeight,
      volume: h.totalVolume,
    }))
  }, [workouts, selectedExercise])

  const stats = useMemo(() => {
    const totalWorkouts = filteredWorkouts.length
    const totalVolume = filteredWorkouts.reduce((sum, w) => sum + calculateWorkoutVolume(w), 0)
    const avgVolume = totalWorkouts > 0 ? totalVolume / totalWorkouts : 0
    return { totalWorkouts, totalVolume, avgVolume }
  }, [filteredWorkouts])

  const clearFilters = () => {
    setSelectedMuscleGroup('all')
    setSelectedExercise('all')
    setStartDate('')
    setEndDate('')
  }

  if (user && effectiveUserId && !canViewTarget) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Histórico de Treinos</h1>
        <p className="text-white/70">Sem permissão para visualizar este aluno.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Histórico de Treinos</h1>
          <p className="text-muted-foreground">
            {loading ? 'Carregando do servidor...' : 'Visualize e filtre seus treinos'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="mb-1 text-xs text-muted-foreground">Total de Treinos</p>
            <p className="text-2xl font-bold text-white">{stats.totalWorkouts}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="mb-1 text-xs text-muted-foreground">Volume Total</p>
            <p className="text-2xl font-bold text-white">
              {(stats.totalVolume / 1000).toFixed(1)}k
              <span className="ml-1 text-sm font-normal text-muted-foreground">kg</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="mb-1 text-xs text-muted-foreground">Volume Médio</p>
            <p className="text-2xl font-bold text-white">{formatWeight(stats.avgVolume)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Grupo Muscular</Label>
              <Select value={selectedMuscleGroup} onValueChange={setSelectedMuscleGroup}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {MUSCLE_GROUPS.map((mg) => (
                    <SelectItem key={mg} value={mg}>
                      {mg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Exercício</Label>
              <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {dbExercises.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Data Final</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-background border-border"
                />
                <Button variant="outline" size="icon" onClick={clearFilters}>
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedExercise !== 'all' && progressData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <TrendingUp className="w-4 h-4 text-primary" />
              Evolução do Exercício
            </CardTitle>
          </CardHeader>

          <CardContent>
            <LineChart
              data={progressData}
              lines={[
                { key: 'maxWeight', name: 'Carga Máxima', color: '#3b82f6' },
                { key: 'volume', name: 'Volume', color: '#22c55e' },
              ]}
              xAxisKey="label"
              yAxisFormatter={(v: number) => `${v}`}
              height={250}
            />
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Calendar className="w-4 h-4 text-primary" />
            Treinos ({filteredWorkouts.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Data</TableHead>
                  <TableHead className="text-muted-foreground">Dia</TableHead>
                  <TableHead className="text-muted-foreground">Exercícios</TableHead>
                  <TableHead className="text-muted-foreground">Volume</TableHead>
                  <TableHead className="text-muted-foreground">RPE Médio</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredWorkouts.map((workout) => (
                  <TableRow key={workout.id} className="border-border">
                    <TableCell className="text-white">
                      {formatLocalDate(workout.date, (d) => format(d, 'dd/MM/yyyy'))}
                    </TableCell>

                    <TableCell className="text-muted-foreground">{workout.weekDay}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {workout.exercises.map((ex, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {ex.exerciseName}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-white">{formatWeight(calculateWorkoutVolume(workout))}</TableCell>
                    <TableCell>
                      {workout.exercises.length > 0 ? (
                        <span className="text-white">
                          {(
                            workout.exercises.reduce((sum, ex) => sum + (Number.isFinite(ex.rpe) ? ex.rpe : 0), 0) /
                            workout.exercises.length
                          ).toFixed(1)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && filteredWorkouts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum treino encontrado com os filtros selecionados
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Carregando histórico...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
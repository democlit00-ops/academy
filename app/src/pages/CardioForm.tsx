//academy\app\src\pages\CardioForm.tsx
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Heart, Save, Flame, History, User, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { CARDIO_TYPES, HEART_RATE_ZONES } from '@/data/exercises'
import type { CardioSession, CardioType, HeartRateZone } from '@/types'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getTodayLocalDateString, formatLocalDate } from '@/lib/date'

interface CardioFormProps {
  onSave: (cardio: CardioSession) => void | Promise<void>
  selectedUserId?: string | null
  selectedUserLabel?: string | null
}

type DbProgramCardioItem = {
  id: string
  block: 'cardio'
  exercise_id: string | null
  custom_exercise_name: string | null
  duration_min: number | null
  zone_min_bpm: number | null
  zone_max_bpm: number | null
  notes: string | null
  sort_order: number
  exercises?: { name: string } | Array<{ name: string }> | null
}

type ProgramCardioSuggestion = {
  planItemId: string
  exerciseId: string
  exerciseName: string
  duration: number
  zoneMinBpm?: number
  zoneMaxBpm?: number
  notes?: string
}

type DbCardioRow = {
  id: string
  user_id: string
  session_date: string
  weekday: number | null
  data: any | null
  created_at: string | null
}

function safeNumber(v: any): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : undefined
}

function formatDateSafe(date: string) {
  return formatLocalDate(date, (d) => format(d, 'dd/MM/yyyy'))
}

function calculateEstimatedMaxHeartRate(age?: number): number | undefined {
  if (!age || age <= 0) return undefined
  return Math.round(220 - age)
}

function calculateHeartRateZone(
  avgHeartRate?: number,
  maxHeartRate?: number,
  estimatedMaxHeartRate?: number
): HeartRateZone {
  const baseMaxHr = maxHeartRate || estimatedMaxHeartRate
  if (!avgHeartRate || !baseMaxHr || baseMaxHr <= 0) return 'Zona 2'

  const intensity = avgHeartRate / baseMaxHr

  if (intensity < 0.6) return 'Zona 1'
  if (intensity < 0.7) return 'Zona 2'
  if (intensity < 0.8) return 'Zona 3'
  if (intensity < 0.9) return 'Zona 4'
  return 'Zona 5'
}

export function CardioForm({
  onSave,
  selectedUserId,
  selectedUserLabel,
}: CardioFormProps) {
  const { user, profile } = useAuth()

  const effectiveUserId = selectedUserId || user?.id || null
  const isStudentMode = !!selectedUserId

  const [date, setDate] = useState(getTodayLocalDateString())
  const [type, setType] = useState<CardioType>('Esteira')
  const [duration, setDuration] = useState('')
  const [distance, setDistance] = useState('')
  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [maxHeartRate, setMaxHeartRate] = useState('')
  const [calories, setCalories] = useState('')
  const [steps, setSteps] = useState('')
  const [notes, setNotes] = useState('')

  const [historyLoading, setHistoryLoading] = useState(true)
  const [history, setHistory] = useState<CardioSession[]>([])
  const [programCardioItems, setProgramCardioItems] = useState<ProgramCardioSuggestion[]>([])
  const [loadingProgramCardio, setLoadingProgramCardio] = useState(false)
  const [selectedProgramCardioItem, setSelectedProgramCardioItem] = useState<ProgramCardioSuggestion | null>(null)

  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const estimatedMaxHeartRate = useMemo(() => {
    const age = typeof profile?.age === 'number' ? profile.age : undefined
    return calculateEstimatedMaxHeartRate(age)
  }, [profile?.age])

  const computedHeartRateZone = useMemo(() => {
    const avgHr = avgHeartRate ? parseInt(avgHeartRate, 10) : undefined
    const maxHr = maxHeartRate ? parseInt(maxHeartRate, 10) : undefined

    return calculateHeartRateZone(avgHr, maxHr, estimatedMaxHeartRate)
  }, [avgHeartRate, maxHeartRate, estimatedMaxHeartRate])

  const selectedZone = useMemo(
    () => HEART_RATE_ZONES.find((z) => z.zone === computedHeartRateZone),
    [computedHeartRateZone]
  )

  const avgSpeed = useMemo(() => {
    const durationMinutes = safeNumber(duration)
    const distanceKm = safeNumber(distance)

    if (!durationMinutes || !distanceKm || durationMinutes <= 0 || distanceKm <= 0) {
      return ''
    }

    const speed = distanceKm / (durationMinutes / 60)
    return speed.toFixed(1)
  }, [duration, distance])

  const hasProgramCardioSuggestions = programCardioItems.length > 0

  const loadHistory = useCallback(async () => {
    if (!effectiveUserId) {
      setHistory([])
      setHistoryLoading(false)
      return
    }

    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('cardio_sessions')
        .select('id,user_id,session_date,weekday,data,created_at')
        .eq('user_id', effectiveUserId)
        .order('session_date', { ascending: false })
        .limit(30)

      if (error) throw error

      const mapped = ((data ?? []) as DbCardioRow[]).map((row) => {
        const d = row.data ?? {}

        const avgHr = safeNumber(d.avgHeartRate)
        const maxHr = safeNumber(d.maxHeartRate)
        const zone = (d.heartRateZone ??
          calculateHeartRateZone(
            avgHr,
            maxHr,
            estimatedMaxHeartRate
          )) as HeartRateZone

        const cardio: CardioSession = {
          id: row.id,
          date: row.session_date,
          type: (d.type ?? 'Esteira') as CardioType,
          duration: safeNumber(d.duration) ?? 0,
          distance: safeNumber(d.distance),
          avgSpeed: safeNumber(d.avgSpeed),
          avgHeartRate: avgHr,
          maxHeartRate: maxHr,
          calories: safeNumber(d.calories),
          steps: safeNumber(d.steps),
          heartRateZone: zone,
          notes: d.notes ?? undefined,
        }

        return cardio
      })

      setHistory(mapped)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar histórico cardio.')
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [effectiveUserId, estimatedMaxHeartRate])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!effectiveUserId) {
      setProgramCardioItems([])
      setSelectedProgramCardioItem(null)
      setLoadingProgramCardio(false)
      return
    }

    const loadProgramCardio = async () => {
      try {
        setLoadingProgramCardio(true)

        const { data: active, error: activeError } = await supabase
          .from('user_active_plan')
          .select('active_program_id')
          .eq('user_id', effectiveUserId)
          .maybeSingle()

        if (activeError) throw activeError

        const activeProgramId = active?.active_program_id ?? null
        if (!activeProgramId) {
          setProgramCardioItems([])
          setSelectedProgramCardioItem(null)
          return
        }

        const weekday = new Date(`${date}T00:00:00`).getDay()
        const isoWeekday = weekday === 0 ? 7 : weekday

        const { data: dayRow, error: dayError } = await supabase
          .from('plan_days')
          .select('id,weekday,day_title')
          .eq('plan_id', activeProgramId)
          .eq('weekday', isoWeekday)
          .maybeSingle()

        if (dayError) throw dayError
        if (!dayRow?.id) {
          setProgramCardioItems([])
          setSelectedProgramCardioItem(null)
          return
        }

        const { data: items, error: itemsError } = await supabase
          .from('plan_items')
          .select(`
            id,block,exercise_id,custom_exercise_name,duration_min,zone_min_bpm,zone_max_bpm,notes,sort_order,
            exercises:exercise_id ( name )
          `)
          .eq('plan_day_id', dayRow.id)
          .eq('block', 'cardio')
          .order('sort_order', { ascending: true })

        if (itemsError) throw itemsError

        const mapped = ((items ?? []) as unknown as DbProgramCardioItem[]).map((item) => {
          const exerciseRef = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises

          return {
            planItemId: item.id,
            exerciseId: item.exercise_id ?? '',
            exerciseName: exerciseRef?.name ?? item.custom_exercise_name ?? 'Cardio',
            duration: Math.max(item.duration_min ?? 0, 0),
            zoneMinBpm: item.zone_min_bpm ?? undefined,
            zoneMaxBpm: item.zone_max_bpm ?? undefined,
            notes: item.notes ?? undefined,
          }
        })

        setProgramCardioItems(mapped)
        setSelectedProgramCardioItem((current) =>
          current && mapped.some((item) => item.planItemId === current.planItemId)
            ? mapped.find((item) => item.planItemId === current.planItemId) ?? null
            : null
        )
      } catch (e: any) {
        toast.error(e?.message ?? 'Erro ao carregar cardio do programa ativo.')
        setProgramCardioItems([])
        setSelectedProgramCardioItem(null)
      } finally {
        setLoadingProgramCardio(false)
      }
    }

    void loadProgramCardio()
  }, [effectiveUserId, date])

  const resetForm = () => {
    setDate(getTodayLocalDateString())
    setType('Esteira')
    setDuration('')
    setDistance('')
    setAvgHeartRate('')
    setMaxHeartRate('')
    setCalories('')
    setSteps('')
    setNotes('')
    setSelectedProgramCardioItem(null)
  }

  const applyProgramCardioToForm = (item: ProgramCardioSuggestion) => {
    setSelectedProgramCardioItem(item)
    setDuration(item.duration > 0 ? String(item.duration) : '')
    setNotes(item.notes ?? '')

    if (CARDIO_TYPES.includes(item.exerciseName as CardioType)) {
      setType(item.exerciseName as CardioType)
    } else {
      setType('Outro')
    }
  }

const toggleExpanded = (id: string) => {
  setExpandedIds((prev) =>
    prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
  )
}

const handleDeleteCardio = async (cardioId: string) => {
  if (!effectiveUserId) return
  if (isStudentMode) {
    toast.error('No Modo Aluno, o cardio fica em visualização nesta versão.')
    return
  }

  const confirmed = window.confirm('Tem certeza que deseja excluir este cardio do histórico?')
  if (!confirmed) return

  try {
    setDeletingId(cardioId)

    const { error } = await supabase
      .from('cardio_sessions')
      .delete()
      .eq('id', cardioId)
      .eq('user_id', effectiveUserId)

    if (error) throw error

    setHistory((prev) => prev.filter((item) => item.id !== cardioId))
    setExpandedIds((prev) => prev.filter((id) => id !== cardioId))
    toast.success('Cardio excluído com sucesso ✅')
  } catch (e: any) {
    toast.error(e?.message ?? 'Erro ao excluir cardio.')
  } finally {
    setDeletingId(null)
  }
}

  const handleSubmit = async () => {
    if (isStudentMode) {
      toast.error('No Modo Aluno, o cardio está apenas para visualização por enquanto.')
      return
    }

    if (!duration) {
      toast.error('Informe a duração do treino.')
      return
    }

    const avgHr = avgHeartRate ? parseInt(avgHeartRate, 10) : undefined
    const maxHr = maxHeartRate ? parseInt(maxHeartRate, 10) : undefined
    const heartRateZone = calculateHeartRateZone(avgHr, maxHr, estimatedMaxHeartRate)

    const cardio: CardioSession = {
      id: crypto.randomUUID(),
      date,
      type,
      exerciseId: selectedProgramCardioItem?.exerciseId || undefined,
      exerciseName: selectedProgramCardioItem?.exerciseName || undefined,
      programItemId: selectedProgramCardioItem?.planItemId || undefined,
      duration: parseInt(duration, 10),
      distance: distance ? parseFloat(distance) : undefined,
      avgSpeed: avgSpeed ? parseFloat(avgSpeed) : undefined,
      avgHeartRate: avgHr,
      maxHeartRate: maxHr,
      calories: calories ? parseInt(calories, 10) : undefined,
      steps: steps ? parseInt(steps, 10) : undefined,
      heartRateZone,
      notes: notes || undefined,
    }

    try {
      await Promise.resolve(onSave(cardio))
      void loadHistory()
      resetForm()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar cardio.')
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cardio</h1>
          <p className="text-muted-foreground">
            {isStudentMode
              ? 'Visualize os treinos cardiovasculares do aluno selecionado'
              : 'Registre seus treinos cardiovasculares'}
          </p>

          {isStudentMode && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              <User className="h-4 w-4" />
              <span>
                Visualizando dados de: <strong>{selectedUserLabel || 'Aluno selecionado'}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {(loadingProgramCardio || hasProgramCardioSuggestions) && (
        <Card className="border-cyan-500/30 bg-cyan-500/10">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-cyan-500/30 bg-cyan-500/20 text-cyan-300">
                  Cardio do programa ativo
                </Badge>
              </div>

              {loadingProgramCardio ? (
                <p className="text-sm text-cyan-100">Carregando cardio do programa para a data selecionada...</p>
              ) : (
                <div className="space-y-3">
                  {programCardioItems.map((item) => {
                    const zoneLabel =
                      item.zoneMinBpm || item.zoneMaxBpm
                        ? `${item.zoneMinBpm ?? '-'}-${item.zoneMaxBpm ?? '-'} bpm`
                        : null
                    const isSelected = selectedProgramCardioItem?.planItemId === item.planItemId

                    return (
                      <div
                        key={item.planItemId}
                        className="rounded-lg border border-cyan-500/20 bg-background/40 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-white">{item.exerciseName}</div>
                            <div className="text-xs text-cyan-100">
                              {[`${item.duration} min`, zoneLabel].filter(Boolean).join(' • ') || 'Cardio do dia'}
                            </div>
                            {item.notes && (
                              <div className="mt-1 text-xs text-muted-foreground">{item.notes}</div>
                            )}
                          </div>

                          {!isStudentMode && (
                            <Button
                              type="button"
                              size="sm"
                              variant={isSelected ? 'secondary' : 'outline'}
                              onClick={() => applyProgramCardioToForm(item)}
                            >
                              {isSelected ? 'Aplicado ao formulário' : 'Usar no cardio'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Heart className="h-5 w-5 text-red-500" />
            Novo Treino Cardio
            {isStudentMode && (
              <Badge variant="secondary" className="ml-2">
                Somente visualização
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Atividade</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as CardioType)}
                disabled={isStudentMode}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARDIO_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="duration">
                Duração <span className="text-red-500">*</span>
              </Label>
              <Input
                id="duration"
                type="number"
                placeholder="min"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="distance">Distância (km)</Label>
              <Input
                id="distance"
                type="number"
                step="0.01"
                placeholder="km"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avgSpeed">Vel. Média (km/h)</Label>
              <Input
                id="avgSpeed"
                type="text"
                placeholder="km/h"
                value={avgSpeed}
                className="bg-background border-border"
                readOnly
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calories">Calorias</Label>
              <Input
                id="calories"
                type="number"
                placeholder="kcal"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="avgHeartRate">FC Média (bpm)</Label>
              <Input
                id="avgHeartRate"
                type="number"
                placeholder="bpm"
                value={avgHeartRate}
                onChange={(e) => setAvgHeartRate(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxHeartRate">FC Máxima (bpm)</Label>
              <Input
                id="maxHeartRate"
                type="number"
                placeholder="bpm"
                value={maxHeartRate}
                onChange={(e) => setMaxHeartRate(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="steps">Passos</Label>
              <Input
                id="steps"
                type="number"
                placeholder="passos"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zone">Zona Cardíaca (automática)</Label>
              <Input
                id="zone"
                value={computedHeartRateZone}
                readOnly
                className="bg-background border-border text-white"
                disabled
              />
            </div>
          </div>

          {selectedZone && (
            <div
              className="flex items-center gap-3 rounded-lg p-3"
              style={{ backgroundColor: `${selectedZone.color}15` }}
            >
              <Flame className="h-5 w-5" style={{ color: selectedZone.color }} />
              <div>
                <p className="text-sm font-medium" style={{ color: selectedZone.color }}>
                  {selectedZone.zone}: {selectedZone.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Intensidade {selectedZone.range} da FC máxima
                  {estimatedMaxHeartRate ? ` • FC máx estimada: ${estimatedMaxHeartRate} bpm` : ''}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Como foi o treino?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[90px] bg-background border-border"
              disabled={isStudentMode}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              size="lg"
              className="gap-2"
              disabled={isStudentMode}
            >
              <Save className="h-5 w-5" />
              Registrar Cardio
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <History className="h-4 w-4 text-primary" />
            Histórico Cardio
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading}>
            {historyLoading ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
  <TableHeader>
    <TableRow className="border-border hover:bg-transparent">
      <TableHead className="text-muted-foreground">Abrir</TableHead>
      <TableHead className="text-muted-foreground">Data</TableHead>
      <TableHead className="text-muted-foreground">Tipo</TableHead>
      <TableHead className="text-muted-foreground">Duração</TableHead>
      <TableHead className="text-muted-foreground">Distância</TableHead>
      <TableHead className="text-muted-foreground">FC</TableHead>
      <TableHead className="text-muted-foreground">Zona</TableHead>
      {!isStudentMode && (
        <TableHead className="text-right text-muted-foreground">Ações</TableHead>
      )}
    </TableRow>
  </TableHeader>

  <TableBody>
    {history.map((h) => {
      const isExpanded = expandedIds.includes(h.id)

      return (
        <Fragment key={h.id}>
          <TableRow
            className="cursor-pointer border-border transition-colors hover:bg-white/5"
            onClick={() => toggleExpanded(h.id)}
          >
            <TableCell className="text-white">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </TableCell>

            <TableCell className="text-white">{formatDateSafe(h.date)}</TableCell>
            <TableCell className="text-muted-foreground">{h.type}</TableCell>
            <TableCell className="text-white">{h.duration} min</TableCell>

            <TableCell className="text-white">
              {h.distance !== undefined ? `${h.distance.toFixed(2)} km` : '-'}
            </TableCell>

            <TableCell className="text-white">
              {h.avgHeartRate || h.maxHeartRate ? (
                <span>
                  {h.avgHeartRate ? `${h.avgHeartRate}` : '-'}
                  <span className="text-muted-foreground"> / </span>
                  {h.maxHeartRate ? `${h.maxHeartRate}` : '-'}
                </span>
              ) : (
                '-'
              )}
            </TableCell>

            <TableCell>
              <Badge variant="secondary" className="text-xs">
                {h.heartRateZone}
              </Badge>
            </TableCell>

            {!isStudentMode && (
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  disabled={deletingId === h.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleDeleteCardio(h.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            )}
          </TableRow>

          {isExpanded && (
            <TableRow className="border-border bg-white/[0.03]">
              <TableCell colSpan={isStudentMode ? 7 : 8}>
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</p>
                      <p className="mt-1 text-sm font-semibold text-white">{h.type}</p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Duração</p>
                      <p className="mt-1 text-sm font-semibold text-white">{h.duration} min</p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Zona Cardíaca</p>
                      <p className="mt-1 text-sm font-semibold text-white">{h.heartRateZone}</p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Data</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatDateSafe(h.date)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Distância</p>
                      <p className="mt-1 text-sm text-white">
                        {h.distance !== undefined ? `${h.distance.toFixed(2)} km` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Vel. Média</p>
                      <p className="mt-1 text-sm text-white">
                        {h.avgSpeed !== undefined ? `${h.avgSpeed.toFixed(1)} km/h` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">FC Média</p>
                      <p className="mt-1 text-sm text-white">
                        {h.avgHeartRate !== undefined ? `${h.avgHeartRate} bpm` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">FC Máxima</p>
                      <p className="mt-1 text-sm text-white">
                        {h.maxHeartRate !== undefined ? `${h.maxHeartRate} bpm` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Calorias</p>
                      <p className="mt-1 text-sm text-white">
                        {h.calories !== undefined ? `${h.calories} kcal` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Passos</p>
                      <p className="mt-1 text-sm text-white">
                        {h.steps !== undefined ? `${h.steps}` : '-'}
                      </p>
                    </div>
                  </div>

                  {h.notes && (
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Observações</p>
                      <p className="mt-1 text-sm text-white">{h.notes}</p>
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}
        </Fragment>
      )
    })}

    {!historyLoading && history.length === 0 && (
      <TableRow>
        <TableCell colSpan={isStudentMode ? 7 : 8} className="py-8 text-center text-muted-foreground">
          Nenhum cardio registrado ainda
        </TableCell>
      </TableRow>
    )}

    {historyLoading && (
      <TableRow>
        <TableCell colSpan={isStudentMode ? 7 : 8} className="py-8 text-center text-muted-foreground">
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

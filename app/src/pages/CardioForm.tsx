import { useCallback, useEffect, useMemo, useState } from 'react'
import { Heart, Save, Flame, History, User } from 'lucide-react'
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
  onSave: (cardio: CardioSession) => void
  selectedUserId?: string | null
  selectedUserLabel?: string | null
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
  const [avgSpeed, setAvgSpeed] = useState('')
  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [maxHeartRate, setMaxHeartRate] = useState('')
  const [calories, setCalories] = useState('')
  const [steps, setSteps] = useState('')
  const [notes, setNotes] = useState('')

  const [historyLoading, setHistoryLoading] = useState(true)
  const [history, setHistory] = useState<CardioSession[]>([])

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

  const resetForm = () => {
    setDate(getTodayLocalDateString())
    setType('Esteira')
    setDuration('')
    setDistance('')
    setAvgSpeed('')
    setAvgHeartRate('')
    setMaxHeartRate('')
    setCalories('')
    setSteps('')
    setNotes('')
  }

  const handleSubmit = () => {
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

    onSave(cardio)
    setHistory((prev) => [cardio, ...prev].slice(0, 30))
    void loadHistory()
    resetForm()
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
                type="number"
                step="0.1"
                placeholder="km/h"
                value={avgSpeed}
                onChange={(e) => setAvgSpeed(e.target.value)}
                className="bg-background border-border"
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
                  <TableHead className="text-muted-foreground">Data</TableHead>
                  <TableHead className="text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-muted-foreground">Duração</TableHead>
                  <TableHead className="text-muted-foreground">Distância</TableHead>
                  <TableHead className="text-muted-foreground">FC</TableHead>
                  <TableHead className="text-muted-foreground">Zona</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id} className="border-border">
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
                  </TableRow>
                ))}

                {!historyLoading && history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum cardio registrado ainda
                    </TableCell>
                  </TableRow>
                )}

                {historyLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
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
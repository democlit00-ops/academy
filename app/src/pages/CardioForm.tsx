import { useEffect, useMemo, useState } from 'react'
import { Heart, Save, Flame, History, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { CARDIO_TYPES, HEART_RATE_ZONES } from '@/data/exercises'
import type { CardioSession, CardioType, HeartRateZone } from '@/types'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

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

export function CardioForm({
  onSave,
  selectedUserId,
  selectedUserLabel,
}: CardioFormProps) {
  const { user } = useAuth()

  const effectiveUserId = selectedUserId || user?.id || null
  const isStudentMode = !!selectedUserId

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [type, setType] = useState<CardioType>('Esteira')
  const [duration, setDuration] = useState('')
  const [distance, setDistance] = useState('')
  const [avgSpeed, setAvgSpeed] = useState('')
  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [maxHeartRate, setMaxHeartRate] = useState('')
  const [calories, setCalories] = useState('')
  const [steps, setSteps] = useState('')
  const [heartRateZone, setHeartRateZone] = useState<HeartRateZone>('Zona 2')
  const [notes, setNotes] = useState('')

  // Histórico (Supabase)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [history, setHistory] = useState<CardioSession[]>([])

  const selectedZone = useMemo(
    () => HEART_RATE_ZONES.find((z) => z.zone === heartRateZone),
    [heartRateZone]
  )

  const loadHistory = async () => {
    if (!effectiveUserId) return

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

        const cardio: CardioSession = {
          id: row.id,
          date: row.session_date,
          type: (d.type ?? 'Esteira') as CardioType,
          duration: safeNumber(d.duration) ?? 0,
          distance: safeNumber(d.distance),
          avgSpeed: safeNumber(d.avgSpeed),
          avgHeartRate: safeNumber(d.avgHeartRate),
          maxHeartRate: safeNumber(d.maxHeartRate),
          calories: safeNumber(d.calories),
          steps: safeNumber(d.steps),
          heartRateZone: (d.heartRateZone ?? 'Zona 2') as HeartRateZone,
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
  }

  useEffect(() => {
    void loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId])

  const handleSubmit = async () => {
    if (isStudentMode) {
      toast.error('No Modo Aluno, o cardio está apenas para visualização por enquanto.')
      return
    }

    if (!duration) {
      toast.error('Informe a duração do treino')
      return
    }

    const cardio: CardioSession = {
      id: crypto.randomUUID(),
      date,
      type,
      duration: parseInt(duration),
      distance: distance ? parseFloat(distance) : undefined,
      avgSpeed: avgSpeed ? parseFloat(avgSpeed) : undefined,
      avgHeartRate: avgHeartRate ? parseInt(avgHeartRate) : undefined,
      maxHeartRate: maxHeartRate ? parseInt(maxHeartRate) : undefined,
      calories: calories ? parseInt(calories) : undefined,
      steps: steps ? parseInt(steps) : undefined,
      heartRateZone,
      notes: notes || undefined,
    }

    // 1) salva (App.tsx faz local + Supabase)
    onSave(cardio)

    // 2) feedback + otimista
    toast.success('Cardio registrado!')
    setHistory((prev) => [cardio, ...prev].slice(0, 30))

    // 3) recarrega do servidor
    void loadHistory()

    // Reset form
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setType('Esteira')
    setDuration('')
    setDistance('')
    setAvgSpeed('')
    setAvgHeartRate('')
    setMaxHeartRate('')
    setCalories('')
    setSteps('')
    setHeartRateZone('Zona 2')
    setNotes('')
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
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

      {/* Formulário */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Novo Treino Cardio
            {isStudentMode && (
              <Badge variant="secondary" className="ml-2">
                Somente visualização
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Data e Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Métricas principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

          {/* Frequência cardíaca */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <Label htmlFor="zone">Zona Cardíaca</Label>
              <Select
                value={heartRateZone}
                onValueChange={(v) => setHeartRateZone(v as HeartRateZone)}
                disabled={isStudentMode}
              >
                <SelectTrigger
                  className="bg-background border-border"
                  style={{ borderColor: selectedZone?.color }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEART_RATE_ZONES.map((z) => (
                    <SelectItem key={z.zone} value={z.zone}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: z.color }} />
                        {z.zone} - {z.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info da zona cardíaca */}
          {selectedZone && (
            <div
              className="p-3 rounded-lg flex items-center gap-3"
              style={{ backgroundColor: `${selectedZone.color}15` }}
            >
              <Flame className="w-5 h-5" style={{ color: selectedZone.color }} />
              <div>
                <p className="text-sm font-medium" style={{ color: selectedZone.color }}>
                  {selectedZone.zone}: {selectedZone.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Intensidade {selectedZone.range} da FC máxima
                </p>
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input
              id="notes"
              placeholder="Como foi o treino?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-background border-border"
              disabled={isStudentMode}
            />
          </div>

          {/* Botão salvar */}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              size="lg"
              className="gap-2"
              disabled={isStudentMode}
            >
              <Save className="w-5 h-5" />
              Registrar Cardio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Histórico Cardio
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadHistory}>
            Atualizar
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
                    <TableCell className="text-white">{format(new Date(h.date), 'dd/MM/yyyy')}</TableCell>
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum cardio registrado ainda
                    </TableCell>
                  </TableRow>
                )}

                {historyLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
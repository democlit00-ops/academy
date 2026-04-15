//academy\app\src\pages\PhysiologicalControl.tsx
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Moon, Save, Heart, Wind, Droplets, History, User, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { PhysiologicalData } from '@/types'
import { parseTimeToDecimal } from '@/lib/calculations'
import { format } from 'date-fns'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getTodayLocalDateString, formatLocalDate } from '@/lib/date'

interface PhysiologicalControlProps {
  onSave: (data: PhysiologicalData) => void | Promise<void>
  physioData: PhysiologicalData[]
  selectedUserId?: string | null
  selectedUserLabel?: string | null
}

type DbPhysioRow = {
  id: string
  user_id: string
  entry_date: string
  data: any
  created_at: string | null
}

function safeNumber(v: any): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : undefined
}

export function PhysiologicalControl({
  onSave,
  physioData,
  selectedUserId,
  selectedUserLabel,
}: PhysiologicalControlProps) {
  const { user } = useAuth()

  const effectiveUserId = selectedUserId || user?.id || null
  const isStudentMode = !!selectedUserId

  const [date, setDate] = useState(getTodayLocalDateString())
  const [weight, setWeight] = useState('')
  const [restingHR, setRestingHR] = useState('')
  const [sleepHR, setSleepHR] = useState('')
  const [sleepTotal, setSleepTotal] = useState('07:00')
  const [sleepREM, setSleepREM] = useState('')
  const [sleepLight, setSleepLight] = useState('')
  const [sleepDeep, setSleepDeep] = useState('')
  const [awakeTime, setAwakeTime] = useState('')
  const [spo2, setSpo2] = useState('')
  const [respiratoryRate, setRespiratoryRate] = useState('')
  const [fatigue, setFatigue] = useState(5)
  const [notes, setNotes] = useState('')

  const [historyLoading, setHistoryLoading] = useState(true)
  const [history, setHistory] = useState<PhysiologicalData[]>([])
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sleepTotalHours = parseTimeToDecimal(sleepTotal)

  const loadHistory = useCallback(async () => {
    if (!effectiveUserId) {
      setHistory([])
      setHistoryLoading(false)
      return
    }

    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('physio_entries')
        .select('id,user_id,entry_date,data,created_at')
        .eq('user_id', effectiveUserId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error

      const mapped = ((data ?? []) as DbPhysioRow[]).map((row) => {
        const d = row.data ?? {}

        const item: PhysiologicalData = {
          id: row.id,
          date: row.entry_date,
          weight: safeNumber(d.weight),
          restingHeartRate: safeNumber(d.restingHeartRate),
          sleepHeartRate: safeNumber(d.sleepHeartRate),
          sleepTotal: d.sleepTotal ?? '00:00',
          sleepTotalHours:
            safeNumber(d.sleepTotalHours) ?? parseTimeToDecimal(d.sleepTotal ?? '00:00'),
          sleepREM: safeNumber(d.sleepREM),
          sleepLight: safeNumber(d.sleepLight),
          sleepDeep: safeNumber(d.sleepDeep),
          awakeTime: safeNumber(d.awakeTime),
          spo2: safeNumber(d.spo2),
          respiratoryRate: safeNumber(d.respiratoryRate),
          fatigue: safeNumber(d.fatigue) ?? 5,
          notes: d.notes ?? undefined,
        }

        return item
      })

      setHistory(mapped)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar histórico fisiológico.')
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const resetForm = () => {
    setDate(getTodayLocalDateString())
    setWeight('')
    setRestingHR('')
    setSleepHR('')
    setSleepTotal('07:00')
    setSleepREM('')
    setSleepLight('')
    setSleepDeep('')
    setAwakeTime('')
    setSpo2('')
    setRespiratoryRate('')
    setFatigue(5)
    setNotes('')
  }

  const toggleExpanded = (id: string) => {
  setExpandedIds((prev) =>
    prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
  )
}

const handleDeletePhysio = async (entryId: string) => {
  if (!effectiveUserId) return
  if (isStudentMode) {
    toast.error('No Modo Aluno, o registro fisiológico fica em visualização nesta versão.')
    return
  }

  const confirmed = window.confirm('Tem certeza que deseja excluir este registro fisiológico?')
  if (!confirmed) return

  try {
    setDeletingId(entryId)

    const { error } = await supabase
      .from('physio_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', effectiveUserId)

    if (error) throw error

    setHistory((prev) => prev.filter((item) => item.id !== entryId))
    setExpandedIds((prev) => prev.filter((id) => id !== entryId))
    toast.success('Registro fisiológico excluído com sucesso ✅')
  } catch (e: any) {
    toast.error(e?.message ?? 'Erro ao excluir registro fisiológico.')
  } finally {
    setDeletingId(null)
  }
}

  const handleSubmit = async () => {
    if (isStudentMode) {
      toast.error('No Modo Aluno, o registro está apenas para visualização por enquanto.')
      return
    }

    const data: PhysiologicalData = {
      id: crypto.randomUUID(),
      date,
      weight: weight ? parseFloat(weight) : undefined,
      restingHeartRate: restingHR ? parseInt(restingHR) : undefined,
      sleepHeartRate: sleepHR ? parseInt(sleepHR) : undefined,
      sleepTotal,
      sleepTotalHours,
      sleepREM: sleepREM ? parseInt(sleepREM) : undefined,
      sleepLight: sleepLight ? parseInt(sleepLight) : undefined,
      sleepDeep: sleepDeep ? parseInt(sleepDeep) : undefined,
      awakeTime: awakeTime ? parseInt(awakeTime) : undefined,
      spo2: spo2 ? parseInt(spo2) : undefined,
      respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
      fatigue,
      notes: notes || undefined,
    }

    try {
      await Promise.resolve(onSave(data))
      setHistory((prev) => [data, ...prev].slice(0, 30))
      void loadHistory()
      resetForm()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar registro fisiológico.')
    }
  }

  const latestData = useMemo(() => {
    if (history.length > 0) return history[0]
    return physioData[0] ?? physioData[physioData.length - 1]
  }, [history, physioData])

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Controle Fisiológico</h1>
          <p className="text-muted-foreground">
            {isStudentMode
              ? 'Visualize os indicadores fisiológicos do aluno selecionado'
              : 'Monitore seus indicadores de recuperação'}
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

      {latestData && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span className="text-xs">FC Repouso</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {latestData.restingHeartRate || '--'}
                <span className="ml-1 text-sm font-normal text-muted-foreground">bpm</span>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                <Moon className="h-4 w-4" />
                <span className="text-xs">Sono</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {latestData.sleepTotalHours?.toFixed(1) || '--'}
                <span className="ml-1 text-sm font-normal text-muted-foreground">h</span>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                <Droplets className="h-4 w-4" />
                <span className="text-xs">SpO2</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {latestData.spo2 || '--'}
                <span className="ml-1 text-sm font-normal text-muted-foreground">%</span>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                <Wind className="h-4 w-4" />
                <span className="text-xs">Respiração</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {latestData.respiratoryRate || '--'}
                <span className="ml-1 text-sm font-normal text-muted-foreground">rpm</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Heart className="h-5 w-5 text-red-500" />
            Novo Registro
            {isStudentMode && (
              <Badge variant="secondary" className="ml-2">
                Somente visualização
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                placeholder="kg"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="restingHR">FC Repouso</Label>
              <Input
                id="restingHR"
                type="number"
                placeholder="bpm"
                value={restingHR}
                onChange={(e) => setRestingHR(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sleepHR">FC Média Sono</Label>
              <Input
                id="sleepHR"
                type="number"
                placeholder="bpm"
                value={sleepHR}
                onChange={(e) => setSleepHR(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-white">
              <Moon className="h-4 w-4 text-blue-400" />
              Sono
            </h3>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="sleepTotal">Total (hh:mm)</Label>
                <Input
                  id="sleepTotal"
                  type="time"
                  value={sleepTotal}
                  onChange={(e) => setSleepTotal(e.target.value)}
                  className="bg-background border-border"
                  disabled={isStudentMode}
                />
                <p className="text-xs text-muted-foreground">= {sleepTotalHours.toFixed(2)}h</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sleepREM">REM (min)</Label>
                <Input
                  id="sleepREM"
                  type="number"
                  placeholder="min"
                  value={sleepREM}
                  onChange={(e) => setSleepREM(e.target.value)}
                  className="bg-background border-border"
                  disabled={isStudentMode}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sleepLight">Leve (min)</Label>
                <Input
                  id="sleepLight"
                  type="number"
                  placeholder="min"
                  value={sleepLight}
                  onChange={(e) => setSleepLight(e.target.value)}
                  className="bg-background border-border"
                  disabled={isStudentMode}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sleepDeep">Profundo (min)</Label>
                <Input
                  id="sleepDeep"
                  type="number"
                  placeholder="min"
                  value={sleepDeep}
                  onChange={(e) => setSleepDeep(e.target.value)}
                  className="bg-background border-border"
                  disabled={isStudentMode}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="awakeTime">Acordado (min)</Label>
                <Input
                  id="awakeTime"
                  type="number"
                  placeholder="min"
                  value={awakeTime}
                  onChange={(e) => setAwakeTime(e.target.value)}
                  className="bg-background border-border"
                  disabled={isStudentMode}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="spo2">SpO2 Média (%)</Label>
              <Input
                id="spo2"
                type="number"
                placeholder="%"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="respiratoryRate">Freq. Respiratória (rpm)</Label>
              <Input
                id="respiratoryRate"
                type="number"
                placeholder="rpm"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(e.target.value)}
                className="bg-background border-border"
                disabled={isStudentMode}
              />
            </div>

            <div className="space-y-2">
              <Label>Cansaço (1-10): {fatigue}</Label>
              <Slider
                value={[fatigue]}
                onValueChange={([v]) => setFatigue(v)}
                min={1}
                max={10}
                step={1}
                disabled={isStudentMode}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Descansado</span>
                <span>Exausto</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Como você se sente hoje?"
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
              Salvar Registro
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <History className="h-4 w-4 text-primary" />
            Histórico Fisiológico
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
      <TableHead className="text-muted-foreground">Peso</TableHead>
      <TableHead className="text-muted-foreground">FC Repouso</TableHead>
      <TableHead className="text-muted-foreground">Sono</TableHead>
      <TableHead className="text-muted-foreground">SpO2</TableHead>
      <TableHead className="text-muted-foreground">Cansaço</TableHead>
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

            <TableCell className="text-white">
              {formatLocalDate(h.date, (d) => format(d, 'dd/MM/yyyy'))}
            </TableCell>

            <TableCell className="text-white">
              {h.weight !== undefined ? `${h.weight.toFixed(1)} kg` : '-'}
            </TableCell>

            <TableCell className="text-white">
              {h.restingHeartRate ?? '-'}
            </TableCell>

            <TableCell className="text-white">
              {h.sleepTotalHours !== undefined ? (
                <span>
                  {h.sleepTotalHours.toFixed(1)}h{' '}
                  <span className="text-muted-foreground">({h.sleepTotal})</span>
                </span>
              ) : (
                '-'
              )}
            </TableCell>

            <TableCell className="text-white">{h.spo2 ?? '-'}</TableCell>

            <TableCell>
              <Badge variant="secondary" className="text-xs">
                {h.fatigue ?? 5}/10
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
                    void handleDeletePhysio(h.id)
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
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Data</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {formatLocalDate(h.date, (d) => format(d, 'dd/MM/yyyy'))}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Peso</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {h.weight !== undefined ? `${h.weight.toFixed(1)} kg` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">FC Repouso</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {h.restingHeartRate !== undefined ? `${h.restingHeartRate} bpm` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">FC Sono</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {h.sleepHeartRate !== undefined ? `${h.sleepHeartRate} bpm` : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Sono Total</p>
                      <p className="mt-1 text-sm text-white">
                        {h.sleepTotalHours !== undefined ? `${h.sleepTotalHours.toFixed(1)}h` : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">{h.sleepTotal || '-'}</p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">REM</p>
                      <p className="mt-1 text-sm text-white">
                        {h.sleepREM !== undefined ? `${h.sleepREM} min` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Sono Leve</p>
                      <p className="mt-1 text-sm text-white">
                        {h.sleepLight !== undefined ? `${h.sleepLight} min` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Sono Profundo</p>
                      <p className="mt-1 text-sm text-white">
                        {h.sleepDeep !== undefined ? `${h.sleepDeep} min` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Acordado</p>
                      <p className="mt-1 text-sm text-white">
                        {h.awakeTime !== undefined ? `${h.awakeTime} min` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Cansaço</p>
                      <p className="mt-1 text-sm text-white">
                        {h.fatigue !== undefined ? `${h.fatigue}/10` : '5/10'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">SpO2</p>
                      <p className="mt-1 text-sm text-white">
                        {h.spo2 !== undefined ? `${h.spo2}%` : '-'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Respiração</p>
                      <p className="mt-1 text-sm text-white">
                        {h.respiratoryRate !== undefined ? `${h.respiratoryRate} rpm` : '-'}
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
          Nenhum registro fisiológico ainda
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

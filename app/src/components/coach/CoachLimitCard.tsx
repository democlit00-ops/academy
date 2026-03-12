import { useEffect, useState } from 'react'
import { Users, UserCheck, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCoachLimitSummary, type CoachLimitSummary } from '@/lib/coachLimits'

type CoachLimitCardProps = {
  coachId: string
  title?: string
}

export function CoachLimitCard({ coachId, title = 'Capacidade de alunos' }: CoachLimitCardProps) {
  const [summary, setSummary] = useState<CoachLimitSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!coachId) return

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await getCoachLimitSummary(coachId)
        setSummary(data)
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao carregar limite do coach.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [coachId])

  if (!coachId) return null

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando capacidade do coach...</div>
        ) : error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : !summary ? (
          <div className="text-sm text-muted-foreground">Nenhum limite configurado.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                Limite total
              </div>
              <div className="text-2xl font-bold text-white">{summary.studentLimit}</div>
              <Badge variant="outline">Pack atual</Badge>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCheck className="w-4 h-4" />
                Alunos vinculados
              </div>
              <div className="text-2xl font-bold text-white">{summary.usedStudents}</div>
              <Badge variant="secondary">Em uso</Badge>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserPlus className="w-4 h-4" />
                Vagas disponíveis
              </div>
              <div className="text-2xl font-bold text-white">{summary.availableStudents}</div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Disponível</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

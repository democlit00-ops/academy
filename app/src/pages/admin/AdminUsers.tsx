import { useEffect, useMemo, useState } from 'react'
import { Users, Search, Shield, GraduationCap, User as UserIcon, Link2, Unlink, List, WalletCards, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { getManyCoachLimitSummaries, type CoachLimitSummary } from '@/lib/coachLimits'

type Role = 'user' | 'coach' | 'admin'

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  role: Role | null
  created_at?: string | null
}

type LinkRow = {
  id: string
  coach_id: string
  student_id: string
  created_at: string
}

type LinkView = {
  id: string
  created_at: string
  coach_id: string
  student_id: string
  coach?: ProfileRow | null
  student?: ProfileRow | null
}

function getProfileDisplayName(p?: ProfileRow | null, fallback = '—') {
  const fullName = p?.full_name?.trim()
  if (fullName) return fullName

  const email = p?.email?.trim()
  if (email) return email

  const id = p?.id?.trim()
  if (id) return `${id.slice(0, 6)}…`

  return fallback
}

export default function AdminUsers() {
  const { user, profile } = useAuth()
  const myRole = (profile?.role ?? 'user') as Role

  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [profiles, setProfiles] = useState<ProfileRow[]>([])

  const [coachId, setCoachId] = useState<string>('')
  const [studentId, setStudentId] = useState<string>('')

  const [linksLoading, setLinksLoading] = useState(true)
  const [links, setLinks] = useState<LinkView[]>([])

  const [coachSummaries, setCoachSummaries] = useState<CoachLimitSummary[]>([])
  const [limitsLoading, setLimitsLoading] = useState(true)
  const [savingLimitCoachId, setSavingLimitCoachId] = useState<string | null>(null)
  const [draftLimits, setDraftLimits] = useState<Record<string, string>>({})

  const loadProfiles = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,full_name,role,created_at')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setProfiles((data ?? []) as ProfileRow[])
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar usuários')
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  const loadLinks = async () => {
    setLinksLoading(true)
    try {
      const { data, error } = await supabase
        .from('coach_students')
        .select('id, coach_id, student_id, created_at')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error

      const raw = (data ?? []) as LinkRow[]
      if (raw.length === 0) {
        setLinks([])
        return
      }

      const ids = Array.from(
        new Set(raw.flatMap((r) => [r.coach_id, r.student_id]).filter(Boolean))
      )

      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('id,email,full_name,role,created_at')
        .in('id', ids)

      if (profErr) throw profErr

      const map = new Map<string, ProfileRow>()
      ;((profs ?? []) as ProfileRow[]).forEach((p) => map.set(p.id, p))

      const view: LinkView[] = raw.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        coach_id: r.coach_id,
        student_id: r.student_id,
        coach: map.get(r.coach_id) ?? null,
        student: map.get(r.student_id) ?? null,
      }))

      setLinks(view)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar vínculos')
      setLinks([])
    } finally {
      setLinksLoading(false)
    }
  }

  const loadCoachLimits = async (coachProfiles?: ProfileRow[]) => {
    const baseProfiles = coachProfiles ?? profiles
    const coachIds = baseProfiles
      .filter((p) => (p.role ?? 'user') === 'coach' || (p.role ?? 'user') === 'admin')
      .map((p) => p.id)

    setLimitsLoading(true)
    try {
      const summaries = await getManyCoachLimitSummaries(coachIds)
      setCoachSummaries(summaries)
      setDraftLimits(
        summaries.reduce<Record<string, string>>((acc, item) => {
          acc[item.coachId] = String(item.studentLimit)
          return acc
        }, {})
      )
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar limites dos coaches')
      setCoachSummaries([])
      setDraftLimits({})
    } finally {
      setLimitsLoading(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      await loadProfiles()
      await loadLinks()
    }
    void run()
  }, [])

  useEffect(() => {
    if (profiles.length === 0) return
    void loadCoachLimits(profiles)
  }, [profiles])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return profiles

    return profiles.filter((p) => {
      const email = (p.email ?? '').toLowerCase()
      const name = getProfileDisplayName(p, '').toLowerCase()
      return email.includes(s) || name.includes(s) || p.id.toLowerCase().includes(s)
    })
  }, [profiles, q])

  const coachSummaryMap = useMemo(() => {
    const map = new Map<string, CoachLimitSummary>()
    coachSummaries.forEach((item) => map.set(item.coachId, item))
    return map
  }, [coachSummaries])

  const setRole = async (id: string, role: Role) => {
    try {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
      toast.success(`Role atualizada para ${role} ✅`)
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)))
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao atualizar role')
    }
  }

  const saveCoachLimit = async (targetCoachId: string) => {
    const rawValue = draftLimits[targetCoachId] ?? '0'
    const studentLimit = Math.max(Number(rawValue || 0), 0)

    if (!Number.isFinite(studentLimit)) {
      toast.error('Informe um limite válido')
      return
    }

    setSavingLimitCoachId(targetCoachId)
    try {
      const { error } = await supabase
        .from('coach_limits')
        .upsert(
          {
            coach_id: targetCoachId,
            student_limit: studentLimit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'coach_id' }
        )

      if (error) throw error

      toast.success('Limite do coach atualizado ✅')
      await loadCoachLimits()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar limite do coach')
    } finally {
      setSavingLimitCoachId(null)
    }
  }

  const applyPackLimit = (targetCoachId: string, value: number) => {
    setDraftLimits((prev) => ({
      ...prev,
      [targetCoachId]: String(value),
    }))
  }

  const linkStudent = async () => {
    if (!coachId || !studentId) {
      toast.error('Selecione Professor e Aluno')
      return
    }
    if (coachId === studentId) {
      toast.error('Professor e Aluno não podem ser o mesmo usuário')
      return
    }

    try {
      const summary = coachSummaryMap.get(coachId)
      const availableStudents = summary?.availableStudents ?? 0
      if (availableStudents <= 0) {
        toast.error('Esse professor não possui vagas disponíveis')
        return
      }

      const { error } = await supabase.from('coach_students').insert({
        coach_id: coachId,
        student_id: studentId,
      })
      if (error) throw error
      toast.success('Aluno vinculado ✅')
      await loadLinks()
      await loadCoachLimits()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao vincular aluno')
    }
  }

  const unlinkStudent = async (cId?: string, sId?: string) => {
    const c = cId ?? coachId
    const s = sId ?? studentId

    if (!c || !s) {
      toast.error('Selecione Professor e Aluno')
      return
    }
    try {
      const { error } = await supabase
        .from('coach_students')
        .delete()
        .eq('coach_id', c)
        .eq('student_id', s)

      if (error) throw error
      toast.success('Vínculo removido ✅')
      await loadLinks()
      await loadCoachLimits()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao remover vínculo')
    }
  }

  if (!user) return null
  if (myRole !== 'admin') {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Sem permissão</h2>
        <p className="text-white/70">Acesso restrito ao Admin.</p>
      </div>
    )
  }

  const coaches = profiles.filter((p) => (p.role ?? 'user') === 'coach' || (p.role ?? 'user') === 'admin')
  const students = profiles.filter((p) => (p.role ?? 'user') === 'user')

  const roleBadge = (r: Role | null) => {
    const role = (r ?? 'user') as Role
    const common = 'text-xs'
    if (role === 'admin') return <Badge className={common}><Shield className="w-3 h-3 mr-1" />Admin</Badge>
    if (role === 'coach') return <Badge variant="secondary" className={common}><GraduationCap className="w-3 h-3 mr-1" />Professor</Badge>
    return <Badge variant="outline" className={common}><UserIcon className="w-3 h-3 mr-1" />Aluno</Badge>
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Admin • Usuários
          </h1>
          <p className="text-muted-foreground">Promover roles, configurar limite de alunos e vincular alunos a professores</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadLinks}>Atualizar vínculos</Button>
          <Button variant="outline" onClick={loadProfiles}>Atualizar usuários</Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <WalletCards className="w-4 h-4" />
            Limite de alunos por professor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {limitsLoading && <div className="text-white/70">Carregando limites...</div>}

          {!limitsLoading && coaches.length === 0 && (
            <div className="text-muted-foreground">Nenhum professor/admin encontrado.</div>
          )}

          {!limitsLoading && coaches.map((coach) => {
            const summary = coachSummaryMap.get(coach.id)
            const draftValue = draftLimits[coach.id] ?? String(summary?.studentLimit ?? 0)

            return (
              <div key={coach.id} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-white truncate">{getProfileDisplayName(coach, 'Professor')}</div>
                      {roleBadge(coach.role)}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{coach.email ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{coach.id}</div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3 lg:min-w-[360px]">
                    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                      <div className="text-xs text-muted-foreground">Limite total</div>
                      <div className="text-xl font-bold text-white">{summary?.studentLimit ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                      <div className="text-xs text-muted-foreground">Vinculados</div>
                      <div className="text-xl font-bold text-white">{summary?.usedStudents ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                      <div className="text-xs text-muted-foreground">Disponíveis</div>
                      <div className="text-xl font-bold text-white">{summary?.availableStudents ?? 0}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => applyPackLimit(coach.id, 10)}>
                      Pack 10
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => applyPackLimit(coach.id, 20)}>
                      Pack 20
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => applyPackLimit(coach.id, 40)}>
                      Pack 40
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="number"
                      min={0}
                      value={draftValue}
                      onChange={(e) => setDraftLimits((prev) => ({ ...prev, [coach.id]: e.target.value }))}
                      className="w-full sm:w-32 bg-background border-border"
                      placeholder="Limite"
                    />
                    <Button
                      onClick={() => saveCoachLimit(coach.id)}
                      disabled={savingLimitCoachId === coach.id}
                      className="gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {savingLimitCoachId === coach.id ? 'Salvando...' : 'Salvar limite'}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Vincular Aluno ao Professor
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Professor</div>
            <Select value={coachId} onValueChange={setCoachId}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Selecione um professor" />
              </SelectTrigger>
              <SelectContent>
                {coaches.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {getProfileDisplayName(p)} ({p.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Aluno</div>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Selecione um aluno" />
              </SelectTrigger>
              <SelectContent>
                {students.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {getProfileDisplayName(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 items-end">
            <Button onClick={linkStudent} className="gap-2">
              <Link2 className="w-4 h-4" />
              Vincular
            </Button>
            <Button variant="outline" onClick={() => unlinkStudent()} className="gap-2">
              <Unlink className="w-4 h-4" />
              Remover
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <List className="w-4 h-4" />
            Vínculos atuais (Professor → Aluno)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {linksLoading && <div className="text-white/70">Carregando vínculos...</div>}
          {!linksLoading && links.length === 0 && (
            <div className="text-muted-foreground">Nenhum vínculo criado ainda.</div>
          )}

          {!linksLoading && links.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div className="min-w-0">
                <div className="text-white font-medium truncate">
                  {getProfileDisplayName(l.coach)} <span className="text-muted-foreground">→</span> {getProfileDisplayName(l.student)}
                </div>
                <div className="text-xs text-muted-foreground">
                  coach: {l.coach_id.slice(0, 8)}… • aluno: {l.student_id.slice(0, 8)}…
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => unlinkStudent(l.coach_id, l.student_id)}
              >
                <Unlink className="w-4 h-4" />
                Remover
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Search className="w-4 h-4" />
            Buscar usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            className="bg-background border-border"
            placeholder="Buscar por nome, email ou id..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base">Usuários ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <div className="text-white/70">Carregando...</div>}
          {!loading && filtered.length === 0 && <div className="text-muted-foreground">Nenhum usuário encontrado.</div>}

          {!loading && filtered.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-white truncate">{getProfileDisplayName(p, 'Sem nome')}</div>
                  {roleBadge(p.role)}
                </div>
                <div className="text-sm text-muted-foreground truncate">{p.email ?? '—'}</div>
                <div className="text-xs text-muted-foreground">{p.id}</div>
              </div>

              <div className="w-44">
                <Select value={(p.role ?? 'user') as Role} onValueChange={(v) => setRole(p.id, v as Role)}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Aluno (user)</SelectItem>
                    <SelectItem value="coach">Professor (coach)</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

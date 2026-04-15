//academy\app\src\pages\coach\CoachStudents.tsx
import { useEffect, useMemo, useState } from 'react'
import { Users, Search, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { CoachLimitCard } from '@/components/coach/CoachLimitCard'
import { CoachInvites } from '@/components/coach/CoachInvites'

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

type StudentRow = {
  student_id: string
  profiles?: ProfileRow | null
}

type CoachStudentsProps = {
  onOpenStudent?: (studentId: string, studentName: string) => void
}

function getProfileDisplayName(profile?: ProfileRow | null, fallback = 'Aluno') {
  const fullName = profile?.full_name?.trim()
  if (fullName) return fullName

  const email = profile?.email?.trim()
  if (email) return email

  const id = profile?.id?.trim()
  if (id) return `${id.slice(0, 6)}…`

  return fallback
}

export default function CoachStudents({ onOpenStudent }: CoachStudentsProps) {
  const { user, profile } = useAuth()
  const role = profile?.role ?? 'user'

  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([])

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      if (role === 'admin') {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('role', 'user')
          .order('full_name', { ascending: true })
          .order('email', { ascending: true })

        if (profilesError) throw profilesError

        const mapped: StudentRow[] = ((profiles ?? []) as ProfileRow[]).map((studentProfile) => ({
          student_id: studentProfile.id,
          profiles: studentProfile,
        }))

        setStudents(mapped)
        return
      }

      const { data: links, error: linksError } = await supabase
        .from('coach_students')
        .select('student_id')
        .eq('coach_id', user.id)

      if (linksError) throw linksError

      const ids = (links ?? []).map((x: any) => x.student_id).filter(Boolean)

      if (ids.length === 0) {
        setStudents([])
        return
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', ids)

      if (profilesError) throw profilesError

      const map = new Map<string, ProfileRow>()
      ;((profiles ?? []) as ProfileRow[]).forEach((p) => map.set(p.id, p))

      const merged: StudentRow[] = ids.map((id) => ({
        student_id: id,
        profiles: map.get(id) ?? null,
      }))

      setStudents(merged)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar alunos.')
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students

    return students.filter((s) => {
      const name = getProfileDisplayName(s.profiles, '').toLowerCase()
      const email = (s.profiles?.email ?? '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [students, query])

  if (!user) return null

  if (role !== 'coach' && role !== 'admin') {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Sem permissão</h2>
        <p className="text-white/70">Essa área é exclusiva para Professor/Admin.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {role === 'admin' ? 'Selecionar Aluno' : 'Meus Alunos'}
          </h1>
          <p className="text-muted-foreground">
            {role === 'admin'
              ? 'Abra o Modo Aluno para consultar treinos, cardio e fisiológico'
              : 'Acompanhe treinos, cardio e fisiológico dos seus alunos'}
          </p>
        </div>

        <Button variant="outline" onClick={load}>
          Atualizar
        </Button>
      </div>

      {role === 'coach' && (
        <>
          <CoachLimitCard coachId={user.id} />
          <CoachInvites />
        </>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Search className="w-4 h-4" />
            Buscar aluno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Digite nome ou email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-background border-border"
          />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base">Alunos ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <div className="text-white/70">Carregando...</div>}

          {!loading && filtered.length === 0 && (
            <div className="text-muted-foreground">
              {role === 'admin' ? 'Nenhum aluno encontrado.' : 'Nenhum aluno vinculado ainda.'}
            </div>
          )}

          {!loading &&
            filtered.map((s) => (
              <div
                key={s.student_id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-white truncate">
                      {getProfileDisplayName(s.profiles, 'Aluno')}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {s.student_id.slice(0, 6)}…
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{s.profiles?.email ?? '—'}</div>
                </div>

                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    onOpenStudent?.(
                      s.student_id,
                      getProfileDisplayName(s.profiles, 'Aluno')
                    )
                  }
                >
                  Abrir <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}

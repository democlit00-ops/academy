//academy\app\src\components\coach\CoachInvites.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Link2, Mail, RefreshCw, Trash2, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getCoachLimitSummary } from '@/lib/coachLimits'

type InviteStatus = 'pending' | 'used' | 'cancelled' | 'expired'

type CoachInviteRow = {
  id: string
  coach_id: string
  code: string
  email: string | null
  status: InviteStatus
  expires_at: string | null
  used_by_user_id: string | null
  used_at: string | null
  created_at: string
}

function generateInviteCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()
}

function getBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

function buildInviteLink(code: string) {
  const baseUrl = getBaseUrl()
  return `${baseUrl}/signup?invite=${code}`
}

function statusBadge(status: InviteStatus) {
  if (status === 'pending') return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Pendente</Badge>
  if (status === 'used') return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Usado</Badge>
  if (status === 'cancelled') return <Badge variant="outline">Cancelado</Badge>
  return <Badge variant="outline">Expirado</Badge>
}

export function CoachInvites() {
  const { user, profile } = useAuth()
  const role = profile?.role ?? 'user'

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [invites, setInvites] = useState<CoachInviteRow[]>([])
  const [availableStudents, setAvailableStudents] = useState(0)

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === 'pending'),
    [invites]
  )

  const load = useCallback(async () => {
  if (!user) return

  setLoading(true)
  try {
    const [summary, invitesResult] = await Promise.all([
      getCoachLimitSummary(user.id),
      supabase
        .from('coach_invites')
        .select('id,coach_id,code,email,status,expires_at,used_by_user_id,used_at,created_at')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (invitesResult.error) throw invitesResult.error

    setAvailableStudents(summary.availableStudents)
    setInvites((invitesResult.data ?? []) as CoachInviteRow[])
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao carregar convites.'
    toast.error(message)
    setInvites([])
  } finally {
    setLoading(false)
  }
}, [user])

  useEffect(() => {
  void load()
}, [load])

  const handleCreateInvite = async () => {
    if (!user) return
    if (availableStudents <= 0) {
      toast.error('Você não possui vagas disponíveis para gerar convite.')
      return
    }

    setCreating(true)
    try {
      const code = generateInviteCode()
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()

      const { error } = await supabase.from('coach_invites').insert({
        coach_id: user.id,
        code,
        email: email.trim() || null,
        status: 'pending',
        expires_at: expiresAt,
      })

      if (error) throw error

      toast.success('Convite criado ✅')
      setEmail('')
      await load()
    } catch (e: unknown) {
  const message = e instanceof Error ? e.message : 'Erro ao criar convite.'
  toast.error(message)
} finally {
      setCreating(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    setCancellingId(inviteId)
    try {
      const { error } = await supabase
        .from('coach_invites')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', inviteId)
        .eq('status', 'pending')

      if (error) throw error

      toast.success('Convite cancelado ✅')
      await load()
    } catch (e: unknown) {
  const message = e instanceof Error ? e.message : 'Erro ao cancelar convite.'
  toast.error(message)
} finally {
      setCancellingId(null)
    }
  }

  const copyInviteLink = async (code: string) => {
    try {
      const link = buildInviteLink(code)
      await navigator.clipboard.writeText(link)
      toast.success('Link do convite copiado ✅')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  const copyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Código copiado ✅')
    } catch {
      toast.error('Não foi possível copiar o código.')
    }
  }

  if (!user) return null
  if (role !== 'coach' && role !== 'admin') return null

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Convites para alunos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Convites pendentes: {pendingInvites.length}</Badge>
            <Badge variant="outline">Vagas disponíveis: {availableStudents}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email do aluno (opcional)
              </div>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@email.com"
                className="bg-background border-border"
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleCreateInvite} disabled={creating || availableStudents <= 0} className="gap-2">
                <Link2 className="w-4 h-4" />
                {creating ? 'Criando...' : 'Gerar convite'}
              </Button>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base">Lista de convites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <div className="text-white/70">Carregando convites...</div>}

          {!loading && invites.length === 0 && (
            <div className="text-muted-foreground">Nenhum convite criado ainda.</div>
          )}

          {!loading && invites.map((invite) => (
            <div key={invite.id} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-white">{invite.code}</div>
                    {statusBadge(invite.status)}
                  </div>

                  <div className="text-sm text-muted-foreground break-all">
                    Link: {buildInviteLink(invite.code)}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Email: {invite.email ?? 'não informado'}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Criado em: {new Date(invite.created_at).toLocaleString('pt-BR')}
                    {invite.expires_at ? ` • expira em: ${new Date(invite.expires_at).toLocaleString('pt-BR')}` : ''}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyInviteCode(invite.code)} className="gap-2">
                    <Copy className="w-4 h-4" />
                    Código
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyInviteLink(invite.code)} className="gap-2">
                    <Copy className="w-4 h-4" />
                    Link
                  </Button>
                  {invite.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelInvite(invite.id)}
                      disabled={cancellingId === invite.id}
                      className="gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {cancellingId === invite.id ? 'Cancelando...' : 'Cancelar'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

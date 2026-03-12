// academy/app/src/pages/Auth.tsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type InvitePreview = {
  id: string
  coach_id: string
  code: string
  email: string | null
  status: 'pending' | 'used' | 'cancelled' | 'expired'
  expires_at: string | null
  coach?: {
    full_name: string | null
    email: string | null
  } | null
}

function isInviteExpired(expiresAt: string | null) {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

export default function AuthPage() {
  const inviteCodeFromUrl =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('invite')?.trim().toUpperCase() ?? ''
      : ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [invite, setInvite] = useState<InvitePreview | null>(null)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [inviteAccepted, setInviteAccepted] = useState(false)
  const [resolvedInviteCode, setResolvedInviteCode] = useState(inviteCodeFromUrl)

  const canSubmit = useMemo(() => email.trim().length > 3, [email])
  const passwordsMatch = password === confirmPassword
  const inviteMode = !!resolvedInviteCode

  useEffect(() => {
    if (inviteCodeFromUrl) {
      setResolvedInviteCode(inviteCodeFromUrl)
    }
  }, [inviteCodeFromUrl])

  useEffect(() => {
    const syncInviteFromSession = async () => {
      if (resolvedInviteCode) return

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const metadataInviteCode = String(user?.user_metadata?.invite_code ?? '')
        .trim()
        .toUpperCase()

      if (metadataInviteCode) {
        setResolvedInviteCode(metadataInviteCode)
      }
    }

    void syncInviteFromSession()
  }, [resolvedInviteCode])

  useEffect(() => {
    const loadInvite = async () => {
      if (!resolvedInviteCode) {
        setInvite(null)
        setInviteMessage(null)
        return
      }

      setInviteLoading(true)
      setInviteMessage(null)

      try {
        const { data, error } = await supabase
          .from('coach_invites')
          .select(`
            id,
            coach_id,
            code,
            email,
            status,
            expires_at,
            coach:coach_id (
              full_name,
              email
            )
          `)
          .eq('code', resolvedInviteCode)
          .maybeSingle()

        if (error) throw error

        const parsed = (data ?? null) as unknown as InvitePreview | null
        setInvite(parsed)

        if (!parsed) {
          setInviteMessage('Convite não encontrado.')
          return
        }

        if (parsed.status !== 'pending') {
          setInviteMessage('Este convite não está mais disponível.')
          return
        }

        if (isInviteExpired(parsed.expires_at)) {
          setInviteMessage('Este convite expirou.')
          return
        }

        if (parsed.email && !email) {
          setEmail(parsed.email)
        }
      } catch (e: any) {
        setInvite(null)
        setInviteMessage(e?.message ?? 'Erro ao validar convite.')
      } finally {
        setInviteLoading(false)
      }
    }

    void loadInvite()
  }, [resolvedInviteCode, email])

  useEffect(() => {
    const consumeInviteIfNeeded = async () => {
      if (!resolvedInviteCode || inviteAccepted) return

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const metadataInviteCode = String(user.user_metadata?.invite_code ?? '')
        .trim()
        .toUpperCase()

      const effectiveInviteCode = resolvedInviteCode || metadataInviteCode
      if (!effectiveInviteCode) return

      try {
        const response = await fetch('/.netlify/functions/accept-coach-invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inviteCode: effectiveInviteCode,
            userId: user.id,
            email: user.email ?? email ?? null,
          }),
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          setMessage(payload?.error ?? 'Não foi possível concluir o convite.')
          return
        }

        setInviteAccepted(true)
        setMessage('Convite aceito com sucesso! Seu vínculo com o professor foi criado.')
      } catch (e: any) {
        setMessage(e?.message ?? 'Erro ao concluir o convite.')
      }
    }

    void consumeInviteIfNeeded()
  }, [resolvedInviteCode, inviteAccepted, email])

  async function handleSignIn() {
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
    } catch (e: any) {
      setMessage(e?.message ?? 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  async function handleInviteSignUp() {
    if (!resolvedInviteCode) return

    if (password.length < 6) {
      setMessage('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (!passwordsMatch) {
      setMessage('As senhas não conferem.')
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const redirectTo = `${window.location.origin}/signup?invite=${resolvedInviteCode}`

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { invite_code: resolvedInviteCode },
        },
      })

      if (error) throw error

      setMessage('Conta criada com sucesso. Verifique seu email e clique no link de confirmação para ativar o acesso. Depois do primeiro login, o sistema concluirá automaticamente o vínculo com o professor.')
    } catch (e: any) {
      setMessage(e?.message ?? 'Erro ao cadastrar com convite')
    } finally {
      setLoading(false)
    }
  }

  const inviteIsUsable = !!invite && invite.status === 'pending' && !isInviteExpired(invite.expires_at)

  return (
    <div className="min-h-screen bg-[#081225] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-sm">
        <div className="mb-8 text-center space-y-2">
          <div className="text-3xl font-semibold tracking-tight">FitTrack</div>
          <div className="text-sm text-white/65">
            {inviteMode ? 'Finalize seu cadastro para entrar no FitTrack com o convite recebido.' : 'Entre para acessar sua conta e salvar seus dados.'}
          </div>
        </div>

        {inviteMode && (
          <div className="mb-6 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-5 text-center">
            {inviteLoading ? (
              <div className="text-sm text-cyan-100">Validando convite...</div>
            ) : inviteIsUsable ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-cyan-100">Cadastro por convite</div>
                <div className="text-sm text-cyan-50 leading-relaxed">
                  Você está entrando com um convite de <strong>Professor</strong>
                </div>
                <div className="text-xs text-cyan-200/90">Código: {resolvedInviteCode}</div>
                {invite?.email && (
                  <div className="text-xs text-cyan-200/90">Email esperado: {invite.email}</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-amber-200">{inviteMessage ?? 'Este convite não está disponível.'}</div>
            )}
          </div>
        )}

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm text-white/70 text-center">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-center outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="seu@email.com"
              type="email"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-white/70 text-center">Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-center outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="••••••••"
              type="password"
              autoComplete={inviteMode ? 'new-password' : 'current-password'}
            />
          </div>

          {inviteMode && (
            <div className="space-y-2">
              <label className="block text-sm text-white/70 text-center">Confirmar senha</label>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-center outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="••••••••"
                type="password"
                autoComplete="new-password"
              />
            </div>
          )}
        </div>

        {message && <div className="mt-5 text-sm text-amber-200 text-center">{message}</div>}

        <div className="mt-7 grid grid-cols-1 gap-3">
          {!inviteMode && (
            <button
              disabled={!canSubmit || loading || password.length < 6}
              onClick={handleSignIn}
              className="rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-3 font-medium transition-colors"
            >
              Entrar (Email + Senha)
            </button>
          )}

          {inviteMode && (
            <button
              disabled={!canSubmit || loading || password.length < 6 || !passwordsMatch || !inviteIsUsable}
              onClick={handleInviteSignUp}
              className="rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-3 font-medium transition-colors"
            >
              Criar conta com convite
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

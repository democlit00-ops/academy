import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const canSubmit = useMemo(() => email.trim().length > 3, [email])

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

  async function handleSignUp() {
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (error) throw error
      setMessage('Cadastro enviado. Se o projeto exigir confirmação por email, confira sua caixa de entrada.')
    } catch (e: any) {
      setMessage(e?.message ?? 'Erro ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLink() {
    setLoading(true)
    setMessage(null)
    try {
      const redirectTo = `${window.location.origin}`
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      })
      if (error) throw error
      setMessage('Link mágico enviado. Confira seu email.')
    } catch (e: any) {
      setMessage(e?.message ?? 'Erro ao enviar link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <div className="mb-6">
          <div className="text-2xl font-semibold">FitTrack</div>
          <div className="text-sm text-white/70">Entre para salvar seus dados no seu login.</div>
        </div>

        <label className="block text-sm text-white/70 mb-1">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="seu@email.com"
          type="email"
          autoComplete="email"
        />

        <label className="block text-sm text-white/70 mt-4 mb-1">Senha (para Email+Senha)</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="••••••••"
          type="password"
          autoComplete="current-password"
        />

        {message && <div className="mt-4 text-sm text-amber-200">{message}</div>}

        <div className="mt-6 grid grid-cols-1 gap-3">
          <button
            disabled={!canSubmit || loading || password.length < 6}
            onClick={handleSignIn}
            className="rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 font-medium"
          >
            Entrar (Email + Senha)
          </button>
          <button
            disabled={!canSubmit || loading || password.length < 6}
            onClick={handleSignUp}
            className="rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 px-4 py-2 font-medium"
          >
            Criar conta
          </button>
          <button
            disabled={!canSubmit || loading}
            onClick={handleMagicLink}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 font-medium"
          >
            Enviar Magic Link
          </button>
        </div>

        <div className="mt-6 text-xs text-white/60 leading-relaxed">
          Dica: no Supabase, em <b>Authentication → URL Configuration</b>, adicione seu domínio do Netlify em <b>Site URL</b> e <b>Redirect URLs</b>.
        </div>
      </div>
    </div>
  )
}

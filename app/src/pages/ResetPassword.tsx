import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

function translateAuthMessage(message?: string) {
  const raw = message ?? 'Erro ao redefinir senha.'

  const translatedMessageMap: Record<string, string> = {
    'New password should be different from the old password.':
      'A nova senha precisa ser diferente da senha antiga.',
    'Password should be at least 6 characters.':
      'A senha precisa ter pelo menos 6 caracteres.',
    'Auth session missing!':
      'Sessão de redefinição inválida ou expirada.',
    'Invalid login credentials':
      'Credenciais inválidas.',
    'JWT expired':
      'O link expirou. Solicite uma nova redefinição de senha.',
    'Email link is invalid or has expired':
      'O link de redefinição é inválido ou expirou.',
    'Token has expired or is invalid':
      'O link de redefinição é inválido ou expirou.',
  }

  return translatedMessageMap[raw] ?? raw
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [success, setSuccess] = useState(false)

  const passwordsMatch = useMemo(() => password === confirmPassword, [password, confirmPassword])

  useEffect(() => {
    const prepareRecoverySession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error

        if (!data.session) {
          throw new Error('Auth session missing!')
        }

        setReady(true)
      } catch (e: any) {
        setMessage(translateAuthMessage(e?.message))
        setReady(true)
      }
    }

    void prepareRecoverySession()
  }, [])

  async function goToLogin() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  async function handleUpdatePassword() {
    if (password.length < 6) {
      setMessage('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (!passwordsMatch) {
      setMessage('As senhas não conferem.')
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) throw error

      setSuccess(true)
      setMessage('Senha redefinida com sucesso. Redirecionando para o login...')
      setPassword('')
      setConfirmPassword('')

      setTimeout(async () => {
        await supabase.auth.signOut()
        window.location.href = '/'
      }, 1500)
    } catch (e: any) {
      setMessage(translateAuthMessage(e?.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#081225] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-sm">
        <div className="mb-8 text-center space-y-2">
          <div className="text-3xl font-semibold tracking-tight">AcademyK</div>
          <div className="text-sm text-white/65">
            Redefina sua senha para voltar a acessar sua conta.
          </div>
        </div>

        {!ready ? (
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-5 text-center text-sm text-cyan-100">
            Validando link de recuperação...
          </div>
        ) : (
          <>
            {!success && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm text-white/70 text-center">Nova senha</label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-center outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="••••••••"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm text-white/70 text-center">Confirmar nova senha</label>
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-center outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="••••••••"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {message && <div className="mt-5 text-sm text-amber-200 text-center">{message}</div>}

            <div className="mt-7 grid grid-cols-1 gap-3">
              {!success ? (
                <>
                  <button
                    disabled={loading || password.length < 6 || !passwordsMatch}
                    onClick={handleUpdatePassword}
                    className="rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-3 font-medium transition-colors"
                  >
                    {loading ? 'Salvando...' : 'Salvar nova senha'}
                  </button>

                  <button
                    onClick={goToLogin}
                    className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 font-medium transition-colors"
                  >
                    Ir para login
                  </button>
                </>
              ) : (
                <button
                  onClick={goToLogin}
                  className="rounded-2xl bg-cyan-600 hover:bg-cyan-500 px-4 py-3 font-medium transition-colors"
                >
                  Ir para login
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
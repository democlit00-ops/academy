// academy/app/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type UserRole = 'admin' | 'coach' | 'user'

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole
  age?: number | null
  weight?: number | null
  height?: number | null
  fitness_goal?: string | null
  preferred_weight_unit?: 'kg' | 'lbs' | null
  created_at?: string
  updated_at?: string
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function getOrCreateProfile(user: User): Promise<Profile> {
  const { data: existing, error: selectErr } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,age,weight,height,fitness_goal,preferred_weight_unit,created_at,updated_at')
    .eq('id', user.id)
    .maybeSingle()

  if (selectErr) throw selectErr
  if (existing) return existing as Profile

  const payload = {
    id: user.id,
    email: user.email ?? null,
    full_name:
      (user.user_metadata &&
        (user.user_metadata.full_name || user.user_metadata.name)) ||
      null,
    role: 'user' as UserRole,
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert(payload)
    .select('id,email,full_name,role,age,weight,height,fitness_goal,preferred_weight_unit,created_at,updated_at')
    .single()

  if (insertErr) throw insertErr
  return inserted as Profile
}

async function consumeCoachInvite(user: User) {
  const inviteCode = String(user.user_metadata?.invite_code ?? '')
    .trim()
    .toUpperCase()

  if (!inviteCode) return

  const response = await fetch('/.netlify/functions/accept-coach-invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inviteCode,
      userId: user.id,
      email: user.email ?? null,
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Não foi possível concluir o convite do professor.')
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const inviteProcessingKeyRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    const syncFromSession = async (sess: Session | null) => {
      if (!mounted) return

      setSession(sess)

      const u = sess?.user ?? null
      if (!u) {
        setProfile(null)
        inviteProcessingKeyRef.current = null
        return
      }

      try {
        const p = await getOrCreateProfile(u)
        if (!mounted) return
        setProfile(p)
      } catch (e) {
        if (!mounted) return
        setProfile(null)
        console.error('[Auth] Failed to sync profile:', e)
      }

      const inviteCode = String(u.user_metadata?.invite_code ?? '')
        .trim()
        .toUpperCase()

      if (!inviteCode) return

      const processingKey = `${u.id}:${inviteCode}`
      if (inviteProcessingKeyRef.current === processingKey) return

      inviteProcessingKeyRef.current = processingKey

      try {
        await consumeCoachInvite(u)
        console.log('[Auth] Coach invite accepted successfully.')
      } catch (e) {
        console.error('[Auth] Failed to consume coach invite:', e)
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => syncFromSession(data.session ?? null))
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void syncFromSession(newSession)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, profile, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

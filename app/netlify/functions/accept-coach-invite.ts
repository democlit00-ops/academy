// academy/app/netlify/functions/accept-coach-invite.ts
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'node:path'

const projectRoot = path.resolve(__dirname, '..', '..')

dotenv.config({ path: path.join(projectRoot, '.env.local') })
dotenv.config({ path: path.join(projectRoot, '.env') })

type CoachInviteRow = {
  id: string
  coach_id: string
  code: string
  email: string | null
  status: 'pending' | 'used' | 'cancelled' | 'expired'
  expires_at: string | null
}

type CoachLimitRow = {
  student_limit: number | null
}

type CoachStudentRow = {
  coach_id: string
  student_id: string
}

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, {
      error: 'Supabase env vars are missing.',
      debug: {
        cwd: process.cwd(),
        projectRoot,
        hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
        hasViteSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL),
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_KEY),
      },
    })
  }

  try {
    const parsedBody = event.body ? JSON.parse(event.body) : {}
    const inviteCode = String(parsedBody.inviteCode ?? '').trim().toUpperCase()
    const userId = String(parsedBody.userId ?? '').trim()
    const email = parsedBody.email ? String(parsedBody.email).trim().toLowerCase() : null

    if (!inviteCode || !userId) {
      return json(400, { error: 'inviteCode and userId are required.' })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: invite, error: inviteError } = await admin
      .from('coach_invites')
      .select('id, coach_id, code, email, status, expires_at')
      .eq('code', inviteCode)
      .maybeSingle()

    if (inviteError) {
      return json(500, { error: inviteError.message })
    }

    const typedInvite = (invite ?? null) as CoachInviteRow | null

    if (!typedInvite) {
      return json(404, { error: 'Invite not found.' })
    }

    if (typedInvite.status !== 'pending') {
      return json(400, { error: 'Invite is not pending.' })
    }

    if (typedInvite.expires_at && new Date(typedInvite.expires_at).getTime() < Date.now()) {
      await admin
        .from('coach_invites')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', typedInvite.id)

      return json(400, { error: 'Invite expired.' })
    }

    if (typedInvite.email && email && typedInvite.email.toLowerCase() !== email) {
      return json(400, { error: 'Invite email does not match.' })
    }

    const { data: existingLink, error: existingLinkError } = await admin
      .from('coach_students')
      .select('coach_id, student_id')
      .eq('coach_id', typedInvite.coach_id)
      .eq('student_id', userId)
      .maybeSingle()

    if (existingLinkError) {
      return json(500, { error: existingLinkError.message })
    }

    if (existingLink) {
      await admin
        .from('coach_invites')
        .update({
          status: 'used',
          used_by_user_id: userId,
          used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', typedInvite.id)

      return json(200, { ok: true, alreadyLinked: true })
    }

    const [{ data: limitRow, error: limitError }, { data: coachLinks, error: coachLinksError }] = await Promise.all([
      admin
        .from('coach_limits')
        .select('student_limit')
        .eq('coach_id', typedInvite.coach_id)
        .maybeSingle(),
      admin
        .from('coach_students')
        .select('coach_id, student_id')
        .eq('coach_id', typedInvite.coach_id),
    ])

    if (limitError) {
      return json(500, { error: limitError.message })
    }

    if (coachLinksError) {
      return json(500, { error: coachLinksError.message })
    }

    const typedLimit = (limitRow ?? null) as CoachLimitRow | null
    const typedLinks = (coachLinks ?? []) as CoachStudentRow[]
    const studentLimit = Number(typedLimit?.student_limit ?? 0)
    const usedStudents = typedLinks.length

    if (usedStudents >= studentLimit) {
      return json(400, { error: 'Coach has no available slots.' })
    }

    const { error: insertLinkError } = await admin.from('coach_students').insert({
      coach_id: typedInvite.coach_id,
      student_id: userId,
    })

    if (insertLinkError) {
      return json(500, { error: insertLinkError.message })
    }

    const { error: updateInviteError } = await admin
      .from('coach_invites')
      .update({
        status: 'used',
        used_by_user_id: userId,
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', typedInvite.id)

    if (updateInviteError) {
      return json(500, { error: updateInviteError.message })
    }

    return json(200, {
      ok: true,
      coachId: typedInvite.coach_id,
      userId,
    })
  } catch (e: any) {
    return json(500, { error: e?.message ?? 'Unexpected error.' })
  }
}

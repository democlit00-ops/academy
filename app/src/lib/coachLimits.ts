import { supabase } from '@/lib/supabase'

export type CoachLimitSummary = {
  coachId: string
  studentLimit: number
  usedStudents: number
  availableStudents: number
}

export async function getCoachLimitSummary(coachId: string): Promise<CoachLimitSummary> {
  const [{ data: limitRow, error: limitError }, { count: usedStudents, error: countError }] = await Promise.all([
    supabase
      .from('coach_limits')
      .select('student_limit')
      .eq('coach_id', coachId)
      .maybeSingle(),
    supabase
      .from('coach_students')
      .select('student_id', { count: 'exact', head: true })
      .eq('coach_id', coachId),
  ])

  if (limitError) throw limitError
  if (countError) throw countError

  const studentLimit = Number(limitRow?.student_limit ?? 0)
  const used = Number(usedStudents ?? 0)

  return {
    coachId,
    studentLimit,
    usedStudents: used,
    availableStudents: Math.max(studentLimit - used, 0),
  }
}

export async function getManyCoachLimitSummaries(coachIds: string[]): Promise<CoachLimitSummary[]> {
  const uniqueCoachIds = Array.from(new Set(coachIds.filter(Boolean)))

  if (uniqueCoachIds.length === 0) return []

  const [{ data: limits, error: limitsError }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from('coach_limits')
      .select('coach_id, student_limit')
      .in('coach_id', uniqueCoachIds),
    supabase
      .from('coach_students')
      .select('coach_id, student_id')
      .in('coach_id', uniqueCoachIds),
  ])

  if (limitsError) throw limitsError
  if (linksError) throw linksError

  const limitMap = new Map<string, number>()
  for (const row of (limits ?? []) as Array<{ coach_id: string; student_limit: number }>) {
    limitMap.set(row.coach_id, Number(row.student_limit ?? 0))
  }

  const usedMap = new Map<string, number>()
  for (const row of (links ?? []) as Array<{ coach_id: string; student_id: string }>) {
    usedMap.set(row.coach_id, (usedMap.get(row.coach_id) ?? 0) + 1)
  }

  return uniqueCoachIds.map((coachId) => {
    const studentLimit = limitMap.get(coachId) ?? 0
    const usedStudents = usedMap.get(coachId) ?? 0

    return {
      coachId,
      studentLimit,
      usedStudents,
      availableStudents: Math.max(studentLimit - usedStudents, 0),
    }
  })
}
//academy\app\src\pages\WorkoutPrograms.tsx

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Play,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  Trophy,
  User,
  Square,
  Sparkles,
  Users,
  UserPlus,
  Save,
  Plus,
  Pencil,
  ListChecks,
  Trash2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ExercisePicker, type ExercisePickerOption } from '@/components/exercises/ExercisePicker'
import { ExerciseHelpMenu } from '@/components/exercises/ExerciseHelpMenu'
import { getTodayLocalDateString } from '@/lib/date'

type Role = 'admin' | 'coach' | 'user'
type ProgramDifficulty = 'Iniciante' | 'Intermediário' | 'Avançado'
type ProgramSource = 'public' | 'assigned' | 'owned'
type PlanItemBlock = 'strength' | 'cardio'
type ExerciseSourceMode = 'existing' | 'custom'

type DbPlan = {
  id: string
  title: string
  description: string | null
  type: 'program' | 'split'
  visibility: 'public' | 'private'
  is_active: boolean
  created_at: string
  updated_at: string
  owner_id?: string | null
}

type DbPlanDay = {
  id: string
  plan_id: string
  weekday: number
  day_title: string | null
}

type DbPlanItem = {
  id: string
  plan_day_id: string
  block: PlanItemBlock
  exercise_id: string | null
  custom_exercise_name: string | null
  muscle_group: string | null
  sets: number | null
  reps: string | null
  target_weight: number | null
  duration_min: number | null
  zone_min_bpm: number | null
  zone_max_bpm: number | null
  notes: string | null
  sort_order: number
  exercise_name?: string | null
}

type ProgramUI = {
  id: string
  name: string
  description: string
  duration: string
  sessionsPerWeek: number
  difficulty: ProgramDifficulty
  goal: string
  image: string
  visibility: 'public' | 'private'
  source: ProgramSource
  owner_id?: string | null
}

type PlanStudentRow = {
  plan_id: string
  student_id: string
  assigned_by: string
  created_at: string
}

type CoachStudentLink = {
  student_id: string
}

type ProfileStudentRow = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

type ProgramFormState = {
  title: string
  description: string
  visibility: 'public' | 'private'
  weekdays: number[]
}

type EditorDay = DbPlanDay & {
  items: DbPlanItem[]
}

type ExerciseRow = {
  id: string
  name: string
  muscle_group: string | null
  category: string | null
  type: string | null
  equipment: string | null
  aliases?: string[] | null
  notes?: string | null
  is_active?: boolean | null
}

type NewItemForm = {
  block: PlanItemBlock
  exerciseSourceMode: ExerciseSourceMode
  selectedExerciseId: string
  custom_exercise_name: string
  sets: string
  reps: string
  target_weight: string
  duration_min: string
  zone_min_bpm: string
  zone_max_bpm: string
  notes: string
}



type WorkoutSessionExerciseLite = {
  exerciseId?: string | null
  exerciseName?: string | null
}

type CardioSessionDataLite = {
  type?: string | null
  exerciseId?: string | null
  exerciseName?: string | null
  programItemId?: string | null
}

type DbInjuryRow = {
  id: string
  user_id: string
  body_part: string
  description: string
  severity: number
  date_started: string
  date_recovered: string | null
  status: 'active' | 'recovered' | 'chronic'
  notes: string | null
  affected_exercises: string[] | null
  created_at: string
  updated_at: string
}

type InjuryAlert = {
  id: string
  bodyPart: string
  description: string
  severity: number
  status: 'active' | 'chronic'
}

interface WorkoutProgramsProps {
  selectedUserId?: string | null
  selectedUserLabel?: string | null
}

const WEEKDAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
]

const weekdayLabel = (n: number) =>
  ({ 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 7: 'Domingo' } as Record<number, string>)[n] ?? `Dia ${n}`

function getProfileDisplayName(
  profile?: { id?: string | null; full_name?: string | null; email?: string | null } | null,
  fallback = 'Aluno'
) {
  return profile?.full_name?.trim() || profile?.email?.trim() || (profile?.id ? `${profile.id.slice(0, 6)}…` : fallback)
}

function deriveMetaFromTitle(
  title: string
): Pick<ProgramUI, 'duration' | 'sessionsPerWeek' | 'difficulty' | 'goal' | 'image'> {
  const t = title.toLowerCase()
  if (t.includes('hipertrofia')) return { duration: '8 semanas', sessionsPerWeek: 3, difficulty: 'Intermediário', goal: 'Hipertrofia', image: '💪' }
  if (t.includes('5x5') || t.includes('força') || t.includes('forca')) return { duration: '12 semanas', sessionsPerWeek: 3, difficulty: 'Intermediário', goal: 'Força', image: '🏋️' }
  if (t.includes('hiit') || t.includes('emagrecimento')) return { duration: '6 semanas', sessionsPerWeek: 4, difficulty: 'Avançado', goal: 'Emagrecimento', image: '🔥' }
  if (t.includes('iniciante') || t.includes('full body')) return { duration: '4 semanas', sessionsPerWeek: 3, difficulty: 'Iniciante', goal: 'Condicionamento', image: '🌱' }
  return { duration: '—', sessionsPerWeek: 0, difficulty: 'Intermediário', goal: 'Programa', image: '📘' }
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case 'Iniciante': return 'bg-green-500/20 text-green-400'
    case 'Intermediário': return 'bg-yellow-500/20 text-yellow-400'
    case 'Avançado': return 'bg-red-500/20 text-red-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function mapPlanToProgramUI(plan: DbPlan, source: ProgramSource): ProgramUI {
  return {
    id: plan.id,
    name: plan.title,
    description: plan.description ?? 'Programa de treino',
    visibility: plan.visibility,
    source,
    owner_id: plan.owner_id ?? null,
    ...deriveMetaFromTitle(plan.title),
  }
}

function normalizeProgressKey(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getProgramItemProgressKeys(item: DbPlanItem) {
  const exerciseName = item.exercise_name || item.custom_exercise_name || ''

  return [
    item.id ? `plan-item:${item.id}` : '',
    normalizeProgressKey(item.exercise_id),
    normalizeProgressKey(exerciseName),
  ].filter(Boolean)
}

function isMobilityLikeExercise(exercise?: Pick<ExerciseRow, 'name' | 'category' | 'muscle_group'> | null) {
  if (!exercise) return false
  const category = String(exercise.category ?? '').toLowerCase()
  const muscle = String(exercise.muscle_group ?? '').toLowerCase()
  const name = String(exercise.name ?? '').toLowerCase()

  return (
    category.includes('mobilidade') ||
    category.includes('core') ||
    muscle.includes('mobilidade') ||
    muscle.includes('core') ||
    name.includes('isometr') ||
    name.includes('prancha')
  )
}

function normalizeInjuryKey(value?: string | null) {
  return normalizeProgressKey(value)
}

function getInjuryAliases(bodyPart: string) {
  const key = normalizeInjuryKey(bodyPart)

  const aliasMap: Record<string, string[]> = {
    peito: ['peito'],
    costas: ['costas', 'lombar'],
    ombro: ['ombro', 'deltoide'],
    'ombro (articulacao)': ['ombro', 'deltoide', 'peito', 'triceps'],
    biceps: ['biceps'],
    triceps: ['triceps'],
    quadriceps: ['quadriceps', 'joelho', 'perna'],
    posteriores: ['posteriores', 'isquiotibiais', 'perna'],
    gluteos: ['gluteos', 'quadril'],
    panturrilhas: ['panturrilhas', 'tornozelo'],
    abdomen: ['abdomen', 'core', 'lombar'],
    joelho: ['joelho', 'quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'perna'],
    cotovelo: ['cotovelo', 'biceps', 'triceps', 'antebraco'],
    pulso: ['pulso', 'antebraco'],
    quadril: ['quadril', 'gluteos', 'posteriores', 'adutores'],
    tornozelo: ['tornozelo', 'panturrilhas'],
    lombar: ['lombar', 'costas', 'abdomen', 'core'],
    cervical: ['cervical', 'ombro', 'costas'],
  }

  return aliasMap[key] ?? [key]
}

function itemConflictsWithInjuries(item: DbPlanItem, injuries: InjuryAlert[]) {
  const exerciseName = normalizeInjuryKey(item.exercise_name || item.custom_exercise_name || '')
  const muscleGroup = normalizeInjuryKey(item.muscle_group || '')
  const combined = `${exerciseName} ${muscleGroup}`

  return injuries.filter((injury) => {
    const aliases = getInjuryAliases(injury.bodyPart)
    return aliases.some((alias) => alias && combined.includes(alias))
  })
}

function openWorkoutPageFromProgram(programId: string) {
  localStorage.setItem(
    'academy:openWorkoutFromProgram',
    JSON.stringify({
      programId,
      ts: Date.now(),
    })
  )

  window.dispatchEvent(
    new CustomEvent('academy:open-workout-from-program', {
      detail: { programId },
    })
  )
}

const emptyProgramForm = (): ProgramFormState => ({
  title: '',
  description: '',
  visibility: 'private',
  weekdays: [1, 3, 5],
})

const emptyNewItemForm = (): NewItemForm => ({
  block: 'strength',
  exerciseSourceMode: 'existing',
  selectedExerciseId: '',
  custom_exercise_name: '',
  sets: '',
  reps: '',
  target_weight: '',
  duration_min: '',
  zone_min_bpm: '',
  zone_max_bpm: '',
  notes: '',
})

export function WorkoutPrograms({ selectedUserId, selectedUserLabel }: WorkoutProgramsProps) {
  const { user, profile } = useAuth()
  const role = (profile?.role ?? 'user') as Role
  const isStudentMode = !!selectedUserId
  const targetUserId = selectedUserId || user?.id || null
  const targetUserLabel = selectedUserLabel || 'Aluno selecionado'
  const canManagePrograms = role === 'coach' || role === 'admin'

  const [loading, setLoading] = useState(true)
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)
  const [publicPrograms, setPublicPrograms] = useState<ProgramUI[]>([])
  const [assignedPrograms, setAssignedPrograms] = useState<ProgramUI[]>([])
  const [ownedPrograms, setOwnedPrograms] = useState<ProgramUI[]>([])
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null)
  const [activeProgram, setActiveProgram] = useState<ProgramUI | null>(null)
  const [changingProgram, setChangingProgram] = useState<string | null>(null)
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, { days: (DbPlanDay & { items: DbPlanItem[] })[] }>>({})
  const [activeProgramDays, setActiveProgramDays] = useState<DbPlanDay[]>([])
  const [activeProgramItems, setActiveProgramItems] = useState<Record<string, DbPlanItem[]>>({})
  const [completedTodayKeys, setCompletedTodayKeys] = useState<string[]>([])
  const [injuryAlerts, setInjuryAlerts] = useState<InjuryAlert[]>([])
  const [injuryLoading, setInjuryLoading] = useState(false)

  const [students, setStudents] = useState<ProfileStudentRow[]>([])
  const [planStudentIds, setPlanStudentIds] = useState<Record<string, string[]>>({})
  const [assignPanelPlanId, setAssignPanelPlanId] = useState<string | null>(null)
  const [draftPlanStudentIds, setDraftPlanStudentIds] = useState<Record<string, string[]>>({})
  const [savingAssignmentsForPlanId, setSavingAssignmentsForPlanId] = useState<string | null>(null)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formSaving, setFormSaving] = useState(false)
  const [programForm, setProgramForm] = useState<ProgramFormState>(emptyProgramForm())
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null)

  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false)
  const [editingContentProgram, setEditingContentProgram] = useState<ProgramUI | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [editorDays, setEditorDays] = useState<EditorDay[]>([])
  const [openNewItemDayId, setOpenNewItemDayId] = useState<string | null>(null)
  const [newItemForm, setNewItemForm] = useState<NewItemForm>(emptyNewItemForm())
  const [savingNewItemDayId, setSavingNewItemDayId] = useState<string | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseRow[]>([])

  const canChangeActiveProgram = useMemo(() => {
    if (!user || !targetUserId) return false
    if (user.id === targetUserId) return true
    return role === 'coach' || role === 'admin'
  }, [user, targetUserId, role])

  const selectedExercise = useMemo(
    () => exerciseOptions.find((exercise) => exercise.id === newItemForm.selectedExerciseId) ?? null,
    [exerciseOptions, newItemForm.selectedExerciseId]
  )

  const exercisePickerOptions = useMemo<ExercisePickerOption[]>(
    () =>
      exerciseOptions.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        muscle_group: exercise.muscle_group,
        category: exercise.category,
        type: exercise.type,
        equipment: exercise.equipment,
        aliases: exercise.aliases ?? [],
        notes: exercise.notes ?? null,
        is_active: exercise.is_active ?? true,
      })),
    [exerciseOptions]
  )

  const rawToday = new Date().toLocaleDateString('pt-BR', { weekday: 'long' })
  const normalizedToday = rawToday.replace('-feira', '').trim()
  const todayLabel = normalizedToday.charAt(0).toUpperCase() + normalizedToday.slice(1)
  const todayProgramDay = activeProgramDays.find((day) => weekdayLabel(day.weekday) === todayLabel)
  const todayProgramExercises = useMemo(
    () => (todayProgramDay ? (activeProgramItems[todayProgramDay.id] ?? []) : []),
    [todayProgramDay, activeProgramItems]
  )

  const progress = useMemo(() => {
    const total = todayProgramExercises.length
    const completed = todayProgramExercises.filter((item) => {
      const keys = getProgramItemProgressKeys(item)

      return keys.some((key) => completedTodayKeys.includes(key))
    }).length

    return {
      completed,
      total,
      percent: total > 0 ? (completed / total) * 100 : 0,
      isComplete: total > 0 && completed >= total,
    }
  }, [todayProgramExercises, completedTodayKeys])

  const todayInjuryConflicts = useMemo(() => {
    return todayProgramExercises
      .map((item) => ({
        itemId: item.id,
        conflicts: itemConflictsWithInjuries(item, injuryAlerts),
      }))
      .filter((entry) => entry.conflicts.length > 0)
  }, [todayProgramExercises, injuryAlerts])

  const hasTodayInjuryConflicts = todayInjuryConflicts.length > 0

  const loadCompletedTodayProgress = useCallback(async () => {
    if (!targetUserId) {
      setCompletedTodayKeys([])
      return
    }

    try {
      const today = getTodayLocalDateString()
      const [{ data: workoutData, error: workoutError }, { data: cardioData, error: cardioError }] =
        await Promise.all([
          supabase
            .from('workout_sessions')
            .select('exercises')
            .eq('user_id', targetUserId)
            .eq('session_date', today),
          supabase
            .from('cardio_sessions')
            .select('data')
            .eq('user_id', targetUserId)
            .eq('session_date', today),
        ])

      if (workoutError) throw workoutError
      if (cardioError) throw cardioError

      const keys = new Set<string>()

      for (const row of (workoutData ?? []) as Array<{ exercises?: unknown }>) {
        if (!Array.isArray(row.exercises)) continue

        for (const rawExercise of row.exercises as WorkoutSessionExerciseLite[]) {
          const byId = normalizeProgressKey(rawExercise?.exerciseId)
          const byName = normalizeProgressKey(rawExercise?.exerciseName)

          if (byId) keys.add(byId)
          if (byName) keys.add(byName)
        }
      }

      for (const row of (cardioData ?? []) as Array<{ data?: unknown }>) {
        const cardio = (row.data ?? {}) as CardioSessionDataLite
        const programItemKey = cardio.programItemId ? `plan-item:${cardio.programItemId}` : ''
        const byId = normalizeProgressKey(cardio.exerciseId)
        const byName = normalizeProgressKey(cardio.exerciseName)
        const byType = normalizeProgressKey(cardio.type)

        if (programItemKey) keys.add(programItemKey)
        if (byId) keys.add(byId)
        if (byName) keys.add(byName)
        if (byType) keys.add(byType)
      }

      setCompletedTodayKeys(Array.from(keys))
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar progresso do programa de hoje.')
    }
  }, [targetUserId])

    const loadInjuryAlerts = useCallback(async () => {
    if (!targetUserId) {
      setInjuryAlerts([])
      return
    }

    try {
      setInjuryLoading(true)

      const { data, error } = await supabase
        .from('injuries')
        .select('id,user_id,body_part,description,severity,status')
        .eq('user_id', targetUserId)
        .in('status', ['active', 'chronic'])
        .order('severity', { ascending: false })

      if (error) throw error

      const mapped: InjuryAlert[] = ((data ?? []) as Array<Pick<DbInjuryRow, 'id' | 'body_part' | 'description' | 'severity' | 'status'>>).map((row) => ({
        id: row.id,
        bodyPart: row.body_part,
        description: row.description,
        severity: row.severity,
        status: row.status as 'active' | 'chronic',
      }))

      setInjuryAlerts(mapped)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar alertas de lesão.')
      setInjuryAlerts([])
    } finally {
      setInjuryLoading(false)
    }
  }, [targetUserId])

  const loadExercises = useCallback(async () => {
    if (!canManagePrograms || !user) return

    const { data, error } = await supabase
      .from('exercises')
      .select('id,name,muscle_group,category,type,equipment,aliases,notes,is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error

    const normalized: ExerciseRow[] = ((data ?? []) as Array<{
      id: string
      name: string
      muscle_group: string | null
      category: string | null
      type: string | null
      equipment: string | null
      aliases?: string[] | null
      notes?: string | null
      is_active?: boolean | null
    }>).map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscle_group ?? null,
      category: exercise.category ?? null,
      type: exercise.type ?? null,
      equipment: exercise.equipment ?? null,
      aliases: exercise.aliases ?? [],
      notes: exercise.notes ?? null,
      is_active: exercise.is_active ?? true,
    }))

    setExerciseOptions(normalized)
  }, [canManagePrograms, user])

  const loadActiveProgramContent = useCallback(async (programId: string) => {
    const { data: daysData, error: daysError } = await supabase
      .from('plan_days')
      .select('id, plan_id, weekday, day_title')
      .eq('plan_id', programId)
      .order('weekday', { ascending: true })

    if (daysError) throw daysError

    const days = (daysData ?? []) as DbPlanDay[]
    setActiveProgramDays(days)

    if (days.length === 0) {
      setActiveProgramItems({})
      return
    }

    const dayIds = days.map((day) => day.id)

    const { data: itemsData, error: itemsError } = await supabase
      .from('plan_items')
      .select(`
        id,
        plan_day_id,
        block,
        exercise_id,
        custom_exercise_name,
        muscle_group,
        sets,
        reps,
        target_weight,
        duration_min,
        zone_min_bpm,
        zone_max_bpm,
        notes,
        sort_order,
        exercises:exercise_id ( name )
      `)
      .in('plan_day_id', dayIds)
      .order('sort_order', { ascending: true })

    if (itemsError) throw itemsError

    const grouped: Record<string, DbPlanItem[]> = {}
    for (const raw of (itemsData ?? []) as any[]) {
      const item: DbPlanItem = {
        id: raw.id,
        plan_day_id: raw.plan_day_id,
        block: raw.block,
        exercise_id: raw.exercise_id,
        custom_exercise_name: raw.custom_exercise_name,
        muscle_group: raw.muscle_group,
        sets: raw.sets,
        reps: raw.reps,
        target_weight: raw.target_weight,
        duration_min: raw.duration_min,
        zone_min_bpm: raw.zone_min_bpm,
        zone_max_bpm: raw.zone_max_bpm,
        notes: raw.notes,
        sort_order: raw.sort_order ?? 0,
        exercise_name: raw.exercises?.name ?? null,
      }

      if (!grouped[item.plan_day_id]) grouped[item.plan_day_id] = []
      grouped[item.plan_day_id].push(item)
    }

    setActiveProgramItems(grouped)
  }, [])

  const loadProgramContentForEditor = useCallback(async (programId: string) => {
    setContentLoading(true)
    try {
      const { data: days, error: daysErr } = await supabase
        .from('plan_days')
        .select('id,plan_id,weekday,day_title')
        .eq('plan_id', programId)
        .order('weekday', { ascending: true })
      if (daysErr) throw daysErr

      const typedDays = (days ?? []) as DbPlanDay[]
      const dayIds = typedDays.map((d) => d.id)

      if (dayIds.length === 0) {
        setEditorDays([])
        return
      }

      const { data: items, error: itemsErr } = await supabase
        .from('plan_items')
        .select(`
          id,plan_day_id,block,exercise_id,custom_exercise_name,muscle_group,sets,reps,target_weight,duration_min,zone_min_bpm,zone_max_bpm,notes,sort_order,
          exercises:exercise_id ( name )
        `)
        .in('plan_day_id', dayIds)
        .order('sort_order', { ascending: true })
      if (itemsErr) throw itemsErr

      const normalizedItems: DbPlanItem[] = (items ?? []).map((it: any) => ({
        id: it.id,
        plan_day_id: it.plan_day_id,
        block: it.block,
        exercise_id: it.exercise_id,
        custom_exercise_name: it.custom_exercise_name,
        muscle_group: it.muscle_group,
        sets: it.sets,
        reps: it.reps,
        target_weight: it.target_weight,
        duration_min: it.duration_min,
        zone_min_bpm: it.zone_min_bpm,
        zone_max_bpm: it.zone_max_bpm,
        notes: it.notes,
        sort_order: it.sort_order ?? 0,
        exercise_name: it.exercises?.name ?? null,
      }))

      const byDay: Record<string, DbPlanItem[]> = {}
      for (const item of normalizedItems) {
        byDay[item.plan_day_id] = byDay[item.plan_day_id] ?? []
        byDay[item.plan_day_id].push(item)
      }

      setEditorDays(typedDays.map((day) => ({ ...day, items: byDay[day.id] ?? [] })))
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar conteúdo do programa.')
      setEditorDays([])
    } finally {
      setContentLoading(false)
    }
  }, [])

  const openContentDialog = async (program: ProgramUI) => {
    setEditingContentProgram(program)
    setOpenNewItemDayId(null)
    setNewItemForm(emptyNewItemForm())
    setIsContentDialogOpen(true)
    await loadProgramContentForEditor(program.id)
  }

  const reloadPrograms = useCallback(async () => {
    if (!user || !targetUserId) return

    const { data: publicPlans, error: publicPlansErr } = await supabase
      .from('plans')
      .select('id,title,description,type,visibility,is_active,created_at,updated_at,owner_id')
      .eq('type', 'program')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (publicPlansErr) throw publicPlansErr
    const mappedPublic = ((publicPlans ?? []) as DbPlan[]).map((p) => mapPlanToProgramUI(p, 'public'))
    setPublicPrograms(mappedPublic)

    const { data: planLinks, error: linksErr } = await supabase
      .from('plan_students')
      .select('plan_id, student_id, assigned_by, created_at')
      .eq('student_id', targetUserId)
    if (linksErr) throw linksErr

    const linkedPlanIds = Array.from(new Set(((planLinks ?? []) as PlanStudentRow[]).map((row) => row.plan_id).filter(Boolean)))
    let mappedAssigned: ProgramUI[] = []
    if (linkedPlanIds.length > 0) {
      const { data: assignedPlans, error: assignedPlansErr } = await supabase
        .from('plans')
        .select('id,title,description,type,visibility,is_active,created_at,updated_at,owner_id')
        .eq('type', 'program')
        .eq('is_active', true)
        .in('id', linkedPlanIds)
        .order('created_at', { ascending: false })
      if (assignedPlansErr) throw assignedPlansErr
      mappedAssigned = ((assignedPlans ?? []) as DbPlan[]).map((p) => mapPlanToProgramUI(p, 'assigned'))
    }
    setAssignedPrograms(mappedAssigned)

    let mappedOwned: ProgramUI[] = []
    if (canManagePrograms && user?.id) {
      const { data: ownedPlans, error: ownedPlansErr } = await supabase
        .from('plans')
        .select('id,title,description,type,visibility,is_active,created_at,updated_at,owner_id')
        .eq('type', 'program')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (ownedPlansErr) throw ownedPlansErr

      mappedOwned = ((ownedPlans ?? []) as DbPlan[]).map((p) => mapPlanToProgramUI(p, 'owned'))
      setOwnedPrograms(mappedOwned)

      const ownedPlanIds = mappedOwned.map((p) => p.id)
      if (ownedPlanIds.length > 0) {
        const { data: ownedLinks, error: ownedLinksErr } = await supabase
          .from('plan_students')
          .select('plan_id, student_id, assigned_by, created_at')
          .in('plan_id', ownedPlanIds)
        if (ownedLinksErr) throw ownedLinksErr

        const map: Record<string, string[]> = {}
        for (const row of (ownedLinks ?? []) as PlanStudentRow[]) {
          map[row.plan_id] = map[row.plan_id] ?? []
          if (!map[row.plan_id].includes(row.student_id)) map[row.plan_id].push(row.student_id)
        }
        setPlanStudentIds(map)
        setDraftPlanStudentIds(map)
      } else {
        setPlanStudentIds({})
        setDraftPlanStudentIds({})
      }
    } else {
      setOwnedPrograms([])
      setPlanStudentIds({})
      setDraftPlanStudentIds({})
    }

    if (canManagePrograms && user?.id) {
      if (role === 'admin') {
        const { data: allStudents, error: allStudentsErr } = await supabase
          .from('profiles')
          .select('id,full_name,email,role')
          .eq('role', 'user')
          .order('created_at', { ascending: false })
        if (allStudentsErr) throw allStudentsErr
        setStudents((allStudents ?? []) as ProfileStudentRow[])
      } else {
        const { data: coachLinks, error: coachLinksErr } = await supabase
          .from('coach_students')
          .select('student_id')
          .eq('coach_id', user.id)
        if (coachLinksErr) throw coachLinksErr

        const studentIds = Array.from(new Set(((coachLinks ?? []) as CoachStudentLink[]).map((row) => row.student_id).filter(Boolean)))
        if (studentIds.length > 0) {
          const { data: studentProfiles, error: studentProfilesErr } = await supabase
            .from('profiles')
            .select('id,full_name,email,role')
            .in('id', studentIds)
          if (studentProfilesErr) throw studentProfilesErr
          setStudents((studentProfiles ?? []) as ProfileStudentRow[])
        } else {
          setStudents([])
        }
      }
    } else {
      setStudents([])
    }

    const { data: act, error: actErr } = await supabase
      .from('user_active_plan')
      .select('active_program_id')
      .eq('user_id', targetUserId)
      .maybeSingle()
    if (actErr) throw actErr

    const nextActiveProgramId = act?.active_program_id ?? null
    setActiveProgramId(nextActiveProgramId)

    const allMapped = [...mappedOwned, ...mappedAssigned, ...mappedPublic]
    const found = nextActiveProgramId ? allMapped.find((program) => program.id === nextActiveProgramId) ?? null : null
    setActiveProgram(found)

    if (nextActiveProgramId) {
      await loadActiveProgramContent(nextActiveProgramId)
    } else {
      setActiveProgramDays([])
      setActiveProgramItems({})
    }

        await Promise.all([
      loadCompletedTodayProgress(),
      loadInjuryAlerts(),
    ])
  }, [user, targetUserId, canManagePrograms, role, loadActiveProgramContent, loadCompletedTodayProgress, loadInjuryAlerts])

  useEffect(() => {
    if (!user || !targetUserId) return
    const run = async () => {
      setLoading(true)
      try {
        await Promise.all([reloadPrograms(), loadExercises()])
      } catch (e: any) {
        toast.error(e?.message ?? 'Erro ao carregar programas.')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [user, targetUserId, reloadPrograms, loadExercises])

  const toggleProgram = useCallback(async (programId: string) => {
    const next = expandedProgram === programId ? null : programId
    setExpandedProgram(next)
    if (!next || details[next]) return

    try {
      const { data: days, error: daysErr } = await supabase
        .from('plan_days')
        .select('id,plan_id,weekday,day_title')
        .eq('plan_id', programId)
        .order('weekday', { ascending: true })
      if (daysErr) throw daysErr

      const dayIds = (days ?? []).map((d: DbPlanDay) => d.id)
      if (dayIds.length === 0) {
        setDetails((prev) => ({ ...prev, [programId]: { days: [] } }))
        return
      }

      const { data: items, error: itemsErr } = await supabase
        .from('plan_items')
        .select(`
          id,plan_day_id,block,exercise_id,custom_exercise_name,muscle_group,sets,reps,target_weight,duration_min,zone_min_bpm,zone_max_bpm,notes,sort_order,
          exercises:exercise_id ( name )
        `)
        .in('plan_day_id', dayIds)
        .order('sort_order', { ascending: true })
      if (itemsErr) throw itemsErr

      const normalizedItems: DbPlanItem[] = (items ?? []).map((it: any) => ({
        id: it.id,
        plan_day_id: it.plan_day_id,
        block: it.block,
        exercise_id: it.exercise_id,
        custom_exercise_name: it.custom_exercise_name,
        muscle_group: it.muscle_group,
        sets: it.sets,
        reps: it.reps,
        target_weight: it.target_weight,
        duration_min: it.duration_min,
        zone_min_bpm: it.zone_min_bpm,
        zone_max_bpm: it.zone_max_bpm,
        notes: it.notes,
        sort_order: it.sort_order ?? 0,
        exercise_name: it.exercises?.name ?? null,
      }))

      const byDay: Record<string, DbPlanItem[]> = {}
      normalizedItems.forEach((item) => {
        byDay[item.plan_day_id] = byDay[item.plan_day_id] ?? []
        byDay[item.plan_day_id].push(item)
      })

      setDetails((prev) => ({
        ...prev,
        [programId]: { days: (days ?? []).map((d: DbPlanDay) => ({ ...d, items: byDay[d.id] ?? [] })) },
      }))
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar detalhes do programa.')
    }
  }, [expandedProgram, details])

  const handleStartProgram = async (program: ProgramUI) => {
    if (!user || !targetUserId) return
    if (!canChangeActiveProgram) {
      toast.info('Nesta fase, a ativação continua apenas no próprio usuário logado.')
      return
    }

    try {
      setChangingProgram(program.id)
      const { error } = await supabase
        .from('user_active_plan')
        .upsert({
          user_id: targetUserId,
          active_program_id: program.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      if (error) throw error
      setActiveProgramId(program.id)
      setActiveProgram(program)
      await loadActiveProgramContent(program.id)
      await loadCompletedTodayProgress()
      toast.success(`Programa "${program.name}" iniciado!`)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao iniciar programa.')
    } finally {
      setChangingProgram(null)
    }
  }

  const handleDeactivateProgram = async () => {
    if (!user || !activeProgramId || !targetUserId) return
    if (!canChangeActiveProgram) {
      toast.info('Nesta fase, a desativação continua apenas no próprio usuário logado.')
      return
    }

    try {
      setChangingProgram(activeProgramId)
      const { error } = await supabase
        .from('user_active_plan')
        .update({ active_program_id: null, updated_at: new Date().toISOString() })
        .eq('user_id', targetUserId)
      if (error) throw error
      toast.success(`"${activeProgram?.name ?? 'Programa'}" desativado com sucesso!`)
      setActiveProgramId(null)
      setActiveProgram(null)
      setActiveProgramDays([])
      setActiveProgramItems({})
      setCompletedTodayKeys([])
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao desativar programa.')
    } finally {
      setChangingProgram(null)
    }
  }

  const toggleStudentForPlan = (planId: string, studentId: string) => {
    const current = draftPlanStudentIds[planId] ?? []
    const next = current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]
    setDraftPlanStudentIds((prev) => ({ ...prev, [planId]: next }))
  }

  const handleSaveAssignments = async (planId: string) => {
    if (!user) return
    const current = planStudentIds[planId] ?? []
    const draft = draftPlanStudentIds[planId] ?? []
    const toInsert = draft.filter((id) => !current.includes(id))
    const toDelete = current.filter((id) => !draft.includes(id))
    if (toInsert.length === 0 && toDelete.length === 0) {
      toast.info('Nenhuma alteração para salvar.')
      return
    }

    try {
      setSavingAssignmentsForPlanId(planId)
      if (toInsert.length > 0) {
        const { error } = await supabase.from('plan_students').insert(
          toInsert.map((studentId) => ({ plan_id: planId, student_id: studentId, assigned_by: user.id }))
        )
        if (error) throw error
      }
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('plan_students')
          .delete()
          .eq('plan_id', planId)
          .in('student_id', toDelete)
        if (error) throw error
      }
      setPlanStudentIds((prev) => ({ ...prev, [planId]: draft }))
      toast.success('Alunos vinculados atualizados ✅')
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar vínculos do programa.')
    } finally {
      setSavingAssignmentsForPlanId(null)
    }
  }

  const assignProgramToSelectedStudent = async (planId: string) => {
    if (!user || !selectedUserId) return

    const currentAssigned = planStudentIds[planId] ?? []
    if (currentAssigned.includes(selectedUserId)) {
      toast.info('Esse programa já está atribuído ao aluno selecionado.')
      return
    }

    try {
      setSavingAssignmentsForPlanId(planId)
      const { error } = await supabase.from('plan_students').insert({
        plan_id: planId,
        student_id: selectedUserId,
        assigned_by: user.id,
      })
      if (error) throw error

      const nextAssigned = [...currentAssigned, selectedUserId]
      setPlanStudentIds((prev) => ({ ...prev, [planId]: nextAssigned }))
      setDraftPlanStudentIds((prev) => ({ ...prev, [planId]: nextAssigned }))
      toast.success(`Programa atribuído para ${targetUserLabel}!`)
      await reloadPrograms()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao atribuir programa para o aluno.')
    } finally {
      setSavingAssignmentsForPlanId(null)
    }
  }

  const openCreateDialog = () => {
    setProgramForm(emptyProgramForm())
    setEditingProgramId(null)
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = async (program: ProgramUI) => {
    setEditingProgramId(program.id)
    try {
      const { data, error } = await supabase
        .from('plan_days')
        .select('id, weekday')
        .eq('plan_id', program.id)
        .order('weekday', { ascending: true })
      if (error) throw error
      setProgramForm({
        title: program.name,
        description: program.description,
        visibility: program.visibility,
        weekdays: ((data ?? []) as Array<{ id: string; weekday: number }>).map((d) => d.weekday),
      })
      setIsEditDialogOpen(true)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao abrir editor do programa.')
    }
  }

  const toggleWeekdayInForm = (weekday: number) => {
    setProgramForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(weekday)
        ? prev.weekdays.filter((w) => w !== weekday)
        : [...prev.weekdays, weekday].sort((a, b) => a - b),
    }))
  }

  const handleCreateProgram = async () => {
    if (!user) return
    const title = programForm.title.trim()
    const weekdays = [...programForm.weekdays].sort((a, b) => a - b)
    if (!title) return toast.error('Informe o nome do programa.')
    if (weekdays.length === 0) return toast.error('Selecione pelo menos um dia da semana.')

    try {
      setFormSaving(true)
      const { data, error } = await supabase
        .from('plans')
        .insert({
          title,
          description: programForm.description.trim() || null,
          type: 'program',
          visibility: programForm.visibility,
          owner_id: user.id,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (error) throw error

      const { error: daysErr } = await supabase.from('plan_days').insert(
        weekdays.map((weekday) => ({ plan_id: data.id, weekday, day_title: weekdayLabel(weekday) }))
      )
      if (daysErr) throw daysErr

      toast.success('Programa criado com sucesso ✅')
      setIsCreateDialogOpen(false)
      setProgramForm(emptyProgramForm())
      await reloadPrograms()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao criar programa.')
    } finally {
      setFormSaving(false)
    }
  }

  const handleEditProgram = async () => {
    if (!user || !editingProgramId) return
    const title = programForm.title.trim()
    const weekdays = [...programForm.weekdays].sort((a, b) => a - b)
    if (!title) return toast.error('Informe o nome do programa.')
    if (weekdays.length === 0) return toast.error('Selecione pelo menos um dia da semana.')

    try {
      setFormSaving(true)
      const { error } = await supabase
        .from('plans')
        .update({
          title,
          description: programForm.description.trim() || null,
          visibility: programForm.visibility,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProgramId)
        .eq('owner_id', user.id)
      if (error) throw error

      const { data: existingDays, error: existingDaysErr } = await supabase
        .from('plan_days')
        .select('id')
        .eq('plan_id', editingProgramId)
      if (existingDaysErr) throw existingDaysErr

      const existingDayIds = ((existingDays ?? []) as Array<{ id: string }>).map((d) => d.id)
      if (existingDayIds.length > 0) {
        const { error: deleteItemsErr } = await supabase
          .from('plan_items')
          .delete()
          .in('plan_day_id', existingDayIds)
        if (deleteItemsErr) throw deleteItemsErr
      }

      const { error: deleteDaysErr } = await supabase
        .from('plan_days')
        .delete()
        .eq('plan_id', editingProgramId)
      if (deleteDaysErr) throw deleteDaysErr

      const { error: insertDaysErr } = await supabase.from('plan_days').insert(
        weekdays.map((weekday) => ({
          plan_id: editingProgramId,
          weekday,
          day_title: weekdayLabel(weekday),
        }))
      )
      if (insertDaysErr) throw insertDaysErr

      toast.success('Programa atualizado com sucesso ✅')
      setIsEditDialogOpen(false)
      setEditingProgramId(null)
      await reloadPrograms()

      if (editingContentProgram?.id === editingProgramId) {
        await loadProgramContentForEditor(editingProgramId)
      }
      if (activeProgramId === editingProgramId) {
        await loadActiveProgramContent(editingProgramId)
        await loadCompletedTodayProgress()
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao atualizar programa.')
    } finally {
      setFormSaving(false)
    }
  }

  const openNewItemFormForDay = (dayId: string) => {
    setOpenNewItemDayId(dayId)
    setNewItemForm(emptyNewItemForm())
  }

  const handleSaveNewItem = async (dayId: string) => {
    if (!editingContentProgram) return

    const usingExisting = newItemForm.exerciseSourceMode === 'existing'
    const existingExercise = exerciseOptions.find((exercise) => exercise.id === newItemForm.selectedExerciseId)
    const exerciseName = usingExisting ? existingExercise?.name?.trim() : newItemForm.custom_exercise_name.trim()

    if (!exerciseName) {
      toast.error(usingExisting ? 'Selecione um exercício do banco.' : 'Informe o nome do exercício.')
      return
    }

    if (newItemForm.block === 'strength' && !newItemForm.sets.trim()) {
      toast.error('Informe as séries do item.')
      return
    }

    if (newItemForm.block === 'strength' && !newItemForm.reps.trim() && !newItemForm.duration_min.trim()) {
      toast.error('Informe reps ou tempo por série para o item.')
      return
    }

    if (newItemForm.block === 'cardio' && !newItemForm.duration_min.trim()) {
      toast.error('Informe a duração para item de cardio.')
      return
    }

    try {
      setSavingNewItemDayId(dayId)
      const targetDay = editorDays.find((d) => d.id === dayId)
      const nextSortOrder = targetDay?.items.length ? Math.max(...targetDay.items.map((item) => item.sort_order ?? 0)) + 1 : 0

      const { error } = await supabase.from('plan_items').insert({
        plan_day_id: dayId,
        block: newItemForm.block,
        exercise_id: usingExisting ? newItemForm.selectedExerciseId : null,
        custom_exercise_name: usingExisting ? null : exerciseName,
        muscle_group: usingExisting ? existingExercise?.muscle_group ?? null : null,
        sets: newItemForm.block === 'strength' ? Number(newItemForm.sets) : null,
        reps: newItemForm.block === 'strength' ? newItemForm.reps.trim() : null,
        target_weight: newItemForm.block === 'strength' && newItemForm.target_weight.trim() ? Number(newItemForm.target_weight) : null,
        duration_min: newItemForm.duration_min.trim() ? Number(newItemForm.duration_min) : null,
        zone_min_bpm: newItemForm.block === 'cardio' && newItemForm.zone_min_bpm.trim() ? Number(newItemForm.zone_min_bpm) : null,
        zone_max_bpm: newItemForm.block === 'cardio' && newItemForm.zone_max_bpm.trim() ? Number(newItemForm.zone_max_bpm) : null,
        notes: newItemForm.notes.trim() || null,
        sort_order: nextSortOrder,
      })
      if (error) throw error

      toast.success('Item adicionado ✅')
      setOpenNewItemDayId(null)
      setNewItemForm(emptyNewItemForm())
      await loadProgramContentForEditor(editingContentProgram.id)
      if (activeProgramId === editingContentProgram.id) {
        await loadActiveProgramContent(editingContentProgram.id)
        await loadCompletedTodayProgress()
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao adicionar item.')
    } finally {
      setSavingNewItemDayId(null)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!editingContentProgram) return
    try {
      setDeletingItemId(itemId)
      const { error } = await supabase.from('plan_items').delete().eq('id', itemId)
      if (error) throw error
      toast.success('Item removido ✅')
      await loadProgramContentForEditor(editingContentProgram.id)
      if (activeProgramId === editingContentProgram.id) {
        await loadActiveProgramContent(editingContentProgram.id)
        await loadCompletedTodayProgress()
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao remover item.')
    } finally {
      setDeletingItemId(null)
    }
  }

  const renderAssignmentPanel = (program: ProgramUI) => {
    if (!canManagePrograms || program.source !== 'owned' || program.visibility !== 'private' || isStudentMode) return null

    const isOpen = assignPanelPlanId === program.id
    const selectedIds = draftPlanStudentIds[program.id] ?? []
    const currentAssigned = planStudentIds[program.id] ?? []

    return (
      <div className="border-t border-border bg-muted/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <UserPlus className="h-4 w-4 text-primary" />
              Atribuir alunos
            </h4>
            <p className="text-xs text-muted-foreground">
              Marque os alunos que devem visualizar este programa como indicado pelo professor.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{selectedIds.length} aluno(s)</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAssignPanelPlanId(isOpen ? null : program.id)
                if (!isOpen) setDraftPlanStudentIds((prev) => ({ ...prev, [program.id]: currentAssigned }))
              }}
            >
              {isOpen ? 'Fechar' : 'Gerenciar'}
            </Button>
          </div>
        </div>

        {isOpen && (
          <div className="mt-4 space-y-4">
            {students.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
                Nenhum aluno disponível para vínculo.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {students.map((student) => {
                  const checked = selectedIds.includes(student.id)
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleStudentForPlan(program.id, student.id)}
                      className={`rounded-lg border p-3 text-left transition ${
                        checked ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">{getProfileDisplayName(student, 'Aluno')}</div>
                          <div className="truncate text-xs text-muted-foreground">{student.email ?? '—'}</div>
                        </div>
                        <Badge variant={checked ? 'default' : 'outline'} className="shrink-0 text-xs">
                          {checked ? 'Selecionado' : 'Selecionar'}
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-2"
                onClick={() => void handleSaveAssignments(program.id)}
                disabled={savingAssignmentsForPlanId === program.id}
              >
                <Save className="h-4 w-4" />
                {savingAssignmentsForPlanId === program.id ? 'Salvando...' : 'Salvar vínculos'}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }


  const getItemTypeLabel = (item: DbPlanItem) => {
    if (item.block === 'cardio') return 'Cardio'
    const muscle = String(item.muscle_group ?? '').toLowerCase()
    if (muscle.includes('mobilidade') || muscle.includes('core') || (item.duration_min ?? 0) > 0) return 'Mobilidade'
    return 'Força'
  }

  const getItemTypeClasses = (item: DbPlanItem) => {
    if (item.block === 'cardio') return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
    const muscle = String(item.muscle_group ?? '').toLowerCase()
    if (muscle.includes('mobilidade') || muscle.includes('core') || (item.duration_min ?? 0) > 0) return 'border-violet-400/30 bg-violet-500/10 text-violet-300'
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
  }

  const buildItemMeta = (item: DbPlanItem) => {
    if (item.block === 'cardio') {
      const parts = [] as string[]
      if ((item.duration_min ?? 0) > 0) parts.push(`${item.duration_min} min`)
      if (item.zone_min_bpm || item.zone_max_bpm) parts.push(`Zona ${item.zone_min_bpm ?? '—'} - ${item.zone_max_bpm ?? '—'} bpm`)
      return parts.join(' • ') || 'Cardio do dia'
    }

    const parts = [] as string[]
    if ((item.sets ?? 0) > 0) parts.push(`${item.sets} série${item.sets === 1 ? '' : 's'}`)
    if ((item.duration_min ?? 0) > 0) parts.push(`${item.duration_min}s por série`)
    if (item.reps) parts.push(`${item.reps} reps`)
    if ((item.target_weight ?? 0) > 0) parts.push(`${item.target_weight} kg alvo`)
    return parts.join(' • ') || 'Sem meta definida'
  }

  const handleDeleteProgram = async (program: ProgramUI) => {
    if (!user) return
    if (program.source !== 'owned' || isStudentMode) return

    const confirmed = window.confirm(`Excluir o programa "${program.name}"? Essa ação remove dias, itens e vínculos.`)
    if (!confirmed) return

    try {
      setDeletingProgramId(program.id)

      const { data: dayRows, error: daysLoadError } = await supabase
        .from('plan_days')
        .select('id')
        .eq('plan_id', program.id)

      if (daysLoadError) throw daysLoadError

      const dayIds = ((dayRows ?? []) as Array<{ id: string }>).map((row) => row.id)

      if (dayIds.length > 0) {
        const { error: deleteItemsError } = await supabase
          .from('plan_items')
          .delete()
          .in('plan_day_id', dayIds)
        if (deleteItemsError) throw deleteItemsError
      }

      const { error: deleteDaysError } = await supabase
        .from('plan_days')
        .delete()
        .eq('plan_id', program.id)
      if (deleteDaysError) throw deleteDaysError

      const { error: deleteAssignmentsError } = await supabase
        .from('plan_students')
        .delete()
        .eq('plan_id', program.id)
      if (deleteAssignmentsError) throw deleteAssignmentsError

      const { error: clearActiveError } = await supabase
        .from('user_active_plan')
        .update({ active_program_id: null, updated_at: new Date().toISOString() })
        .eq('active_program_id', program.id)
      if (clearActiveError) throw clearActiveError

      const { error: deletePlanError } = await supabase
        .from('plans')
        .delete()
        .eq('id', program.id)
        .eq('owner_id', user.id)
      if (deletePlanError) throw deletePlanError

      setOwnedPrograms((prev) => prev.filter((item) => item.id !== program.id))
      setPublicPrograms((prev) => prev.filter((item) => item.id !== program.id))
      setAssignedPrograms((prev) => prev.filter((item) => item.id !== program.id))
      setDetails((prev) => {
        const next = { ...prev }
        delete next[program.id]
        return next
      })
      setPlanStudentIds((prev) => {
        const next = { ...prev }
        delete next[program.id]
        return next
      })
      setDraftPlanStudentIds((prev) => {
        const next = { ...prev }
        delete next[program.id]
        return next
      })
      if (expandedProgram === program.id) setExpandedProgram(null)
      if (editingContentProgram?.id === program.id) {
        setIsContentDialogOpen(false)
        setEditingContentProgram(null)
      }
      if (activeProgramId === program.id) {
        setActiveProgramId(null)
        setActiveProgram(null)
        setActiveProgramDays([])
        setActiveProgramItems({})
        setCompletedTodayKeys([])
      }

      toast.success(`Programa "${program.name}" excluído com sucesso.`)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao excluir programa.')
    } finally {
      setDeletingProgramId(null)
    }
  }

  const renderProgramCard = (program: ProgramUI) => {
    const isActive = activeProgramId === program.id
    const isOwned = program.source === 'owned'
    const canDeleteProgram = isOwned && !isStudentMode
    const assignedCount = (planStudentIds[program.id] ?? []).length
    const isAssignedToSelectedStudent = selectedUserId
      ? (planStudentIds[program.id] ?? []).includes(selectedUserId)
      : false

    return (
      <Card key={program.id} className={`overflow-hidden border bg-card/95 shadow-sm transition-all ${isActive ? 'border-primary/50 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]' : 'border-border hover:border-primary/20'}`}>
        <CardContent className="p-0">
          <div
            className={`cursor-pointer p-4 transition-colors ${isActive ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
            onClick={() => void toggleProgram(program.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 flex h-14 w-14 items-center justify-center rounded-2xl border text-3xl ${isActive ? 'border-primary/40 bg-primary/10' : 'border-border bg-background/60'}`}>{program.image}</div>
                <div className="space-y-2">
                  <div>
                    <h3 className="text-lg font-semibold leading-tight text-white">{program.name}</h3>
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{program.description}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs"><Clock className="mr-1 h-3 w-3" />{program.duration}</Badge>
                    <Badge variant="secondary" className="text-xs"><Calendar className="mr-1 h-3 w-3" />{program.sessionsPerWeek}x/semana</Badge>
                    <Badge className={`text-xs ${getDifficultyColor(program.difficulty)}`}>{program.difficulty}</Badge>
                    <Badge variant="outline" className="text-xs"><Trophy className="mr-1 h-3 w-3" />{program.goal}</Badge>

                    {program.source === 'assigned' && (
                      <Badge className="border border-blue-500/30 bg-blue-500/20 text-blue-300 text-xs">
                        <Users className="mr-1 h-3 w-3" />Indicado pelo professor
                      </Badge>
                    )}

                    {program.source === 'public' && (
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="mr-1 h-3 w-3" />Disponível para todos
                      </Badge>
                    )}

                    {program.source === 'owned' && (
                      <Badge className="border border-purple-500/30 bg-purple-500/20 text-purple-300 text-xs">
                        Meu programa
                      </Badge>
                    )}

                    {program.visibility === 'private' && <Badge variant="outline" className="text-xs">Privado</Badge>}
                    {isActive && <Badge className="bg-primary text-primary-foreground text-xs">Ativo</Badge>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {isOwned && program.visibility === 'private' && canManagePrograms && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 rounded-xl border-border/70 bg-background/60"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isStudentMode && selectedUserId) {
                        void assignProgramToSelectedStudent(program.id)
                        return
                      }
                      setAssignPanelPlanId(assignPanelPlanId === program.id ? null : program.id)
                      if (assignPanelPlanId !== program.id) {
                        setDraftPlanStudentIds((prev) => ({
                          ...prev,
                          [program.id]: planStudentIds[program.id] ?? [],
                        }))
                      }
                    }}
                    disabled={
                      savingAssignmentsForPlanId === program.id ||
                      (isStudentMode && isAssignedToSelectedStudent)
                    }
                  >
                    <UserPlus className="h-4 w-4" />
                    {isStudentMode
                      ? isAssignedToSelectedStudent
                        ? 'Já atribuído'
                        : savingAssignmentsForPlanId === program.id
                          ? 'Atribuindo...'
                          : 'Atribuir ao aluno'
                      : `Atribuir (${assignedCount})`}
                  </Button>
                )}

                {isOwned && !isStudentMode && (
                  <>
                    <Button size="sm" variant="outline" className="gap-2 rounded-xl border-border/70 bg-background/60" onClick={(e) => { e.stopPropagation(); void openContentDialog(program) }}>
                      <ListChecks className="h-4 w-4" />Editar conteúdo
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2 rounded-xl border-border/70 bg-background/60" onClick={(e) => { e.stopPropagation(); void openEditDialog(program) }}>
                      <Pencil className="h-4 w-4" />Editar
                    </Button>
                  </>
                )}

                {isActive ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => { e.stopPropagation(); void handleDeactivateProgram() }}
                    disabled={changingProgram === program.id}
                    className="gap-2 rounded-xl"
                  >
                    <Square className="h-4 w-4" />{changingProgram === program.id ? 'Desativando...' : 'Desativar'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); void handleStartProgram(program) }}
                    disabled={changingProgram === program.id || !canChangeActiveProgram}
                    className="gap-2 rounded-xl bg-sky-500 text-white hover:bg-sky-400"
                  >
                    <Play className="h-4 w-4" />{changingProgram === program.id ? 'Iniciando...' : 'Iniciar'}
                  </Button>
                )}

                {canDeleteProgram && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); void handleDeleteProgram(program) }}
                    disabled={deletingProgramId === program.id}
                    className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                  >
                    <Trash2 className="h-4 w-4" />{deletingProgramId === program.id ? 'Excluindo...' : 'Excluir'}
                  </Button>
                )}

                <div className="ml-1 rounded-xl border border-border/70 bg-background/60 p-2">
                  {expandedProgram === program.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </div>
          </div>

          {expandedProgram === program.id && (
            <div className="border-t border-border bg-muted/20 p-4">
              <div className="space-y-4">
                {(details[program.id]?.days ?? []).length === 0 ? (
                  <div className="text-white/70">Carregando detalhes...</div>
                ) : (
                  details[program.id].days.map((day) => (
                    <div key={day.id} className="rounded-lg bg-card p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="outline">{weekdayLabel(day.weekday)}</Badge>
                        <span className="font-medium text-white">{day.day_title ?? `Dia ${day.weekday}`}</span>
                      </div>

                      <div className="space-y-3">
                        {day.items.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Sem exercícios (descanso).</div>
                        ) : (
                          day.items.map((it, idx) => {
                            const name = it.exercise_name || it.custom_exercise_name || 'Exercício'
                            const conflicts = itemConflictsWithInjuries(it, injuryAlerts)
                            const metaLabel = buildItemMeta(it)
                            const typeLabel = getItemTypeLabel(it)

                            return (
                              <div key={it.id ?? idx} className="rounded-2xl border border-border/70 bg-background/40 p-4 shadow-sm">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge className={`border text-[11px] font-medium ${getItemTypeClasses(it)}`}>{typeLabel}</Badge>
                                      <div className="text-base font-semibold leading-tight text-white">{name}</div>
                                      {conflicts.length > 0 && (
                                        <Badge className="border border-amber-500/30 bg-amber-500/20 text-amber-300 text-[10px]">
                                          Cuidado: {conflicts.map((conflict) => conflict.bodyPart).join(', ')}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant="secondary" className="rounded-lg bg-white/10 px-2.5 py-1 text-[12px] font-semibold text-white">
                                        {metaLabel}
                                      </Badge>
                                      {it.block === 'cardio' && (it.zone_min_bpm || it.zone_max_bpm) && (
                                        <Badge variant="outline" className="rounded-lg border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[12px] text-cyan-300">
                                          Ritmo guiado
                                        </Badge>
                                      )}
                                    </div>

                                    {it.notes && (
                                      <div className="rounded-xl border border-border/60 bg-card/60 px-3 py-2">
                                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">Observações</div>
                                        <div className="whitespace-pre-line text-sm leading-6 text-white/85">{it.notes}</div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex shrink-0 items-start justify-end lg:pl-3">
                                    <ExerciseHelpMenu exerciseName={name} />
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {!isStudentMode && renderAssignmentPanel(program)}
        </CardContent>
      </Card>
    )
  }

  const visiblePublicPrograms = publicPrograms.filter((program) => !assignedPrograms.some((assigned) => assigned.id === program.id))

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Programas de Treino</h1>
          <p className="text-muted-foreground">
            {isStudentMode
              ? 'Agora você está vendo os programas públicos e os programas indicados para o aluno selecionado'
              : canManagePrograms
                ? 'Gerencie seus programas, atribua alunos e consulte os programas disponíveis'
                : 'Escolha um programa e siga o plano'}
          </p>

          {isStudentMode && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              <User className="h-4 w-4" />
              <span>Modo Aluno ativo para: <strong>{targetUserLabel}</strong></span>
            </div>
          )}
        </div>

        {canManagePrograms && !isStudentMode && (
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />Novo programa
          </Button>
        )}
      </div>

      {isStudentMode && !canChangeActiveProgram && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-300">Consulta do aluno</Badge>
              <p className="text-sm text-amber-100">
                Nesta fase, a tela já mostra os <strong>programas públicos</strong> e os <strong>programas indicados pelo professor</strong> para o aluno selecionado.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

              {!injuryLoading && injuryAlerts.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-red-500/20 text-red-300">
                  Atenção para lesões
                </Badge>

                {injuryAlerts.map((injury) => (
                  <Badge
                    key={injury.id}
                    variant="outline"
                    className={injury.status === 'active' ? 'border-red-500/30 text-red-300' : 'border-orange-500/30 text-orange-300'}
                  >
                    {injury.bodyPart} • {injury.status === 'active' ? 'Ativa' : 'Crônica'}
                  </Badge>
                ))}
              </div>

              <p className="text-sm text-red-100">
                Revise os exercícios do programa antes de prescrever ou executar. Detectamos áreas com atenção especial no perfil atual.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeProgram && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/20 to-purple-600/20">
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl">{activeProgram.image}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-white">{activeProgram.name}</h3>
                    <Badge className="bg-primary text-primary-foreground"><Play className="mr-1 h-3 w-3" />Em Andamento</Badge>
                    {activeProgram.source === 'assigned' && (
                      <Badge className="border border-blue-500/30 bg-blue-500/20 text-blue-300">Indicado pelo professor</Badge>
                    )}
                    {progress.isComplete && (
                      <Badge className="border border-green-500/30 bg-green-500/20 text-green-300">Treino concluído</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">Semana 1 • {activeProgram.duration}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
  variant="outline"
  size="sm"
  onClick={() => openWorkoutPageFromProgram(activeProgram.id)}
>
  Continuar
</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeactivateProgram}
                  disabled={changingProgram === activeProgramId || !canChangeActiveProgram}
                  className="gap-2"
                >
                  <Square className="h-4 w-4" />{changingProgram === activeProgramId ? 'Desativando...' : 'Desativar'}
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="text-white">{progress.completed} / {progress.total} itens</span>
              </div>
              <Progress value={progress.percent} className="h-2" />
            </div>

                                  {injuryAlerts.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-red-500/20 text-red-300">Lesões relevantes detectadas</Badge>
                  {injuryAlerts.map((injury) => (
                    <Badge
                      key={injury.id}
                      variant="outline"
                      className={injury.status === 'active' ? 'border-red-500/30 text-red-300' : 'border-orange-500/30 text-orange-300'}
                    >
                      {injury.bodyPart}
                    </Badge>
                  ))}
                </div>

                <p className="mt-2 text-sm text-red-100">
                  Antes de seguir o programa, confirme se os exercícios do dia não agravam essas regiões.
                </p>
              </div>
            )}

            {todayProgramDay && (
              <div className="space-y-3 rounded-xl border border-white/10 bg-background/30 p-4">
                <div>
                  <div className="text-sm text-muted-foreground">Hoje • {todayLabel}</div>
                  <div className="text-base font-semibold text-white">
                    {todayProgramDay.day_title || 'Treino do dia'}
                  </div>
                </div>

                                {todayProgramExercises.length > 0 ? (
                  <>
                    {hasTodayInjuryConflicts && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                        Existem exercícios hoje que podem exigir atenção por causa das lesões registradas.
                      </div>
                    )}

                    <div className="space-y-2">
                      {todayProgramExercises.map((item) => {
                        const exerciseName = item.exercise_name || item.custom_exercise_name || 'Exercício'
                        const meta = item.block === 'cardio'
                          ? [`${item.duration_min ?? 0} min`, item.zone_min_bpm || item.zone_max_bpm ? `${item.zone_min_bpm ?? '-'}-${item.zone_max_bpm ?? '-'} bpm` : null].filter(Boolean).join(' • ')
                          : [`${item.sets ?? 0} séries`, (item.duration_min ?? 0) > 0 ? `${item.duration_min}s por série` : null, item.reps ? `${item.reps} reps` : null].filter(Boolean).join(' • ')

                        const exerciseKeys = getProgramItemProgressKeys(item)
                        const isCompleted = exerciseKeys.some((key) => completedTodayKeys.includes(key))
                        const conflicts = itemConflictsWithInjuries(item, injuryAlerts)

                        return (
                          <div key={item.id} className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-medium text-white">{exerciseName}</div>

                                  {isCompleted && (
                                    <Badge className="border border-green-500/30 bg-green-500/20 text-green-300 text-[10px]">
                                      Concluído
                                    </Badge>
                                  )}

                                  {conflicts.length > 0 && (
                                    <Badge className="border border-amber-500/30 bg-amber-500/20 text-amber-300 text-[10px]">
                                      Cuidado: {conflicts.map((conflict) => conflict.bodyPart).join(', ')}
                                    </Badge>
                                  )}
                                </div>

                                <div className="text-xs text-muted-foreground">{meta || 'Sem configuração definida'}</div>

                                {conflicts.length > 0 && (
                                  <div className="mt-1 text-xs text-amber-200">
                                    Revise esse exercício por causa da região afetada.
                                  </div>
                                )}
                              </div>

                              <ExerciseHelpMenu exerciseName={exerciseName} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Nenhum exercício configurado para hoje.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canManagePrograms && !isStudentMode && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <BookOpen className="h-5 w-5 text-purple-400" />Meus Programas
          </h2>

          {loading ? (
            <Card className="bg-card border-border"><CardContent className="p-4 text-white/70">Carregando seus programas...</CardContent></Card>
          ) : ownedPrograms.length === 0 ? (
            <Card className="bg-card border-border"><CardContent className="p-4 text-white/70">Você ainda não criou nenhum programa.</CardContent></Card>
          ) : (
            ownedPrograms.map((program) => renderProgramCard(program))
          )}
        </div>
      )}

      {assignedPrograms.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Users className="h-5 w-5 text-blue-400" />Programas Indicados pelo Professor
          </h2>
          {assignedPrograms.map((program) => renderProgramCard(program))}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <BookOpen className="h-5 w-5 text-primary" />Programas Disponíveis
        </h2>

        {loading ? (
          <Card className="bg-card border-border"><CardContent className="p-4 text-white/70">Carregando programas...</CardContent></Card>
        ) : visiblePublicPrograms.length === 0 ? (
          <Card className="bg-card border-border"><CardContent className="p-4 text-white/70">Nenhum programa público encontrado.</CardContent></Card>
        ) : (
          visiblePublicPrograms.map((program) => renderProgramCard(program))
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo programa</DialogTitle>
            <DialogDescription>Crie um programa base para usar com seus alunos ou para seu catálogo privado.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="program-title">Nome do programa</Label>
              <Input id="program-title" value={programForm.title} onChange={(e) => setProgramForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Ex: Programa AB Hipertrofia" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="program-description">Descrição</Label>
              <Textarea id="program-description" value={programForm.description} onChange={(e) => setProgramForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descreva o objetivo do programa..." />
            </div>

            <div className="space-y-2">
              <Label>Visibilidade</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={programForm.visibility === 'private' ? 'default' : 'outline'} onClick={() => setProgramForm((prev) => ({ ...prev, visibility: 'private' }))}>Privado</Button>
                {role === 'admin' && (
                  <Button type="button" variant={programForm.visibility === 'public' ? 'default' : 'outline'} onClick={() => setProgramForm((prev) => ({ ...prev, visibility: 'public' }))}>Público</Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias do programa</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {WEEKDAYS.map((day) => {
                  const checked = programForm.weekdays.includes(day.value)
                  return (
                    <label key={day.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                      <Checkbox checked={checked} onCheckedChange={() => toggleWeekdayInForm(day.value)} />
                      <span className="text-sm text-white">{day.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={formSaving}>Cancelar</Button>
            <Button onClick={() => void handleCreateProgram()} disabled={formSaving}>{formSaving ? 'Criando...' : 'Criar programa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar programa</DialogTitle>
            <DialogDescription>Atualize as informações principais do programa selecionado.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-program-title">Nome do programa</Label>
              <Input id="edit-program-title" value={programForm.title} onChange={(e) => setProgramForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-program-description">Descrição</Label>
              <Textarea id="edit-program-description" value={programForm.description} onChange={(e) => setProgramForm((prev) => ({ ...prev, description: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Visibilidade</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={programForm.visibility === 'private' ? 'default' : 'outline'} onClick={() => setProgramForm((prev) => ({ ...prev, visibility: 'private' }))}>Privado</Button>
                {role === 'admin' && (
                  <Button type="button" variant={programForm.visibility === 'public' ? 'default' : 'outline'} onClick={() => setProgramForm((prev) => ({ ...prev, visibility: 'public' }))}>Público</Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias do programa</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {WEEKDAYS.map((day) => {
                  const checked = programForm.weekdays.includes(day.value)
                  return (
                    <label key={day.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                      <Checkbox checked={checked} onCheckedChange={() => toggleWeekdayInForm(day.value)} />
                      <span className="text-sm text-white">{day.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={formSaving}>Cancelar</Button>
            <Button onClick={() => void handleEditProgram()} disabled={formSaving}>{formSaving ? 'Salvando...' : 'Salvar alterações'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Editor de conteúdo{editingContentProgram ? ` • ${editingContentProgram.name}` : ''}</DialogTitle>
            <DialogDescription>
              Agora você pode usar exercícios do banco ou cadastrar item personalizado por dia.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {contentLoading ? (
              <div className="py-6 text-sm text-muted-foreground">Carregando conteúdo...</div>
            ) : editorDays.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                Este programa ainda não possui dias ou itens configurados.
              </div>
            ) : (
              <div className="space-y-4">
                {editorDays.map((day) => (
                  <div key={day.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{weekdayLabel(day.weekday)}</Badge>
                        <h3 className="font-medium text-white">{day.day_title ?? `Dia ${day.weekday}`}</h3>
                      </div>

                      <Button size="sm" className="gap-2" onClick={() => openNewItemFormForDay(day.id)}>
                        <Plus className="h-4 w-4" />Adicionar item
                      </Button>
                    </div>

                    {openNewItemDayId === day.id && (
                      <div className="mb-4 space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant={newItemForm.block === 'strength' ? 'default' : 'outline'} onClick={() => setNewItemForm((prev) => ({ ...prev, block: 'strength' }))}>Força</Button>
                          <Button type="button" size="sm" variant={newItemForm.block === 'cardio' ? 'default' : 'outline'} onClick={() => setNewItemForm((prev) => ({ ...prev, block: 'cardio' }))}>Cardio</Button>
                        </div>

                        <div className="space-y-2">
                          <Label>Origem do exercício</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant={newItemForm.exerciseSourceMode === 'existing' ? 'default' : 'outline'} onClick={() => setNewItemForm((prev) => ({ ...prev, exerciseSourceMode: 'existing', custom_exercise_name: '' }))}>Usar banco de exercícios</Button>
                            <Button type="button" size="sm" variant={newItemForm.exerciseSourceMode === 'custom' ? 'default' : 'outline'} onClick={() => setNewItemForm((prev) => ({ ...prev, exerciseSourceMode: 'custom', selectedExerciseId: '' }))}>Exercício personalizado</Button>
                          </div>
                        </div>

                        {newItemForm.exerciseSourceMode === 'existing' ? (
                          <div className="space-y-2">
                            <Label>Exercício</Label>
                            <ExercisePicker
                              options={exercisePickerOptions}
                              value={newItemForm.selectedExerciseId || null}
                              onValueChange={(exerciseId) =>
                                setNewItemForm((prev) => ({ ...prev, selectedExerciseId: exerciseId }))
                              }
                              placeholder="Buscar por nome, categoria, grupo, equipamento..."
                            />

                            {selectedExercise ? (
                              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                                <div><strong className="text-white">{selectedExercise.name}</strong></div>
                                <div>
                                  {selectedExercise.category ?? 'Sem categoria'}
                                  {selectedExercise.muscle_group ? ` • ${selectedExercise.muscle_group}` : ''}
                                  {selectedExercise.equipment ? ` • ${selectedExercise.equipment}` : ''}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>Nome do exercício</Label>
                            <Input
                              value={newItemForm.custom_exercise_name}
                              onChange={(e) => setNewItemForm((prev) => ({ ...prev, custom_exercise_name: e.target.value }))}
                              placeholder="Ex: Elevação pélvica com pausa"
                            />
                          </div>
                        )}

                        {newItemForm.block === 'strength' ? (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                            <div className="space-y-2">
                              <Label>Séries</Label>
                              <Input type="number" value={newItemForm.sets} onChange={(e) => setNewItemForm((prev) => ({ ...prev, sets: e.target.value }))} placeholder="4" />
                            </div>
                            <div className="space-y-2">
                              <Label>Reps</Label>
                              <Input value={newItemForm.reps} onChange={(e) => setNewItemForm((prev) => ({ ...prev, reps: e.target.value }))} placeholder={isMobilityLikeExercise(selectedExercise) ? 'Opcional' : '8-12'} />
                            </div>
                            <div className="space-y-2">
                              <Label>Tempo por série (seg)</Label>
                              <Input type="number" value={newItemForm.duration_min} onChange={(e) => setNewItemForm((prev) => ({ ...prev, duration_min: e.target.value }))} placeholder={isMobilityLikeExercise(selectedExercise) ? '30' : 'Opcional'} />
                            </div>
                            <div className="space-y-2">
                              <Label>Carga alvo (kg)</Label>
                              <Input type="number" value={newItemForm.target_weight} onChange={(e) => setNewItemForm((prev) => ({ ...prev, target_weight: e.target.value }))} placeholder="20" />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Duração (min)</Label>
                              <Input type="number" value={newItemForm.duration_min} onChange={(e) => setNewItemForm((prev) => ({ ...prev, duration_min: e.target.value }))} placeholder="20" />
                            </div>
                            <div className="space-y-2">
                              <Label>BPM mínimo</Label>
                              <Input type="number" value={newItemForm.zone_min_bpm} onChange={(e) => setNewItemForm((prev) => ({ ...prev, zone_min_bpm: e.target.value }))} placeholder="120" />
                            </div>
                            <div className="space-y-2">
                              <Label>BPM máximo</Label>
                              <Input type="number" value={newItemForm.zone_max_bpm} onChange={(e) => setNewItemForm((prev) => ({ ...prev, zone_max_bpm: e.target.value }))} placeholder="145" />
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Observações</Label>
                          <Textarea value={newItemForm.notes} onChange={(e) => setNewItemForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Ex: foco na execução, descanso de 60s..." />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => { setOpenNewItemDayId(null); setNewItemForm(emptyNewItemForm()) }}>
                            Cancelar
                          </Button>
                          <Button onClick={() => void handleSaveNewItem(day.id)} disabled={savingNewItemDayId === day.id}>
                            {savingNewItemDayId === day.id ? 'Salvando...' : 'Salvar item'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {day.items.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhum item cadastrado neste dia.</div>
                    ) : (
                      <div className="space-y-2">
                        {day.items.map((item) => {
                          const name = item.exercise_name || item.custom_exercise_name || 'Exercício'
                          const isCardio = item.block === 'cardio'
                          const isTimeBasedItem = !isCardio && (item.duration_min ?? 0) > 0
                          return (
                            <div key={item.id} className="rounded-md border border-border bg-muted/20 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={isCardio ? 'secondary' : 'outline'}>
                                      {isCardio ? 'Cardio' : isTimeBasedItem ? 'Mobilidade' : 'Força'}
                                    </Badge>
                                    <span className="font-medium text-white">{name}</span>
                                    {item.exercise_id ? (
                                      <Badge variant="outline" className="text-xs">Banco de exercícios</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">Customizado</Badge>
                                    )}
                                    <ExerciseHelpMenu exerciseName={name} />
                                  </div>

                                  <div className="mt-2 text-sm text-muted-foreground">
                                    {isCardio ? (
                                      <>
                                        Duração: <strong>{item.duration_min ?? 0} min</strong>
                                        {item.zone_min_bpm || item.zone_max_bpm ? (
                                          <> • Zona: <strong>{item.zone_min_bpm ?? '-'} - {item.zone_max_bpm ?? '-'} bpm</strong></>
                                        ) : null}
                                      </>
                                    ) : (
                                      <>
                                        Séries: <strong>{item.sets ?? 0}</strong>
                                        {isTimeBasedItem ? (
                                          <> • Tempo: <strong>{item.duration_min ?? 0}s</strong></>
                                        ) : (
                                          <> • Reps: <strong>{item.reps ?? '-'}</strong></>
                                        )}
                                        {!isTimeBasedItem && item.target_weight ? (
                                          <> • Carga alvo: <strong>{item.target_weight} kg</strong></>
                                        ) : null}
                                        {isTimeBasedItem && item.reps ? (
                                          <> • Reps: <strong>{item.reps}</strong></>
                                        ) : null}
                                      </>
                                    )}
                                  </div>

                                  {item.notes ? (
                                    <div className="mt-2 text-sm text-muted-foreground">
                                      Observações: <span className="text-white/90">{item.notes}</span>
                                    </div>
                                  ) : null}
                                </div>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => void handleDeleteItem(item.id)}
                                  disabled={deletingItemId === item.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {deletingItemId === item.id ? 'Removendo...' : 'Remover'}
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContentDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default WorkoutPrograms

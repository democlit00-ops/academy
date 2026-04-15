import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Pencil,
  Play,
  Square,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { MUSCLE_GROUPS, WEEK_DAYS } from '@/data/exercises'
import type { MuscleGroup, WeekDay, SplitDay, SplitTemplate } from '@/types'
import { getProfileDisplayName } from '@/lib/profile'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Role = 'admin' | 'coach' | 'user'
type SplitSource = 'public' | 'assigned' | 'owned'

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
  muscle_groups: string[] | null
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

type SplitUI = {
  id: string
  name: string
  description: string
  visibility: 'public' | 'private'
  source: SplitSource
  owner_id?: string | null
  daysPerWeek: number
}

type SplitFormState = {
  title: string
  description: string
  visibility: 'public' | 'private'
  template: SplitTemplate
  days: SplitDay[]
}

interface WorkoutSplitProps {
  selectedUserId?: string | null
  selectedUserLabel?: string | null
}

const weekdayNumberToLabel = (n: number): WeekDay =>
  ({ 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 7: 'Domingo' } as Record<number, WeekDay>)[n] ?? 'Segunda'

const weekdayLabelToNumber = (day: WeekDay) =>
  ({ Segunda: 1, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5, Sábado: 6, Domingo: 7 } as Record<WeekDay, number>)[day]

const SPLIT_TEMPLATES: Record<SplitTemplate, { name: string; description: string; days: Partial<SplitDay>[] }> = {
  ABC: {
    name: 'ABC - Tradicional',
    description: 'Peito/Tríceps, Costas/Bíceps e Pernas',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito', 'Tríceps'], focus: 'Peito e Tríceps', isRestDay: false },
      { day: 'Terça', muscleGroups: ['Costas', 'Bíceps'], focus: 'Costas e Bíceps', isRestDay: false },
      { day: 'Quarta', muscleGroups: ['Pernas', 'Posterior'], focus: 'Pernas', isRestDay: false },
      { day: 'Quinta', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Sexta', muscleGroups: ['Ombros', 'Tríceps'], focus: 'Ombros e Tríceps', isRestDay: false },
      { day: 'Sábado', muscleGroups: ['Costas', 'Bíceps'], focus: 'Costas e Bíceps', isRestDay: false },
      { day: 'Domingo', muscleGroups: [], focus: 'Descanso', isRestDay: true },
    ],
  },
  AB: {
    name: 'AB - Superior / Inferior',
    description: 'Alternância entre parte superior e inferior',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps'], focus: 'Superior', isRestDay: false },
      { day: 'Terça', muscleGroups: ['Pernas', 'Posterior', 'Core'], focus: 'Inferior', isRestDay: false },
      { day: 'Quarta', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Quinta', muscleGroups: ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps'], focus: 'Superior', isRestDay: false },
      { day: 'Sexta', muscleGroups: ['Pernas', 'Posterior', 'Core'], focus: 'Inferior', isRestDay: false },
      { day: 'Sábado', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Domingo', muscleGroups: [], focus: 'Descanso', isRestDay: true },
    ],
  },
  PPL: {
    name: 'Push / Pull / Legs',
    description: 'Empurrar, puxar e pernas',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito', 'Ombros', 'Tríceps'], focus: 'Push', isRestDay: false },
      { day: 'Terça', muscleGroups: ['Costas', 'Bíceps'], focus: 'Pull', isRestDay: false },
      { day: 'Quarta', muscleGroups: ['Pernas', 'Posterior'], focus: 'Legs', isRestDay: false },
      { day: 'Quinta', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Sexta', muscleGroups: ['Peito', 'Ombros', 'Tríceps'], focus: 'Push', isRestDay: false },
      { day: 'Sábado', muscleGroups: ['Costas', 'Bíceps'], focus: 'Pull', isRestDay: false },
      { day: 'Domingo', muscleGroups: ['Pernas', 'Posterior'], focus: 'Legs', isRestDay: false },
    ],
  },
  FULL_BODY: {
    name: 'Full Body 3x',
    description: 'Corpo inteiro 3 vezes na semana',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito', 'Costas', 'Pernas', 'Posterior', 'Ombros'], focus: 'Full Body', isRestDay: false },
      { day: 'Terça', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Quarta', muscleGroups: ['Peito', 'Costas', 'Pernas', 'Posterior', 'Ombros'], focus: 'Full Body', isRestDay: false },
      { day: 'Quinta', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Sexta', muscleGroups: ['Peito', 'Costas', 'Pernas', 'Posterior', 'Ombros'], focus: 'Full Body', isRestDay: false },
      { day: 'Sábado', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Domingo', muscleGroups: [], focus: 'Descanso', isRestDay: true },
    ],
  },
  UPPER_LOWER: {
    name: 'Upper / Lower 4x',
    description: 'Upper e lower alternado',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps'], focus: 'Upper', isRestDay: false },
      { day: 'Terça', muscleGroups: ['Pernas', 'Posterior'], focus: 'Lower', isRestDay: false },
      { day: 'Quarta', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Quinta', muscleGroups: ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps'], focus: 'Upper', isRestDay: false },
      { day: 'Sexta', muscleGroups: ['Pernas', 'Posterior'], focus: 'Lower', isRestDay: false },
      { day: 'Sábado', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Domingo', muscleGroups: [], focus: 'Descanso', isRestDay: true },
    ],
  },
  ABCDE: {
    name: 'ABCDE',
    description: 'Um grupamento por dia',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito'], focus: 'Peito', isRestDay: false },
      { day: 'Terça', muscleGroups: ['Costas'], focus: 'Costas', isRestDay: false },
      { day: 'Quarta', muscleGroups: ['Ombros'], focus: 'Ombros', isRestDay: false },
      { day: 'Quinta', muscleGroups: ['Pernas'], focus: 'Pernas', isRestDay: false },
      { day: 'Sexta', muscleGroups: ['Bíceps', 'Tríceps'], focus: 'Braços', isRestDay: false },
      { day: 'Sábado', muscleGroups: ['Core', 'Pernas'], focus: 'Core e Pernas', isRestDay: false },
      { day: 'Domingo', muscleGroups: [], focus: 'Descanso', isRestDay: true },
    ],
  },
  CUSTOM: {
    name: 'Split Personalizado',
    description: 'Montado manualmente',
    days: WEEK_DAYS.map((day) => ({ day, muscleGroups: [], focus: '', isRestDay: false })),
  },
}

const normalizeMuscleGroupAlias = (group: string): MuscleGroup | null => {
  const raw = String(group ?? '').trim().toLowerCase()

  const aliasMap: Record<string, MuscleGroup> = {
    peito: 'Peito',
    costas: 'Costas',
    ombro: 'Ombros',
    ombros: 'Ombros',
    bíceps: 'Bíceps',
    biceps: 'Bíceps',
    tríceps: 'Tríceps',
    triceps: 'Tríceps',
    pernas: 'Pernas',
    quadriceps: 'Pernas',
    quadríceps: 'Pernas',
    panturrilha: 'Pernas',
    panturrilhas: 'Pernas',
    glúteos: 'Glúteos',
    gluteos: 'Glúteos',
    posterior: 'Posterior',
    posteriores: 'Posterior',
    core: 'Core',
    cardio: 'Cardio',
    mobilidade: 'Mobilidade',
    cervical: 'Mobilidade',
    adutores: 'Pernas',
  }

  return aliasMap[raw] ?? null
}

const normalizeMuscleGroups = (groups: string[] | null | undefined): MuscleGroup[] => {
  const normalized = (groups ?? [])
    .map((group) => normalizeMuscleGroupAlias(group))
    .filter((group): group is MuscleGroup => !!group)

  return Array.from(new Set(normalized))
}

const buildDaysFromTemplate = (template: SplitTemplate): SplitDay[] => {
  const base = SPLIT_TEMPLATES[template]
  return base.days.map((day) => ({
    day: day.day as WeekDay,
    muscleGroups: normalizeMuscleGroups(day.muscleGroups as string[]),
    focus: day.focus ?? '',
    isRestDay: !!day.isRestDay,
  }))
}

const emptySplitForm = (): SplitFormState => ({
  title: SPLIT_TEMPLATES.ABC.name,
  description: SPLIT_TEMPLATES.ABC.description,
  visibility: 'private',
  template: 'ABC',
  days: buildDaysFromTemplate('ABC'),
})

const mapPlanToSplitUI = (plan: DbPlan, source: SplitSource, totalDays: number): SplitUI => ({
  id: plan.id,
  name: plan.title,
  description: plan.description ?? 'Split de treino',
  visibility: plan.visibility,
  source,
  owner_id: plan.owner_id ?? null,
  daysPerWeek: totalDays,
})

function SplitCard({
  split,
  days,
  isExpanded,
  onToggle,
  isActive,
  canSetActive,
  onSetActive,
  onDeactivate,
  onEdit,
  onDelete,
  canManage,
  onAssign,
  assignLabel,
  assignedCount,
  activating,
}: {
  split: SplitUI
  days?: DbPlanDay[]
  isExpanded: boolean
  onToggle: () => void
  isActive: boolean
  canSetActive: boolean
  onSetActive: () => void
  onDeactivate?: () => void
  onEdit?: () => void
  onDelete?: () => void
  canManage?: boolean
  onAssign?: () => void
  assignLabel?: string
  assignedCount?: number
  activating?: boolean
}) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{split.name}</h3>
              {isActive && <Badge className="border-green-500/30 bg-green-500/20 text-green-400">Ativo</Badge>}
              <Badge variant="secondary">{split.daysPerWeek} dias</Badge>
              <Badge variant="outline">{split.visibility === 'public' ? 'Público' : 'Privado'}</Badge>
              {split.source === 'assigned' && <Badge className="border-blue-500/30 bg-blue-500/20 text-blue-400">Atribuído</Badge>}
              {split.source === 'owned' && <Badge className="border-purple-500/30 bg-purple-500/20 text-purple-400">Meu</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{split.description}</p>
            {typeof assignedCount === 'number' && assignedCount > 0 && (
              <div className="text-xs text-muted-foreground">{assignedCount} aluno(s) vinculados</div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onToggle} className="gap-2">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {isExpanded ? 'Ocultar' : 'Detalhes'}
            </Button>

            {canSetActive && (
              isActive && onDeactivate ? (
                <Button size="sm" variant="secondary" onClick={onDeactivate} disabled={activating} className="gap-2">
                  <Square className="h-4 w-4" />
                  {activating ? 'Salvando...' : 'Desativar'}
                </Button>
              ) : (
                <Button size="sm" onClick={onSetActive} disabled={activating} className="gap-2">
                  <Play className="h-4 w-4" />
                  {activating ? 'Salvando...' : 'Definir ativo'}
                </Button>
              )
            )}

            {canManage && onAssign && (
              <Button variant="outline" size="sm" onClick={onAssign} className="gap-2">
                <UserPlus className="h-4 w-4" />
                {assignLabel || 'Atribuir'}
              </Button>
            )}

            {canManage && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}

            {canManage && onDelete && (
              <Button variant="outline" size="sm" onClick={onDelete} className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(days ?? []).map((day) => {
              const groups = normalizeMuscleGroups(day.muscle_groups)
              const isRest = groups.length === 0 && (day.day_title ?? '').toLowerCase().includes('descanso')

              return (
                <div key={day.id} className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
                  <div>
                    <div className="text-sm font-medium text-white">{weekdayNumberToLabel(day.weekday)}</div>
                    <div className="text-xs text-muted-foreground">{day.day_title || (isRest ? 'Descanso' : 'Treino')}</div>
                  </div>

                  {isRest ? (
                    <Badge variant="secondary">Descanso</Badge>
                  ) : groups.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {groups.map((group) => (
                        <Badge key={group} variant="secondary">{group}</Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Sem grupos definidos.</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function WorkoutSplitPlanner({ selectedUserId, selectedUserLabel }: WorkoutSplitProps) {
  const { user, profile } = useAuth()
  const role = (profile?.role ?? 'user') as Role
  const canManageSplits = role === 'coach' || role === 'admin'
  const isStudentMode = !!selectedUserId
  const targetUserId = selectedUserId || user?.id || null
  const targetUserLabel = selectedUserLabel || 'Aluno selecionado'

  const [loading, setLoading] = useState(true)
  const [publicSplits, setPublicSplits] = useState<SplitUI[]>([])
  const [assignedSplits, setAssignedSplits] = useState<SplitUI[]>([])
  const [ownedSplits, setOwnedSplits] = useState<SplitUI[]>([])
  const [activeSplitId, setActiveSplitId] = useState<string | null>(null)
  const [expandedSplit, setExpandedSplit] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, DbPlanDay[]>>({})
  const [changingActiveSplitId, setChangingActiveSplitId] = useState<string | null>(null)

  const [students, setStudents] = useState<ProfileStudentRow[]>([])
  const [planStudentIds, setPlanStudentIds] = useState<Record<string, string[]>>({})
  const [draftPlanStudentIds, setDraftPlanStudentIds] = useState<Record<string, string[]>>({})
  const [assignPanelPlanId, setAssignPanelPlanId] = useState<string | null>(null)
  const [savingAssignmentsForPlanId, setSavingAssignmentsForPlanId] = useState<string | null>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSplitId, setEditingSplitId] = useState<string | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [form, setForm] = useState<SplitFormState>(emptySplitForm())

  const canChangeActiveSplit = useMemo(() => {
    if (!user || !targetUserId) return false
    if (user.id === targetUserId) return true
    return role === 'coach' || role === 'admin'
  }, [user, targetUserId, role])

  const assignedSplitIds = useMemo(() => new Set(assignedSplits.map((split) => split.id)), [assignedSplits])

  const allVisibleSplits = useMemo(
    () =>
      [...assignedSplits, ...publicSplits, ...ownedSplits].filter(
        (split, index, arr) => arr.findIndex((x) => x.id === split.id) === index
      ),
    [assignedSplits, publicSplits, ownedSplits]
  )

  const activeSplit = useMemo(
    () => (activeSplitId ? allVisibleSplits.find((split) => split.id === activeSplitId) ?? null : null),
    [allVisibleSplits, activeSplitId]
  )

  const loadDaysCountByPlan = useCallback(async (planIds: string[]) => {
    if (planIds.length === 0) return {}

    const { data, error } = await supabase
      .from('plan_days')
      .select('plan_id, day_title, muscle_groups')
      .in('plan_id', planIds)

    if (error) throw error

    const map: Record<string, number> = {}

    for (const row of (data ?? []) as Array<{ plan_id: string; day_title: string | null; muscle_groups: string[] | null }>) {
      const groups = normalizeMuscleGroups(row.muscle_groups)
      const isRestDay = groups.length === 0 && (row.day_title ?? '').toLowerCase().includes('descanso')

      if (!isRestDay) {
        map[row.plan_id] = (map[row.plan_id] ?? 0) + 1
      }
    }

    return map
  }, [])

  const loadSplitDetails = useCallback(
    async (splitId: string) => {
      if (details[splitId]) return

      const { data, error } = await supabase
        .from('plan_days')
        .select('id,plan_id,weekday,day_title,muscle_groups')
        .eq('plan_id', splitId)
        .order('weekday', { ascending: true })

      if (error) throw error

      setDetails((prev) => ({
        ...prev,
        [splitId]: (data ?? []) as DbPlanDay[],
      }))
    },
    [details]
  )

  const reloadSplits = useCallback(async () => {
    if (!user || !targetUserId) return

    const { data: publicPlans, error: publicErr } = await supabase
      .from('plans')
      .select('id,title,description,type,visibility,is_active,created_at,updated_at,owner_id')
      .eq('type', 'split')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (publicErr) throw publicErr

    const { data: assignmentRows, error: assignmentErr } = await supabase
      .from('plan_students')
      .select('plan_id, student_id, assigned_by, created_at')
      .eq('student_id', targetUserId)
    if (assignmentErr) throw assignmentErr

    const linkedSplitIds = Array.from(
      new Set(((assignmentRows ?? []) as PlanStudentRow[]).map((row) => row.plan_id).filter(Boolean))
    )

    let assignedPlans: DbPlan[] = []
    if (linkedSplitIds.length > 0) {
      const { data, error } = await supabase
        .from('plans')
        .select('id,title,description,type,visibility,is_active,created_at,updated_at,owner_id')
        .eq('type', 'split')
        .eq('is_active', true)
        .in('id', linkedSplitIds)
        .order('created_at', { ascending: false })
      if (error) throw error
      assignedPlans = (data ?? []) as DbPlan[]
    }

    let ownedPlans: DbPlan[] = []
    if (canManageSplits && user?.id) {
      const { data, error } = await supabase
        .from('plans')
        .select('id,title,description,type,visibility,is_active,created_at,updated_at,owner_id')
        .eq('type', 'split')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      ownedPlans = (data ?? []) as DbPlan[]
    }

    const unionIds = Array.from(
      new Set([
        ...((publicPlans ?? []) as DbPlan[]).map((p) => p.id),
        ...assignedPlans.map((p) => p.id),
        ...ownedPlans.map((p) => p.id),
      ])
    )

    const countMap = await loadDaysCountByPlan(unionIds)

    setPublicSplits(((publicPlans ?? []) as DbPlan[]).map((plan) => mapPlanToSplitUI(plan, 'public', countMap[plan.id] ?? 0)))
    setAssignedSplits(assignedPlans.map((plan) => mapPlanToSplitUI(plan, 'assigned', countMap[plan.id] ?? 0)))
    setOwnedSplits(ownedPlans.map((plan) => mapPlanToSplitUI(plan, 'owned', countMap[plan.id] ?? 0)))

    if (canManageSplits && ownedPlans.length > 0) {
      const ownedIds = ownedPlans.map((p) => p.id)
      const { data, error } = await supabase
        .from('plan_students')
        .select('plan_id, student_id, assigned_by, created_at')
        .in('plan_id', ownedIds)
      if (error) throw error

      const map: Record<string, string[]> = {}
      for (const row of (data ?? []) as PlanStudentRow[]) {
        map[row.plan_id] = map[row.plan_id] ?? []
        if (!map[row.plan_id].includes(row.student_id)) map[row.plan_id].push(row.student_id)
      }
      setPlanStudentIds(map)
      setDraftPlanStudentIds(map)
    } else {
      setPlanStudentIds({})
      setDraftPlanStudentIds({})
    }

    if (canManageSplits && user?.id) {
      if (role === 'admin') {
        const { data, error } = await supabase
          .from('profiles')
          .select('id,full_name,email,role')
          .eq('role', 'user')
          .order('created_at', { ascending: false })
        if (error) throw error
        setStudents((data ?? []) as ProfileStudentRow[])
      } else {
        const { data: coachLinks, error: coachErr } = await supabase
          .from('coach_students')
          .select('student_id')
          .eq('coach_id', user.id)
        if (coachErr) throw coachErr

        const studentIds = Array.from(new Set(((coachLinks ?? []) as CoachStudentLink[]).map((row) => row.student_id).filter(Boolean)))
        if (studentIds.length > 0) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id,full_name,email,role')
            .in('id', studentIds)
          if (error) throw error
          setStudents((data ?? []) as ProfileStudentRow[])
        } else {
          setStudents([])
        }
      }
    } else {
      setStudents([])
    }

    const { data: activeRow, error: activeErr } = await supabase
      .from('user_active_plan')
      .select('active_split_id')
      .eq('user_id', targetUserId)
      .maybeSingle()
    if (activeErr) throw activeErr

    const nextActiveSplitId = activeRow?.active_split_id ?? null
    setActiveSplitId(nextActiveSplitId)

    if (nextActiveSplitId) {
      const { data: activeDays, error: activeDaysErr } = await supabase
        .from('plan_days')
        .select('id,plan_id,weekday,day_title,muscle_groups')
        .eq('plan_id', nextActiveSplitId)
        .order('weekday', { ascending: true })

      if (activeDaysErr) throw activeDaysErr

      setDetails((prev) => ({
        ...prev,
        [nextActiveSplitId]: (activeDays ?? []) as DbPlanDay[],
      }))
    }
  }, [user, targetUserId, canManageSplits, role, loadDaysCountByPlan])

  useEffect(() => {
    if (!user || !targetUserId) return

    const run = async () => {
      setLoading(true)
      try {
        await reloadSplits()
      } catch (e: any) {
        toast.error(e?.message ?? 'Erro ao carregar splits.')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [user, targetUserId, reloadSplits])

  const openCreateDialog = () => {
    setEditingSplitId(null)
    setForm(emptySplitForm())
    setIsFormOpen(true)
  }

  const openEditDialog = async (split: SplitUI) => {
    try {
      const { data: days, error } = await supabase
        .from('plan_days')
        .select('id,plan_id,weekday,day_title,muscle_groups')
        .eq('plan_id', split.id)
        .order('weekday', { ascending: true })
      if (error) throw error

      const mappedDays = ((days ?? []) as DbPlanDay[]).map((day) => ({
        day: weekdayNumberToLabel(day.weekday),
        muscleGroups: normalizeMuscleGroups(day.muscle_groups),
        focus: day.day_title ?? '',
        isRestDay:
          normalizeMuscleGroups(day.muscle_groups).length === 0 &&
          (day.day_title ?? '').toLowerCase().includes('descanso'),
      }))

      setEditingSplitId(split.id)
      setForm({
        title: split.name,
        description: split.description,
        visibility: split.visibility,
        template: 'CUSTOM',
        days: mappedDays.length > 0 ? mappedDays : buildDaysFromTemplate('CUSTOM'),
      })
      setIsFormOpen(true)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao abrir split para edição.')
    }
  }

  const applyTemplate = (template: SplitTemplate) => {
    setForm((prev) => ({
      ...prev,
      template,
      title: template === 'CUSTOM' ? prev.title : SPLIT_TEMPLATES[template].name,
      description: template === 'CUSTOM' ? prev.description : SPLIT_TEMPLATES[template].description,
      days: buildDaysFromTemplate(template),
    }))
  }

  const updateDay = (index: number, updates: Partial<SplitDay>) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.map((day, i) => (i === index ? { ...day, ...updates } : day)),
    }))
  }

  const toggleMuscleGroup = (index: number, group: MuscleGroup) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.map((day, i) => {
        if (i !== index) return day
        const exists = day.muscleGroups.includes(group)
        return {
          ...day,
          muscleGroups: exists ? day.muscleGroups.filter((g) => g !== group) : [...day.muscleGroups, group],
        }
      }),
    }))
  }

  const saveSplit = async () => {
    if (!user) return
    if (!form.title.trim()) {
      toast.error('Informe o nome do split.')
      return
    }

    setFormSaving(true)
    try {
      let splitId = editingSplitId

      if (!splitId) {
        const { data, error } = await supabase
          .from('plans')
          .insert({
            title: form.title.trim(),
            description: form.description.trim() || null,
            type: 'split',
            visibility: form.visibility,
            owner_id: user.id,
            is_active: true,
          })
          .select('id')
          .single()
        if (error) throw error
        splitId = data.id
      } else {
        const { error } = await supabase
          .from('plans')
          .update({
            title: form.title.trim(),
            description: form.description.trim() || null,
            visibility: form.visibility,
            updated_at: new Date().toISOString(),
          })
          .eq('id', splitId)
        if (error) throw error

        const { error: deleteDaysErr } = await supabase.from('plan_days').delete().eq('plan_id', splitId)
        if (deleteDaysErr) throw deleteDaysErr
      }

      const payload = form.days.map((day) => ({
        plan_id: splitId,
        weekday: weekdayLabelToNumber(day.day),
        day_title: day.isRestDay ? 'Descanso' : day.focus || 'Treino',
        muscle_groups: day.isRestDay ? [] : day.muscleGroups,
      }))

      const { error: insertDaysErr } = await supabase.from('plan_days').insert(payload)
      if (insertDaysErr) throw insertDaysErr

      toast.success(editingSplitId ? 'Split atualizado com sucesso!' : 'Split criado com sucesso!')
      setIsFormOpen(false)
      setEditingSplitId(null)
      setForm(emptySplitForm())
      setDetails({})
      await reloadSplits()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar split.')
    } finally {
      setFormSaving(false)
    }
  }

  const deleteSplit = async (splitId: string) => {
    try {
      const { error } = await supabase.from('plans').delete().eq('id', splitId)
      if (error) throw error

      if (activeSplitId === splitId && targetUserId) {
        const { error: clearErr } = await supabase
          .from('user_active_plan')
          .upsert({ user_id: targetUserId, active_split_id: null }, { onConflict: 'user_id' })
        if (clearErr) throw clearErr
      }

      toast.success('Split excluído!')
      setDetails((prev) => {
        const next = { ...prev }
        delete next[splitId]
        return next
      })
      await reloadSplits()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao excluir split.')
    }
  }

  const clearActiveSplitForTarget = async () => {
    if (!targetUserId) return

    setChangingActiveSplitId(activeSplitId ?? '__clearing__')
    try {
      const { error } = await supabase
        .from('user_active_plan')
        .upsert({ user_id: targetUserId, active_split_id: null }, { onConflict: 'user_id' })
      if (error) throw error

      setActiveSplitId(null)
      toast.success(isStudentMode ? 'Split do aluno desativado!' : 'Split ativo removido!')
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao desativar split ativo.')
    } finally {
      setChangingActiveSplitId(null)
    }
  }

  const setActiveSplitForTarget = async (splitId: string) => {
    if (!targetUserId) return

    setChangingActiveSplitId(splitId)
    try {
      const { error } = await supabase
        .from('user_active_plan')
        .upsert({ user_id: targetUserId, active_split_id: splitId }, { onConflict: 'user_id' })
      if (error) throw error

      setActiveSplitId(splitId)

      const { data: activeDays, error: activeDaysErr } = await supabase
        .from('plan_days')
        .select('id,plan_id,weekday,day_title,muscle_groups')
        .eq('plan_id', splitId)
        .order('weekday', { ascending: true })

      if (activeDaysErr) throw activeDaysErr

      setDetails((prev) => ({
        ...prev,
        [splitId]: (activeDays ?? []) as DbPlanDay[],
      }))

      toast.success(isStudentMode ? 'Split ativo definido para o aluno!' : 'Split ativo atualizado!')
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao definir split ativo.')
    } finally {
      setChangingActiveSplitId(null)
    }
  }

  const assignSplitToSelectedStudent = async (planId: string) => {
    if (!user || !selectedUserId) return

    if (assignedSplitIds.has(planId)) {
      toast.info('Esse split já está atribuído para este aluno.')
      return
    }

    try {
      const { error } = await supabase.from('plan_students').insert({
        plan_id: planId,
        student_id: selectedUserId,
        assigned_by: user.id,
      })

      if (error) throw error

      toast.success(`Split atribuído para ${targetUserLabel}!`)
      await reloadSplits()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao atribuir split para o aluno.')
    }
  }

  const toggleStudentForPlan = (planId: string, studentId: string) => {
    setDraftPlanStudentIds((prev) => {
      const current = prev[planId] ?? planStudentIds[planId] ?? []
      const next = current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]
      return { ...prev, [planId]: next }
    })
  }

  const saveAssignments = async (planId: string) => {
    if (!user) return

    const current = planStudentIds[planId] ?? []
    const draft = draftPlanStudentIds[planId] ?? []

    const toInsert = draft.filter((id) => !current.includes(id))
    const toDelete = current.filter((id) => !draft.includes(id))

    setSavingAssignmentsForPlanId(planId)
    try {
      if (toInsert.length > 0) {
        const { error } = await supabase.from('plan_students').insert(
          toInsert.map((studentId) => ({
            plan_id: planId,
            student_id: studentId,
            assigned_by: user.id,
          }))
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

      toast.success('Vínculos de alunos atualizados!')
      setPlanStudentIds((prev) => ({ ...prev, [planId]: draft }))
      await reloadSplits()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar vínculos do split.')
    } finally {
      setSavingAssignmentsForPlanId(null)
    }
  }

  const rawToday = new Date().toLocaleDateString('pt-BR', { weekday: 'long' })
  const normalizedToday = rawToday.replace('-feira', '').trim()
  const todayLabel = (normalizedToday.charAt(0).toUpperCase() + normalizedToday.slice(1)) as WeekDay
  const activeSplitDetails = activeSplitId ? details[activeSplitId] : undefined
  const todayPlan = activeSplitDetails?.find((day) => weekdayNumberToLabel(day.weekday) === todayLabel)
  const todayGroups = normalizeMuscleGroups(todayPlan?.muscle_groups)
  const isTodayRest =
    !!todayPlan &&
    todayGroups.length === 0 &&
    (todayPlan.day_title ?? '').toLowerCase().includes('descanso')
  const weeklyTrainingDays = activeSplit?.daysPerWeek ?? 0

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Split de treino</h1>
          <p className="text-muted-foreground">Biblioteca, atribuição e ativação de splits no Supabase.</p>
        </div>

        {canManageSplits && (
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo split
          </Button>
        )}
      </div>

      {isStudentMode && (
        <Card className="border-primary/30 bg-primary/10">
          <CardContent className="py-4 text-sm text-white">
            <span>
              Modo Aluno ativo para: <strong>{targetUserLabel}</strong>
            </span>
          </CardContent>
        </Card>
      )}

      {activeSplit && (
        <Card className="border-blue-500/30 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
          <CardContent className="space-y-5 py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-500/20">
                  <Dumbbell className="h-7 w-7 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Split ativo</p>
                  <h3 className="truncate text-xl font-bold text-white">{activeSplit.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{weeklyTrainingDays} dias de treino</Badge>
                    <Badge variant="outline">{activeSplit.visibility === 'public' ? 'Público' : 'Privado'}</Badge>
                    {activeSplit.source === 'assigned' && <Badge className="border-blue-500/30 bg-blue-500/20 text-blue-400">Atribuído</Badge>}
                    {activeSplit.source === 'owned' && <Badge className="border-purple-500/30 bg-purple-500/20 text-purple-400">Meu</Badge>}
                  </div>
                </div>
              </div>

              <div className="min-w-[220px] rounded-xl border border-white/10 bg-background/30 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Hoje</div>
                <div className="mt-1 text-sm font-medium text-white">{todayLabel}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {todayPlan ? (isTodayRest ? 'Dia de descanso' : (todayPlan.day_title || 'Treino do dia')) : 'Nenhum dia configurado'}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-background/30 p-4">
              <div>
                <div className="text-sm text-muted-foreground">Foco do dia</div>
                <div className="text-base font-semibold text-white">
                  {todayPlan ? (isTodayRest ? 'Descanso' : (todayPlan.day_title || 'Treino do dia')) : 'Sem treino definido para hoje'}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {todayPlan ? (
                  isTodayRest ? (
                    <Badge variant="secondary">Descanso</Badge>
                  ) : todayGroups.length > 0 ? (
                    todayGroups.map((group) => (
                      <Badge key={group} variant="secondary">{group}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Sem grupos musculares definidos.</span>
                  )
                ) : (
                  <span className="text-sm text-muted-foreground">Ative um split com os dias configurados para ver o resumo de hoje.</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Carregando splits...</CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Splits atribuídos ao aluno</h2>
            </div>

            {assignedSplits.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                  Nenhum split atribuído no momento.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assignedSplits.map((split) => (
                  <SplitCard
                    key={split.id}
                    split={split}
                    days={details[split.id]}
                    isExpanded={expandedSplit === split.id}
                    onToggle={async () => {
                      const next = expandedSplit === split.id ? null : split.id
                      setExpandedSplit(next)
                      if (next) await loadSplitDetails(split.id)
                    }}
                    isActive={activeSplitId === split.id}
                    canSetActive={canChangeActiveSplit}
                    onSetActive={() => setActiveSplitForTarget(split.id)}
                    onDeactivate={activeSplitId === split.id ? () => clearActiveSplitForTarget() : undefined}
                    activating={changingActiveSplitId === split.id}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Biblioteca pública de splits</h2>
            </div>

            {publicSplits.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                  Nenhum split público cadastrado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {publicSplits.map((split) => (
                  <SplitCard
                    key={split.id}
                    split={split}
                    days={details[split.id]}
                    isExpanded={expandedSplit === split.id}
                    onToggle={async () => {
                      const next = expandedSplit === split.id ? null : split.id
                      setExpandedSplit(next)
                      if (next) await loadSplitDetails(split.id)
                    }}
                    isActive={activeSplitId === split.id}
                    canSetActive={canChangeActiveSplit}
                    onSetActive={() => setActiveSplitForTarget(split.id)}
                    onDeactivate={activeSplitId === split.id ? () => clearActiveSplitForTarget() : undefined}
                    activating={changingActiveSplitId === split.id}
                  />
                ))}
              </div>
            )}
          </section>

          {canManageSplits && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Meus splits</h2>
              </div>

              {ownedSplits.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-sm text-muted-foreground">
                    Você ainda não criou nenhum split.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {ownedSplits.map((split) => {
                    const assignedCount = (planStudentIds[split.id] ?? []).length
                    const isAssignedToSelectedStudent = selectedUserId ? assignedSplitIds.has(split.id) : false

                    return (
                      <SplitCard
                        key={split.id}
                        split={split}
                        days={details[split.id]}
                        isExpanded={expandedSplit === split.id}
                        onToggle={async () => {
                          const next = expandedSplit === split.id ? null : split.id
                          setExpandedSplit(next)
                          if (next) await loadSplitDetails(split.id)
                        }}
                        isActive={activeSplitId === split.id}
                        canSetActive={canChangeActiveSplit}
                        onSetActive={() => setActiveSplitForTarget(split.id)}
                        activating={changingActiveSplitId === split.id}
                        canManage
                        onAssign={() => {
                          if (isStudentMode && selectedUserId) {
                            void assignSplitToSelectedStudent(split.id)
                            return
                          }
                          setAssignPanelPlanId(assignPanelPlanId === split.id ? null : split.id)
                        }}
                        assignLabel={isStudentMode ? (isAssignedToSelectedStudent ? 'Já atribuído' : 'Atribuir ao aluno') : 'Atribuir'}
                        onEdit={() => openEditDialog(split)}
                        onDelete={() => deleteSplit(split.id)}
                        assignedCount={assignedCount}
                      />
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {assignPanelPlanId && !isStudentMode && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Atribuir split aos alunos</CardTitle>
            <CardDescription>Selecione quem deve receber este split.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {students.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum aluno disponível para vínculo.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {students.map((student) => {
                  const selectedIds = draftPlanStudentIds[assignPanelPlanId] ?? planStudentIds[assignPanelPlanId] ?? []
                  const checked = selectedIds.includes(student.id)

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleStudentForPlan(assignPanelPlanId, student.id)}
                      className={`rounded-xl border p-3 text-left transition ${checked ? 'border-primary bg-primary/10' : 'border-border/60 bg-background/40 hover:border-primary/40'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">{getProfileDisplayName(student, 'Aluno')}</div>
                          <div className="truncate text-xs text-muted-foreground">{student.email ?? '—'}</div>
                        </div>
                        {checked && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignPanelPlanId(null)}>
                Fechar
              </Button>
              <Button onClick={() => saveAssignments(assignPanelPlanId)} disabled={savingAssignmentsForPlanId === assignPanelPlanId} className="gap-2">
                <Save className="h-4 w-4" />
                {savingAssignmentsForPlanId === assignPanelPlanId ? 'Salvando...' : 'Salvar vínculos'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSplitId ? 'Editar split' : 'Novo split'}</DialogTitle>
            <DialogDescription>
              Cadastre um split reutilizável e atribua para seus alunos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="split-title">Nome do split</Label>
                <Input
                  id="split-title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex.: ABC Hipertrofia"
                />
              </div>

              <div className="space-y-2">
                <Label>Visibilidade</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={form.visibility === 'private' ? 'default' : 'outline'}
                    onClick={() => setForm((prev) => ({ ...prev, visibility: 'private' }))}
                  >
                    Privado
                  </Button>
                  <Button
                    type="button"
                    variant={form.visibility === 'public' ? 'default' : 'outline'}
                    onClick={() => setForm((prev) => ({ ...prev, visibility: 'public' }))}
                  >
                    Público
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="split-description">Descrição</Label>
              <Textarea
                id="split-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Resumo do objetivo deste split"
              />
            </div>

            <div className="space-y-3">
              <Label>Template</Label>
              <div className="flex flex-wrap gap-2">
                {(['ABC', 'AB', 'PPL', 'FULL_BODY', 'UPPER_LOWER', 'ABCDE', 'CUSTOM'] as SplitTemplate[]).map((template) => (
                  <Button
                    key={template}
                    type="button"
                    variant={form.template === template ? 'default' : 'outline'}
                    onClick={() => applyTemplate(template)}
                  >
                    {template}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {form.days.map((day, index) => (
                <Card key={day.day} className="border-border/60 bg-background/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{day.day}</CardTitle>
                        <CardDescription>Defina foco e grupamentos do dia.</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                        <Checkbox
                          checked={day.isRestDay}
                          onCheckedChange={(checked) =>
                            updateDay(index, {
                              isRestDay: !!checked,
                              focus: checked ? 'Descanso' : day.focus,
                              muscleGroups: checked ? [] : day.muscleGroups,
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">Descanso</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Foco do dia</Label>
                      <Input
                        value={day.focus}
                        disabled={day.isRestDay}
                        onChange={(e) => updateDay(index, { focus: e.target.value })}
                        placeholder="Ex.: Peito e Tríceps"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Grupos musculares</Label>
                      <div className="flex flex-wrap gap-2">
                        {MUSCLE_GROUPS.map((group) => {
                          const active = day.muscleGroups.includes(group)
                          return (
                            <Button
                              key={group}
                              type="button"
                              size="sm"
                              disabled={day.isRestDay}
                              variant={active ? 'default' : 'outline'}
                              onClick={() => toggleMuscleGroup(index, group)}
                            >
                              {group}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveSplit} disabled={formSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {formSaving ? 'Salvando...' : editingSplitId ? 'Salvar alterações' : 'Criar split'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

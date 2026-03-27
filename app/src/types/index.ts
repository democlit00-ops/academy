// ============================================
// TIPOS DO SISTEMA AcademyK PRO
// ============================================

// Categoria do exercício (classificação profissional)
export type ExerciseCategory =
  | 'Força'
  | 'Cardio'
  | 'Core'
  | 'Mobilidade'

// Grupos musculares / grupos funcionais
export type MuscleGroup =
  | 'Peito'
  | 'Costas'
  | 'Ombros'
  | 'Bíceps'
  | 'Tríceps'
  | 'Pernas'
  | 'Glúteos'
  | 'Posterior'
  | 'Core'
  | 'Cardio'
  | 'Mobilidade'

// Tipos de cardio
export type CardioType =
  | 'Esteira'
  | 'Bike'
  | 'Caminhada'
  | 'Corrida'
  | 'Elíptico'
  | 'Remo'
  | 'Outro'

// Zonas cardíacas
export type HeartRateZone =
  | 'Zona 1'
  | 'Zona 2'
  | 'Zona 3'
  | 'Zona 4'
  | 'Zona 5'

// Dias da semana
export type WeekDay =
  | 'Segunda'
  | 'Terça'
  | 'Quarta'
  | 'Quinta'
  | 'Sexta'
  | 'Sábado'
  | 'Domingo'

// Status de progressão de carga
export type LoadProgressionStatus =
  | 'Subir carga'
  | 'Manter carga'
  | 'Reduzir carga'

// ============================================
// EXERCÍCIO BASE (TABELA DE REFERÊNCIA)
// ============================================
export interface ExerciseDefinition {
  id: string
  name: string
  muscleGroup: MuscleGroup
  category: ExerciseCategory
  loadIncrement: number // em kg
  isBodyweight?: boolean
}

// ============================================
// TREINO DE MUSCULAÇÃO
// ============================================
export interface WorkoutSet {
  reps: number
  weight: number // em kg
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  exerciseName: string
  muscleGroup: MuscleGroup
  sourceMode?: 'bank' | 'custom'
  sets: WorkoutSet[]
  rpe: number
  avgHeartRate?: number
  maxHeartRate?: number
  notes?: string
}

export interface WorkoutSession {
  id: string
  date: string // ISO date
  weekDay: WeekDay
  exercises: WorkoutExercise[]
  totalVolume: number
  duration?: number // em minutos
  createdAt?: number | string
}

// ============================================
// CARDIO
// ============================================
export interface CardioSession {
  id: string
  date: string
  type: CardioType
  duration: number // em minutos
  distance?: number // em km
  avgSpeed?: number // km/h
  avgHeartRate?: number
  maxHeartRate?: number
  calories?: number
  steps?: number
  heartRateZone: HeartRateZone
  notes?: string
}

// ============================================
// CONTROLE FISIOLÓGICO
// ============================================
export interface PhysiologicalData {
  id: string
  date: string
  weight?: number // em kg
  restingHeartRate?: number // bpm
  sleepHeartRate?: number // bpm
  sleepTotal: string // formato "hh:mm"
  sleepTotalHours: number // decimal (ex: 7.63)
  sleepREM?: number // minutos
  sleepLight?: number // minutos
  sleepDeep?: number // minutos
  awakeTime?: number // minutos
  spo2?: number // %
  respiratoryRate?: number // rpm
  fatigue: number // 1-10
  notes?: string
}

// ============================================
// RECOVERY SCORE
// ============================================
export interface RecoveryScore {
  date: string
  score: number // 0-100
  classification: 'Ótima' | 'Boa' | 'Moderada' | 'Baixa'
  sleepContribution: number
  hrContribution: number
  fatigueContribution: number
}

// ============================================
// ESTATÍSTICAS E ANÁLISES
// ============================================
export interface ExerciseProgress {
  exerciseId: string
  exerciseName: string
  muscleGroup: MuscleGroup
  history: {
    date: string
    maxWeight: number
    totalVolume: number
    avgWeight: number
  }[]
}

export interface MuscleVolumeData {
  muscleGroup: MuscleGroup
  weeklyVolume: number
  monthlyVolume: number
  exerciseCount: number
}

export interface WeeklyStats {
  weekStart: string
  totalWorkouts: number
  totalVolume: number
  totalCardioMinutes: number
  totalCardioDistance: number
  avgRPE: number
  muscleVolumes: Record<MuscleGroup, number>
}

// ============================================
// SPLIT DE TREINO SEMANAL (LEGADO / EM REVISÃO)
// ============================================
// Observação:
// O sistema atual de split/programa já usa banco de dados com plans, plan_days,
// plan_items, plan_students e user_active_plan.
// Estes tipos podem ser removidos ou reduzidos depois da limpeza completa.
export interface SplitDay {
  day: WeekDay
  muscleGroups: MuscleGroup[]
  focus: string
  isRestDay: boolean
  exercises?: string[]
}

export interface WorkoutSplit {
  id: string
  name: string
  description?: string
  days: SplitDay[]
  createdAt: number
  isActive: boolean
}

export type SplitTemplate =
  | 'ABC'
  | 'AB'
  | 'ABCDE'
  | 'PPL'
  | 'FULL_BODY'
  | 'UPPER_LOWER'
  | 'CUSTOM'

// ============================================
// CONFIGURAÇÕES DO USUÁRIO
// ============================================
export interface UserSettings {
  name: string
  age?: number
  weight?: number
  height?: number
  fitnessGoal?: 'Hipertrofia' | 'Força' | 'Resistência' | 'Emagrecimento' | 'Geral'
  preferredUnits: {
    weight: 'kg' | 'lbs'
    distance: 'km' | 'mi'
  }
  theme: 'dark' | 'light' | 'system'
}

// ============================================
// ESTADO GLOBAL DA APLICAÇÃO (LEGADO / EM REVISÃO)
// ============================================
export interface AppState {
  workoutSessions: WorkoutSession[]
  cardioSessions: CardioSession[]
  physiologicalData: PhysiologicalData[]
  settings: UserSettings
  exerciseProgress: ExerciseProgress[]
  muscleVolumeData: MuscleVolumeData[]
  recoveryScores: RecoveryScore[]
  weeklyStats: WeeklyStats[]
}

// ============================================
// PROPS DE COMPONENTES
// ============================================
export interface ChartDataPoint {
  date: string
  label: string
  value: number
  [key: string]: string | number | undefined
}

export interface RadarDataPoint {
  subject: string
  value: number
  fullMark: number
}
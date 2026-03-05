// ============================================
// TIPOS DO SISTEMA FITTRACK PRO
// ============================================

// Grupos musculares
export type MuscleGroup = 
  | 'Peito'
  | 'Costas'
  | 'Ombro'
  | 'Bíceps'
  | 'Tríceps'
  | 'Quadríceps'
  | 'Posterior'
  | 'Panturrilha'
  | 'Core'
  | 'Pernas';

// Tipos de cardio
export type CardioType = 
  | 'Esteira'
  | 'Bike'
  | 'Caminhada'
  | 'Corrida'
  | 'Elíptico'
  | 'Remo'
  | 'Outro';

// Zonas cardíacas
export type HeartRateZone = 
  | 'Zona 1'
  | 'Zona 2'
  | 'Zona 3'
  | 'Zona 4'
  | 'Zona 5';

// Dias da semana
export type WeekDay = 
  | 'Segunda'
  | 'Terça'
  | 'Quarta'
  | 'Quinta'
  | 'Sexta'
  | 'Sábado'
  | 'Domingo';

// Status de progressão de carga
export type LoadProgressionStatus = 
  | 'Subir carga'
  | 'Manter carga'
  | 'Reduzir carga';

// ============================================
// EXERCÍCIO BASE (TABELA DE REFERÊNCIA)
// ============================================
export interface ExerciseDefinition {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  loadIncrement: number; // em kg
  isBodyweight?: boolean;
}

// ============================================
// TREINO DE MUSCULAÇÃO
// ============================================
export interface WorkoutSet {
  reps: number;
  weight: number; // em kg
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: WorkoutSet[];
  rpe: number; // 1-10
  avgHeartRate?: number;
  maxHeartRate?: number;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO date
  weekDay: WeekDay;
  exercises: WorkoutExercise[];
  totalVolume: number;
  duration?: number; // em minutos
  createdAt: number;
}

// ============================================
// CARDIO
// ============================================
export interface CardioSession {
  id: string;
  date: string;
  type: CardioType;
  duration: number; // em minutos
  distance?: number; // em km
  avgSpeed?: number; // km/h
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  steps?: number;
  heartRateZone: HeartRateZone;
  notes?: string;
}

// ============================================
// CONTROLE FISIOLÓGICO
// ============================================
export interface PhysiologicalData {
  id: string;
  date: string;
  weight?: number; // em kg
  restingHeartRate?: number; // bpm
  sleepHeartRate?: number; // bpm
  sleepTotal: string; // formato "hh:mm"
  sleepTotalHours: number; // decimal (ex: 7.63)
  sleepREM?: number; // minutos
  sleepLight?: number; // minutos
  sleepDeep?: number; // minutos
  awakeTime?: number; // minutos
  spo2?: number; // %
  respiratoryRate?: number; // rpm
  fatigue: number; // 1-10
  notes?: string;
}

// ============================================
// RECOVERY SCORE
// ============================================
export interface RecoveryScore {
  date: string;
  score: number; // 0-100
  classification: 'Ótima' | 'Boa' | 'Moderada' | 'Baixa';
  sleepContribution: number;
  hrContribution: number;
  fatigueContribution: number;
}

// ============================================
// ESTATÍSTICAS E ANÁLISES
// ============================================
export interface ExerciseProgress {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  history: {
    date: string;
    maxWeight: number;
    totalVolume: number;
    avgWeight: number;
  }[];
}

export interface MuscleVolumeData {
  muscleGroup: MuscleGroup;
  weeklyVolume: number;
  monthlyVolume: number;
  exerciseCount: number;
}

export interface WeeklyStats {
  weekStart: string;
  totalWorkouts: number;
  totalVolume: number;
  totalCardioMinutes: number;
  totalCardioDistance: number;
  avgRPE: number;
  muscleVolumes: Record<MuscleGroup, number>;
}

// ============================================
// SPLIT DE TREINO SEMANAL
// ============================================
export interface SplitDay {
  day: WeekDay;
  muscleGroups: MuscleGroup[];
  focus: string; // ex: "Peito e Tríceps", "Costas e Bíceps"
  isRestDay: boolean;
  exercises?: string[]; // IDs dos exercícios sugeridos
}

export interface WorkoutSplit {
  id: string;
  name: string; // ex: "Push/Pull/Legs", "ABC", "Full Body"
  description?: string;
  days: SplitDay[];
  createdAt: number;
  isActive: boolean;
}

// Templates pré-definidos de splits
export type SplitTemplate = 
  | 'ABC'           // A=Peito/Tríceps, B=Costas/Bíceps, C=Pernas/Ombro
  | 'AB'            // A=Superior, B=Inferior
  | 'ABCDE'         // Um grupo por dia
  | 'PPL'           // Push/Pull/Legs
  | 'FULL_BODY'     // Full body 3x por semana
  | 'UPPER_LOWER'   // Upper/Lower alternado
  | 'CUSTOM';       // Personalizado

// ============================================
// CONFIGURAÇÕES DO USUÁRIO
// ============================================
export interface UserSettings {
  name: string;
  age?: number;
  weight?: number;
  height?: number;
  maxHeartRate?: number;
  restingHeartRate?: number;
  fitnessGoal?: 'Hipertrofia' | 'Força' | 'Resistência' | 'Emagrecimento' | 'Geral';
  preferredUnits: {
    weight: 'kg' | 'lbs';
    distance: 'km' | 'mi';
  };
  theme: 'dark' | 'light' | 'system';
}

// ============================================
// ESTADO GLOBAL DA APLICAÇÃO
// ============================================
export interface AppState {
  // Dados brutos
  workoutSessions: WorkoutSession[];
  cardioSessions: CardioSession[];
  physiologicalData: PhysiologicalData[];
  
  // Configurações
  settings: UserSettings;
  
  // Dados derivados (calculados)
  exerciseProgress: ExerciseProgress[];
  muscleVolumeData: MuscleVolumeData[];
  recoveryScores: RecoveryScore[];
  weeklyStats: WeeklyStats[];
}

// ============================================
// PROPS DE COMPONENTES
// ============================================
export interface ChartDataPoint {
  date: string;
  label: string;
  value: number;
  [key: string]: any;
}

export interface RadarDataPoint {
  subject: string;
  value: number;
  fullMark: number;
}

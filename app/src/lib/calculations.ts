import type { 
  WorkoutSession, 
  CardioSession, 
  PhysiologicalData, 
  RecoveryScore,
  ExerciseProgress,
  MuscleVolumeData,
  MuscleGroup,
  LoadProgressionStatus,
  WorkoutExercise 
} from '@/types';
import { MUSCLE_GROUPS } from '@/data/exercises';

// ============================================
// CONVERSÃO DE TEMPO
// ============================================

export function parseTimeToDecimal(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours + minutes / 60;
}

export function decimalToTimeString(decimal: number): string {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// ============================================
// CÁLCULOS DE TREINO
// ============================================

export function calculateExerciseVolume(exercise: WorkoutExercise): number {
  // Volume (kg) = peso × reps por série
  // Nota: em muitos treinos o usuário registra apenas a carga e deixa reps em branco.
  // Para não “zerar” o volume (e quebrar dashboards), aplicamos um fallback conservador.
  const DEFAULT_REPS_FALLBACK = 10;
  return exercise.sets.reduce((total, set) => {
    const weight = Number(set.weight) || 0;
    const reps = Number(set.reps) > 0 ? Number(set.reps) : DEFAULT_REPS_FALLBACK;
    return total + (weight * reps);
  }, 0);
}

export function calculateWorkoutVolume(session: WorkoutSession): number {
  return session.exercises.reduce((total, ex) => total + calculateExerciseVolume(ex), 0);
}

export function getMaxWeightForExercise(exercise: WorkoutExercise): number {
  const weights = exercise.sets
    .map(s => Number(s.weight) || 0)
    .filter(w => w > 0);
  return weights.length ? Math.max(...weights) : 0;
}

export function getAverageWeightForExercise(exercise: WorkoutExercise): number {
  if (!exercise.sets || exercise.sets.length === 0) return 0;
  const weights = exercise.sets
    .map(s => Number(s.weight) || 0)
    .filter(w => w > 0);
  if (weights.length === 0) return 0;
  const total = weights.reduce((sum, w) => sum + w, 0);
  return total / weights.length;
}

// ============================================
// STATUS DE PROGRESSÃO DE CARGA
// ============================================

export function determineLoadProgression(
  lastRPE: number,
  failedSets: number
): LoadProgressionStatus {
  if (failedSets > 0 || lastRPE >= 10) {
    return 'Reduzir carga';
  }
  if (lastRPE <= 7 && failedSets === 0) {
    return 'Subir carga';
  }
  return 'Manter carga';
}

export function getLoadProgressionColor(status: LoadProgressionStatus): string {
  switch (status) {
    case 'Subir carga': return '#22c55e'; // verde
    case 'Manter carga': return '#3b82f6'; // azul
    case 'Reduzir carga': return '#ef4444'; // vermelho
    default: return '#6b7280';
  }
}

// ============================================
// RECOVERY SCORE
// ============================================

export function calculateRecoveryScore(physio: PhysiologicalData): RecoveryScore {
  // Sono: 40% (baseado em 7-9 horas ideais)
  const sleepHours = physio.sleepTotalHours || 0;
  let sleepScore = 0;
  if (sleepHours >= 7 && sleepHours <= 9) {
    sleepScore = 100;
  } else if (sleepHours >= 6 && sleepHours < 7) {
    sleepScore = 80;
  } else if (sleepHours >= 9 && sleepHours <= 10) {
    sleepScore = 75;
  } else if (sleepHours >= 5 && sleepHours < 6) {
    sleepScore = 50;
  } else if (sleepHours > 10) {
    sleepScore = 60;
  } else {
    sleepScore = 30;
  }

  // FC de repouso: 30% (baseado em 50-70 bpm ideal)
  const restingHR = physio.restingHeartRate || 70;
  let hrScore = 0;
  if (restingHR >= 50 && restingHR <= 60) {
    hrScore = 100;
  } else if (restingHR > 60 && restingHR <= 70) {
    hrScore = 85;
  } else if (restingHR > 70 && restingHR <= 80) {
    hrScore = 65;
  } else if (restingHR > 80) {
    hrScore = 40;
  } else if (restingHR < 50) {
    hrScore = 90; // Atleta
  }

  // Cansaço: 30% (invertido - menor é melhor)
  const fatigue = physio.fatigue || 5;
  const fatigueScore = Math.max(0, 100 - (fatigue * 10));

  // Score final ponderado
  const finalScore = Math.round(
    (sleepScore * 0.40) + 
    (hrScore * 0.30) + 
    (fatigueScore * 0.30)
  );

  // Classificação
  let classification: RecoveryScore['classification'];
  if (finalScore >= 80) classification = 'Ótima';
  else if (finalScore >= 60) classification = 'Boa';
  else if (finalScore >= 40) classification = 'Moderada';
  else classification = 'Baixa';

  return {
    date: physio.date,
    score: finalScore,
    classification,
    sleepContribution: Math.round(sleepScore),
    hrContribution: Math.round(hrScore),
    fatigueContribution: Math.round(fatigueScore),
  };
}

export function getRecoveryScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

// ============================================
// ESTATÍSTICAS SEMANAIS
// ============================================

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Segunda como início
  return new Date(d.setDate(diff));
}

export function getWeekKey(date: Date): string {
  const weekStart = getWeekStart(date);
  return weekStart.toISOString().split('T')[0];
}

export function calculateWeeklyStats(
  workouts: WorkoutSession[],
  cardio: CardioSession[]
) {
  const stats: Record<string, {
    weekStart: string;
    totalWorkouts: number;
    totalVolume: number;
    totalCardioMinutes: number;
    totalCardioDistance: number;
    avgRPE: number;
    muscleVolumes: Record<MuscleGroup, number>;
  }> = {};

  // Inicializar todas as semanas
  [...workouts, ...cardio].forEach(session => {
    const date = new Date(session.date);
    const weekKey = getWeekKey(date);
    
    if (!stats[weekKey]) {
      stats[weekKey] = {
        weekStart: weekKey,
        totalWorkouts: 0,
        totalVolume: 0,
        totalCardioMinutes: 0,
        totalCardioDistance: 0,
        avgRPE: 0,
        muscleVolumes: {} as Record<MuscleGroup, number>,
      };
      MUSCLE_GROUPS.forEach(mg => stats[weekKey].muscleVolumes[mg] = 0);
    }
  });

  // Processar treinos
  workouts.forEach(workout => {
    const weekKey = getWeekKey(new Date(workout.date));
    if (!stats[weekKey]) return;
    
    stats[weekKey].totalWorkouts++;
    stats[weekKey].totalVolume += calculateWorkoutVolume(workout);
    
    workout.exercises.forEach(ex => {
      const volume = calculateExerciseVolume(ex);
      stats[weekKey].muscleVolumes[ex.muscleGroup] += volume;
    });
  });

  // Processar cardio
  cardio.forEach(session => {
    const weekKey = getWeekKey(new Date(session.date));
    if (!stats[weekKey]) return;
    
    stats[weekKey].totalCardioMinutes += session.duration;
    if (session.distance) {
      stats[weekKey].totalCardioDistance += session.distance;
    }
  });

  return Object.values(stats).sort((a, b) => 
    new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
  );
}

// ============================================
// PROGRESSO DE EXERCÍCIOS
// ============================================

export function calculateExerciseProgress(
  workouts: WorkoutSession[],
  exerciseId?: string
): ExerciseProgress[] {
  const progressMap: Record<string, ExerciseProgress> = {};

  workouts.forEach(workout => {
    workout.exercises.forEach(ex => {
      if (exerciseId && ex.exerciseId !== exerciseId) return;
      
      if (!progressMap[ex.exerciseId]) {
        progressMap[ex.exerciseId] = {
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          history: [],
        };
      }

      progressMap[ex.exerciseId].history.push({
        date: workout.date,
        maxWeight: getMaxWeightForExercise(ex),
        totalVolume: calculateExerciseVolume(ex),
        avgWeight: getAverageWeightForExercise(ex),
      });
    });
  });

  // Ordenar histórico por data
  Object.values(progressMap).forEach(p => {
    p.history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  return Object.values(progressMap);
}

// ============================================
// VOLUME POR GRUPO MUSCULAR
// ============================================

export function calculateMuscleVolumeData(
  workouts: WorkoutSession[]
): MuscleVolumeData[] {
  const muscleData: Record<MuscleGroup, { weekly: number; monthly: number; count: number }> = 
    {} as Record<MuscleGroup, { weekly: number; monthly: number; count: number }>;
  
  MUSCLE_GROUPS.forEach(mg => {
    muscleData[mg] = { weekly: 0, monthly: 0, count: 0 };
  });

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  workouts.forEach(workout => {
    const workoutDate = new Date(workout.date);
    
    workout.exercises.forEach(ex => {
      const volume = calculateExerciseVolume(ex);
      
      if (workoutDate >= oneWeekAgo) {
        muscleData[ex.muscleGroup].weekly += volume;
      }
      if (workoutDate >= oneMonthAgo) {
        muscleData[ex.muscleGroup].monthly += volume;
      }
      muscleData[ex.muscleGroup].count++;
    });
  });

  return MUSCLE_GROUPS.map(mg => ({
    muscleGroup: mg,
    weeklyVolume: muscleData[mg].weekly,
    monthlyVolume: muscleData[mg].monthly,
    exerciseCount: muscleData[mg].count,
  }));
}

// ============================================
// FILTROS E UTILITÁRIOS
// ============================================

export function filterByDateRange<T extends { date: string }>(
  items: T[],
  startDate?: string,
  endDate?: string
): T[] {
  return items.filter(item => {
    const itemDate = new Date(item.date);
    if (startDate && itemDate < new Date(startDate)) return false;
    if (endDate && itemDate > new Date(endDate)) return false;
    return true;
  });
}

export function filterByMuscleGroup(
  workouts: WorkoutSession[],
  muscleGroup: MuscleGroup
): WorkoutSession[] {
  return workouts.filter(w => 
    w.exercises.some(e => e.muscleGroup === muscleGroup)
  );
}

export function filterByExercise(
  workouts: WorkoutSession[],
  exerciseId: string
): WorkoutSession[] {
  return workouts.filter(w => 
    w.exercises.some(e => e.exerciseId === exerciseId)
  );
}

// ============================================
// FORMATAÇÃO
// ============================================

export function formatWeight(kg: number): string {
  return `${kg.toFixed(1)} kg`;
}

export function formatDistance(km: number): string {
  return `${km.toFixed(2)} km`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins} min`;
}

export function formatNumber(num: number, decimals = 0): string {
  return num.toFixed(decimals);
}

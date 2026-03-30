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
// HELPERS DE DATA LOCAL SEGURA
// ============================================

export function parseLocalDate(date: string | null | undefined): Date | null {
  if (!date) return null;

  // Para strings YYYY-MM-DD, forçamos meia-noite local
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTodayLocalDateString(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

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

export function isDurationBasedExercise(exercise: WorkoutExercise): boolean {
  if (exercise.trackingMode === 'mobility') return true;
  return exercise.sets.some((set) => Number(set?.durationSec || 0) > 0);
}

export function getTotalDurationSecondsForExercise(exercise: WorkoutExercise): number {
  return exercise.sets.reduce((total, set) => total + (Number(set?.durationSec) || 0), 0);
}

export function getMaxDurationSecondsForExercise(exercise: WorkoutExercise): number {
  const values = exercise.sets.map((set) => Number(set?.durationSec) || 0).filter((value) => value > 0);
  return values.length ? Math.max(...values) : 0;
}

export function getAverageDurationSecondsForExercise(exercise: WorkoutExercise): number {
  const values = exercise.sets.map((set) => Number(set?.durationSec) || 0).filter((value) => value > 0);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateExerciseVolume(exercise: WorkoutExercise): number {
  if (isDurationBasedExercise(exercise)) return 0;

  const DEFAULT_REPS_FALLBACK = 10;

  return exercise.sets.reduce((total, set) => {
    const weight = Number(set.weight) || 0;
    const reps = Number(set.reps) > 0 ? Number(set.reps) : DEFAULT_REPS_FALLBACK;
    return total + weight * reps;
  }, 0);
}

export function calculateWorkoutVolume(session: WorkoutSession): number {
  return session.exercises.reduce((total, ex) => total + calculateExerciseVolume(ex), 0);
}

export function getMaxWeightForExercise(exercise: WorkoutExercise): number {
  const weights = exercise.sets
    .map((s) => Number(s.weight) || 0)
    .filter((w) => w > 0);

  return weights.length ? Math.max(...weights) : 0;
}

export function getAverageWeightForExercise(exercise: WorkoutExercise): number {
  if (!exercise.sets || exercise.sets.length === 0) return 0;

  const weights = exercise.sets
    .map((s) => Number(s.weight) || 0)
    .filter((w) => w > 0);

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
    case 'Subir carga': return '#22c55e';
    case 'Manter carga': return '#3b82f6';
    case 'Reduzir carga': return '#ef4444';
    default: return '#6b7280';
  }
}

// ============================================
// RECOVERY SCORE
// ============================================

export function calculateRecoveryScore(physio: PhysiologicalData): RecoveryScore {
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
    hrScore = 90;
  }

  const fatigue = physio.fatigue || 5;
  const fatigueScore = Math.max(0, 100 - fatigue * 10);

  const finalScore = Math.round(
    sleepScore * 0.4 +
    hrScore * 0.3 +
    fatigueScore * 0.3
  );

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
  const localDate = startOfLocalDay(date);
  const day = localDate.getDay();
  const diff = localDate.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(localDate.getFullYear(), localDate.getMonth(), diff);
}

export function getWeekKey(date: Date): string {
  const weekStart = getWeekStart(date);
  const year = weekStart.getFullYear();
  const month = String(weekStart.getMonth() + 1).padStart(2, '0');
  const day = String(weekStart.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  [...workouts, ...cardio].forEach((session) => {
    const date = parseLocalDate(session.date);
    if (!date) return;

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

      MUSCLE_GROUPS.forEach((mg) => {
        stats[weekKey].muscleVolumes[mg] = 0;
      });
    }
  });

  workouts.forEach((workout) => {
    const workoutDate = parseLocalDate(workout.date);
    if (!workoutDate) return;

    const weekKey = getWeekKey(workoutDate);
    if (!stats[weekKey]) return;

    stats[weekKey].totalWorkouts++;
    stats[weekKey].totalVolume += calculateWorkoutVolume(workout);

    workout.exercises.forEach((ex) => {
      const volume = calculateExerciseVolume(ex);
      stats[weekKey].muscleVolumes[ex.muscleGroup] += volume;
    });
  });

  cardio.forEach((session) => {
    const cardioDate = parseLocalDate(session.date);
    if (!cardioDate) return;

    const weekKey = getWeekKey(cardioDate);
    if (!stats[weekKey]) return;

    stats[weekKey].totalCardioMinutes += session.duration;
    if (session.distance) {
      stats[weekKey].totalCardioDistance += session.distance;
    }
  });

  return Object.values(stats).sort((a, b) => {
    const da = parseLocalDate(a.weekStart)?.getTime() ?? 0;
    const db = parseLocalDate(b.weekStart)?.getTime() ?? 0;
    return da - db;
  });
}

// ============================================
// PROGRESSO DE EXERCÍCIOS
// ============================================

export function calculateExerciseProgress(
  workouts: WorkoutSession[],
  exerciseId?: string
): ExerciseProgress[] {
  const progressMap: Record<string, ExerciseProgress> = {};

  workouts.forEach((workout) => {
    workout.exercises.forEach((ex) => {
      if (exerciseId && ex.exerciseId !== exerciseId) return;

      const metricType = isDurationBasedExercise(ex) ? 'duration' : 'load';

      if (!progressMap[ex.exerciseId]) {
        progressMap[ex.exerciseId] = {
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          metricType,
          history: [],
        };
      }

      progressMap[ex.exerciseId].history.push({
        date: workout.date,
        maxWeight: getMaxWeightForExercise(ex),
        totalVolume: calculateExerciseVolume(ex),
        avgWeight: getAverageWeightForExercise(ex),
        maxDurationSec: getMaxDurationSecondsForExercise(ex),
        totalDurationSec: getTotalDurationSecondsForExercise(ex),
        avgDurationSec: getAverageDurationSecondsForExercise(ex),
      });
    });
  });

  Object.values(progressMap).forEach((p) => {
    p.history.sort((a, b) => {
      const da = parseLocalDate(a.date)?.getTime() ?? 0;
      const db = parseLocalDate(b.date)?.getTime() ?? 0;
      return da - db;
    });
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

  MUSCLE_GROUPS.forEach((mg) => {
    muscleData[mg] = { weekly: 0, monthly: 0, count: 0 };
  });

  const now = startOfLocalDay(new Date());
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  workouts.forEach((workout) => {
    const workoutDate = parseLocalDate(workout.date);
    if (!workoutDate) return;

    workout.exercises.forEach((ex) => {
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

  return MUSCLE_GROUPS.map((mg) => ({
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
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  return items.filter((item) => {
    const itemDate = parseLocalDate(item.date);
    if (!itemDate) return false;
    if (start && itemDate < start) return false;
    if (end && itemDate > end) return false;
    return true;
  });
}

export function filterByMuscleGroup(
  workouts: WorkoutSession[],
  muscleGroup: MuscleGroup
): WorkoutSession[] {
  return workouts.filter((w) =>
    w.exercises.some((e) => e.muscleGroup === muscleGroup)
  );
}

export function filterByExercise(
  workouts: WorkoutSession[],
  exerciseId: string
): WorkoutSession[] {
  return workouts.filter((w) =>
    w.exercises.some((e) => e.exerciseId === exerciseId)
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
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins} min`;
}

export function formatNumber(num: number, decimals = 0): string {
  return num.toFixed(decimals);
}
export function formatDurationSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  if (minutes <= 0) return `${remainingSeconds}s`;
  if (remainingSeconds === 0) return `${minutes} min`;
  return `${minutes}min ${remainingSeconds}s`;
}

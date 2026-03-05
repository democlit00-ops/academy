import { useMemo } from 'react';
import { 
  Activity, 
  Heart, 
  TrendingUp, 
  Dumbbell,
  Moon,
  Zap
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { RecoveryScoreRing } from '@/components/RecoveryScoreRing';
import { LineChart, BarChart, RadarChart } from '@/components/charts';
import type { 
  WorkoutSession, 
  CardioSession, 
  PhysiologicalData,
  RecoveryScore 
} from '@/types';
import { 
  calculateWorkoutVolume,
  calculateExerciseProgress,
  calculateExerciseVolume,
  formatDuration
} from '@/lib/calculations';
import { MUSCLE_GROUPS } from '@/data/exercises';
import { format, subDays, startOfWeek, isSameWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardProps {
  workouts: WorkoutSession[];
  cardio: CardioSession[];
  physio: PhysiologicalData[];
  recoveryScores: RecoveryScore[];
}

export function Dashboard({ workouts, cardio, physio, recoveryScores }: DashboardProps) {
  // Último dado fisiológico
  const latestPhysio = useMemo(() => {
    return physio[physio.length - 1];
  }, [physio]);

  // Último recovery score
  const latestRecovery = useMemo(() => {
    return recoveryScores[recoveryScores.length - 1];
  }, [recoveryScores]);

  // Dados para gráfico de evolução de força
  const strengthProgressData = useMemo(() => {
    const progress = calculateExerciseProgress(workouts);
    // Pegar os 3 exercícios mais recentes
    const topExercises = progress.slice(0, 3);
    
    // Criar dados para o gráfico
    const dates = [...new Set(workouts.map(w => w.date))].sort();
    
    return dates.map(date => {
      const point: Record<string, any> = { date, label: format(new Date(date), 'dd/MM') };
      topExercises.forEach(ex => {
        const dayData = ex.history.find(h => h.date === date);
        point[ex.exerciseName] = dayData?.maxWeight || 0;
      });
      return point;
    });
  }, [workouts]);

  const strengthLines = useMemo(() => {
    const progress = calculateExerciseProgress(workouts);
    return progress.slice(0, 3).map((ex, i) => ({
      key: ex.exerciseName,
      name: ex.exerciseName,
      color: ['#3b82f6', '#22c55e', '#f59e0b'][i],
    }));
  }, [workouts]);

  // Dados para gráfico de cardio semanal
  const cardioData = useMemo(() => {
    const last4Weeks = Array.from({ length: 4 }, (_, i) => {
      const date = subDays(new Date(), i * 7);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      return {
        week: format(weekStart, 'dd/MM'),
        minutes: 0,
        distance: 0,
      };
    }).reverse();

    cardio.forEach(session => {
      const sessionDate = new Date(session.date);
      const weekData = last4Weeks.find(w => {
        const weekDate = new Date(w.week.split('/').reverse().join('-'));
        return isSameWeek(sessionDate, weekDate, { weekStartsOn: 1 });
      });
      if (weekData) {
        weekData.minutes += session.duration;
        weekData.distance += session.distance || 0;
      }
    });

    return last4Weeks;
  }, [cardio]);

  // Dados para gráfico de recuperação
  const recoveryData = useMemo(() => {
    return recoveryScores.slice(-7).map(r => ({
      date: r.date,
      label: format(new Date(r.date), 'dd/MM'),
      score: r.score,
    }));
  }, [recoveryScores]);

  // Dados para radar de grupos musculares
  const muscleRadarData = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const muscleVolumes: Record<string, number> = {};
    MUSCLE_GROUPS.forEach(mg => muscleVolumes[mg] = 0);
    
    workouts.forEach(workout => {
      if (new Date(workout.date) >= oneWeekAgo) {
        workout.exercises.forEach(ex => {
          const volume = calculateExerciseVolume(ex);
          muscleVolumes[ex.muscleGroup] = (muscleVolumes[ex.muscleGroup] || 0) + volume;
        });
      }
    });
    
    const maxVolume = Math.max(...Object.values(muscleVolumes), 1);
    
    return MUSCLE_GROUPS.map(mg => ({
      subject: mg,
      value: Math.round(((muscleVolumes[mg] || 0) / maxVolume) * 100),
      fullMark: 100,
    }));
  }, [workouts]);

  // Total de treinos esta semana
  const weeklyWorkouts = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return workouts.filter(w => new Date(w.date) >= weekStart).length;
  }, [workouts]);

  // Volume total da semana
  const weeklyVolume = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return workouts
      .filter(w => new Date(w.date) >= weekStart)
      .reduce((total, w) => total + calculateWorkoutVolume(w), 0);
  }, [workouts]);

  // Tempo total de cardio
  const weeklyCardioMinutes = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return cardio
      .filter(c => new Date(c.date) >= weekStart)
      .reduce((total, c) => total + c.duration, 0);
  }, [cardio]);

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Recovery Score - Destaque */}
      {latestRecovery && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recovery Score</h3>
            <div className="flex justify-center">
              <RecoveryScoreRing score={latestRecovery.score} size={140} />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sono</span>
                <span className="text-white">{latestRecovery.sleepContribution}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${latestRecovery.sleepContribution}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">FC Repouso</span>
                <span className="text-white">{latestRecovery.hrContribution}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div 
                  className="bg-green-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${latestRecovery.hrContribution}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cansaço</span>
                <span className="text-white">{latestRecovery.fatigueContribution}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div 
                  className="bg-orange-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${latestRecovery.fatigueContribution}%` }}
                />
              </div>
            </div>
          </div>

          {/* Cards de estatísticas */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <StatCard
              title="Treinos esta semana"
              value={weeklyWorkouts}
              unit="treinos"
              icon={<Dumbbell className="w-5 h-5" />}
              variant="blue"
            />
            <StatCard
              title="Volume semanal"
              value={(weeklyVolume / 1000).toFixed(1)}
              unit="ton"
              icon={<TrendingUp className="w-5 h-5" />}
              variant="green"
            />
            <StatCard
              title="Cardio semanal"
              value={formatDuration(weeklyCardioMinutes)}
              icon={<Heart className="w-5 h-5" />}
              variant="orange"
            />
            <StatCard
              title="FC Repouso"
              value={latestPhysio?.restingHeartRate || '--'}
              unit="bpm"
              icon={<Activity className="w-5 h-5" />}
              variant="purple"
            />
            <StatCard
              title="Sono"
              value={latestPhysio?.sleepTotalHours?.toFixed(1) || '--'}
              unit="h"
              icon={<Moon className="w-5 h-5" />}
              variant="blue"
            />
            <StatCard
              title="Cansaço"
              value={latestPhysio?.fatigue || '--'}
              unit="/10"
              icon={<Zap className="w-5 h-5" />}
              variant={latestPhysio && latestPhysio.fatigue > 7 ? 'red' : 'green'}
            />
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução de força */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Evolução de Força</h3>
          <LineChart
            data={strengthProgressData}
            lines={strengthLines}
            xAxisKey="label"
            yAxisFormatter={(v: number) => `${v}kg`}
            tooltipFormatter={(v: number, name: string) => [`${v} kg`, name]}
            height={250}
          />
        </div>

        {/* Cardio semanal */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Cardio Semanal</h3>
          <BarChart
            data={cardioData}
            bars={[
              { key: 'minutes', name: 'Minutos' },
            ]}
            xAxisKey="week"
            yAxisFormatter={(v: number) => `${v}min`}
            tooltipFormatter={(v: number) => [`${v} min`, 'Duração']}
            height={250}
            colors={['#f59e0b']}
          />
        </div>

        {/* Recuperação fisiológica */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Recuperação (7 dias)</h3>
          <LineChart
            data={recoveryData}
            lines={[
              { key: 'score', name: 'Recovery Score', color: '#22c55e' },
            ]}
            xAxisKey="label"
            yAxisFormatter={(v: number) => `${v}`}
            tooltipFormatter={(v: number) => [`${v}`, 'Score']}
            height={250}
          />
        </div>

        {/* Distribuição por grupo muscular */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Volume por Grupo Muscular</h3>
          <RadarChart
            data={muscleRadarData}
            dataKey="value"
            name="Volume"
            color="#3b82f6"
            height={250}
          />
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Heart,
  TrendingUp,
  Dumbbell,
  Moon,
  Zap,
  User,
  AlertTriangle,
  ShieldCheck,
  Target,
  Gauge,
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { RecoveryScoreRing } from '@/components/RecoveryScoreRing';
import { LineChart, BarChart, RadarChart } from '@/components/charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type {
  WorkoutSession,
  CardioSession,
  PhysiologicalData,
  RecoveryScore,
  CardioType,
  HeartRateZone,
  WeekDay,
} from '@/types';
import {
  calculateWorkoutVolume,
  calculateExerciseProgress,
  calculateExerciseVolume,
  formatDuration,
  calculateRecoveryScore,
} from '@/lib/calculations';
import { MUSCLE_GROUPS } from '@/data/exercises';
import { format, subDays, startOfWeek, isSameWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseLocalDate, formatLocalDate } from '@/lib/date';

interface DashboardProps {
  workouts: WorkoutSession[];
  cardio: CardioSession[];
  physio: PhysiologicalData[];
  recoveryScores: RecoveryScore[];
  selectedUserId?: string | null;
  selectedUserLabel?: string | null;
}

type DbWorkoutRow = {
  id: string;
  user_id: string;
  session_date: string;
  weekday: number | null;
  total_volume: number | null;
  exercises: any[] | null;
  created_at: string | null;
};

type DbCardioRow = {
  id: string;
  user_id: string;
  session_date: string;
  weekday: number | null;
  data: any | null;
  created_at: string | null;
};

type DbPhysioRow = {
  id: string;
  user_id: string;
  entry_date: string;
  data: any;
  created_at: string | null;
};

type ExecutiveSummary = {
  overallStatus: 'Bom' | 'Atenção' | 'Recuperação baixa';
  overallToneClass: string;
  focusToday: string;
  positiveHighlight: string;
  mainAttention: string;
};

function safeNumber(v: any): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

function weekdayNumberToLabel(weekday?: number | null): WeekDay {
  const map: Record<number, WeekDay> = {
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado',
    7: 'Domingo',
  };
  return map[weekday ?? 1] ?? 'Segunda';
}

function average(values: Array<number | undefined>) {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length === 0) return undefined;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function getDeltaLabel(current?: number, baseline?: number, suffix = '') {
  if (current === undefined || baseline === undefined) return 'Sem base suficiente';
  const delta = current - baseline;
  if (Math.abs(delta) < 0.05) return `Estável${suffix}`;
  const signal = delta > 0 ? '+' : '';
  return `${signal}${delta.toFixed(1)}${suffix}`;
}

export function Dashboard({
  workouts,
  cardio,
  physio,
  recoveryScores,
  selectedUserId,
  selectedUserLabel,
}: DashboardProps) {
  const { user } = useAuth();

  const effectiveUserId = selectedUserId || user?.id || null;
  const isStudentMode = !!selectedUserId;

  const [dbWorkouts, setDbWorkouts] = useState<WorkoutSession[]>([]);
  const [dbCardio, setDbCardio] = useState<CardioSession[]>([]);
  const [dbPhysio, setDbPhysio] = useState<PhysiologicalData[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!effectiveUserId) return;

      if (!isStudentMode) {
        setDbWorkouts([]);
        setDbCardio([]);
        setDbPhysio([]);
        return;
      }

      setDashboardLoading(true);

      try {
        const [workoutsResult, cardioResult, physioResult] = await Promise.all([
          supabase
            .from('workout_sessions')
            .select('id,user_id,session_date,weekday,total_volume,exercises,created_at')
            .eq('user_id', effectiveUserId)
            .order('session_date', { ascending: true }),

          supabase
            .from('cardio_sessions')
            .select('id,user_id,session_date,weekday,data,created_at')
            .eq('user_id', effectiveUserId)
            .order('session_date', { ascending: true }),

          supabase
            .from('physio_entries')
            .select('id,user_id,entry_date,data,created_at')
            .eq('user_id', effectiveUserId)
            .order('entry_date', { ascending: true })
            .order('created_at', { ascending: true }),
        ]);

        if (workoutsResult.error) throw workoutsResult.error;
        if (cardioResult.error) throw cardioResult.error;
        if (physioResult.error) throw physioResult.error;

        const mappedWorkouts: WorkoutSession[] = ((workoutsResult.data ?? []) as DbWorkoutRow[]).map((row) => ({
          id: row.id,
          date: row.session_date,
          weekDay: weekdayNumberToLabel(row.weekday),
          exercises: Array.isArray(row.exercises) ? row.exercises : [],
          totalVolume: safeNumber(row.total_volume) ?? 0,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          duration: undefined,
        }));

        const mappedCardio: CardioSession[] = ((cardioResult.data ?? []) as DbCardioRow[]).map((row) => {
          const d = row.data ?? {};
          return {
            id: row.id,
            date: row.session_date,
            type: (d.type ?? 'Esteira') as CardioType,
            duration: safeNumber(d.duration) ?? 0,
            distance: safeNumber(d.distance),
            avgSpeed: safeNumber(d.avgSpeed),
            avgHeartRate: safeNumber(d.avgHeartRate),
            maxHeartRate: safeNumber(d.maxHeartRate),
            calories: safeNumber(d.calories),
            steps: safeNumber(d.steps),
            heartRateZone: (d.heartRateZone ?? 'Zona 2') as HeartRateZone,
            notes: d.notes ?? undefined,
          };
        });

        const mappedPhysio: PhysiologicalData[] = ((physioResult.data ?? []) as DbPhysioRow[]).map((row) => {
          const d = row.data ?? {};
          return {
            id: row.id,
            date: row.entry_date,
            weight: safeNumber(d.weight),
            restingHeartRate: safeNumber(d.restingHeartRate),
            sleepHeartRate: safeNumber(d.sleepHeartRate),
            sleepTotal: d.sleepTotal ?? '00:00',
            sleepTotalHours: safeNumber(d.sleepTotalHours) ?? 0,
            sleepREM: safeNumber(d.sleepREM),
            sleepLight: safeNumber(d.sleepLight),
            sleepDeep: safeNumber(d.sleepDeep),
            awakeTime: safeNumber(d.awakeTime),
            spo2: safeNumber(d.spo2),
            respiratoryRate: safeNumber(d.respiratoryRate),
            fatigue: safeNumber(d.fatigue) ?? 5,
            notes: d.notes ?? undefined,
          };
        });

        setDbWorkouts(mappedWorkouts);
        setDbCardio(mappedCardio);
        setDbPhysio(mappedPhysio);
      } catch (e: any) {
        toast.error(e?.message ?? 'Erro ao carregar dashboard do aluno.');
        setDbWorkouts([]);
        setDbCardio([]);
        setDbPhysio([]);
      } finally {
        setDashboardLoading(false);
      }
    };

    void loadDashboardData();
  }, [effectiveUserId, isStudentMode]);

  const effectiveWorkouts = isStudentMode ? dbWorkouts : workouts;
  const effectiveCardio = isStudentMode ? dbCardio : cardio;
  const effectivePhysio = isStudentMode ? dbPhysio : physio;

  const effectiveRecoveryScores = useMemo(() => {
    if (isStudentMode) {
      return effectivePhysio.map((p) => calculateRecoveryScore(p));
    }
    return recoveryScores;
  }, [isStudentMode, effectivePhysio, recoveryScores]);

  const latestPhysio = useMemo(() => {
    return effectivePhysio[effectivePhysio.length - 1];
  }, [effectivePhysio]);

  const latestRecovery = useMemo(() => {
    return effectiveRecoveryScores[effectiveRecoveryScores.length - 1];
  }, [effectiveRecoveryScores]);

  const recentPhysioWindow = useMemo(() => {
    return effectivePhysio.slice(-8, -1);
  }, [effectivePhysio]);

  const avgRecentSleep = useMemo(() => {
    return average(recentPhysioWindow.map((p) => p.sleepTotalHours));
  }, [recentPhysioWindow]);

  const avgRecentFatigue = useMemo(() => {
    return average(recentPhysioWindow.map((p) => p.fatigue));
  }, [recentPhysioWindow]);

  const avgRecentRestingHr = useMemo(() => {
    return average(recentPhysioWindow.map((p) => p.restingHeartRate));
  }, [recentPhysioWindow]);

  const strengthProgressData = useMemo(() => {
    const progress = calculateExerciseProgress(effectiveWorkouts);
    const topExercises = progress.slice(0, 3);
    const dates = [...new Set(effectiveWorkouts.map((w) => w.date))].sort((a, b) => {
      const da = parseLocalDate(a)?.getTime() ?? 0;
      const db = parseLocalDate(b)?.getTime() ?? 0;
      return da - db;
    });

    return dates.map((date) => {
      const point: Record<string, any> = { date, label: formatLocalDate(date, (d) => format(d, 'dd/MM')) };
      topExercises.forEach((ex) => {
        const dayData = ex.history.find((h) => h.date === date);
        point[ex.exerciseName] = dayData?.maxWeight || 0;
      });
      return point;
    });
  }, [effectiveWorkouts]);

  const strengthLines = useMemo(() => {
    const progress = calculateExerciseProgress(effectiveWorkouts);
    return progress.slice(0, 3).map((ex, i) => ({
      key: ex.exerciseName,
      name: ex.exerciseName,
      color: ['#3b82f6', '#22c55e', '#f59e0b'][i],
    }));
  }, [effectiveWorkouts]);

  const topStrengthProgress = useMemo(() => {
    const progress = calculateExerciseProgress(effectiveWorkouts);

    return progress
      .map((ex) => {
        const history = ex.history;
        if (history.length < 2) {
          return {
            exerciseName: ex.exerciseName,
            delta: 0,
            trend: 'estável' as const,
          };
        }

        const last = history[history.length - 1];
        const prev = history[history.length - 2];
        const delta = last.maxWeight - prev.maxWeight;

        return {
          exerciseName: ex.exerciseName,
          delta,
          trend: delta > 0 ? 'subindo' as const : delta < 0 ? 'caindo' as const : 'estável' as const,
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);
  }, [effectiveWorkouts]);

  const cardioData = useMemo(() => {
    const last4Weeks = Array.from({ length: 4 }, (_, i) => {
      const date = subDays(new Date(), i * 7);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      return {
        week: format(weekStart, 'dd/MM'),
        weekStart,
        minutes: 0,
        distance: 0,
      };
    }).reverse();

    effectiveCardio.forEach((session) => {
      const sessionDate = parseLocalDate(session.date);
      if (!sessionDate) return;

      const weekData = last4Weeks.find((w) =>
        isSameWeek(sessionDate, w.weekStart, { weekStartsOn: 1 })
      );

      if (weekData) {
        weekData.minutes += session.duration;
        weekData.distance += session.distance || 0;
      }
    });

    return last4Weeks.map(({ week, minutes, distance }) => ({
      week,
      minutes,
      distance,
    }));
  }, [effectiveCardio]);

  const recoveryData = useMemo(() => {
    return effectiveRecoveryScores.slice(-7).map((r) => ({
      date: r.date,
      label: formatLocalDate(r.date, (d) => format(d, 'dd/MM')),
      score: r.score,
    }));
  }, [effectiveRecoveryScores]);

  const muscleVolumeSummary = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const muscleVolumes: Record<string, number> = {};
    MUSCLE_GROUPS.forEach((mg) => {
      muscleVolumes[mg] = 0;
    });

    effectiveWorkouts.forEach((workout) => {
      const workoutDate = parseLocalDate(workout.date);
      if (!workoutDate) return;

      if (workoutDate >= oneWeekAgo) {
        workout.exercises.forEach((ex) => {
          const volume = calculateExerciseVolume(ex);
          muscleVolumes[ex.muscleGroup] = (muscleVolumes[ex.muscleGroup] || 0) + volume;
        });
      }
    });

    return muscleVolumes;
  }, [effectiveWorkouts]);

  const muscleRadarData = useMemo(() => {
    const maxVolume = Math.max(...Object.values(muscleVolumeSummary), 1);

    return MUSCLE_GROUPS.map((mg) => ({
      subject: mg,
      value: Math.round(((muscleVolumeSummary[mg] || 0) / maxVolume) * 100),
      fullMark: 100,
    }));
  }, [muscleVolumeSummary]);

  const topMuscleVolume = useMemo(() => {
    return Object.entries(muscleVolumeSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [muscleVolumeSummary]);

  const lowMuscleVolume = useMemo(() => {
    return Object.entries(muscleVolumeSummary)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);
  }, [muscleVolumeSummary]);

  const weeklyWorkouts = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return effectiveWorkouts.filter((w) => {
      const workoutDate = parseLocalDate(w.date);
      return workoutDate ? workoutDate >= weekStart : false;
    }).length;
  }, [effectiveWorkouts]);

  const weeklyVolume = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return effectiveWorkouts
      .filter((w) => {
        const workoutDate = parseLocalDate(w.date);
        return workoutDate ? workoutDate >= weekStart : false;
      })
      .reduce((total, w) => total + calculateWorkoutVolume(w), 0);
  }, [effectiveWorkouts]);

  const weeklyCardioMinutes = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return effectiveCardio
      .filter((c) => {
        const cardioDate = parseLocalDate(c.date);
        return cardioDate ? cardioDate >= weekStart : false;
      })
      .reduce((total, c) => total + c.duration, 0);
  }, [effectiveCardio]);

  const weeklyCardioDistance = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return effectiveCardio
      .filter((c) => {
        const cardioDate = parseLocalDate(c.date);
        return cardioDate ? cardioDate >= weekStart : false;
      })
      .reduce((total, c) => total + (c.distance || 0), 0);
  }, [effectiveCardio]);

  const priorityAlerts = useMemo(() => {
    const alerts: string[] = [];

    if (latestRecovery && latestRecovery.score < 60) {
      alerts.push('Recovery Score baixo para o momento atual.');
    }

    if (latestPhysio?.sleepTotalHours !== undefined && latestPhysio.sleepTotalHours < 6) {
      alerts.push('Sono abaixo de 6 horas no registro mais recente.');
    }

    if (latestPhysio?.fatigue !== undefined && latestPhysio.fatigue >= 8) {
      alerts.push('Cansaço alto no registro mais recente.');
    }

    if (
      latestPhysio?.restingHeartRate !== undefined &&
      avgRecentRestingHr !== undefined &&
      latestPhysio.restingHeartRate >= avgRecentRestingHr + 5
    ) {
      alerts.push('FC de repouso acima da média recente.');
    }

    if (weeklyWorkouts === 0) {
      alerts.push('Nenhum treino registrado nesta semana.');
    }

    if (weeklyCardioMinutes < 60) {
      alerts.push('Cardio semanal ainda baixo.');
    }

    return alerts;
  }, [latestRecovery, latestPhysio, avgRecentRestingHr, weeklyWorkouts, weeklyCardioMinutes]);

  const positiveHighlights = useMemo(() => {
    const positives: string[] = [];

    if (latestRecovery && latestRecovery.score >= 80) {
      positives.push('Recuperação atual está boa.');
    }

    if (weeklyWorkouts >= 3) {
      positives.push('Boa consistência de treinos na semana.');
    }

    if (weeklyCardioMinutes >= 90) {
      positives.push('Cardio semanal consistente.');
    }

    if (topStrengthProgress.some((item) => item.delta > 0)) {
      positives.push('Há exercícios com força em evolução recente.');
    }

    return positives;
  }, [latestRecovery, weeklyWorkouts, weeklyCardioMinutes, topStrengthProgress]);

  const executiveSummary = useMemo<ExecutiveSummary>(() => {
    let overallStatus: ExecutiveSummary['overallStatus'] = 'Bom';
    let overallToneClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
    let focusToday = 'Treino normal, mantendo boa técnica e consistência.';
    const positiveHighlight = positiveHighlights[0] || 'Base de acompanhamento montada.';
    const mainAttention = priorityAlerts[0] || 'Sem alertas prioritários no momento.';

    if (
      (latestRecovery && latestRecovery.score < 60) ||
      (latestPhysio?.fatigue !== undefined && latestPhysio.fatigue >= 8)
    ) {
      overallStatus = 'Recuperação baixa';
      overallToneClass = 'bg-red-500/10 border-red-500/30 text-red-300';
      focusToday = 'Priorizar recuperação, técnica e controle de carga.';
    } else if (
      priorityAlerts.length > 0 ||
      (latestPhysio?.sleepTotalHours !== undefined && latestPhysio.sleepTotalHours < 7)
    ) {
      overallStatus = 'Atenção';
      overallToneClass = 'bg-amber-500/10 border-amber-500/30 text-amber-300';
      focusToday = 'Treinar com atenção e ajustar carga conforme resposta do corpo.';
    }

    return {
      overallStatus,
      overallToneClass,
      focusToday,
      positiveHighlight,
      mainAttention,
    };
  }, [latestRecovery, latestPhysio, priorityAlerts, positiveHighlights]);

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>

          {isStudentMode && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              <User className="h-4 w-4" />
              <span>
                Visualizando dados de: <strong>{selectedUserLabel || 'Aluno selecionado'}</strong>
              </span>
            </div>
          )}

          {isStudentMode && dashboardLoading && (
            <p className="mt-2 text-sm text-muted-foreground">Carregando dados do aluno...</p>
          )}
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Target className="h-5 w-5 text-primary" />
            Resumo Executivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`rounded-xl border px-4 py-3 ${executiveSummary.overallToneClass}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-current text-current">
                Status geral: {executiveSummary.overallStatus}
              </Badge>
            </div>
            <p className="mt-2 text-sm">{executiveSummary.focusToday}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="font-medium">Ponto positivo</span>
              </div>
              <p className="text-sm text-muted-foreground">{executiveSummary.positiveHighlight}</p>
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-white">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="font-medium">Principal atenção</span>
              </div>
              <p className="text-sm text-muted-foreground">{executiveSummary.mainAttention}</p>
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-white">
                <Gauge className="h-4 w-4 text-blue-400" />
                <span className="font-medium">Foco do dia</span>
              </div>
              <p className="text-sm text-muted-foreground">{executiveSummary.focusToday}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Alertas prioritários
            </CardTitle>
          </CardHeader>
          <CardContent>
            {priorityAlerts.length > 0 ? (
              <div className="space-y-2">
                {priorityAlerts.map((alert, index) => (
                  <div key={index} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    {alert}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                Sem alertas prioritários relevantes no momento.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Tendências úteis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Sono vs. média recente</p>
                <p className="mt-1 font-medium text-white">
                  {getDeltaLabel(latestPhysio?.sleepTotalHours, avgRecentSleep, ' h')}
                </p>
              </div>

              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Fadiga vs. média recente</p>
                <p className="mt-1 font-medium text-white">
                  {getDeltaLabel(latestPhysio?.fatigue, avgRecentFatigue)}
                </p>
              </div>

              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">FC repouso vs. média recente</p>
                <p className="mt-1 font-medium text-white">
                  {getDeltaLabel(latestPhysio?.restingHeartRate, avgRecentRestingHr, ' bpm')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {latestRecovery && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6 lg:col-span-1">
            <h3 className="mb-4 text-lg font-semibold text-white">Recovery Score</h3>
            <div className="flex justify-center">
              <RecoveryScoreRing score={latestRecovery.score} size={140} />
            </div>

            <div className="mt-4 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
              {latestRecovery.score >= 80
                ? 'Boa recuperação para manter treino normal.'
                : latestRecovery.score >= 60
                  ? 'Recuperação moderada. Ajuste a carga se necessário.'
                  : 'Recuperação baixa. Atenção à intensidade e ao descanso.'}
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sono</span>
                <span className="text-white">{latestRecovery.sleepContribution}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${latestRecovery.sleepContribution}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">FC Repouso</span>
                <span className="text-white">{latestRecovery.hrContribution}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-green-500 transition-all"
                  style={{ width: `${latestRecovery.hrContribution}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cansaço</span>
                <span className="text-white">{latestRecovery.fatigueContribution}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-orange-500 transition-all"
                  style={{ width: `${latestRecovery.fatigueContribution}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:col-span-2">
            <StatCard
              title="Treinos esta semana"
              value={weeklyWorkouts}
              unit="treinos"
              icon={<Dumbbell className="h-5 w-5" />}
              variant="blue"
            />
            <StatCard
              title="Volume semanal"
              value={(weeklyVolume / 1000).toFixed(1)}
              unit="ton"
              icon={<TrendingUp className="h-5 w-5" />}
              variant="green"
            />
            <StatCard
              title="Cardio semanal"
              value={formatDuration(weeklyCardioMinutes)}
              icon={<Heart className="h-5 w-5" />}
              variant="orange"
            />
            <StatCard
              title="Distância cardio"
              value={weeklyCardioDistance.toFixed(1)}
              unit="km"
              icon={<TrendingUp className="h-5 w-5" />}
              variant="blue"
            />
            <StatCard
              title="FC Repouso"
              value={latestPhysio?.restingHeartRate || '--'}
              unit="bpm"
              icon={<Activity className="h-5 w-5" />}
              variant="purple"
            />
            <StatCard
              title="Sono"
              value={latestPhysio?.sleepTotalHours?.toFixed(1) || '--'}
              unit="h"
              icon={<Moon className="h-5 w-5" />}
              variant="blue"
            />
            <StatCard
              title="Cansaço"
              value={latestPhysio?.fatigue || '--'}
              unit="/10"
              icon={<Zap className="h-5 w-5" />}
              variant={latestPhysio && latestPhysio.fatigue > 7 ? 'red' : 'green'}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-lg font-semibold text-white">Evolução de Força</h3>
          <LineChart
            data={strengthProgressData}
            lines={strengthLines}
            xAxisKey="label"
            yAxisFormatter={(v: number) => `${v}kg`}
            tooltipFormatter={(v: number, name: string) => [`${v} kg`, name]}
            height={250}
          />

          <div className="mt-4 grid grid-cols-1 gap-2">
            {topStrengthProgress.length > 0 ? (
              topStrengthProgress.map((item, index) => (
                <div key={`${item.exerciseName}-${index}`} className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-white">{item.exerciseName}</span>
                  <span className="ml-2 text-muted-foreground">
                    {item.trend === 'subindo'
                      ? `subindo (+${item.delta.toFixed(1)} kg)`
                      : item.trend === 'caindo'
                        ? `caindo (${item.delta.toFixed(1)} kg)`
                        : 'estável'}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Sem dados suficientes para analisar tendência de força.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-lg font-semibold text-white">Cardio Semanal</h3>
          <BarChart
            data={cardioData}
            bars={[{ key: 'minutes', name: 'Minutos' }]}
            xAxisKey="week"
            yAxisFormatter={(v: number) => `${v}min`}
            tooltipFormatter={(v: number) => [`${v} min`, 'Duração']}
            height={250}
            colors={['#f59e0b']}
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Minutos na semana</p>
              <p className="mt-1 font-medium text-white">{weeklyCardioMinutes} min</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Distância na semana</p>
              <p className="mt-1 font-medium text-white">{weeklyCardioDistance.toFixed(1)} km</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-lg font-semibold text-white">Recuperação (7 dias)</h3>
          <LineChart
            data={recoveryData}
            lines={[{ key: 'score', name: 'Recovery Score', color: '#22c55e' }]}
            xAxisKey="label"
            yAxisFormatter={(v: number) => `${v}`}
            tooltipFormatter={(v: number) => [`${v}`, 'Score']}
            height={250}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-lg font-semibold text-white">Volume por Grupo Muscular</h3>
          <RadarChart
            data={muscleRadarData}
            dataKey="value"
            name="Volume"
            color="#3b82f6"
            height={250}
          />

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="mb-2 text-xs text-muted-foreground">Maior volume recente</p>
              <div className="space-y-1">
                {topMuscleVolume.map(([muscle, volume]) => (
                  <div key={muscle} className="text-sm text-white">
                    {muscle}: <span className="text-muted-foreground">{Math.round(volume)} kg</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-muted/30 p-3">
              <p className="mb-2 text-xs text-muted-foreground">Menor estímulo recente</p>
              <div className="space-y-1">
                {lowMuscleVolume.map(([muscle, volume]) => (
                  <div key={muscle} className="text-sm text-white">
                    {muscle}: <span className="text-muted-foreground">{Math.round(volume)} kg</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

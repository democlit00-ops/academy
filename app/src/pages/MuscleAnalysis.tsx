import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Target, TrendingUp, User, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadarChart, BarChart, PieChart } from '@/components/charts';
import type { WorkoutSession, WeekDay, MuscleGroup } from '@/types';
import { MUSCLE_GROUPS } from '@/data/exercises';
import { calculateExerciseVolume, formatWeight, formatDurationSeconds } from '@/lib/calculations';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseLocalDate } from '@/lib/date';

interface MuscleAnalysisProps {
  workouts: WorkoutSession[];
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

type MuscleVolumeEntry = {
  muscleGroup: string;
  weeklyVolume: number;
  monthlyVolume: number;
  exerciseCount: number;
};

function safeNumber(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
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

function normalizeMuscleGroup(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase();

  const map: Record<string, MuscleGroup> = {
    peito: 'Peito',
    costas: 'Costas',
    ombros: 'Ombros',
    ombro: 'Ombros',
    bíceps: 'Bíceps',
    biceps: 'Bíceps',
    tríceps: 'Tríceps',
    triceps: 'Tríceps',
    pernas: 'Pernas',
    glúteos: 'Glúteos',
    gluteos: 'Glúteos',
    posterior: 'Posterior',
    posteriores: 'Posterior',
    core: 'Core',
    cardio: 'Cardio',
    mobilidade: 'Mobilidade',
    cervical: 'Mobilidade',
    panturrilhas: 'Pernas',
    adutores: 'Pernas',
  };

  return map[raw] ?? '';
}

function getMuscleStatus(volume: number, maxWeeklyVolume: number) {
  if (volume <= 0) {
    return {
      label: 'Sem estímulo',
      className: 'bg-muted text-muted-foreground',
    };
  }

  const ratio = maxWeeklyVolume > 0 ? volume / maxWeeklyVolume : 0;

  if (ratio >= 0.7) {
    return {
      label: 'Alto',
      className: 'bg-emerald-500/20 text-emerald-400',
    };
  }

  if (ratio >= 0.35) {
    return {
      label: 'Moderado',
      className: 'bg-blue-500/20 text-blue-400',
    };
  }

  return {
    label: 'Baixo',
    className: 'bg-orange-500/20 text-orange-400',
  };
}

export function MuscleAnalysis({
  workouts,
  selectedUserId,
  selectedUserLabel,
}: MuscleAnalysisProps) {
  const { user } = useAuth();

  const effectiveUserId = selectedUserId || user?.id || null;
  const isStudentMode = !!selectedUserId;

  const [dbWorkouts, setDbWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadStudentWorkouts = async () => {
      if (!effectiveUserId) return;

      if (!isStudentMode) {
        setDbWorkouts([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('workout_sessions')
          .select('id,user_id,session_date,weekday,total_volume,exercises,created_at')
          .eq('user_id', effectiveUserId)
          .order('session_date', { ascending: true });

        if (error) throw error;

        const mapped: WorkoutSession[] = ((data ?? []) as DbWorkoutRow[]).map((row) => ({
          id: row.id,
          date: row.session_date,
          weekDay: weekdayNumberToLabel(row.weekday),
          exercises: Array.isArray(row.exercises) ? row.exercises : [],
          totalVolume: safeNumber(row.total_volume),
          duration: undefined,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        }));

        setDbWorkouts(mapped);
      } catch (e: any) {
        toast.error(e?.message ?? 'Erro ao carregar análise muscular do aluno.');
        setDbWorkouts([]);
      } finally {
        setLoading(false);
      }
    };

    void loadStudentWorkouts();
  }, [effectiveUserId, isStudentMode]);

  const effectiveWorkouts = isStudentMode ? dbWorkouts : workouts;

  const muscleData = useMemo<MuscleVolumeEntry[]>(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const muscleVolumes: Record<string, { weekly: number; monthly: number; count: number }> = {};

    MUSCLE_GROUPS.forEach((mg) => {
      muscleVolumes[mg] = { weekly: 0, monthly: 0, count: 0 };
    });

    effectiveWorkouts.forEach((workout) => {
      const workoutDate = parseLocalDate(workout.date);
      if (!workoutDate) return;

      workout.exercises.forEach((ex) => {
        const normalizedGroup = normalizeMuscleGroup(ex?.muscleGroup);
        if (!normalizedGroup || !muscleVolumes[normalizedGroup]) return;

        const volume = calculateExerciseVolume(ex);

        if (workoutDate >= oneWeekAgo) {
          muscleVolumes[normalizedGroup].weekly += volume;
        }

        if (workoutDate >= oneMonthAgo) {
          muscleVolumes[normalizedGroup].monthly += volume;
        }

        muscleVolumes[normalizedGroup].count += 1;
      });
    });

    return MUSCLE_GROUPS.map((mg) => ({
      muscleGroup: mg,
      weeklyVolume: muscleVolumes[mg].weekly,
      monthlyVolume: muscleVolumes[mg].monthly,
      exerciseCount: muscleVolumes[mg].count,
    }));
  }, [effectiveWorkouts]);

  const totalWeeklyVolume = useMemo(() => {
    return muscleData.reduce((sum, m) => sum + m.weeklyVolume, 0);
  }, [muscleData]);

  const totalMonthlyVolume = useMemo(() => {
    return muscleData.reduce((sum, m) => sum + m.monthlyVolume, 0);
  }, [muscleData]);

  const maxWeeklyVolume = useMemo(() => {
    return Math.max(...muscleData.map((m) => m.weeklyVolume), 0);
  }, [muscleData]);

  const radarData = useMemo(() => {
    const maxVolume = Math.max(...muscleData.map((m) => m.weeklyVolume), 1);

    return muscleData.map((m) => ({
      subject: m.muscleGroup,
      value: Math.round((m.weeklyVolume / maxVolume) * 100),
      fullMark: 100,
    }));
  }, [muscleData]);

  const barData = useMemo(() => {
    return muscleData
      .map((m) => ({
        name: m.muscleGroup,
        semanal: m.weeklyVolume,
        mensal: m.monthlyVolume,
      }))
      .sort((a, b) => b.semanal - a.semanal);
  }, [muscleData]);

  const pieData = useMemo(() => {
    const colors = [
      '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
      '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
      '#84cc16', '#14b8a6',
    ];

    return muscleData
      .filter((m) => m.weeklyVolume > 0)
      .map((m, i) => ({
        name: m.muscleGroup,
        value: m.weeklyVolume,
        color: colors[i % colors.length],
      }));
  }, [muscleData]);

  const topMuscles = useMemo(() => {
    return [...muscleData]
      .filter((m) => m.weeklyVolume > 0)
      .sort((a, b) => b.weeklyVolume - a.weeklyVolume)
      .slice(0, 3);
  }, [muscleData]);

  const bottomMuscles = useMemo(() => {
    return [...muscleData]
      .filter((m) => m.weeklyVolume > 0)
      .sort((a, b) => a.weeklyVolume - b.weeklyVolume)
      .slice(0, 3);
  }, [muscleData]);

  const inactiveMuscles = useMemo(() => {
    return muscleData.filter((m) => m.weeklyVolume === 0);
  }, [muscleData]);

  const totalExercises = useMemo(() => {
    return muscleData.reduce((sum, m) => sum + m.exerciseCount, 0);
  }, [muscleData]);

  const executiveSummary = useMemo(() => {
    const workedGroups = muscleData.filter((m) => m.weeklyVolume > 0).length;

    let positive = 'Distribuição de treino ainda sem leitura suficiente.';
    let attention = 'Sem alertas relevantes.';
    let focus = 'Manter consistência semanal de estímulo.';
    let statusClass = 'bg-blue-500/10 border-blue-500/30 text-blue-300';
    let statusLabel = 'Leitura inicial';

    if (workedGroups >= 5 && inactiveMuscles.length <= 2) {
      positive = 'Boa cobertura muscular ao longo da semana.';
      statusClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
      statusLabel = 'Boa distribuição';
    }

    if (inactiveMuscles.length >= 4) {
      attention = 'Muitos grupos musculares ficaram sem estímulo recente.';
      focus = 'Rever equilíbrio do treino e distribuir melhor o volume.';
      statusClass = 'bg-amber-500/10 border-amber-500/30 text-amber-300';
      statusLabel = 'Atenção';
    }

    if (topMuscles.length > 0 && bottomMuscles.length > 0) {
      positive =
        workedGroups > 0
          ? `Maior ênfase recente em ${topMuscles[0].muscleGroup}.`
          : positive;

      attention =
        inactiveMuscles.length > 0
          ? `Sem estímulo recente em ${inactiveMuscles.slice(0, 2).map((m) => m.muscleGroup).join(', ')}.`
          : bottomMuscles[0]
            ? `Baixo estímulo relativo em ${bottomMuscles[0].muscleGroup}.`
            : attention;
    }

    return {
      statusLabel,
      statusClass,
      positive,
      attention,
      focus,
    };
  }, [muscleData, topMuscles, bottomMuscles, inactiveMuscles]);

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Análise Muscular</h1>
          <p className="text-muted-foreground">
            {isStudentMode
              ? 'Distribuição de volume por grupo muscular do aluno selecionado'
              : 'Distribuição de volume por grupo muscular'}
          </p>

          {isStudentMode && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              <User className="h-4 w-4" />
              <span>
                Visualizando dados de: <strong>{selectedUserLabel || 'Aluno selecionado'}</strong>
              </span>
            </div>
          )}

          {isStudentMode && loading && (
            <p className="mt-2 text-sm text-muted-foreground">Carregando dados do aluno...</p>
          )}
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Target className="h-5 w-5 text-primary" />
            Resumo da Distribuição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`rounded-xl border px-4 py-3 ${executiveSummary.statusClass}`}>
            <Badge variant="outline" className="border-current text-current">
              {executiveSummary.statusLabel}
            </Badge>
            <p className="mt-2 text-sm">{executiveSummary.focus}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="font-medium">Ponto positivo</span>
              </div>
              <p className="text-sm text-muted-foreground">{executiveSummary.positive}</p>
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-white">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="font-medium">Ponto de atenção</span>
              </div>
              <p className="text-sm text-muted-foreground">{executiveSummary.attention}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <Target className="w-4 h-4" />
              <span className="text-xs">Grupos Trabalhados</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {muscleData.filter((m) => m.weeklyVolume > 0).length}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ {MUSCLE_GROUPS.length}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs">Total de Exercícios</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalExercises}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Volume Semanal</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatWeight(totalWeeklyVolume)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Volume Mensal</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatWeight(totalMonthlyVolume)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Distribuição de Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadarChart
              data={radarData}
              dataKey="value"
              name="Volume Relativo"
              color="#3b82f6"
              height={280}
            />
          </CardContent>
        </Card>

        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Volume por Grupo Muscular
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={barData}
              bars={[
                { key: 'semanal', name: 'Semanal', color: '#3b82f6' },
                { key: 'mensal', name: 'Mensal', color: '#22c55e' },
              ]}
              xAxisKey="name"
              yAxisFormatter={(v: number) => `${v / 1000}k`}
              tooltipFormatter={(v: number) => [`${v.toLocaleString()} kg`, '']}
              height={280}
            />
          </CardContent>
        </Card>
      </div>

      {pieData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Proporção de Volume Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto max-w-md">
              <PieChart
                data={pieData}
                height={300}
                innerRadius={80}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Grupos Mais Trabalhados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topMuscles.length > 0 ? topMuscles.map((muscle, i) => (
                <div key={muscle.muscleGroup} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">
                      {i + 1}
                    </span>
                    <span className="text-white">{muscle.muscleGroup}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-white">
                      {formatWeight(muscle.weeklyVolume)}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({muscle.exerciseCount} exercícios)
                    </span>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground">Sem dados suficientes.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              Grupos a Desenvolver
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bottomMuscles.length > 0 ? bottomMuscles.map((muscle, i) => (
                <div key={muscle.muscleGroup} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-400">
                      {i + 1}
                    </span>
                    <span className="text-white">{muscle.muscleGroup}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-white">
                      {formatWeight(muscle.weeklyVolume)}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({muscle.exerciseCount} exercícios)
                    </span>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground">Sem grupos com estímulo recente para comparar.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base text-white">
            Detalhamento por Grupo Muscular
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Grupo</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Volume Semanal</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Volume Mensal</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Exercícios</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {muscleData.map((muscle) => {
                  const status = getMuscleStatus(muscle.weeklyVolume, maxWeeklyVolume);

                  return (
                    <tr key={muscle.muscleGroup} className="border-b border-border/50">
                      <td className="px-4 py-3 text-white">{muscle.muscleGroup}</td>
                      <td className="px-4 py-3 text-right text-white">
                        {formatWeight(muscle.weeklyVolume)}
                      </td>
                      <td className="px-4 py-3 text-right text-white">
                        {formatWeight(muscle.monthlyVolume)}
                      </td>
                      <td className="px-4 py-3 text-right text-white">
                        {muscle.exerciseCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className={status.className}>
                          {status.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}

                {!loading && muscleData.every((m) => m.weeklyVolume === 0 && m.monthlyVolume === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum treino encontrado para análise
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Carregando análise...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
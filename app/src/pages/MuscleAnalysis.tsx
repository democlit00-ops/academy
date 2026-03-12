import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Target, TrendingUp, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadarChart, BarChart, PieChart } from '@/components/charts';
import type { WorkoutSession, WeekDay } from '@/types';
import { MUSCLE_GROUPS } from '@/data/exercises';
import { calculateExerciseVolume, formatWeight } from '@/lib/calculations';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

  const muscleData = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const muscleVolumes: Record<string, { weekly: number; monthly: number; count: number }> = {};

    MUSCLE_GROUPS.forEach((mg) => {
      muscleVolumes[mg] = { weekly: 0, monthly: 0, count: 0 };
    });

    effectiveWorkouts.forEach((workout) => {
      const workoutDate = new Date(workout.date);

      workout.exercises.forEach((ex) => {
        const volume = calculateExerciseVolume(ex);

        if (workoutDate >= oneWeekAgo) {
          muscleVolumes[ex.muscleGroup].weekly += volume;
        }
        if (workoutDate >= oneMonthAgo) {
          muscleVolumes[ex.muscleGroup].monthly += volume;
        }
        muscleVolumes[ex.muscleGroup].count++;
      });
    });

    return MUSCLE_GROUPS.map((mg) => ({
      muscleGroup: mg,
      weeklyVolume: muscleVolumes[mg].weekly,
      monthlyVolume: muscleVolumes[mg].monthly,
      exerciseCount: muscleVolumes[mg].count,
    }));
  }, [effectiveWorkouts]);

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
    return [...muscleData].sort((a, b) => b.weeklyVolume - a.weeklyVolume).slice(0, 3);
  }, [muscleData]);

  const bottomMuscles = useMemo(() => {
    return [...muscleData].sort((a, b) => a.weeklyVolume - b.weeklyVolume).slice(0, 3);
  }, [muscleData]);

  const totalExercises = useMemo(() => {
    return muscleData.reduce((sum, m) => sum + m.exerciseCount, 0);
  }, [muscleData]);

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
              {formatWeight(muscleData.reduce((sum, m) => sum + m.weeklyVolume, 0))}
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
              {formatWeight(muscleData.reduce((sum, m) => sum + m.monthlyVolume, 0))}
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
              {topMuscles.map((muscle, i) => (
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
              ))}
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
              {bottomMuscles.map((muscle, i) => (
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
              ))}
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
                {muscleData.map((muscle) => (
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
                      {muscle.weeklyVolume > 0 ? (
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}

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
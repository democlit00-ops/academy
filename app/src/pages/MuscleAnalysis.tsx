import { useMemo } from 'react';
import { BarChart3, Target, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadarChart, BarChart, PieChart } from '@/components/charts';
import type { WorkoutSession } from '@/types';
import { MUSCLE_GROUPS } from '@/data/exercises';
import { calculateExerciseVolume, formatWeight } from '@/lib/calculations';

interface MuscleAnalysisProps {
  workouts: WorkoutSession[];
}

export function MuscleAnalysis({ workouts }: MuscleAnalysisProps) {
  // Dados de volume por grupo muscular
  const muscleData = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const muscleVolumes: Record<string, { weekly: number; monthly: number; count: number }> = {};
    
    MUSCLE_GROUPS.forEach(mg => {
      muscleVolumes[mg] = { weekly: 0, monthly: 0, count: 0 };
    });

    workouts.forEach(workout => {
      const workoutDate = new Date(workout.date);
      
      workout.exercises.forEach(ex => {
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

    return MUSCLE_GROUPS.map(mg => ({
      muscleGroup: mg,
      weeklyVolume: muscleVolumes[mg].weekly,
      monthlyVolume: muscleVolumes[mg].monthly,
      exerciseCount: muscleVolumes[mg].count,
    }));
  }, [workouts]);

  // Dados para o radar
  const radarData = useMemo(() => {
    const maxVolume = Math.max(...muscleData.map(m => m.weeklyVolume), 1);
    
    return muscleData.map(m => ({
      subject: m.muscleGroup,
      value: Math.round((m.weeklyVolume / maxVolume) * 100),
      fullMark: 100,
    }));
  }, [muscleData]);

  // Dados para o gráfico de barras
  const barData = useMemo(() => {
    return muscleData
      .map(m => ({
        name: m.muscleGroup,
        semanal: m.weeklyVolume,
        mensal: m.monthlyVolume,
      }))
      .sort((a, b) => b.semanal - a.semanal);
  }, [muscleData]);

  // Dados para o gráfico de pizza
  const pieData = useMemo(() => {
    const colors = [
      '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', 
      '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
      '#84cc16', '#14b8a6'
    ];
    
    return muscleData
      .filter(m => m.weeklyVolume > 0)
      .map((m, i) => ({
        name: m.muscleGroup,
        value: m.weeklyVolume,
        color: colors[i % colors.length],
      }));
  }, [muscleData]);

  // Grupos mais trabalhados
  const topMuscles = useMemo(() => {
    return [...muscleData]
      .sort((a, b) => b.weeklyVolume - a.weeklyVolume)
      .slice(0, 3);
  }, [muscleData]);

  // Grupos menos trabalhados
  const bottomMuscles = useMemo(() => {
    return [...muscleData]
      .sort((a, b) => a.weeklyVolume - b.weeklyVolume)
      .slice(0, 3);
  }, [muscleData]);

  // Total de exercícios por grupo
  const totalExercises = useMemo(() => {
    return muscleData.reduce((sum, m) => sum + m.exerciseCount, 0);
  }, [muscleData]);

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Análise Muscular</h1>
          <p className="text-muted-foreground">Distribuição de volume por grupo muscular</p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs">Grupos Trabalhados</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {muscleData.filter(m => m.weeklyVolume > 0).length}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ {MUSCLE_GROUPS.length}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs">Total de Exercícios</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalExercises}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
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
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Volume Mensal</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatWeight(muscleData.reduce((sum, m) => sum + m.monthlyVolume, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white text-base">
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

        {/* Barras */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-base">
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

      {/* Distribuição em pizza */}
      {pieData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white text-base">
              Proporção de Volume Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md mx-auto">
              <PieChart
                data={pieData}
                height={300}
                innerRadius={80}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Análise de destaque */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mais trabalhados */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Grupos Mais Trabalhados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topMuscles.map((muscle, i) => (
                <div key={muscle.muscleGroup} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="text-white">{muscle.muscleGroup}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-medium">
                      {formatWeight(muscle.weeklyVolume)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({muscle.exerciseCount} exercícios)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Menos trabalhados */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              Grupos a Desenvolver
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bottomMuscles.map((muscle, i) => (
                <div key={muscle.muscleGroup} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="text-white">{muscle.muscleGroup}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-medium">
                      {formatWeight(muscle.weeklyVolume)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({muscle.exerciseCount} exercícios)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela detalhada */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base">
            Detalhamento por Grupo Muscular
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Grupo</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Volume Semanal</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Volume Mensal</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Exercícios</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {muscleData.map((muscle) => (
                  <tr key={muscle.muscleGroup} className="border-b border-border/50">
                    <td className="py-3 px-4 text-white">{muscle.muscleGroup}</td>
                    <td className="py-3 px-4 text-right text-white">
                      {formatWeight(muscle.weeklyVolume)}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      {formatWeight(muscle.monthlyVolume)}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      {muscle.exerciseCount}
                    </td>
                    <td className="py-3 px-4 text-center">
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
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

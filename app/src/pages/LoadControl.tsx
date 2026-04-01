import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LineChart, BarChart } from '@/components/charts';
import type { WorkoutSession, LoadProgressionStatus, WeekDay } from '@/types';
import {
  calculateExerciseProgress,
  determineLoadProgression,
  formatWeight
} from '@/lib/calculations';
import { format, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseLocalDate, formatLocalDate } from '@/lib/date';

interface LoadControlProps {
  workouts: WorkoutSession[];
  selectedUserId?: string | null;
  selectedUserLabel?: string | null;
}

interface LoadAnalysisItem {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  status: LoadProgressionStatus;
  lastRPE: number;
  suggestion: string;
  lastMaxWeight: number;
  weightDiff: number;
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

export function LoadControl({
  workouts,
  selectedUserId,
  selectedUserLabel,
}: LoadControlProps) {
  const { user } = useAuth();

  const effectiveUserId = selectedUserId || user?.id || null;
  const isStudentMode = !!selectedUserId;

  const [selectedExercise, setSelectedExercise] = useState<string>('all');
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
        toast.error(e?.message ?? 'Erro ao carregar cargas do aluno.');
        setDbWorkouts([]);
      } finally {
        setLoading(false);
      }
    };

    void loadStudentWorkouts();
  }, [effectiveUserId, isStudentMode]);

  const effectiveWorkouts = isStudentMode ? dbWorkouts : workouts;

  const exerciseProgress = useMemo(() => {
    return calculateExerciseProgress(effectiveWorkouts);
  }, [effectiveWorkouts]);

  const filteredProgress = useMemo(() => {
    if (selectedExercise === 'all') return exerciseProgress;
    return exerciseProgress.filter((p) => p.exerciseId === selectedExercise);
  }, [exerciseProgress, selectedExercise]);

  const progressChartData = useMemo(() => {
    if (filteredProgress.length === 0) return [];

    const exercise = filteredProgress[0];
    return exercise.history.map((h) => ({
      date: h.date,
      label: formatLocalDate(h.date, (d) => format(d, 'dd/MM')),
      maxWeight: h.maxWeight,
      volume: h.totalVolume,
      avgWeight: h.avgWeight,
    }));
  }, [filteredProgress]);

  const loadAnalysis = useMemo((): LoadAnalysisItem[] => {
    return exerciseProgress.map((progress) => {
      const history = progress.history;

      if (history.length < 2) {
        return {
          exerciseId: progress.exerciseId,
          exerciseName: progress.exerciseName,
          muscleGroup: progress.muscleGroup,
          status: 'Manter carga' as LoadProgressionStatus,
          lastRPE: 7,
          suggestion: 'Manter carga',
          lastMaxWeight: history[history.length - 1]?.maxWeight || 0,
          weightDiff: 0,
        };
      }

      const lastSession = history[history.length - 1];
      const prevSession = history[history.length - 2];
      const weightDiff = lastSession.maxWeight - prevSession.maxWeight;

      const simulatedRPE = lastSession.maxWeight > prevSession.maxWeight ? 8 : 6;
      const status = determineLoadProgression(simulatedRPE, 0);

      let suggestion = '';
      if (status === 'Subir carga') {
        suggestion = 'Subir carga na próxima sessão';
      } else if (status === 'Manter carga') {
        suggestion = 'Manter carga atual';
      } else {
        suggestion = 'Reduzir carga na próxima sessão';
      }

      return {
        exerciseId: progress.exerciseId,
        exerciseName: progress.exerciseName,
        muscleGroup: progress.muscleGroup,
        status,
        lastRPE: simulatedRPE,
        suggestion,
        lastMaxWeight: lastSession.maxWeight,
        weightDiff,
      };
    });
  }, [exerciseProgress]);

  const volumeData = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);

    return exerciseProgress
      .map((ex) => {
        const recentVolume = ex.history
          .filter((h) => {
            const historyDate = parseLocalDate(h.date);
            return historyDate ? historyDate >= thirtyDaysAgo : false;
          })
          .reduce((sum, h) => sum + h.totalVolume, 0);

        return {
          name: ex.exerciseName,
          volume: recentVolume,
          muscleGroup: ex.muscleGroup,
        };
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
  }, [exerciseProgress]);

  const getStatusIcon = (status: LoadProgressionStatus) => {
    switch (status) {
      case 'Subir carga':
        return <ArrowUp className="w-4 h-4" />;
      case 'Reduzir carga':
        return <ArrowDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: LoadProgressionStatus) => {
    const colors = {
      'Subir carga': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      'Manter carga': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Reduzir carga': 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
      <Badge variant="outline" className={colors[status]}>
        <span className="flex items-center gap-1">
          {getStatusIcon(status)}
          {status}
        </span>
      </Badge>
    );
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Controle de Cargas</h1>
          <p className="text-muted-foreground">
            {isStudentMode
              ? 'Acompanhe a progressão de força do aluno selecionado'
              : 'Acompanhe sua progressão de força'}
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
        <CardContent className="pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecionar Exercício</label>
            <Select value={selectedExercise} onValueChange={setSelectedExercise}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Todos os exercícios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os exercícios</SelectItem>
                {exerciseProgress.map((ex) => (
                  <SelectItem key={ex.exerciseId} value={ex.exerciseId}>
                    {ex.exerciseName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white text-base">
              Evolução de Carga
            </CardTitle>
          </CardHeader>
          <CardContent>
            {progressChartData.length > 0 ? (
              <LineChart
                data={progressChartData}
                lines={[
                  { key: 'maxWeight', name: 'Carga Máxima', color: '#3b82f6' },
                  { key: 'avgWeight', name: 'Carga Média', color: '#22c55e' },
                ]}
                xAxisKey="label"
                yAxisFormatter={(v: number) => `${v}kg`}
                tooltipFormatter={(v: number) => [`${v} kg`, '']}
                height={250}
              />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Selecione um exercício para ver a evolução
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white text-base">
              Volume Total (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={volumeData}
              bars={[{ key: 'volume', name: 'Volume' }]}
              xAxisKey="name"
              yAxisFormatter={(v: number) => `${v / 1000}k`}
              tooltipFormatter={(v: number) => [`${v.toLocaleString()} kg`, 'Volume']}
              height={250}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Análise de Progressão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Exercício</TableHead>
                  <TableHead className="text-muted-foreground">Grupo</TableHead>
                  <TableHead className="text-muted-foreground">Carga Atual</TableHead>
                  <TableHead className="text-muted-foreground">Variação</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Recomendação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadAnalysis.map((item) => (
                  <TableRow key={item.exerciseId} className="border-border">
                    <TableCell className="font-medium text-white">
                      {item.exerciseName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.muscleGroup}
                    </TableCell>
                    <TableCell className="text-white">
                      {formatWeight(item.lastMaxWeight)}
                    </TableCell>
                    <TableCell>
                      {item.weightDiff > 0 ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          +{formatWeight(item.weightDiff)}
                        </span>
                      ) : item.weightDiff < 0 ? (
                        <span className="text-red-400 flex items-center gap-1">
                          <TrendingDown className="w-4 h-4" />
                          {formatWeight(item.weightDiff)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.suggestion}
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && loadAnalysis.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum treino encontrado para análise
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Carregando análise...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
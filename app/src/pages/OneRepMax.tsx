import { useEffect, useMemo, useState } from 'react';
import { Calculator, TrendingUp, Info, Share2, Trophy, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { WorkoutSession, WeekDay } from '@/types';
import { EXERCISE_DEFINITIONS } from '@/data/exercises';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface OneRepMaxProps {
  workouts: WorkoutSession[];
  selectedUserId?: string | null;
  selectedUserLabel?: string | null;
}

// Fórmulas de 1RM
const formulas = {
  epley: (weight: number, reps: number) => weight * (1 + reps / 30),
  brzycki: (weight: number, reps: number) => weight / (1.0278 - 0.0278 * reps),
  lombardi: (weight: number, reps: number) => weight * Math.pow(reps, 0.10),
  mayhew: (weight: number, reps: number) => weight * 100 / (52.2 + 41.9 * Math.exp(-0.055 * reps)),
  oconner: (weight: number, reps: number) => weight * (1 + reps / 40),
};

type FormulaKey = keyof typeof formulas;

interface FormulaInfo {
  key: FormulaKey;
  name: string;
  description: string;
  bestFor: string;
}

const formulaInfo: FormulaInfo[] = [
  { key: 'epley', name: 'Epley', description: 'A mais popular e simples', bestFor: '1-10 repetições' },
  { key: 'brzycki', name: 'Brzycki', description: 'Mais conservadora', bestFor: '1-10 repetições' },
  { key: 'lombardi', name: 'Lombardi', description: 'Mais otimista', bestFor: '1-10 repetições' },
  { key: 'mayhew', name: 'Mayhew', description: 'Para levantadores avançados', bestFor: 'Atletas experientes' },
  { key: 'oconner', name: "O'Conner", description: 'Alternativa conservadora', bestFor: '1-10 repetições' },
];

// Percentuais de 1RM para diferentes repetições
const rmPercentages = [
  { reps: 1, percentage: 100 },
  { reps: 2, percentage: 95 },
  { reps: 3, percentage: 93 },
  { reps: 4, percentage: 90 },
  { reps: 5, percentage: 87 },
  { reps: 6, percentage: 85 },
  { reps: 7, percentage: 83 },
  { reps: 8, percentage: 80 },
  { reps: 9, percentage: 77 },
  { reps: 10, percentage: 75 },
  { reps: 11, percentage: 73 },
  { reps: 12, percentage: 70 },
];

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

export function OneRepMax({
  workouts,
  selectedUserId,
  selectedUserLabel,
}: OneRepMaxProps) {
  const { user } = useAuth();

  const effectiveUserId = selectedUserId || user?.id || null;
  const isStudentMode = !!selectedUserId;

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState(5);
  const [selectedFormula, setSelectedFormula] = useState<FormulaKey>('epley');
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
        toast.error(e?.message ?? 'Erro ao carregar records do aluno.');
        setDbWorkouts([]);
      } finally {
        setLoading(false);
      }
    };

    void loadStudentWorkouts();
  }, [effectiveUserId, isStudentMode]);

  const effectiveWorkouts = isStudentMode ? dbWorkouts : workouts;

  const oneRepMax = useMemo(() => {
    const w = parseFloat(weight);
    if (!w || reps < 1) return 0;
    return formulas[selectedFormula](w, reps);
  }, [weight, reps, selectedFormula]);

  const loadTable = useMemo(() => {
    if (!oneRepMax) return [];
    return rmPercentages.map((r) => ({
      reps: r.reps,
      weight: oneRepMax * (r.percentage / 100),
      percentage: r.percentage,
    }));
  }, [oneRepMax]);

  const personalRecords = useMemo(() => {
    const records: Record<string, { weight: number; reps: number; date: string }> = {};

    effectiveWorkouts.forEach((workout) => {
      workout.exercises.forEach((ex) => {
        ex.sets.forEach((set) => {
          if (!records[ex.exerciseId] || set.weight > records[ex.exerciseId].weight) {
            records[ex.exerciseId] = {
              weight: set.weight,
              reps: set.reps,
              date: workout.date,
            };
          }
        });
      });
    });

    return Object.entries(records)
      .map(([exerciseId, record]) => {
        const exercise = EXERCISE_DEFINITIONS.find((e) => e.id === exerciseId);
        const estimated1RM = formulas.epley(record.weight, record.reps);
        return {
          exerciseId,
          exerciseName: exercise?.name || exerciseId,
          muscleGroup: exercise?.muscleGroup || '',
          ...record,
          estimated1RM,
        };
      })
      .sort((a, b) => b.estimated1RM - a.estimated1RM);
  }, [effectiveWorkouts]);

  const handleShare = async () => {
    const text = `💪 Meu 1RM estimado: ${oneRepMax.toFixed(1)}kg\n📊 ${formulaInfo.find((f) => f.key === selectedFormula)?.name}\n🏋️ ${reps} reps com ${weight}kg`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Resultado copiado!');
    } catch {
      toast.error('Não foi possível copiar o resultado.');
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calculadora 1RM</h1>
          <p className="text-muted-foreground">
            {isStudentMode ? 'Estime a força máxima do aluno selecionado' : 'Estime sua força máxima'}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Calculator className="w-5 h-5 text-primary" />
              Calcular 1RM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Fórmula</Label>
              <Select value={selectedFormula} onValueChange={(v) => setSelectedFormula(v as FormulaKey)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formulaInfo.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      <div className="flex flex-col items-start">
                        <span>{f.name}</span>
                        <span className="text-xs text-muted-foreground">{f.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formulaInfo.find((f) => f.key === selectedFormula)?.bestFor}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Peso Levantado (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.5"
                placeholder="Ex: 80"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-background border-border text-lg"
              />
            </div>

            <div className="space-y-4">
              <Label>Repetições: {reps}</Label>
              <Slider
                value={[reps]}
                onValueChange={([v]) => setReps(v)}
                min={1}
                max={12}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>6</span>
                <span>12</span>
              </div>
            </div>

            {oneRepMax > 0 && (
              <div className="rounded-xl bg-gradient-to-r from-primary/20 to-purple-600/20 p-6 text-center">
                <p className="mb-2 text-sm text-muted-foreground">Seu 1RM Estimado</p>
                <p className="text-5xl font-bold text-white">
                  {oneRepMax.toFixed(1)}
                  <span className="ml-1 text-xl text-muted-foreground">kg</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Baseado em {weight}kg × {reps} reps
                </p>
                <Button onClick={handleShare} variant="outline" className="mt-4 gap-2">
                  <Share2 className="w-4 h-4" />
                  Copiar Resultado
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Tabela de Cargas
            </CardTitle>
            <CardDescription>
              Cargas equivalentes baseadas no seu 1RM
            </CardDescription>
          </CardHeader>
          <CardContent>
            {oneRepMax > 0 ? (
              <div className="space-y-2">
                {loadTable.map((row) => (
                  <div
                    key={row.reps}
                    className={`flex items-center justify-between rounded-lg p-3 ${
                      row.reps === reps ? 'border border-primary/30 bg-primary/20' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {row.reps}
                      </span>
                      <span className="text-muted-foreground">reps</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-white">{row.weight.toFixed(1)} kg</span>
                      <span className="ml-2 text-xs text-muted-foreground">({row.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Info className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>Insira peso e repetições para ver a tabela</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {personalRecords.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Seus Records (1RM Estimado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {personalRecords.slice(0, 6).map((record, index) => (
                <div
                  key={record.exerciseId}
                  className="relative overflow-hidden rounded-lg bg-muted/30 p-4"
                >
                  {index === 0 && (
                    <div className="absolute right-2 top-2">
                      <Badge className="bg-yellow-500/20 text-yellow-400">
                        <Trophy className="mr-1 h-3 w-3" />
                        TOP 1
                      </Badge>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">{record.muscleGroup}</p>
                  <p className="font-medium text-white">{record.exerciseName}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-primary">
                      {record.estimated1RM.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">kg</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Baseado em {record.weight}kg × {record.reps} reps
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && personalRecords.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum treino encontrado para calcular records
          </CardContent>
        </Card>
      )}
    </div>
  );
}
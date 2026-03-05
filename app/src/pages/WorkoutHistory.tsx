import { useState, useMemo } from 'react';
import { Calendar, Filter, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart } from '@/components/charts';
import type { WorkoutSession } from '@/types';
import { EXERCISE_DEFINITIONS, MUSCLE_GROUPS } from '@/data/exercises';
import { calculateWorkoutVolume, calculateExerciseProgress, formatWeight } from '@/lib/calculations';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

interface WorkoutHistoryProps {
  workouts: WorkoutSession[];
}

export function WorkoutHistory({ workouts }: WorkoutHistoryProps) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('all');
  const [selectedExercise, setSelectedExercise] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filtrar treinos
  const filteredWorkouts = useMemo(() => {
    return workouts.filter(workout => {
      // Filtro por grupo muscular
      if (selectedMuscleGroup !== 'all') {
        const hasMuscleGroup = workout.exercises.some(
          e => e.muscleGroup === selectedMuscleGroup
        );
        if (!hasMuscleGroup) return false;
      }

      // Filtro por exercício
      if (selectedExercise !== 'all') {
        const hasExercise = workout.exercises.some(
          e => e.exerciseId === selectedExercise
        );
        if (!hasExercise) return false;
      }

      // Filtro por data
      if (startDate || endDate) {
        const workoutDate = parseISO(workout.date);
        const start = startDate ? startOfDay(parseISO(startDate)) : null;
        const end = endDate ? endOfDay(parseISO(endDate)) : null;
        
        if (start && workoutDate < start) return false;
        if (end && workoutDate > end) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workouts, selectedMuscleGroup, selectedExercise, startDate, endDate]);

  // Dados para gráfico de evolução
  const progressData = useMemo(() => {
    if (selectedExercise === 'all') return [];
    
    const progress = calculateExerciseProgress(workouts, selectedExercise);
    if (progress.length === 0) return [];
    
    return progress[0].history.map(h => ({
      date: h.date,
      label: format(new Date(h.date), 'dd/MM'),
      maxWeight: h.maxWeight,
      volume: h.totalVolume,
    }));
  }, [workouts, selectedExercise]);

  // Estatísticas
  const stats = useMemo(() => {
    const totalWorkouts = filteredWorkouts.length;
    const totalVolume = filteredWorkouts.reduce((sum, w) => sum + calculateWorkoutVolume(w), 0);
    const avgVolume = totalWorkouts > 0 ? totalVolume / totalWorkouts : 0;
    
    return { totalWorkouts, totalVolume, avgVolume };
  }, [filteredWorkouts]);

  const clearFilters = () => {
    setSelectedMuscleGroup('all');
    setSelectedExercise('all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Histórico de Treinos</h1>
          <p className="text-muted-foreground">Visualize e filtre seus treinos</p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Total de Treinos</p>
            <p className="text-2xl font-bold text-white">{stats.totalWorkouts}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Volume Total</p>
            <p className="text-2xl font-bold text-white">
              {(stats.totalVolume / 1000).toFixed(1)}k
              <span className="text-sm font-normal text-muted-foreground ml-1">kg</span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Volume Médio</p>
            <p className="text-2xl font-bold text-white">
              {formatWeight(stats.avgVolume)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Grupo Muscular</Label>
              <Select value={selectedMuscleGroup} onValueChange={setSelectedMuscleGroup}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {MUSCLE_GROUPS.map(mg => (
                    <SelectItem key={mg} value={mg}>{mg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Exercício</Label>
              <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {EXERCISE_DEFINITIONS.map(ex => (
                    <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Data Final</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-background border-border"
                />
                <Button variant="outline" size="icon" onClick={clearFilters}>
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de evolução (se exercício selecionado) */}
      {selectedExercise !== 'all' && progressData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Evolução do Exercício
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={progressData}
              lines={[
                { key: 'maxWeight', name: 'Carga Máxima', color: '#3b82f6' },
                { key: 'volume', name: 'Volume', color: '#22c55e' },
              ]}
              xAxisKey="label"
              yAxisFormatter={(v: number) => `${v}`}
              height={250}
            />
          </CardContent>
        </Card>
      )}

      {/* Lista de treinos */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Treinos ({filteredWorkouts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Data</TableHead>
                  <TableHead className="text-muted-foreground">Dia</TableHead>
                  <TableHead className="text-muted-foreground">Exercícios</TableHead>
                  <TableHead className="text-muted-foreground">Volume</TableHead>
                  <TableHead className="text-muted-foreground">RPE Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkouts.map((workout) => (
                  <TableRow key={workout.id} className="border-border">
                    <TableCell className="text-white">
                      {format(new Date(workout.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {workout.weekDay}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {workout.exercises.map((ex, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {ex.exerciseName}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-white">
                      {formatWeight(calculateWorkoutVolume(workout))}
                    </TableCell>
                    <TableCell>
                      {workout.exercises.length > 0 ? (
                        <span className="text-white">
                          {(workout.exercises.reduce((sum, ex) => sum + ex.rpe, 0) / workout.exercises.length).toFixed(1)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredWorkouts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum treino encontrado com os filtros selecionados
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

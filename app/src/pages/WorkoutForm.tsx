import { useState } from 'react';
import { Plus, Trash2, Save, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { EXERCISE_DEFINITIONS, WEEK_DAYS } from '@/data/exercises';
import type { WorkoutSession, WorkoutExercise, WorkoutSet, WeekDay, MuscleGroup } from '@/types';
import { calculateExerciseVolume } from '@/lib/calculations';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WorkoutFormProps {
  onSave: (workout: WorkoutSession) => void;
}

export function WorkoutForm({ onSave }: WorkoutFormProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [weekDay, setWeekDay] = useState<WeekDay>(
    format(new Date(), 'EEEE', { locale: ptBR }).charAt(0).toUpperCase() + 
    format(new Date(), 'EEEE', { locale: ptBR }).slice(1) as WeekDay
  );
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);

  const addExercise = () => {
    const newExercise: WorkoutExercise = {
      id: crypto.randomUUID(),
      exerciseId: '',
      exerciseName: '',
      muscleGroup: 'Peito' as MuscleGroup,
      sets: [{ reps: 10, weight: 0 }],
      rpe: 7,
    };
    setExercises([...exercises, newExercise]);
  };

  const removeExercise = (id: string) => {
    setExercises(exercises.filter(e => e.id !== id));
  };

  const updateExercise = (id: string, updates: Partial<WorkoutExercise>) => {
    setExercises(exercises.map(e => 
      e.id === id ? { ...e, ...updates } : e
    ));
  };

  const addSet = (exerciseId: string) => {
    setExercises(exercises.map(e => {
      if (e.id === exerciseId) {
        const lastSet = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [...e.sets, { reps: lastSet?.reps || 10, weight: lastSet?.weight || 0 }],
        };
      }
      return e;
    }));
  };

  const removeSet = (exerciseId: string, setIndex: number) => {
    setExercises(exercises.map(e => {
      if (e.id === exerciseId) {
        return {
          ...e,
          sets: e.sets.filter((_, i) => i !== setIndex),
        };
      }
      return e;
    }));
  };

  const updateSet = (exerciseId: string, setIndex: number, updates: Partial<WorkoutSet>) => {
    setExercises(exercises.map(e => {
      if (e.id === exerciseId) {
        return {
          ...e,
          sets: e.sets.map((s, i) => i === setIndex ? { ...s, ...updates } : s),
        };
      }
      return e;
    }));
  };

  const handleExerciseSelect = (exerciseId: string, workoutExerciseId: string) => {
    const exerciseDef = EXERCISE_DEFINITIONS.find(e => e.id === exerciseId);
    if (exerciseDef) {
      updateExercise(workoutExerciseId, {
        exerciseId: exerciseDef.id,
        exerciseName: exerciseDef.name,
        muscleGroup: exerciseDef.muscleGroup,
      });
    }
  };

  const handleSubmit = () => {
    if (exercises.length === 0) {
      toast.error('Adicione pelo menos um exercício');
      return;
    }

    if (exercises.some(e => !e.exerciseId)) {
      toast.error('Selecione todos os exercícios');
      return;
    }

    const totalVolume = exercises.reduce((total, ex) => total + calculateExerciseVolume(ex), 0);

    const workout: WorkoutSession = {
      id: crypto.randomUUID(),
      date,
      weekDay: weekDay as WeekDay,
      exercises,
      totalVolume,
      createdAt: Date.now(),
    };

    onSave(workout);
    toast.success('Treino salvo com sucesso!');
    
    // Reset form
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setExercises([]);
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Registrar Treino</h1>
          <p className="text-muted-foreground">Registre seus exercícios e cargas</p>
        </div>
      </div>

      {/* Formulário principal */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            Informações do Treino
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekDay">Dia da Semana</Label>
              <Select value={weekDay} onValueChange={(v) => setWeekDay(v as WeekDay)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_DAYS.map(day => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exercícios */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Exercícios</h2>
          <Button onClick={addExercise} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Adicionar Exercício
          </Button>
        </div>

        {exercises.length === 0 && (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="py-8 text-center">
              <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhum exercício adicionado. Clique no botão acima para começar.
              </p>
            </CardContent>
          </Card>
        )}

        {exercises.map((exercise, exIndex) => (
          <Card key={exercise.id} className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-white">
                  Exercício {exIndex + 1}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeExercise(exercise.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seleção de exercício */}
              <div className="space-y-2">
                <Label>Exercício</Label>
                <Select
                  value={exercise.exerciseId}
                  onValueChange={(v) => handleExerciseSelect(v, exercise.id)}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione um exercício" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {EXERCISE_DEFINITIONS.map(ex => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.name} ({ex.muscleGroup})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Séries */}
              <div className="space-y-2">
                <Label>Séries</Label>
                <div className="space-y-2">
                  {exercise.sets.map((set, setIndex) => (
                    <div key={setIndex} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-12">
                        Série {setIndex + 1}
                      </span>
                      <Input
                        type="number"
                        placeholder="Reps"
                        value={set.reps || ''}
                        onChange={(e) => updateSet(exercise.id, setIndex, { 
                          reps: parseInt(e.target.value) || 0 
                        })}
                        className="w-20 bg-background border-border"
                      />
                      <span className="text-muted-foreground">x</span>
                      <Input
                        type="number"
                        placeholder="Kg"
                        value={set.weight || ''}
                        onChange={(e) => updateSet(exercise.id, setIndex, { 
                          weight: parseFloat(e.target.value) || 0 
                        })}
                        className="w-24 bg-background border-border"
                      />
                      <span className="text-muted-foreground">kg</span>
                      {exercise.sets.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSet(exercise.id, setIndex)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addSet(exercise.id)}
                  className="mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar Série
                </Button>
              </div>

              {/* RPE e FC */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>RPE (1-10): {exercise.rpe}</Label>
                  <Slider
                    value={[exercise.rpe]}
                    onValueChange={([v]) => updateExercise(exercise.id, { rpe: v })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>FC Média (bpm)</Label>
                  <Input
                    type="number"
                    placeholder="Opcional"
                    value={exercise.avgHeartRate || ''}
                    onChange={(e) => updateExercise(exercise.id, { 
                      avgHeartRate: parseInt(e.target.value) || undefined 
                    })}
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>FC Máxima (bpm)</Label>
                  <Input
                    type="number"
                    placeholder="Opcional"
                    value={exercise.maxHeartRate || ''}
                    onChange={(e) => updateExercise(exercise.id, { 
                      maxHeartRate: parseInt(e.target.value) || undefined 
                    })}
                    className="bg-background border-border"
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Input
                  placeholder="Notas sobre o exercício..."
                  value={exercise.notes || ''}
                  onChange={(e) => updateExercise(exercise.id, { notes: e.target.value })}
                  className="bg-background border-border"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Botão salvar */}
      {exercises.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSubmit} size="lg" className="gap-2">
            <Save className="w-5 h-5" />
            Salvar Treino
          </Button>
        </div>
      )}
    </div>
  );
}

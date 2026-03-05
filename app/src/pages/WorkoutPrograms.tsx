import { useState } from 'react';
import { BookOpen, Play, Clock, Calendar, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import type { WeekDay } from '@/types';
import { EXERCISE_DEFINITIONS } from '@/data/exercises';

interface Program {
  id: string;
  name: string;
  description: string;
  duration: string;
  sessionsPerWeek: number;
  difficulty: 'Iniciante' | 'Intermediário' | 'Avançado';
  goal: string;
  image: string;
  weeks: {
    week: number;
    days: {
      day: WeekDay;
      name: string;
      exercises: {
        exerciseId: string;
        sets: number;
        reps: string;
        rest: string;
        notes?: string;
      }[];
    }[];
  }[];
}

interface WorkoutProgramsProps {
  onStartProgram: (program: Program) => void;
  activeProgram?: Program;
  progress?: { week: number; day: number; completed: boolean[] };
}

const programs: Program[] = [
  {
    id: 'hipertrofia-abc',
    name: 'Hipertrofia ABC',
    description: 'Programa clássico de 3 dias para ganho de massa muscular',
    duration: '8 semanas',
    sessionsPerWeek: 3,
    difficulty: 'Intermediário',
    goal: 'Hipertrofia',
    image: '💪',
    weeks: [
      {
        week: 1,
        days: [
          {
            day: 'Segunda' as WeekDay,
            name: 'A - Peito e Tríceps',
            exercises: [
              { exerciseId: 'supino-maquina', sets: 4, reps: '8-12', rest: '90s', notes: 'Aqueça bem' },
              { exerciseId: 'chest-press', sets: 3, reps: '10-12', rest: '60s' },
              { exerciseId: 'crucifixo', sets: 3, reps: '12-15', rest: '60s' },
              { exerciseId: 'triceps-mergulho', sets: 4, reps: '10-12', rest: '60s' },
              { exerciseId: 'triceps-polia', sets: 3, reps: '12-15', rest: '45s' },
            ],
          },
          {
            day: 'Quarta' as WeekDay,
            name: 'B - Costas e Bíceps',
            exercises: [
              { exerciseId: 'lat-pulldown', sets: 4, reps: '8-12', rest: '90s' },
              { exerciseId: 'remada-maquina', sets: 4, reps: '10-12', rest: '60s' },
              { exerciseId: 'puxada-alta', sets: 3, reps: '12-15', rest: '60s' },
              { exerciseId: 'rosca-biceps-maquina', sets: 4, reps: '10-12', rest: '60s' },
              { exerciseId: 'rosca-martelo', sets: 3, reps: '12-15', rest: '45s' },
            ],
          },
          {
            day: 'Sexta' as WeekDay,
            name: 'C - Pernas e Ombro',
            exercises: [
              { exerciseId: 'agachamento-livre', sets: 4, reps: '8-10', rest: '2min', notes: 'Pesado!' },
              { exerciseId: 'leg-press', sets: 4, reps: '10-12', rest: '90s' },
              { exerciseId: 'extensora', sets: 3, reps: '12-15', rest: '60s' },
              { exerciseId: 'mesa-flexora', sets: 4, reps: '10-12', rest: '60s' },
              { exerciseId: 'desenvolvimento-ombro', sets: 4, reps: '10-12', rest: '60s' },
              { exerciseId: 'elevacao-lateral', sets: 3, reps: '12-15', rest: '45s' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'forca-5x5',
    name: 'Força 5x5',
    description: 'Programa clássico para aumento de força máxima',
    duration: '12 semanas',
    sessionsPerWeek: 3,
    difficulty: 'Intermediário',
    goal: 'Força',
    image: '🏋️',
    weeks: [
      {
        week: 1,
        days: [
          {
            day: 'Segunda' as WeekDay,
            name: 'A - Treino A',
            exercises: [
              { exerciseId: 'agachamento-livre', sets: 5, reps: '5', rest: '3min', notes: 'Peso pesado' },
              { exerciseId: 'lat-pulldown', sets: 5, reps: '5', rest: '2min' },
              { exerciseId: 'desenvolvimento-ombro', sets: 5, reps: '5', rest: '2min' },
            ],
          },
          {
            day: 'Quarta' as WeekDay,
            name: 'B - Treino B',
            exercises: [
              { exerciseId: 'agachamento-livre', sets: 5, reps: '5', rest: '3min' },
              { exerciseId: 'supino-maquina', sets: 5, reps: '5', rest: '3min' },
              { exerciseId: 'remada-maquina', sets: 5, reps: '5', rest: '2min' },
            ],
          },
          {
            day: 'Sexta' as WeekDay,
            name: 'A - Treino A',
            exercises: [
              { exerciseId: 'agachamento-livre', sets: 5, reps: '5', rest: '3min' },
              { exerciseId: 'lat-pulldown', sets: 5, reps: '5', rest: '2min' },
              { exerciseId: 'desenvolvimento-ombro', sets: 5, reps: '5', rest: '2min' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'emagrecimento-hiit',
    name: 'Emagrecimento + HIIT',
    description: 'Combinação de musculação e cardio para queima de gordura',
    duration: '6 semanas',
    sessionsPerWeek: 4,
    difficulty: 'Avançado',
    goal: 'Emagrecimento',
    image: '🔥',
    weeks: [
      {
        week: 1,
        days: [
          {
            day: 'Segunda' as WeekDay,
            name: 'Circuito Full Body',
            exercises: [
              { exerciseId: 'agachamento-livre', sets: 3, reps: '15', rest: '30s', notes: 'Circuito' },
              { exerciseId: 'supino-maquina', sets: 3, reps: '15', rest: '30s' },
              { exerciseId: 'remada-maquina', sets: 3, reps: '15', rest: '30s' },
              { exerciseId: 'desenvolvimento-ombro', sets: 3, reps: '15', rest: '30s' },
              { exerciseId: 'prancha', sets: 3, reps: '45s', rest: '15s' },
            ],
          },
          {
            day: 'Terça' as WeekDay,
            name: 'HIIT Cardio',
            exercises: [
              { exerciseId: 'esteira', sets: 1, reps: '30min', rest: '-', notes: 'Intervalos' },
            ],
          },
          {
            day: 'Quinta' as WeekDay,
            name: 'Circuito Full Body',
            exercises: [
              { exerciseId: 'leg-press', sets: 3, reps: '15', rest: '30s' },
              { exerciseId: 'lat-pulldown', sets: 3, reps: '15', rest: '30s' },
              { exerciseId: 'triceps-mergulho', sets: 3, reps: '15', rest: '30s' },
              { exerciseId: 'rosca-biceps-maquina', sets: 3, reps: '15', rest: '30s' },
              { exerciseId: 'abdominal-maquina', sets: 3, reps: '20', rest: '30s' },
            ],
          },
          {
            day: 'Sexta' as WeekDay,
            name: 'HIIT Cardio',
            exercises: [
              { exerciseId: 'bike', sets: 1, reps: '30min', rest: '-', notes: 'Intervalos' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'iniciante-fullbody',
    name: 'Iniciante Full Body',
    description: 'Programa perfeito para quem está começando na academia',
    duration: '4 semanas',
    sessionsPerWeek: 3,
    difficulty: 'Iniciante',
    goal: 'Condicionamento',
    image: '🌱',
    weeks: [
      {
        week: 1,
        days: [
          {
            day: 'Segunda' as WeekDay,
            name: 'Full Body A',
            exercises: [
              { exerciseId: 'leg-press', sets: 3, reps: '12-15', rest: '90s', notes: 'Aprenda a técnica' },
              { exerciseId: 'supino-maquina', sets: 3, reps: '12-15', rest: '90s' },
              { exerciseId: 'lat-pulldown', sets: 3, reps: '12-15', rest: '90s' },
              { exerciseId: 'desenvolvimento-ombro', sets: 3, reps: '12-15', rest: '60s' },
              { exerciseId: 'rosca-biceps-maquina', sets: 2, reps: '15', rest: '60s' },
              { exerciseId: 'triceps-polia', sets: 2, reps: '15', rest: '60s' },
              { exerciseId: 'prancha', sets: 3, reps: '30s', rest: '30s' },
            ],
          },
          {
            day: 'Quarta' as WeekDay,
            name: 'Full Body B',
            exercises: [
              { exerciseId: 'extensora', sets: 3, reps: '12-15', rest: '90s' },
              { exerciseId: 'chest-press', sets: 3, reps: '12-15', rest: '90s' },
              { exerciseId: 'remada-maquina', sets: 3, reps: '12-15', rest: '90s' },
              { exerciseId: 'elevacao-lateral', sets: 3, reps: '12-15', rest: '60s' },
              { exerciseId: 'rosca-scott', sets: 2, reps: '15', rest: '60s' },
              { exerciseId: 'triceps-mergulho', sets: 2, reps: '15', rest: '60s' },
              { exerciseId: 'abdominal-maquina', sets: 3, reps: '15', rest: '30s' },
            ],
          },
          {
            day: 'Sexta' as WeekDay,
            name: 'Full Body C',
            exercises: [
              { exerciseId: 'mesa-flexora', sets: 3, reps: '12-15', rest: '90s' },
              { exerciseId: 'supino-maquina', sets: 3, reps: '12-15', rest: '90s' },
              { exerciseId: 'puxada-alta', sets: 3, reps: '12-15', rest: '90s' },
              { exerciseId: 'desenvolvimento-ombro', sets: 3, reps: '12-15', rest: '60s' },
              { exerciseId: 'rosca-martelo', sets: 2, reps: '15', rest: '60s' },
              { exerciseId: 'triceps-testa', sets: 2, reps: '15', rest: '60s' },
              { exerciseId: 'prancha', sets: 3, reps: '30s', rest: '30s' },
            ],
          },
        ],
      },
    ],
  },
];

export function WorkoutPrograms({ onStartProgram, activeProgram, progress }: WorkoutProgramsProps) {
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);

  const handleStartProgram = (program: Program) => {
    onStartProgram(program);
    toast.success(`Programa "${program.name}" iniciado!`);
  };

  const toggleProgram = (programId: string) => {
    setExpandedProgram(expandedProgram === programId ? null : programId);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Iniciante': return 'bg-green-500/20 text-green-400';
      case 'Intermediário': return 'bg-yellow-500/20 text-yellow-400';
      case 'Avançado': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Programas de Treino</h1>
          <p className="text-muted-foreground">Escolha um programa e siga o plano</p>
        </div>
      </div>

      {/* Programa Ativo */}
      {activeProgram && (
        <Card className="bg-gradient-to-r from-primary/20 to-purple-600/20 border-primary/30">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-4xl">{activeProgram.image}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{activeProgram.name}</h3>
                    <Badge className="bg-primary text-primary-foreground">
                      <Play className="w-3 h-3 mr-1" />
                      Em Andamento
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Semana {progress?.week || 1} • {activeProgram.duration}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Continuar
              </Button>
            </div>
            {progress && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="text-white">
                    {progress.completed.filter(Boolean).length} / {progress.completed.length} treinos
                  </span>
                </div>
                <Progress 
                  value={(progress.completed.filter(Boolean).length / progress.completed.length) * 100} 
                  className="h-2"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de Programas */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Programas Disponíveis
        </h2>

        {programs.map(program => (
          <Card key={program.id} className="bg-card border-border overflow-hidden">
            <CardContent className="p-0">
              {/* Header do programa */}
              <div 
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleProgram(program.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{program.image}</div>
                    <div>
                      <h3 className="font-medium text-white">{program.name}</h3>
                      <p className="text-sm text-muted-foreground">{program.description}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {program.duration}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <Calendar className="w-3 h-3 mr-1" />
                          {program.sessionsPerWeek}x/semana
                        </Badge>
                        <Badge className={`text-xs ${getDifficultyColor(program.difficulty)}`}>
                          {program.difficulty}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Trophy className="w-3 h-3 mr-1" />
                          {program.goal}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartProgram(program);
                      }}
                      disabled={activeProgram?.id === program.id}
                    >
                      {activeProgram?.id === program.id ? 'Ativo' : 'Iniciar'}
                    </Button>
                    {expandedProgram === program.id ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              {/* Detalhes expandidos */}
              {expandedProgram === program.id && (
                <div className="border-t border-border p-4 bg-muted/20">
                  <div className="space-y-4">
                    {program.weeks[0].days.map((day, idx) => (
                      <div key={idx} className="bg-card rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{day.day}</Badge>
                          <span className="font-medium text-white">{day.name}</span>
                        </div>
                        <div className="space-y-1">
                          {day.exercises.map((ex, exIdx) => {
                            const exercise = EXERCISE_DEFINITIONS.find(e => e.id === ex.exerciseId);
                            return (
                              <div key={exIdx} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {exercise?.name || ex.exerciseId}
                                </span>
                                <span className="text-white">
                                  {ex.sets}x{ex.reps} <span className="text-muted-foreground">({ex.rest})</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

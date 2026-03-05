import { useState } from 'react';
import { Calendar, Dumbbell, Save, Trash2, Plus, Check, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MUSCLE_GROUPS, WEEK_DAYS } from '@/data/exercises';
import type { WorkoutSplit, SplitDay, MuscleGroup, WeekDay, SplitTemplate } from '@/types';
import { cn } from '@/lib/utils';

interface WorkoutSplitProps {
  splits: WorkoutSplit[];
  onSave: (split: WorkoutSplit) => void;
  onDelete: (id: string) => void;
  onSetActive: (id: string) => void;
  activeSplitId?: string;
}

// Templates pré-definidos
const SPLIT_TEMPLATES: Record<SplitTemplate, { name: string; days: Partial<SplitDay>[] }> = {
  ABC: {
    name: 'ABC - Tradicional',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito', 'Tríceps'], focus: 'Peito e Tríceps', isRestDay: false },
      { day: 'Terça', muscleGroups: ['Costas', 'Bíceps'], focus: 'Costas e Bíceps', isRestDay: false },
      { day: 'Quarta', muscleGroups: ['Quadríceps', 'Posterior', 'Panturrilha'], focus: 'Pernas', isRestDay: false },
      { day: 'Quinta', muscleGroups: ['Ombro', 'Tríceps'], focus: 'Ombro e Tríceps', isRestDay: false },
      { day: 'Sexta', muscleGroups: ['Costas', 'Bíceps'], focus: 'Costas e Bíceps', isRestDay: false },
      { day: 'Sábado', muscleGroups: ['Quadríceps', 'Posterior'], focus: 'Pernas', isRestDay: false },
      { day: 'Domingo', muscleGroups: [], focus: 'Descanso', isRestDay: true },
    ],
  },
  AB: {
    name: 'AB - Superior/Inferior',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps'], focus: 'Superior', isRestDay: false },
      { day: 'Terça', muscleGroups: ['Quadríceps', 'Posterior', 'Panturrilha', 'Core'], focus: 'Inferior', isRestDay: false },
      { day: 'Quarta', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Quinta', muscleGroups: ['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps'], focus: 'Superior', isRestDay: false },
      { day: 'Sexta', muscleGroups: ['Quadríceps', 'Posterior', 'Panturrilha', 'Core'], focus: 'Inferior', isRestDay: false },
      { day: 'Sábado', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Domingo', muscleGroups: [], focus: 'Descanso', isRestDay: true },
    ],
  },
  PPL: {
    name: 'Push/Pull/Legs',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito', 'Ombro', 'Tríceps'], focus: 'Push', isRestDay: false },
      { day: 'Terça', muscleGroups: ['Costas', 'Bíceps'], focus: 'Pull', isRestDay: false },
      { day: 'Quarta', muscleGroups: ['Quadríceps', 'Posterior', 'Panturrilha'], focus: 'Legs', isRestDay: false },
      { day: 'Quinta', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Sexta', muscleGroups: ['Peito', 'Ombro', 'Tríceps'], focus: 'Push', isRestDay: false },
      { day: 'Sábado', muscleGroups: ['Costas', 'Bíceps'], focus: 'Pull', isRestDay: false },
      { day: 'Domingo', muscleGroups: ['Quadríceps', 'Posterior', 'Panturrilha'], focus: 'Legs', isRestDay: false },
    ],
  },
  FULL_BODY: {
    name: 'Full Body 3x',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito', 'Costas', 'Quadríceps', 'Posterior', 'Ombro'], focus: 'Full Body', isRestDay: false },
      { day: 'Terça', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Quarta', muscleGroups: ['Peito', 'Costas', 'Quadríceps', 'Posterior', 'Ombro'], focus: 'Full Body', isRestDay: false },
      { day: 'Quinta', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Sexta', muscleGroups: ['Peito', 'Costas', 'Quadríceps', 'Posterior', 'Ombro'], focus: 'Full Body', isRestDay: false },
      { day: 'Sábado', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Domingo', muscleGroups: [], focus: 'Descanso', isRestDay: true },
    ],
  },
  UPPER_LOWER: {
    name: 'Upper/Lower 4x',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps'], focus: 'Upper', isRestDay: false },
      { day: 'Terça', muscleGroups: ['Quadríceps', 'Posterior', 'Panturrilha'], focus: 'Lower', isRestDay: false },
      { day: 'Quarta', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Quinta', muscleGroups: ['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps'], focus: 'Upper', isRestDay: false },
      { day: 'Sexta', muscleGroups: ['Quadríceps', 'Posterior', 'Panturrilha'], focus: 'Lower', isRestDay: false },
      { day: 'Sábado', muscleGroups: [], focus: 'Descanso', isRestDay: true },
      { day: 'Domingo', muscleGroups: [], focus: 'Descanso', isRestDay: true },
    ],
  },
  ABCDE: {
    name: 'ABCDE - Um grupo por dia',
    days: [
      { day: 'Segunda', muscleGroups: ['Peito'], focus: 'Peito', isRestDay: false },
      { day: 'Terça', muscleGroups: ['Costas'], focus: 'Costas', isRestDay: false },
      { day: 'Quarta', muscleGroups: ['Ombro'], focus: 'Ombro', isRestDay: false },
      { day: 'Quinta', muscleGroups: ['Pernas'], focus: 'Pernas', isRestDay: false },
      { day: 'Sexta', muscleGroups: ['Bíceps', 'Tríceps'], focus: 'Braços', isRestDay: false },
      { day: 'Sábado', muscleGroups: ['Core', 'Panturrilha'], focus: 'Core e Panturrilha', isRestDay: false },
      { day: 'Domingo', muscleGroups: [], focus: 'Descanso', isRestDay: true },
    ],
  },
  CUSTOM: {
    name: 'Personalizado',
    days: WEEK_DAYS.map(day => ({ day, muscleGroups: [], focus: '', isRestDay: false })),
  },
};

export function WorkoutSplitPlanner({ splits, onSave, onDelete, onSetActive, activeSplitId }: WorkoutSplitProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<SplitTemplate>('ABC');
  const [splitName, setSplitName] = useState('');
  const [days, setDays] = useState<SplitDay[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Carregar template
  const loadTemplate = (template: SplitTemplate) => {
    const tmpl = SPLIT_TEMPLATES[template];
    setSplitName(tmpl.name);
    setDays(tmpl.days.map(d => ({
      day: d.day as WeekDay,
      muscleGroups: d.muscleGroups as MuscleGroup[] || [],
      focus: d.focus || '',
      isRestDay: d.isRestDay || false,
    })));
    setSelectedTemplate(template);
  };

  // Inicializar com template ABC
  useState(() => {
    if (days.length === 0) {
      loadTemplate('ABC');
    }
  });

  // Atualizar dia do split
  const updateDay = (index: number, updates: Partial<SplitDay>) => {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d));
  };

  // Toggle grupo muscular
  const toggleMuscleGroup = (dayIndex: number, group: MuscleGroup) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d;
      const groups = d.muscleGroups.includes(group)
        ? d.muscleGroups.filter(g => g !== group)
        : [...d.muscleGroups, group];
      return { ...d, muscleGroups: groups };
    }));
  };

  // Salvar split
  const handleSave = () => {
    if (!splitName.trim()) {
      toast.error('Dê um nome ao seu split');
      return;
    }

    const split: WorkoutSplit = {
      id: editingId || crypto.randomUUID(),
      name: splitName,
      days,
      createdAt: Date.now(),
      isActive: false,
    };

    onSave(split);
    toast.success(editingId ? 'Split atualizado!' : 'Split criado!');
    
    setSplitName('');
    setDays([]);
    setIsEditing(false);
    setEditingId(null);
  };

  // Editar split existente
  const handleEdit = (split: WorkoutSplit) => {
    setSplitName(split.name);
    setDays(split.days);
    setEditingId(split.id);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Criar novo
  const handleNew = () => {
    setSplitName('');
    setDays(WEEK_DAYS.map(day => ({ day, muscleGroups: [], focus: '', isRestDay: false })));
    setIsEditing(true);
    setEditingId(null);
  };

  // Cancelar edição
  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setSplitName('');
    setDays([]);
  };

  // Dia da semana atual
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);
  const activeSplit = splits.find(s => s.id === activeSplitId);
  const todayWorkout = activeSplit?.days.find(d => d.day === todayCapitalized);

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planejador de Split</h1>
          <p className="text-muted-foreground">Organize sua semana de treinos</p>
        </div>
        {!isEditing && (
          <Button onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Split
          </Button>
        )}
      </div>

      {/* Card de hoje */}
      {todayWorkout && (
        <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/30">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Dumbbell className="w-7 h-7 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Hoje é {todayCapitalized}</p>
                <h3 className="text-xl font-bold text-white">
                  {todayWorkout.isRestDay ? '😴 Dia de Descanso' : `💪 ${todayWorkout.focus}`}
                </h3>
                {!todayWorkout.isRestDay && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {todayWorkout.muscleGroups.map(g => (
                      <Badge key={g} variant="secondary" className="bg-blue-500/20 text-blue-300">
                        {g}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário de edição */}
      {isEditing && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              {editingId ? 'Editar Split' : 'Criar Novo Split'}
            </CardTitle>
            <CardDescription>
              Escolha um template ou personalize sua semana
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Templates */}
            {!editingId && (
              <div className="space-y-2">
                <Label>Template</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(Object.keys(SPLIT_TEMPLATES) as SplitTemplate[]).map(template => (
                    <Button
                      key={template}
                      variant={selectedTemplate === template ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => loadTemplate(template)}
                      className="justify-start"
                    >
                      {SPLIT_TEMPLATES[template].name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Nome do split */}
            <div className="space-y-2">
              <Label>Nome do Split</Label>
              <Input
                value={splitName}
                onChange={(e) => setSplitName(e.target.value)}
                placeholder="Ex: Meu ABC de Hipertrofia"
                className="bg-background border-border"
              />
            </div>

            {/* Configuração dos dias */}
            <div className="space-y-4">
              <Label>Configuração da Semana</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {days.map((day, index) => (
                  <Card 
                    key={day.day} 
                    className={cn(
                      'border transition-all',
                      day.isRestDay 
                        ? 'bg-muted/30 border-muted' 
                        : 'bg-card border-border'
                    )}
                  >
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{day.day}</span>
                        <Button
                          variant={day.isRestDay ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateDay(index, { 
                            isRestDay: !day.isRestDay,
                            muscleGroups: !day.isRestDay ? [] : day.muscleGroups
                          })}
                          className={cn(
                            'h-7 text-xs',
                            day.isRestDay && 'bg-orange-500 hover:bg-orange-600'
                          )}
                        >
                          {day.isRestDay ? 'Descanso' : 'Treino'}
                        </Button>
                      </div>
                    </CardHeader>
                    {!day.isRestDay && (
                      <CardContent className="p-3 pt-0 space-y-3">
                        <Input
                          placeholder="Foco do dia"
                          value={day.focus}
                          onChange={(e) => updateDay(index, { focus: e.target.value })}
                          className="bg-background border-border text-sm"
                        />
                        <div className="flex flex-wrap gap-1">
                          {MUSCLE_GROUPS.map(group => (
                            <button
                              key={group}
                              onClick={() => toggleMuscleGroup(index, group)}
                              className={cn(
                                'px-2 py-1 rounded text-xs transition-all',
                                day.muscleGroups.includes(group)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              )}
                            >
                              {group}
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="w-4 h-4" />
                Salvar Split
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de splits salvos */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Meus Splits</h2>
        
        {splits.length === 0 ? (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="py-8 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhum split criado ainda. Clique em "Novo Split" para começar!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {splits.map(split => (
              <Card 
                key={split.id} 
                className={cn(
                  'bg-card border transition-all',
                  split.id === activeSplitId 
                    ? 'border-primary shadow-lg shadow-primary/10' 
                    : 'border-border'
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base text-white flex items-center gap-2">
                        {split.name}
                        {split.id === activeSplitId && (
                          <Badge className="bg-primary text-primary-foreground">
                            <Check className="w-3 h-3 mr-1" />
                            Ativo
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {split.days.filter(d => !d.isRestDay).length} dias de treino
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(split)}
                        className="h-8 w-8"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(split.id)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {split.days.map(d => (
                      <div 
                        key={d.day} 
                        className={cn(
                          'p-1.5 rounded',
                          d.isRestDay 
                            ? 'bg-muted text-muted-foreground' 
                            : 'bg-primary/20 text-primary'
                        )}
                        title={d.focus}
                      >
                        {d.day.slice(0, 3)}
                      </div>
                    ))}
                  </div>
                  {split.id !== activeSplitId && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-3"
                      onClick={() => {
                        onSetActive(split.id);
                        toast.success('Split ativado!');
                      }}
                    >
                      Ativar Split
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

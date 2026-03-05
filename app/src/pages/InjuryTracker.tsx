import { useState } from 'react';
import { AlertTriangle, Plus, Calendar, Activity, CheckCircle2, Trash2, Bandage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { MUSCLE_GROUPS } from '@/data/exercises';
import type { MuscleGroup } from '@/types';

interface Injury {
  id: string;
  bodyPart: MuscleGroup | string;
  description: string;
  severity: number; // 1-10
  dateStarted: string;
  dateRecovered?: string;
  status: 'active' | 'recovered' | 'chronic';
  notes: string;
  affectedExercises: string[];
}

interface InjuryTrackerProps {
  injuries: Injury[];
  onSave: (injury: Injury) => void;
  onUpdate: (id: string, updates: Partial<Injury>) => void;
  onDelete: (id: string) => void;
}

const bodyParts = [
  ...MUSCLE_GROUPS,
  'Joelho',
  'Ombro (articulação)',
  'Cotovelo',
  'Pulso',
  'Quadril',
  'Tornozelo',
  'Lombar',
  'Cervical',
  'Outro',
];

const severityLabels: Record<number, { label: string; color: string }> = {
  1: { label: 'Muito Leve', color: 'bg-green-500' },
  2: { label: 'Leve', color: 'bg-green-400' },
  3: { label: 'Leve-Moderado', color: 'bg-yellow-400' },
  4: { label: 'Moderado', color: 'bg-yellow-500' },
  5: { label: 'Moderado', color: 'bg-yellow-500' },
  6: { label: 'Moderado-Grave', color: 'bg-orange-400' },
  7: { label: 'Grave', color: 'bg-orange-500' },
  8: { label: 'Muito Grave', color: 'bg-red-400' },
  9: { label: 'Severo', color: 'bg-red-500' },
  10: { label: 'Crítico', color: 'bg-red-600' },
};

export function InjuryTracker({ injuries, onSave, onUpdate, onDelete }: InjuryTrackerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [bodyPart, setBodyPart] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(5);
  const [dateStarted, setDateStarted] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const activeInjuries = injuries.filter(i => i.status === 'active');
  const recoveredInjuries = injuries.filter(i => i.status === 'recovered');
  const chronicInjuries = injuries.filter(i => i.status === 'chronic');

  const handleSubmit = () => {
    if (!bodyPart || !description) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const injury: Injury = {
      id: crypto.randomUUID(),
      bodyPart,
      description,
      severity,
      dateStarted,
      status: 'active',
      notes,
      affectedExercises: [],
    };

    onSave(injury);
    toast.success('Lesão registrada! Cuide-se! 💚');
    
    // Reset
    setBodyPart('');
    setDescription('');
    setSeverity(5);
    setDateStarted(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
    setIsAdding(false);
  };

  const handleRecover = (id: string) => {
    onUpdate(id, { 
      status: 'recovered', 
      dateRecovered: format(new Date(), 'yyyy-MM-dd') 
    });
    toast.success('Que ótima notícia! Recuperação completa! 🎉');
  };

  const handleMarkChronic = (id: string) => {
    onUpdate(id, { status: 'chronic' });
    toast.info('Marcado como condição crônica');
  };

  const getDaysSince = (date: string) => {
    return differenceInDays(new Date(), new Date(date));
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Controle de Lesões</h1>
          <p className="text-muted-foreground">Monitore sua saúde e recuperação</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} className="gap-2">
          {isAdding ? 'Cancelar' : <><Plus className="w-4 h-4" /> Registrar Lesão</>}
        </Button>
      </div>

      {/* Alerta de lesões ativas */}
      {activeInjuries.length > 0 && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <p className="font-medium text-red-400">
                  {activeInjuries.length} {activeInjuries.length === 1 ? 'lesão ativa' : 'lesões ativas'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Evite treinar grupos musculares afetados até a recuperação
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário de nova lesão */}
      {isAdding && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bandage className="w-5 h-5 text-red-500" />
              Nova Lesão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Local da Lesão</Label>
                <Select value={bodyPart} onValueChange={setBodyPart}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {bodyParts.map(part => (
                      <SelectItem key={part} value={part}>{part}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={dateStarted}
                  onChange={(e) => setDateStarted(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: Dor no joelho direito ao agachar"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Intensidade da Dor: {severity}/10</Label>
                <Badge className={severityLabels[severity]?.color || 'bg-gray-500'}>
                  {severityLabels[severity]?.label}
                </Badge>
              </div>
              <Slider
                value={[severity]}
                onValueChange={([v]) => setSeverity(v)}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Sem dor</span>
                <span>Moderada</span>
                <span>Incapacitante</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                placeholder="Tratamento, medicamentos, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <Button onClick={handleSubmit} className="w-full gap-2">
              <Plus className="w-4 h-4" />
              Registrar Lesão
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lesões Ativas */}
      {activeInjuries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500" />
            Lesões Ativas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeInjuries.map(injury => (
              <Card key={injury.id} className="bg-card border-red-500/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{injury.bodyPart}</h3>
                        <Badge className={severityLabels[injury.severity]?.color}>
                          {injury.severity}/10
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{injury.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {getDaysSince(injury.dateStarted)} dias
                      </p>
                    </div>
                  </div>
                  
                  {injury.notes && (
                    <p className="text-sm text-muted-foreground mt-3 bg-muted/50 p-2 rounded">
                      {injury.notes}
                    </p>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecover(injury.id)}
                      className="flex-1 gap-1 text-green-400 border-green-500/30"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Recuperado
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkChronic(injury.id)}
                      className="text-muted-foreground"
                    >
                      Crônico
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(injury.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Condições Crônicas */}
      {chronicInjuries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-500" />
            Condições Crônicas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chronicInjuries.map(injury => (
              <Card key={injury.id} className="bg-card border-orange-500/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{injury.bodyPart}</h3>
                        <Badge variant="outline" className="text-orange-400 border-orange-500/30">
                          Crônico
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{injury.description}</p>
                    </div>
                  </div>
                  {injury.notes && (
                    <p className="text-sm text-muted-foreground mt-3">{injury.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de Recuperação */}
      {recoveredInjuries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Recuperados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recoveredInjuries.slice(0, 4).map(injury => (
              <Card key={injury.id} className="bg-card border-green-500/30 opacity-70">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white">{injury.bodyPart}</h3>
                    <Badge className="bg-green-500/20 text-green-400">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Recuperado
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{injury.description}</p>
                  {injury.dateRecovered && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Recuperado em {format(new Date(injury.dateRecovered), 'dd/MM/yyyy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {injuries.length === 0 && !isAdding && (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="py-12 text-center">
            <Bandage className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma lesão registrada</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Mantenha-se saudável! Mas se acontecer alguma coisa, registre aqui para 
              acompanhar sua recuperação e evitar treinar grupos afetados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

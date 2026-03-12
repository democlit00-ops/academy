import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Calendar, Activity, CheckCircle2, Trash2, Bandage, User } from 'lucide-react';
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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { MuscleGroup } from '@/types';

interface Injury {
  id: string;
  bodyPart: MuscleGroup | string;
  description: string;
  severity: number;
  dateStarted: string;
  dateRecovered?: string;
  status: 'active' | 'recovered' | 'chronic';
  notes: string;
  affectedExercises: string[];
}

interface InjuryTrackerProps {
  selectedUserId?: string | null;
  selectedUserLabel?: string | null;
}

type DbInjuryRow = {
  id: string;
  user_id: string;
  body_part: string;
  description: string;
  severity: number;
  date_started: string;
  date_recovered: string | null;
  status: 'active' | 'recovered' | 'chronic';
  notes: string | null;
  affected_exercises: string[] | null;
  created_at: string;
  updated_at: string;
};

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

function mapDbToInjury(row: DbInjuryRow): Injury {
  return {
    id: row.id,
    bodyPart: row.body_part,
    description: row.description,
    severity: row.severity,
    dateStarted: row.date_started,
    dateRecovered: row.date_recovered ?? undefined,
    status: row.status,
    notes: row.notes ?? '',
    affectedExercises: Array.isArray(row.affected_exercises) ? row.affected_exercises : [],
  };
}

export function InjuryTracker({
  selectedUserId,
  selectedUserLabel,
}: InjuryTrackerProps) {
  const { user } = useAuth();

  const effectiveUserId = selectedUserId || user?.id || null;
  const isStudentMode = !!selectedUserId;

  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAdding, setIsAdding] = useState(false);
  const [bodyPart, setBodyPart] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(5);
  const [dateStarted, setDateStarted] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const activeInjuries = useMemo(() => injuries.filter((i) => i.status === 'active'), [injuries]);
  const recoveredInjuries = useMemo(() => injuries.filter((i) => i.status === 'recovered'), [injuries]);
  const chronicInjuries = useMemo(() => injuries.filter((i) => i.status === 'chronic'), [injuries]);

  const loadInjuries = async () => {
    if (!effectiveUserId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('injuries')
        .select(
          'id,user_id,body_part,description,severity,date_started,date_recovered,status,notes,affected_exercises,created_at,updated_at'
        )
        .eq('user_id', effectiveUserId)
        .order('date_started', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInjuries(((data ?? []) as DbInjuryRow[]).map(mapDbToInjury));
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar lesões.');
      setInjuries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInjuries();
  }, [effectiveUserId]);

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (isStudentMode) {
      toast.error('No Modo Aluno, as lesões ficam em visualização nesta versão.');
      return;
    }

    if (!bodyPart || !description) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const payload = {
        user_id: user.id,
        body_part: bodyPart,
        description,
        severity,
        date_started: dateStarted,
        status: 'active' as const,
        notes: notes || null,
        affected_exercises: [],
      };

      const { data, error } = await supabase
        .from('injuries')
        .insert(payload)
        .select(
          'id,user_id,body_part,description,severity,date_started,date_recovered,status,notes,affected_exercises,created_at,updated_at'
        )
        .single();

      if (error) throw error;

      setInjuries((prev) => [mapDbToInjury(data as DbInjuryRow), ...prev]);
      toast.success('Lesão registrada! Cuide-se! 💚');

      setBodyPart('');
      setDescription('');
      setSeverity(5);
      setDateStarted(format(new Date(), 'yyyy-MM-dd'));
      setNotes('');
      setIsAdding(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao registrar lesão.');
    }
  };

  const handleRecover = async (id: string) => {
    if (isStudentMode) {
      toast.error('No Modo Aluno, as lesões ficam em visualização nesta versão.');
      return;
    }

    try {
      const updates = {
        status: 'recovered' as const,
        date_recovered: format(new Date(), 'yyyy-MM-dd'),
      };

      const { data, error } = await supabase
        .from('injuries')
        .update(updates)
        .eq('id', id)
        .select(
          'id,user_id,body_part,description,severity,date_started,date_recovered,status,notes,affected_exercises,created_at,updated_at'
        )
        .single();

      if (error) throw error;

      setInjuries((prev) => prev.map((item) => (item.id === id ? mapDbToInjury(data as DbInjuryRow) : item)));
      toast.success('Que ótima notícia! Recuperação completa! 🎉');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao atualizar lesão.');
    }
  };

  const handleMarkChronic = async (id: string) => {
    if (isStudentMode) {
      toast.error('No Modo Aluno, as lesões ficam em visualização nesta versão.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('injuries')
        .update({ status: 'chronic' })
        .eq('id', id)
        .select(
          'id,user_id,body_part,description,severity,date_started,date_recovered,status,notes,affected_exercises,created_at,updated_at'
        )
        .single();

      if (error) throw error;

      setInjuries((prev) => prev.map((item) => (item.id === id ? mapDbToInjury(data as DbInjuryRow) : item)));
      toast.info('Marcado como condição crônica');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao atualizar lesão.');
    }
  };

  const handleDelete = async (id: string) => {
    if (isStudentMode) {
      toast.error('No Modo Aluno, as lesões ficam em visualização nesta versão.');
      return;
    }

    try {
      const { error } = await supabase.from('injuries').delete().eq('id', id);
      if (error) throw error;

      setInjuries((prev) => prev.filter((item) => item.id !== id));
      toast.success('Lesão removida.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao remover lesão.');
    }
  };

  const getDaysSince = (date: string) => differenceInDays(new Date(), new Date(date));

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Controle de Lesões</h1>
          <p className="text-muted-foreground">
            {isStudentMode ? 'Visualize as lesões do aluno selecionado' : 'Monitore sua saúde e recuperação'}
          </p>

          {isStudentMode && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              <User className="h-4 w-4" />
              <span>
                Visualizando dados de: <strong>{selectedUserLabel || 'Aluno selecionado'}</strong>
              </span>
            </div>
          )}
        </div>

        {!isStudentMode && (
          <Button onClick={() => setIsAdding(!isAdding)} className="gap-2">
            {isAdding ? 'Cancelar' : <><Plus className="w-4 h-4" /> Registrar Lesão</>}
          </Button>
        )}
      </div>

      {activeInjuries.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/10">
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

      {isAdding && !isStudentMode && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Bandage className="w-5 h-5 text-red-500" />
              Nova Lesão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Local da Lesão</Label>
                <Select value={bodyPart} onValueChange={setBodyPart}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {bodyParts.map((part) => (
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

      {loading && (
        <Card className="bg-card border-border">
          <CardContent className="py-8 text-center text-muted-foreground">
            Carregando lesões...
          </CardContent>
        </Card>
      )}

      {!loading && activeInjuries.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Activity className="w-5 h-5 text-red-500" />
            Lesões Ativas
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeInjuries.map((injury) => (
              <Card key={injury.id} className="border-red-500/30 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{injury.bodyPart}</h3>
                        <Badge className={severityLabels[injury.severity]?.color}>
                          {injury.severity}/10
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{injury.description}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {getDaysSince(injury.dateStarted)} dias
                      </p>
                    </div>
                  </div>

                  {injury.notes && (
                    <p className="mt-3 rounded bg-muted/50 p-2 text-sm text-muted-foreground">
                      {injury.notes}
                    </p>
                  )}

                  {!isStudentMode && (
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRecover(injury.id)}
                        className="flex-1 gap-1 border-green-500/30 text-green-400"
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
                        onClick={() => handleDelete(injury.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && chronicInjuries.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Activity className="w-5 h-5 text-orange-500" />
            Condições Crônicas
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {chronicInjuries.map((injury) => (
              <Card key={injury.id} className="border-orange-500/30 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{injury.bodyPart}</h3>
                        <Badge variant="outline" className="border-orange-500/30 text-orange-400">
                          Crônico
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{injury.description}</p>
                    </div>
                  </div>
                  {injury.notes && (
                    <p className="mt-3 text-sm text-muted-foreground">{injury.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && recoveredInjuries.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Recuperados
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {recoveredInjuries.slice(0, 4).map((injury) => (
              <Card key={injury.id} className="border-green-500/30 bg-card opacity-70">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white">{injury.bodyPart}</h3>
                    <Badge className="bg-green-500/20 text-green-400">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Recuperado
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{injury.description}</p>
                  {injury.dateRecovered && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Recuperado em {format(new Date(injury.dateRecovered), 'dd/MM/yyyy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && injuries.length === 0 && !isAdding && (
        <Card className="border-border border-dashed bg-card">
          <CardContent className="py-12 text-center">
            <Bandage className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium text-white">Nenhuma lesão registrada</h3>
            <p className="mx-auto max-w-md text-muted-foreground">
              {isStudentMode
                ? 'Este aluno não possui lesões registradas no momento.'
                : 'Mantenha-se saudável! Mas se acontecer alguma coisa, registre aqui para acompanhar sua recuperação e evitar treinar grupos afetados.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
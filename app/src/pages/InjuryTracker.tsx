//academy\app\src\pages\InjuryTracker.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Calendar, Activity, CheckCircle2, Trash2, Bandage, User, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
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
import { parseLocalDate, getTodayLocalDateString, formatLocalDate } from '@/lib/date'

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

  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [bodyPart, setBodyPart] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(5);
 const [dateStarted, setDateStarted] = useState(getTodayLocalDateString());
  const [notes, setNotes] = useState('');

  const activeInjuries = useMemo(() => injuries.filter((i) => i.status === 'active'), [injuries]);
  const recoveredInjuries = useMemo(() => injuries.filter((i) => i.status === 'recovered'), [injuries]);
  const chronicInjuries = useMemo(() => injuries.filter((i) => i.status === 'chronic'), [injuries]);

    const loadInjuries = useCallback(async () => {
    if (!effectiveUserId) {
      setInjuries([]);
      setLoading(false);
      return;
    }

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao carregar lesões.';
      toast.error(message);
      setInjuries([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
  void loadInjuries();
}, [loadInjuries]);

    const clearForm = () => {
    setBodyPart('');
    setDescription('');
    setSeverity(5);
    setDateStarted(getTodayLocalDateString());
    setNotes('');
  };

  const openAddForm = () => {
    clearForm();
    setEditingId(null);
    setIsAdding(true);
  };

  const cancelForm = () => {
    clearForm();
    setEditingId(null);
    setIsAdding(false);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const startEdit = (injury: Injury) => {
    setBodyPart(String(injury.bodyPart ?? ''));
    setDescription(injury.description ?? '');
    setSeverity(injury.severity ?? 5);
    setDateStarted(injury.dateStarted || getTodayLocalDateString());
    setNotes(injury.notes ?? '');
    setEditingId(injury.id);
    setIsAdding(true);
    setExpandedIds((prev) => (prev.includes(injury.id) ? prev : [...prev, injury.id]));
  };

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
      if (editingId) {
        const updates = {
          body_part: bodyPart,
          description,
          severity,
          date_started: dateStarted,
          notes: notes || null,
        };

        const { data, error } = await supabase
          .from('injuries')
          .update(updates)
          .eq('id', editingId)
          .eq('user_id', user.id)
          .select(
            'id,user_id,body_part,description,severity,date_started,date_recovered,status,notes,affected_exercises,created_at,updated_at'
          )
          .single();

        if (error) throw error;

        setInjuries((prev) =>
          prev.map((item) => (item.id === editingId ? mapDbToInjury(data as DbInjuryRow) : item))
        );
        toast.success('Lesão atualizada com sucesso ✅');
        cancelForm();
        return;
      }

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
      cancelForm();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : editingId ? 'Erro ao atualizar lesão.' : 'Erro ao registrar lesão.';
      toast.error(message);
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
        date_recovered: getTodayLocalDateString(),
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
    } catch (e: unknown) {
  const message = e instanceof Error ? e.message : 'Erro ao atualizar lesão.';
  toast.error(message);
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
    } catch (e: unknown) {
  const message = e instanceof Error ? e.message : 'Erro ao atualizar lesão.';
  toast.error(message);
}
  };

    const handleDelete = async (id: string) => {
    if (isStudentMode) {
      toast.error('No Modo Aluno, as lesões ficam em visualização nesta versão.');
      return;
    }

    const confirmed = window.confirm('Tem certeza que deseja excluir esta lesão?');
    if (!confirmed) return;

    try {
      setDeletingId(id);

      const { error } = await supabase
        .from('injuries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInjuries((prev) => prev.filter((item) => item.id !== id));
      setExpandedIds((prev) => prev.filter((item) => item !== id));

      if (editingId === id) {
        cancelForm();
      }

      toast.success('Lesão removida.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao excluir lesão.';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const getDaysSince = (date: string) => {
    const parsed = parseLocalDate(date);
    if (!parsed) return 0;
    return differenceInDays(new Date(), parsed);
  };

  const renderInjuryCard = (injury: Injury) => {
    const isExpanded = expandedIds.includes(injury.id);

    const statusMeta =
      injury.status === 'active'
        ? {
            border: 'border-red-500/30',
            badgeClass: severityLabels[injury.severity]?.color || 'bg-gray-500',
            badgeText: `${injury.severity}/10`,
          }
        : injury.status === 'chronic'
          ? {
              border: 'border-orange-500/30',
              badgeClass: 'border-orange-500/30 text-orange-400',
              badgeText: 'Crônico',
            }
          : {
              border: 'border-green-500/30',
              badgeClass: 'bg-green-500/20 text-green-400',
              badgeText: 'Recuperado',
            };

    return (
      <Card key={injury.id} className={`${statusMeta.border} bg-card`}>
        <CardContent className="p-4">
          <div
            className="cursor-pointer"
            onClick={() => toggleExpanded(injury.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-white">{injury.bodyPart}</h3>

                  {injury.status === 'active' ? (
                    <Badge className={statusMeta.badgeClass}>{statusMeta.badgeText}</Badge>
                  ) : injury.status === 'chronic' ? (
                    <Badge variant="outline" className={statusMeta.badgeClass}>
                      {statusMeta.badgeText}
                    </Badge>
                  ) : (
                    <Badge className={statusMeta.badgeClass}>
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {statusMeta.badgeText}
                    </Badge>
                  )}
                </div>

                <p className="mt-1 text-sm text-muted-foreground">{injury.description}</p>

                <p className="mt-2 text-xs text-muted-foreground">
                  <Calendar className="mr-1 inline h-3 w-3" />
                  Início em {formatLocalDate(injury.dateStarted, (d) => format(d, 'dd/MM/yyyy'))}
                  {injury.status !== 'recovered' ? ` • ${getDaysSince(injury.dateStarted)} dias` : ''}
                </p>
              </div>

              <div className="shrink-0 text-muted-foreground">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Local</p>
                  <p className="mt-1 text-sm font-semibold text-white">{injury.bodyPart}</p>
                </div>

                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Severidade</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {injury.severity}/10 • {severityLabels[injury.severity]?.label ?? 'Sem classificação'}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Início</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {formatLocalDate(injury.dateStarted, (d) => format(d, 'dd/MM/yyyy'))}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {injury.status === 'active'
                      ? 'Ativa'
                      : injury.status === 'chronic'
                        ? 'Crônica'
                        : 'Recuperada'}
                  </p>
                </div>
              </div>

              {injury.dateRecovered && (
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Data de recuperação</p>
                  <p className="mt-1 text-sm text-white">
                    {formatLocalDate(injury.dateRecovered, (d) => format(d, 'dd/MM/yyyy'))}
                  </p>
                </div>
              )}

              {injury.notes && (
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Observações</p>
                  <p className="mt-1 text-sm text-white">{injury.notes}</p>
                </div>
              )}

              {!isStudentMode && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(injury);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>

                  {injury.status === 'active' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRecover(injury.id);
                        }}
                        className="gap-1 border-green-500/30 text-green-400"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Recuperado
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkChronic(injury.id);
                        }}
                        className="text-muted-foreground"
                      >
                        Crônico
                      </Button>
                    </>
                  )}

                  {injury.status === 'chronic' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecover(injury.id);
                      }}
                      className="gap-1 border-green-500/30 text-green-400"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Recuperado
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deletingId === injury.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(injury.id);
                    }}
                    className="gap-1 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingId === injury.id ? 'Excluindo...' : 'Excluir'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

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
          <Button onClick={() => (isAdding ? cancelForm() : openAddForm())} className="gap-2">
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
              {editingId ? 'Editar Lesão' : 'Nova Lesão'}
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

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleSubmit} className="flex-1 gap-2">
                {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingId ? 'Salvar Alterações' : 'Registrar Lesão'}
              </Button>

              <Button variant="outline" onClick={cancelForm} className="flex-1">
                Cancelar
              </Button>
            </div>
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
            {activeInjuries.map((injury) => renderInjuryCard(injury))}
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
            {chronicInjuries.map((injury) => renderInjuryCard(injury))}
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
            {recoveredInjuries.map((injury) => renderInjuryCard(injury))}
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
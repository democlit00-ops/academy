import { useEffect, useMemo, useRef, useState } from 'react';
import { Share2, Download, Camera, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { WorkoutSession, CardioSession, WeekDay } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateWorkoutVolume } from '@/lib/calculations';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ShareWorkoutProps {
  workouts: WorkoutSession[];
  cardio?: CardioSession[];
  selectedUserId?: string | null;
  selectedUserLabel?: string | null;
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

export function ShareWorkout({
  workouts,
  selectedUserId,
  selectedUserLabel,
}: ShareWorkoutProps) {
  const { user } = useAuth();

  const effectiveUserId = selectedUserId || user?.id || null;
  const isStudentMode = !!selectedUserId;

  const [selectedWorkoutId, setSelectedWorkoutId] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'blue' | 'purple' | 'green'>('dark');
  const [dbWorkouts, setDbWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

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
          .order('session_date', { ascending: false });

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
        toast.error(e?.message ?? 'Erro ao carregar treinos para compartilhamento.');
        setDbWorkouts([]);
      } finally {
        setLoading(false);
      }
    };

    void loadStudentWorkouts();
  }, [effectiveUserId, isStudentMode]);

  const effectiveWorkouts = isStudentMode ? dbWorkouts : workouts;

  const recentWorkouts = useMemo(() => {
    return [...effectiveWorkouts]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [effectiveWorkouts]);

  const selectedWorkout = useMemo(() => {
    return effectiveWorkouts.find((w) => w.id === selectedWorkoutId);
  }, [effectiveWorkouts, selectedWorkoutId]);

  const themeStyles = {
    dark: 'bg-gradient-to-br from-gray-900 to-black text-white',
    blue: 'bg-gradient-to-br from-blue-600 to-blue-900 text-white',
    purple: 'bg-gradient-to-br from-purple-600 to-pink-600 text-white',
    green: 'bg-gradient-to-br from-emerald-600 to-teal-800 text-white',
  };

  const handleDownload = async () => {
    if (!canvasRef.current || !selectedWorkout) return;

    try {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
          <rect width="100%" height="100%" fill="url(#grad)"/>
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${selectedTheme === 'blue' ? '#2563eb' : selectedTheme === 'purple' ? '#9333ea' : selectedTheme === 'green' ? '#059669' : '#1f2937'};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${selectedTheme === 'blue' ? '#1e40af' : selectedTheme === 'purple' ? '#db2777' : selectedTheme === 'green' ? '#0f766e' : '#000000'};stop-opacity:1" />
            </linearGradient>
          </defs>
          <text x="50%" y="30%" text-anchor="middle" fill="white" font-size="48" font-family="sans-serif" font-weight="bold">
            💪 TREINO COMPLETO
          </text>
          <text x="50%" y="45%" text-anchor="middle" fill="white" font-size="72" font-family="sans-serif" font-weight="bold">
            ${(calculateWorkoutVolume(selectedWorkout) / 1000).toFixed(1)}k kg
          </text>
          <text x="50%" y="55%" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="32" font-family="sans-serif">
            Volume Total
          </text>
          <text x="50%" y="75%" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="24" font-family="sans-serif">
            FitTrack Pro
          </text>
        </svg>
      `;

      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `treino-${selectedWorkout.date || 'hoje'}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Imagem baixada!');
    } catch {
      toast.error('Erro ao gerar imagem');
    }
  };

  const handleShareText = async () => {
    if (!selectedWorkout) return;

    const volume = calculateWorkoutVolume(selectedWorkout);
    const text = `💪 Treino de ${selectedWorkout.weekDay} na FitTrack Pro!\n\n📊 Volume: ${(volume / 1000).toFixed(1)}k kg\n🏋️ ${selectedWorkout.exercises.length} exercícios\n\n${selectedWorkout.exercises
      .map((e) => `• ${e.exerciseName}: ${e.sets.length}x${e.sets[0]?.reps} @ ${e.sets[0]?.weight}kg`)
      .join('\n')}`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Texto copiado! Cole no Instagram/WhatsApp');
    } catch {
      toast.error('Não foi possível copiar o texto.');
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Compartilhar Treino</h1>
          <p className="text-muted-foreground">
            {isStudentMode
              ? 'Gere imagens com os treinos do aluno selecionado'
              : 'Gere imagens para suas redes sociais'}
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
            <p className="mt-2 text-sm text-muted-foreground">Carregando treinos do aluno...</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Camera className="w-5 h-5 text-primary" />
              Configurar Imagem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Selecionar Treino</Label>
              <Select value={selectedWorkoutId} onValueChange={setSelectedWorkoutId}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Escolha um treino" />
                </SelectTrigger>
                <SelectContent>
                  {recentWorkouts.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {format(new Date(w.date), 'dd/MM')} - {w.weekDay} ({w.exercises.length} exercícios)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Tema</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['dark', 'blue', 'purple', 'green'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setSelectedTheme(theme)}
                    className={`h-12 rounded-lg transition-all ${themeStyles[theme]} ${
                      selectedTheme === theme ? 'scale-105 ring-2 ring-white' : 'opacity-70'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleDownload}
                className="flex-1 gap-2"
                disabled={!selectedWorkout}
              >
                <Download className="w-4 h-4" />
                Baixar Imagem
              </Button>
              <Button
                onClick={handleShareText}
                variant="outline"
                className="flex-1 gap-2"
                disabled={!selectedWorkout}
              >
                <Share2 className="w-4 h-4" />
                Copiar Texto
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedWorkout ? (
              <div
                ref={canvasRef}
                className={`aspect-square rounded-xl p-8 flex flex-col items-center justify-center text-center ${themeStyles[selectedTheme]}`}
              >
                <div className="mb-4 text-6xl">💪</div>
                <h2 className="mb-2 text-2xl font-bold">TREINO {selectedWorkout.weekDay.toUpperCase()}</h2>
                <p className="mb-6 text-white/60">
                  {format(new Date(selectedWorkout.date), "dd 'de' MMMM", { locale: ptBR })}
                </p>

                <div className="mb-2 text-6xl font-bold">
                  {(calculateWorkoutVolume(selectedWorkout) / 1000).toFixed(1)}k
                </div>
                <p className="mb-8 text-white/60">kg de volume</p>

                <div className="grid w-full max-w-xs grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{selectedWorkout.exercises.length}</div>
                    <div className="text-xs text-white/60">Exercícios</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {selectedWorkout.exercises.reduce((sum, e) => sum + e.sets.length, 0)}
                    </div>
                    <div className="text-xs text-white/60">Séries</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {Math.round(
                        selectedWorkout.exercises.reduce((sum, e) => sum + e.rpe, 0) /
                          selectedWorkout.exercises.length
                      )}
                    </div>
                    <div className="text-xs text-white/60">RPE Médio</div>
                  </div>
                </div>

                <div className="mt-8 text-sm text-white/40">FitTrack Pro</div>
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl bg-muted">
                <p className="text-muted-foreground">
                  {loading ? 'Carregando treinos...' : 'Selecione um treino para ver o preview'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedWorkout && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white">Legendas Prontas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="mb-2 text-sm text-muted-foreground">Instagram</p>
              <p className="text-white whitespace-pre-line">
                {`💪 Treino de ${selectedWorkout.weekDay} finalizado!\n\n📊 Volume: ${(calculateWorkoutVolume(selectedWorkout) / 1000).toFixed(1)}k kg\n🏋️ ${selectedWorkout.exercises.length} exercícios\n\n#fitness #academia #treino #fittrack`}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="mb-2 text-sm text-muted-foreground">WhatsApp</p>
              <p className="text-white whitespace-pre-line">
                {`Treino de hoje: ${selectedWorkout.exercises.map((e) => e.exerciseName).join(', ')}\nVolume total: ${(calculateWorkoutVolume(selectedWorkout) / 1000).toFixed(1)}k kg 💪`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && recentWorkouts.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum treino encontrado para compartilhar
          </CardContent>
        </Card>
      )}
    </div>
  );
}
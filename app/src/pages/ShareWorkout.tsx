import { useRef, useState } from 'react';
import { Share2, Download, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { WorkoutSession, CardioSession } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateWorkoutVolume } from '@/lib/calculations';

interface ShareWorkoutProps {
  workouts: WorkoutSession[];
  cardio?: CardioSession[];
}

export function ShareWorkout({ workouts }: ShareWorkoutProps) {
  const [selectedWorkoutId, setSelectedWorkoutId] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'blue' | 'purple' | 'green'>('dark');
  const canvasRef = useRef<HTMLDivElement>(null);

  const recentWorkouts = [...workouts].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ).slice(0, 10);

  const selectedWorkout = workouts.find(w => w.id === selectedWorkoutId);

  const themeStyles = {
    dark: 'bg-gradient-to-br from-gray-900 to-black text-white',
    blue: 'bg-gradient-to-br from-blue-600 to-blue-900 text-white',
    purple: 'bg-gradient-to-br from-purple-600 to-pink-600 text-white',
    green: 'bg-gradient-to-br from-emerald-600 to-teal-800 text-white',
  };

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    
    try {
      // Simulação de download - em produção usaria html2canvas
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
            ${selectedWorkout ? (calculateWorkoutVolume(selectedWorkout) / 1000).toFixed(1) : '0'}k kg
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
      a.download = `treino-${selectedWorkout?.date || 'hoje'}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Imagem baixada!');
    } catch (error) {
      toast.error('Erro ao gerar imagem');
    }
  };

  const handleShareText = () => {
    if (!selectedWorkout) return;
    
    const volume = calculateWorkoutVolume(selectedWorkout);
    const text = `💪 Treino de ${selectedWorkout.weekDay} na FitTrack Pro!\n\n📊 Volume: ${(volume / 1000).toFixed(1)}k kg\n🏋️ ${selectedWorkout.exercises.length} exercícios\n\n${selectedWorkout.exercises.map(e => `• ${e.exerciseName}: ${e.sets.length}x${e.sets[0]?.reps} @ ${e.sets[0]?.weight}kg`).join('\n')}`;
    
    navigator.clipboard.writeText(text);
    toast.success('Texto copiado! Cole no Instagram/WhatsApp');
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Compartilhar Treino</h1>
          <p className="text-muted-foreground">Gere imagens para suas redes sociais</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurações */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
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
                  {recentWorkouts.map(w => (
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
                {(['dark', 'blue', 'purple', 'green'] as const).map(theme => (
                  <button
                    key={theme}
                    onClick={() => setSelectedTheme(theme)}
                    className={`h-12 rounded-lg transition-all ${themeStyles[theme]} ${
                      selectedTheme === theme ? 'ring-2 ring-white scale-105' : 'opacity-70'
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

        {/* Preview */}
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
                <div className="text-6xl mb-4">💪</div>
                <h2 className="text-2xl font-bold mb-2">TREINO {selectedWorkout.weekDay.toUpperCase()}</h2>
                <p className="text-white/60 mb-6">
                  {format(new Date(selectedWorkout.date), "dd 'de' MMMM", { locale: ptBR })}
                </p>
                
                <div className="text-6xl font-bold mb-2">
                  {(calculateWorkoutVolume(selectedWorkout) / 1000).toFixed(1)}k
                </div>
                <p className="text-white/60 mb-8">kg de volume</p>

                <div className="grid grid-cols-3 gap-6 w-full max-w-xs">
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
                      {Math.round(selectedWorkout.exercises.reduce((sum, e) => sum + e.rpe, 0) / selectedWorkout.exercises.length)}
                    </div>
                    <div className="text-xs text-white/60">RPE Médio</div>
                  </div>
                </div>

                <div className="mt-8 text-white/40 text-sm">
                  FitTrack Pro
                </div>
              </div>
            ) : (
              <div className="aspect-square rounded-xl bg-muted flex items-center justify-center">
                <p className="text-muted-foreground">Selecione um treino para ver o preview</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Templates de texto */}
      {selectedWorkout && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white">Legendas Prontas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Instagram</p>
              <p className="text-white">
                💪 Treino de {selectedWorkout.weekDay} finalizado!\n\n
                📊 Volume: {(calculateWorkoutVolume(selectedWorkout) / 1000).toFixed(1)}k kg\n
                🏋️ {selectedWorkout.exercises.length} exercícios\n\n
                #fitness #academia #treino #fittrack
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">WhatsApp</p>
              <p className="text-white">
                Treino de hoje: {selectedWorkout.exercises.map(e => e.exerciseName).join(', ')}\n
                Volume total: {(calculateWorkoutVolume(selectedWorkout) / 1000).toFixed(1)}k kg 💪
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Import necessário
import { Label } from '@/components/ui/label';

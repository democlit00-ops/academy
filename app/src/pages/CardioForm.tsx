import { useState } from 'react';
import { Heart, Save, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CARDIO_TYPES, HEART_RATE_ZONES } from '@/data/exercises';
import type { CardioSession, CardioType, HeartRateZone } from '@/types';
import { format } from 'date-fns';

interface CardioFormProps {
  onSave: (cardio: CardioSession) => void;
}

export function CardioForm({ onSave }: CardioFormProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [type, setType] = useState<CardioType>('Esteira');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [avgSpeed, setAvgSpeed] = useState('');
  const [avgHeartRate, setAvgHeartRate] = useState('');
  const [maxHeartRate, setMaxHeartRate] = useState('');
  const [calories, setCalories] = useState('');
  const [steps, setSteps] = useState('');
  const [heartRateZone, setHeartRateZone] = useState<HeartRateZone>('Zona 2');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!duration) {
      toast.error('Informe a duração do treino');
      return;
    }

    const cardio: CardioSession = {
      id: crypto.randomUUID(),
      date,
      type,
      duration: parseInt(duration),
      distance: distance ? parseFloat(distance) : undefined,
      avgSpeed: avgSpeed ? parseFloat(avgSpeed) : undefined,
      avgHeartRate: avgHeartRate ? parseInt(avgHeartRate) : undefined,
      maxHeartRate: maxHeartRate ? parseInt(maxHeartRate) : undefined,
      calories: calories ? parseInt(calories) : undefined,
      steps: steps ? parseInt(steps) : undefined,
      heartRateZone,
      notes: notes || undefined,
    };

    onSave(cardio);
    toast.success('Cardio registrado com sucesso!');

    // Reset form
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setDuration('');
    setDistance('');
    setAvgSpeed('');
    setAvgHeartRate('');
    setMaxHeartRate('');
    setCalories('');
    setSteps('');
    setNotes('');
  };

  const selectedZone = HEART_RATE_ZONES.find(z => z.zone === heartRateZone);

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cardio</h1>
          <p className="text-muted-foreground">Registre seus treinos cardiovasculares</p>
        </div>
      </div>

      {/* Formulário */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Novo Treino Cardio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Data e Tipo */}
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
              <Label htmlFor="type">Tipo de Atividade</Label>
              <Select value={type} onValueChange={(v) => setType(v as CardioType)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARDIO_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Métricas principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">
                Duração <span className="text-red-500">*</span>
              </Label>
              <Input
                id="duration"
                type="number"
                placeholder="min"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distance">Distância (km)</Label>
              <Input
                id="distance"
                type="number"
                step="0.01"
                placeholder="km"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avgSpeed">Vel. Média (km/h)</Label>
              <Input
                id="avgSpeed"
                type="number"
                step="0.1"
                placeholder="km/h"
                value={avgSpeed}
                onChange={(e) => setAvgSpeed(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calories">Calorias</Label>
              <Input
                id="calories"
                type="number"
                placeholder="kcal"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          {/* Frequência cardíaca */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="avgHeartRate">FC Média (bpm)</Label>
              <Input
                id="avgHeartRate"
                type="number"
                placeholder="bpm"
                value={avgHeartRate}
                onChange={(e) => setAvgHeartRate(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxHeartRate">FC Máxima (bpm)</Label>
              <Input
                id="maxHeartRate"
                type="number"
                placeholder="bpm"
                value={maxHeartRate}
                onChange={(e) => setMaxHeartRate(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="steps">Passos</Label>
              <Input
                id="steps"
                type="number"
                placeholder="passos"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone">Zona Cardíaca</Label>
              <Select value={heartRateZone} onValueChange={(v) => setHeartRateZone(v as HeartRateZone)}>
                <SelectTrigger 
                  className="bg-background border-border"
                  style={{ borderColor: selectedZone?.color }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEART_RATE_ZONES.map(z => (
                    <SelectItem key={z.zone} value={z.zone}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: z.color }}
                        />
                        {z.zone} - {z.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info da zona cardíaca */}
          {selectedZone && (
            <div 
              className="p-3 rounded-lg flex items-center gap-3"
              style={{ backgroundColor: `${selectedZone.color}15` }}
            >
              <Flame className="w-5 h-5" style={{ color: selectedZone.color }} />
              <div>
                <p className="text-sm font-medium" style={{ color: selectedZone.color }}>
                  {selectedZone.zone}: {selectedZone.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Intensidade {selectedZone.range} da FC máxima
                </p>
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input
              id="notes"
              placeholder="Como foi o treino?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* Botão salvar */}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} size="lg" className="gap-2">
              <Save className="w-5 h-5" />
              Registrar Cardio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

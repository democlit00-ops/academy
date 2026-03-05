import { useState } from 'react';
import { Activity, Moon, Save, Heart, Wind, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import type { PhysiologicalData } from '@/types';
import { parseTimeToDecimal } from '@/lib/calculations';
import { format } from 'date-fns';

interface PhysiologicalControlProps {
  onSave: (data: PhysiologicalData) => void;
  physioData: PhysiologicalData[];
}

export function PhysiologicalControl({ onSave, physioData }: PhysiologicalControlProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [weight, setWeight] = useState('');
  const [restingHR, setRestingHR] = useState('');
  const [sleepHR, setSleepHR] = useState('');
  const [sleepTotal, setSleepTotal] = useState('07:00');
  const [sleepREM, setSleepREM] = useState('');
  const [sleepLight, setSleepLight] = useState('');
  const [sleepDeep, setSleepDeep] = useState('');
  const [awakeTime, setAwakeTime] = useState('');
  const [spo2, setSpo2] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [fatigue, setFatigue] = useState(5);
  const [notes, setNotes] = useState('');

  // Calcular sono total em horas decimais
  const sleepTotalHours = parseTimeToDecimal(sleepTotal);

  const handleSubmit = () => {
    const data: PhysiologicalData = {
      id: crypto.randomUUID(),
      date,
      weight: weight ? parseFloat(weight) : undefined,
      restingHeartRate: restingHR ? parseInt(restingHR) : undefined,
      sleepHeartRate: sleepHR ? parseInt(sleepHR) : undefined,
      sleepTotal,
      sleepTotalHours,
      sleepREM: sleepREM ? parseInt(sleepREM) : undefined,
      sleepLight: sleepLight ? parseInt(sleepLight) : undefined,
      sleepDeep: sleepDeep ? parseInt(sleepDeep) : undefined,
      awakeTime: awakeTime ? parseInt(awakeTime) : undefined,
      spo2: spo2 ? parseInt(spo2) : undefined,
      respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
      fatigue,
      notes: notes || undefined,
    };

    onSave(data);
    toast.success('Dados fisiológicos salvos!');

    // Reset
    setWeight('');
    setRestingHR('');
    setSleepHR('');
    setSleepTotal('07:00');
    setSleepREM('');
    setSleepLight('');
    setSleepDeep('');
    setAwakeTime('');
    setSpo2('');
    setRespiratoryRate('');
    setFatigue(5);
    setNotes('');
  };

  // Último registro
  const latestData = physioData[physioData.length - 1];

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Controle Fisiológico</h1>
          <p className="text-muted-foreground">Monitore seus indicadores de recuperação</p>
        </div>
      </div>

      {/* Cards de resumo */}
      {latestData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-xs">FC Repouso</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {latestData.restingHeartRate || '--'}
                <span className="text-sm font-normal text-muted-foreground ml-1">bpm</span>
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Moon className="w-4 h-4" />
                <span className="text-xs">Sono</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {latestData.sleepTotalHours?.toFixed(1) || '--'}
                <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Droplets className="w-4 h-4" />
                <span className="text-xs">SpO2</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {latestData.spo2 || '--'}
                <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Wind className="w-4 h-4" />
                <span className="text-xs">Respiração</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {latestData.respiratoryRate || '--'}
                <span className="text-sm font-normal text-muted-foreground ml-1">rpm</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Formulário */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Novo Registro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Data e Peso */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                placeholder="kg"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restingHR">FC Repouso</Label>
              <Input
                id="restingHR"
                type="number"
                placeholder="bpm"
                value={restingHR}
                onChange={(e) => setRestingHR(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sleepHR">FC Média Sono</Label>
              <Input
                id="sleepHR"
                type="number"
                placeholder="bpm"
                value={sleepHR}
                onChange={(e) => setSleepHR(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          {/* Sono */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Moon className="w-4 h-4 text-blue-400" />
              Sono
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sleepTotal">Total (hh:mm)</Label>
                <Input
                  id="sleepTotal"
                  type="time"
                  value={sleepTotal}
                  onChange={(e) => setSleepTotal(e.target.value)}
                  className="bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">
                  = {sleepTotalHours.toFixed(2)}h
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sleepREM">REM (min)</Label>
                <Input
                  id="sleepREM"
                  type="number"
                  placeholder="min"
                  value={sleepREM}
                  onChange={(e) => setSleepREM(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sleepLight">Leve (min)</Label>
                <Input
                  id="sleepLight"
                  type="number"
                  placeholder="min"
                  value={sleepLight}
                  onChange={(e) => setSleepLight(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sleepDeep">Profundo (min)</Label>
                <Input
                  id="sleepDeep"
                  type="number"
                  placeholder="min"
                  value={sleepDeep}
                  onChange={(e) => setSleepDeep(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="awakeTime">Acordado (min)</Label>
                <Input
                  id="awakeTime"
                  type="number"
                  placeholder="min"
                  value={awakeTime}
                  onChange={(e) => setAwakeTime(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </div>
          </div>

          {/* Outros indicadores */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="spo2">SpO2 Média (%)</Label>
              <Input
                id="spo2"
                type="number"
                placeholder="%"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="respiratoryRate">Freq. Respiratória (rpm)</Label>
              <Input
                id="respiratoryRate"
                type="number"
                placeholder="rpm"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Cansaço (1-10): {fatigue}</Label>
              <Slider
                value={[fatigue]}
                onValueChange={([v]) => setFatigue(v)}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Descansado</span>
                <span>Exausto</span>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input
              id="notes"
              placeholder="Como você se sente hoje?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* Botão salvar */}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} size="lg" className="gap-2">
              <Save className="w-5 h-5" />
              Salvar Registro
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

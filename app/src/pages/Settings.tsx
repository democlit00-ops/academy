import { useState } from 'react';
import { Settings as SettingsIcon, User, Trash2, Download, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { UserSettings } from '@/types';
import { useAuth } from "../contexts/AuthContext";


interface SettingsProps {
  settings: UserSettings;
  onSaveSettings: (settings: UserSettings) => void;
  onClearData: () => void;
  onExportData: () => void;
}

export function Settings({ settings, onSaveSettings, onClearData, onExportData }: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const { user, signOut } = useAuth();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleSave = () => {
    onSaveSettings(localSettings);
    toast.success('Configurações salvas!');
  };

  const handleClearData = () => {
    onClearData();
    setShowClearConfirm(false);
    toast.success('Todos os dados foram apagados!');
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações</h1>
          <p className="text-muted-foreground">Personalize o FitTrack Pro</p>
        </div>
      </div>

      {/* Perfil do usuário */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={localSettings.name}
                onChange={(e) => setLocalSettings({ ...localSettings, name: e.target.value })}
                placeholder="Seu nome"
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Idade</Label>
              <Input
                type="number"
                value={localSettings.age || ''}
                onChange={(e) => setLocalSettings({ 
                  ...localSettings, 
                  age: parseInt(e.target.value) || undefined 
                })}
                placeholder="anos"
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={localSettings.weight || ''}
                onChange={(e) => setLocalSettings({ 
                  ...localSettings, 
                  weight: parseFloat(e.target.value) || undefined 
                })}
                placeholder="kg"
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Altura (cm)</Label>
              <Input
                type="number"
                value={localSettings.height || ''}
                onChange={(e) => setLocalSettings({ 
                  ...localSettings, 
                  height: parseInt(e.target.value) || undefined 
                })}
                placeholder="cm"
                className="bg-background border-border"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas cardíacas */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-red-500" />
            Métricas Cardíacas
          </CardTitle>
          <CardDescription>
            Configure suas zonas cardíacas para análises mais precisas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>FC Máxima (bpm)</Label>
              <Input
                type="number"
                value={localSettings.maxHeartRate || ''}
                onChange={(e) => setLocalSettings({ 
                  ...localSettings, 
                  maxHeartRate: parseInt(e.target.value) || undefined 
                })}
                placeholder="220 - idade"
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>FC de Repouso (bpm)</Label>
              <Input
                type="number"
                value={localSettings.restingHeartRate || ''}
                onChange={(e) => setLocalSettings({ 
                  ...localSettings, 
                  restingHeartRate: parseInt(e.target.value) || undefined 
                })}
                placeholder="bpm"
                className="bg-background border-border"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferências */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white">Preferências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select 
                value={localSettings.fitnessGoal || 'Geral'} 
                onValueChange={(v) => setLocalSettings({ 
                  ...localSettings, 
                  fitnessGoal: v as any 
                })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hipertrofia">Hipertrofia</SelectItem>
                  <SelectItem value="Força">Força</SelectItem>
                  <SelectItem value="Resistência">Resistência</SelectItem>
                  <SelectItem value="Emagrecimento">Emagrecimento</SelectItem>
                  <SelectItem value="Geral">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade de Peso</Label>
              <Select 
                value={localSettings.preferredUnits.weight} 
                onValueChange={(v) => setLocalSettings({ 
                  ...localSettings, 
                  preferredUnits: { ...localSettings.preferredUnits, weight: v as 'kg' | 'lbs' }
                })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                  <SelectItem value="lbs">Libras (lbs)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white">Gerenciamento de Dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={onExportData}
            >
              <Download className="w-4 h-4" />
              Exportar Dados
            </Button>
            
            {!showClearConfirm ? (
              <Button 
                variant="destructive" 
                className="gap-2"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 className="w-4 h-4" />
                Limpar Todos os Dados
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="destructive"
                  onClick={handleClearData}
                >
                  Confirmar
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conta */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              <div className="text-white">Logado como:</div>
              <div>{user?.email ?? "-"}</div>
            </div>
            <Button variant="destructive" onClick={() => signOut()}>Sair</Button>
          </div>
        </CardContent>
      </Card>

      {/* Sobre */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Sobre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-white">FitTrack Pro</strong> v1.0</p>
            <p>Sistema completo para controle de treino de academia e análise fisiológica.</p>
            <p>Desenvolvido com React, TypeScript e Tailwind CSS.</p>
          </div>
        </CardContent>
      </Card>

      {/* Botão salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" className="gap-2">
          <SettingsIcon className="w-5 h-5" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}

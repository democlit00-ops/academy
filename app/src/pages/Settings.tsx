import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, User, Trash2, Info, KeyRound, AlertTriangle, LogOut } from 'lucide-react';
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
  onSaveSettings: (settings: UserSettings) => void | Promise<void>;
  onClearData: () => void | Promise<void>;
  onRequestPasswordReset?: () => void | Promise<void>;
  coachName?: string | null;
}

export function Settings({
  settings,
  onSaveSettings,
  onClearData,
  onRequestPasswordReset,
  coachName = null,
}: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const { user, signOut } = useAuth();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSaveSettings(localSettings);
    } finally {
      setSaving(false);
    }
  };

  const handleClearData = async () => {
    if (clearConfirmText.trim().toUpperCase() !== 'APAGAR') {
      toast.error('Digite APAGAR para confirmar.');
      return;
    }

    try {
      setClearing(true);
      await onClearData();
      setShowClearConfirm(false);
      setClearConfirmText('');
    } finally {
      setClearing(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!onRequestPasswordReset) {
      toast.info('Fluxo de redefinição de senha ainda não configurado nesta tela.');
      return;
    }

    try {
      setSendingReset(true);
      await onRequestPasswordReset();
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações</h1>
          <p className="text-muted-foreground">Personalize o FitTrack Pro</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Conta
          </CardTitle>
          <CardDescription>
            Informações da sua conta e acesso
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={user?.email ?? ''}
                disabled
                className="bg-background border-border opacity-80"
              />
            </div>

            <div className="space-y-2">
              <Label>Professor vinculado</Label>
              <Input
                value={coachName ?? 'Nenhum professor vinculado'}
                disabled
                className="bg-background border-border opacity-80"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handlePasswordReset}
              disabled={sendingReset}
            >
              <KeyRound className="w-4 h-4" />
              {sendingReset ? 'Enviando...' : 'Mudar senha'}
            </Button>

            <Button variant="destructive" className="gap-2" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Perfil
          </CardTitle>
          <CardDescription>
            Dados base do usuário para análises e cálculos
          </CardDescription>
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
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    age: parseInt(e.target.value) || undefined,
                  })
                }
                placeholder="anos"
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Peso atual (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={localSettings.weight || ''}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    weight: parseFloat(e.target.value) || undefined,
                  })
                }
                placeholder="kg"
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Altura (cm)</Label>
              <Input
                type="number"
                value={localSettings.height || ''}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    height: parseInt(e.target.value) || undefined,
                  })
                }
                placeholder="cm"
                className="bg-background border-border"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-3 text-sm text-muted-foreground">
            O peso salvo aqui representa o valor atual/base do perfil. Quando houver registro fisiológico
            mais recente com peso, esse valor pode ser atualizado automaticamente.
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white">Preferências</CardTitle>
          <CardDescription>
            Configurações gerais do usuário
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select
                value={localSettings.fitnessGoal || 'Geral'}
                onValueChange={(v) =>
                  setLocalSettings({
                    ...localSettings,
                    fitnessGoal: v as UserSettings['fitnessGoal'],
                  })
                }
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
                onValueChange={(v) =>
                  setLocalSettings({
                    ...localSettings,
                    preferredUnits: {
                      ...localSettings.preferredUnits,
                      weight: v as 'kg' | 'lbs',
                    },
                  })
                }
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

      <Card className="bg-card border-red-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Zona de perigo
          </CardTitle>
          <CardDescription>
            Ações destrutivas da conta do usuário
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
            Isso vai apagar todos os registros do usuário no banco de dados, como treinos, cardio,
            fisiológico e lesões. A conta, o perfil/configurações e o vínculo com professor não serão apagados.
          </div>

          {!showClearConfirm ? (
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="w-4 h-4" />
              Apagar todos os meus dados
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-red-500/20 bg-background/40 p-4">
              <div className="text-sm text-white">
                Digite <strong>APAGAR</strong> para confirmar.
              </div>

              <Input
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="Digite APAGAR"
                className="bg-background border-border"
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="destructive" onClick={handleClearData} disabled={clearing}>
                  {clearing ? 'Apagando...' : 'Confirmar exclusão'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowClearConfirm(false);
                    setClearConfirmText('');
                  }}
                  disabled={clearing}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
            <p>Desenvolvido por Kito Biten.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" className="gap-2" disabled={saving}>
          <SettingsIcon className="w-5 h-5" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
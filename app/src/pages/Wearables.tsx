import { useState } from 'react';
import { Watch, Smartphone, Activity, Heart, Moon, Footprints, Bluetooth, Check, X, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface WearableDevice {
  id: string;
  name: string;
  brand: string;
  icon: React.ReactNode;
  connected: boolean;
  lastSync?: string;
  dataTypes: string[];
}

interface WearablesProps {
  onSync?: (deviceId: string) => void;
}

export function Wearables({ onSync }: WearablesProps) {
  const [devices, setDevices] = useState<WearableDevice[]>([
    {
      id: 'apple-watch',
      name: 'Apple Watch',
      brand: 'Apple',
      icon: <Watch className="w-8 h-8" />,
      connected: false,
      dataTypes: ['FC', 'Passos', 'Sono', 'Calorias'],
    },
    {
      id: 'garmin',
      name: 'Garmin Connect',
      brand: 'Garmin',
      icon: <Activity className="w-8 h-8" />,
      connected: false,
      dataTypes: ['FC', 'Passos', 'Sono', 'Calorias', 'GPS'],
    },
    {
      id: 'mi-band',
      name: 'Mi Band / Xiaomi',
      brand: 'Xiaomi',
      icon: <Heart className="w-8 h-8" />,
      connected: false,
      dataTypes: ['FC', 'Passos', 'Sono'],
    },
    {
      id: 'samsung',
      name: 'Galaxy Watch',
      brand: 'Samsung',
      icon: <Smartphone className="w-8 h-8" />,
      connected: false,
      dataTypes: ['FC', 'Passos', 'Sono', 'Calorias'],
    },
    {
      id: 'fitbit',
      name: 'Fitbit',
      brand: 'Google',
      icon: <Footprints className="w-8 h-8" />,
      connected: false,
      dataTypes: ['FC', 'Passos', 'Sono', 'Calorias'],
    },
    {
      id: 'polar',
      name: 'Polar',
      brand: 'Polar',
      icon: <Heart className="w-8 h-8" />,
      connected: false,
      dataTypes: ['FC', 'Calorias', 'GPS'],
    },
  ]);

  const [autoSync, setAutoSync] = useState(false);

  const handleConnect = (deviceId: string) => {
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId) {
        const newConnected = !d.connected;
        if (newConnected) {
          toast.success(`${d.name} conectado!`);
        } else {
          toast.info(`${d.name} desconectado`);
        }
        return { ...d, connected: newConnected, lastSync: newConnected ? new Date().toISOString() : undefined };
      }
      return d;
    }));
  };

  const handleSync = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device?.connected) {
      toast.error('Conecte o dispositivo primeiro');
      return;
    }
    
    setDevices(prev => prev.map(d => 
      d.id === deviceId ? { ...d, lastSync: new Date().toISOString() } : d
    ));
    
    toast.success(`Dados sincronizados com ${device.name}`);
    onSync?.(deviceId);
  };

  const handleSyncAll = () => {
    const connectedDevices = devices.filter(d => d.connected);
    if (connectedDevices.length === 0) {
      toast.error('Nenhum dispositivo conectado');
      return;
    }
    
    connectedDevices.forEach(d => handleSync(d.id));
    toast.success('Todos os dispositivos sincronizados!');
  };

  const connectedCount = devices.filter(d => d.connected).length;

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Integração com Wearables</h1>
          <p className="text-muted-foreground">Conecte seus dispositivos de fitness</p>
        </div>
        <Badge variant={connectedCount > 0 ? 'default' : 'secondary'} className="gap-1">
          <Bluetooth className="w-4 h-4" />
          {connectedCount} {connectedCount === 1 ? 'conectado' : 'conectados'}
        </Badge>
      </div>

      {/* Status geral */}
      <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/30">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <RefreshCw className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Sincronização Automática</h3>
                <p className="text-sm text-muted-foreground">
                  Sincronize dados automaticamente ao abrir o app
                </p>
              </div>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
        </CardContent>
      </Card>

      {/* Botão sincronizar tudo */}
      {connectedCount > 0 && (
        <Button onClick={handleSyncAll} className="w-full gap-2">
          <RefreshCw className="w-4 h-4" />
          Sincronizar Todos os Dispositivos
        </Button>
      )}

      {/* Lista de dispositivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map(device => (
          <Card 
            key={device.id} 
            className={`bg-card border transition-all ${
              device.connected ? 'border-green-500/30' : 'border-border'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    device.connected ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'
                  }`}>
                    {device.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{device.name}</h3>
                    <p className="text-sm text-muted-foreground">{device.brand}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {device.dataTypes.map(type => (
                        <span key={type} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {device.connected ? (
                    <>
                      <Badge className="bg-green-500/20 text-green-400 gap-1">
                        <Check className="w-3 h-3" />
                        Conectado
                      </Badge>
                      {device.lastSync && (
                        <p className="text-xs text-muted-foreground">
                          Sync: {new Date(device.lastSync).toLocaleTimeString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <X className="w-3 h-3" />
                      Desconectado
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant={device.connected ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => handleConnect(device.id)}
                  className="flex-1"
                >
                  {device.connected ? 'Desconectar' : 'Conectar'}
                </Button>
                {device.connected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(device.id)}
                    className="gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Sync
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dados sincronizados */}
      {connectedCount > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Dados Sincronizados
            </CardTitle>
            <CardDescription>
              Últimos dados recebidos dos seus dispositivos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <Heart className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">--</p>
                <p className="text-xs text-muted-foreground">FC Média</p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center">
                <Footprints className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">--</p>
                <p className="text-xs text-muted-foreground">Passos Hoje</p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center">
                <Moon className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">--</p>
                <p className="text-xs text-muted-foreground">Sono (h)</p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center">
                <Activity className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">--</p>
                <p className="text-xs text-muted-foreground">Calorias</p>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Conecte um dispositivo para ver seus dados em tempo real
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="bg-card border-border">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Bluetooth className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">Como funciona?</h3>
              <p className="text-sm text-muted-foreground">
                Conecte seus dispositivos de fitness para importar dados automaticamente 
                como frequência cardíaca, passos, sono e calorias. Os dados serão usados 
                para calcular seu Recovery Score e acompanhar sua evolução.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

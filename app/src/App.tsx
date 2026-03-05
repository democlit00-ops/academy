import { useState, useMemo } from 'react';
import { useAuth } from "./contexts/AuthContext";
import AuthPage from "./pages/Auth";

import { Toaster, toast } from 'sonner';
import { Navigation } from '@/components/Navigation';
import type { Page } from '@/components/Navigation';
import { 
  Dashboard, 
  WorkoutForm, 
  CardioForm, 
  LoadControl, 
  PhysiologicalControl, 
  WorkoutHistory, 
  MuscleAnalysis, 
  WorkoutSplitPlanner,
  OneRepMax,
  InjuryTracker,
  ShareWorkout,
  Wearables,
  WorkoutPrograms,
  Settings 
} from '@/pages';
import { useAppData } from '@/hooks/useLocalStorage';
import type { 
  WorkoutSession, 
  CardioSession, 
  PhysiologicalData, 
  UserSettings,
  WorkoutSplit 
} from '@/types';
import { calculateRecoveryScore } from '@/lib/calculations';
import './App.css';

function App() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1220] text-white flex items-center justify-center">
        <div className="text-white/70">Carregando...</div>
      </div>
    );
  }
  if (!user) return <AuthPage />;

  const userKey = user.id;

  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const {
    workoutSessions,
    setWorkoutSessions,
    cardioSessions,
    setCardioSessions,
    physiologicalData,
    setPhysiologicalData,
    splits,
    setSplits,
    activeSplitId,
    setActiveSplitId,
    injuries,
    setInjuries,
    settings,
    setSettings,
  } = useAppData(userKey);

  // Calcular Recovery Scores quando os dados fisiológicos mudam
  const recoveryScores = useMemo(() => {
    return physiologicalData.map(p => calculateRecoveryScore(p));
  }, [physiologicalData]);

  // Handlers para salvar dados
  const handleSaveWorkout = (workout: WorkoutSession) => {
    setWorkoutSessions((prev: WorkoutSession[]) => [...prev, workout]);
    toast.success('Treino salvo com sucesso!');
  };

  const handleSaveCardio = (cardio: CardioSession) => {
    setCardioSessions((prev: CardioSession[]) => [...prev, cardio]);
    toast.success('Cardio registrado com sucesso!');
  };

  const handleSavePhysio = (data: PhysiologicalData) => {
    setPhysiologicalData((prev: PhysiologicalData[]) => [...prev, data]);
    toast.success('Dados fisiológicos salvos!');
  };

  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    toast.success('Configurações salvas!');
  };

  const handleSaveSplit = (split: WorkoutSplit) => {
    setSplits((prev: WorkoutSplit[]) => {
      const exists = prev.find(s => s.id === split.id);
      if (exists) {
        return prev.map(s => s.id === split.id ? split : s);
      }
      return [...prev, split];
    });
  };

  const handleDeleteSplit = (id: string) => {
    setSplits((prev: WorkoutSplit[]) => prev.filter(s => s.id !== id));
    if (activeSplitId === id) {
      setActiveSplitId('');
    }
    toast.success('Split removido!');
  };

  const handleSetActiveSplit = (id: string) => {
    setActiveSplitId(id);
  };

  const handleSaveInjury = (injury: any) => {
    setInjuries((prev: any[]) => [...prev, injury]);
  };

  const handleUpdateInjury = (id: string, updates: any) => {
    setInjuries((prev: any[]) => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const handleDeleteInjury = (id: string) => {
    setInjuries((prev: any[]) => prev.filter(i => i.id !== id));
  };

  const handleClearData = () => {
    setWorkoutSessions([]);
    setCardioSessions([]);
    setPhysiologicalData([]);
    setSplits([]);
    setActiveSplitId('');
    setInjuries([]);
    toast.success('Todos os dados foram apagados!');
  };

  const handleExportData = () => {
    const data = {
      workouts: workoutSessions,
      cardio: cardioSessions,
      physiological: physiologicalData,
      splits,
      activeSplitId,
      injuries,
      settings,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fittrack-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Dados exportados!');
  };

  // Renderizar página atual
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            workouts={workoutSessions} 
            cardio={cardioSessions}
            physio={physiologicalData}
            recoveryScores={recoveryScores}
          />
        );
      case 'workout':
        return <WorkoutForm onSave={handleSaveWorkout} />;
      case 'cardio':
        return <CardioForm onSave={handleSaveCardio} />;
      case 'loads':
        return <LoadControl workouts={workoutSessions} />;
      case 'physio':
        return (
          <PhysiologicalControl 
            onSave={handleSavePhysio} 
            physioData={physiologicalData}
          />
        );
      case 'history':
        return <WorkoutHistory workouts={workoutSessions} />;
      case 'analysis':
        return <MuscleAnalysis workouts={workoutSessions} />;
      case 'split':
        return (
          <WorkoutSplitPlanner
            splits={splits}
            onSave={handleSaveSplit}
            onDelete={handleDeleteSplit}
            onSetActive={handleSetActiveSplit}
            activeSplitId={activeSplitId}
          />
        );
      case 'onerm':
        return <OneRepMax workouts={workoutSessions} />;
      case 'programs':
        return <WorkoutPrograms onStartProgram={(p) => toast.success(`Programa ${p.name} iniciado!`)} />;
      case 'injuries':
        return (
          <InjuryTracker
            injuries={injuries}
            onSave={handleSaveInjury}
            onUpdate={handleUpdateInjury}
            onDelete={handleDeleteInjury}
          />
        );
      case 'share':
        return <ShareWorkout workouts={workoutSessions} cardio={cardioSessions} />;
      case 'wearables':
        return <Wearables />;
      case 'settings':
        return (
          <Settings 
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onClearData={handleClearData}
            onExportData={handleExportData}
          />
        );
      default:
        return (
          <Dashboard 
            workouts={workoutSessions} 
            cardio={cardioSessions} 
            physio={physiologicalData} 
            recoveryScores={recoveryScores} 
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster 
        position="top-right" 
        richColors 
        theme="dark"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
          },
        }}
      />
      
      <div className="flex">
        <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
        
        <main className="flex-1 min-h-screen p-4 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

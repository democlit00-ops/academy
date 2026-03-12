import { useState, useMemo, useEffect } from 'react';
import { useAuth } from "./contexts/AuthContext";
import AuthPage from "./pages/Auth";
import CoachStudents from '@/pages/coach/CoachStudents';
import AdminUsers from '@/pages/admin/AdminUsers';
import { supabase } from './lib/supabase';

import { Toaster, toast } from 'sonner';
import { Navigation } from '@/components/Navigation';
import type { Page } from '@/components/Navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, X } from 'lucide-react';
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

import AdminExercises from '@/pages/admin/AdminExercises';

import { useAppData } from '@/hooks/useLocalStorage';
import type {
  WorkoutSession,
  CardioSession,
  PhysiologicalData,
  UserSettings,
} from '@/types';
import { calculateRecoveryScore } from '@/lib/calculations';
import './App.css';

type SelectedStudent = {
  id: string;
  name: string;
};

type StudentModeBadgeProps = {
  student: SelectedStudent | null
  onExit: () => void
}

function StudentModeBadge({ student, onExit }: StudentModeBadgeProps) {
  if (!student) return null

  return (
    <div className="mb-5 flex justify-center">
      <div className="w-full max-w-4xl rounded-2xl border border-primary/30 bg-background/95 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <User className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-primary/15 text-primary border border-primary/20">
                  Modo Aluno
                </Badge>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Consulta ativa
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Você está visualizando os dados de
              </p>
              <p className="truncate text-base font-semibold text-white">
                {student.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:justify-end">
            <Button variant="outline" size="sm" onClick={onExit} className="gap-2">
              <X className="h-4 w-4" />
              Sair do modo aluno
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MainApp() {
  const { user, profile } = useAuth();
  const role = profile?.role ?? 'user';
  const userKey = user?.id ?? '';

  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');

  useEffect(() => {
    const adminPages: Page[] = ['admin_exercises', 'admin_users'];
    const coachPages: Page[] = ['coach_students'];

    const isAdminPage = adminPages.includes(currentPage);
    const isCoachPage = coachPages.includes(currentPage);

    if (isAdminPage && role !== 'admin') {
      setCurrentPage('dashboard');
      toast.error('Sem permissão para acessar esta área.');
      return;
    }

    if (isCoachPage && role !== 'coach' && role !== 'admin') {
      setCurrentPage('dashboard');
      toast.error('Sem permissão para acessar esta área.');
      return;
    }
  }, [currentPage, role]);

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
    settings,
    setSettings,
  } = useAppData(userKey);

  const recoveryScores = useMemo(() => {
    return physiologicalData.map((p) => calculateRecoveryScore(p));
  }, [physiologicalData]);

  const selectedStudent = selectedStudentId
    ? {
        id: selectedStudentId,
        name: selectedStudentName || 'Aluno selecionado',
      }
    : null;

  const handleExitStudentMode = () => {
    setSelectedStudentId('');
    setSelectedStudentName('');
    toast.success('Modo Aluno encerrado ✅');
  };

  const handleSaveWorkout = async (workout: WorkoutSession) => {
    if (!user) return;

    try {
      setWorkoutSessions((prev: WorkoutSession[]) => [...prev, workout]);

      const weekdayMap: Record<string, number> = {
        Segunda: 1,
        Terça: 2,
        Quarta: 3,
        Quinta: 4,
        Sexta: 5,
        Sábado: 6,
        Domingo: 7,
      };

      const payload = {
        user_id: user.id,
        session_date: workout.date,
        weekday: weekdayMap[String(workout.weekDay)] ?? 1,
        total_volume: workout.totalVolume ?? 0,
        exercises: workout.exercises,
      };

      const { error } = await supabase.from('workout_sessions').insert(payload);
      if (error) throw error;

      toast.success('Treino salvo ✅');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar no Supabase. (Ficou salvo localmente)');
    }
  };

  const handleSaveCardio = async (cardio: CardioSession) => {
    if (!user) return;

    try {
      setCardioSessions((prev: CardioSession[]) => [...prev, cardio]);

      const isoWeekday = new Date(cardio.date + 'T00:00:00').getDay();
      const weekday = isoWeekday === 0 ? 7 : isoWeekday;

      const payload = {
        user_id: user.id,
        session_date: cardio.date,
        weekday,
        data: cardio,
      };

      const { error } = await supabase.from('cardio_sessions').insert(payload);
      if (error) throw error;

      toast.success('Cardio salvo ✅');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar cardio no servidor. (Ficou salvo localmente)');
    }
  };

  const handleSavePhysio = async (data: PhysiologicalData) => {
    if (!user) return;

    try {
      setPhysiologicalData((prev: PhysiologicalData[]) => [...prev, data]);

      const payload = {
        user_id: user.id,
        entry_date: data.date,
        data,
      };

      const { error } = await supabase.from('physio_entries').insert(payload);
      if (error) throw error;

      toast.success('Fisiológico salvo ✅');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar fisiológico no servidor. (Ficou salvo localmente)');
    }
  };

  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    toast.success('Configurações salvas!');
  };

  
  

  const handleClearData = () => {
    setWorkoutSessions([]);
    setCardioSessions([]);
    setPhysiologicalData([]);
    setSplits([]);
    setActiveSplitId('');
    toast.success('Dados locais apagados!');
  };

  const handleExportData = () => {
    const data = {
      workouts: workoutSessions,
      cardio: cardioSessions,
      physiological: physiologicalData,
      splits,
      activeSplitId,
      settings,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fittrack-backup-local-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Backup local exportado!');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            workouts={workoutSessions}
            cardio={cardioSessions}
            physio={physiologicalData}
            recoveryScores={recoveryScores}
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
          />
        );

      case 'workout':
        return (
          <WorkoutForm
            onSave={handleSaveWorkout}
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
          />
        );

      case 'cardio':
        return (
          <CardioForm
            onSave={handleSaveCardio}
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
          />
        );

      case 'loads':
        return (
          <LoadControl
            workouts={workoutSessions}
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
          />
        );

      case 'physio':
        return (
          <PhysiologicalControl
            onSave={handleSavePhysio}
            physioData={physiologicalData}
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
          />
        );

      case 'history':
        return <WorkoutHistory selectedUserId={selectedStudentId || user?.id || ''} />;

      case 'analysis':
        return (
          <MuscleAnalysis
            workouts={workoutSessions}
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
          />
        );

     
      case 'split':
        return (
          <WorkoutSplitPlanner
           selectedUserId={selectedStudentId || null}
           selectedUserLabel={selectedStudentName || null}
    />
  )



      case 'onerm':
        return (
          <OneRepMax
            workouts={workoutSessions}
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
          />
        );

      case 'programs':
        return (
          <WorkoutPrograms
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
          />
        );

      case 'injuries':
        return (
          <InjuryTracker
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
          />
        );

      case 'share':
        return (
          <ShareWorkout
            workouts={workoutSessions}
            cardio={cardioSessions}
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
          />
        );

      case 'wearables':
        return <Wearables />;

      case 'admin_exercises':
        return role === 'admin' ? <AdminExercises /> : null;

      case 'admin_users':
        return role === 'admin' ? <AdminUsers /> : null;

      case 'coach_students':
        return role === 'coach' || role === 'admin' ? (
          <CoachStudents
            onOpenStudent={(studentId, studentName) => {
              setSelectedStudentId(studentId);
              setSelectedStudentName(studentName ?? '');
              setCurrentPage('history');
              toast.success('Aluno selecionado ✅');
            }}
          />
        ) : null;

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
            selectedUserId={selectedStudentId || null}
            selectedUserLabel={selectedStudentName || null}
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
        <Navigation
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          selectedStudentName={selectedStudentName || null}
          onExitStudentMode={handleExitStudentMode}
        />

        <main className="flex-1 min-h-screen p-4 pb-24 lg:p-8 lg:pb-8">
          <div className="mx-auto max-w-7xl">
            <StudentModeBadge
              student={selectedStudent}
              onExit={handleExitStudentMode}
            />

            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1220] text-white flex items-center justify-center">
        <div className="text-white/70">Carregando...</div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  return <MainApp />;
}
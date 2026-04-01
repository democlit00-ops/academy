//academy\app\src\App.tsx
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from "./contexts/AuthContext";
import AuthPage from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
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
  WorkoutPrograms,
  Settings
} from '@/pages';

import AdminExercises from '@/pages/admin/AdminExercises';
import { useAppData } from '@/hooks/useAppData';
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
  student: SelectedStudent | null;
  onExit: () => void;
};

type CoachProfileRow = {
  full_name: string | null;
  email: string | null;
  role: string | null;
};

function StudentModeBadge({ student, onExit }: StudentModeBadgeProps) {
  if (!student) return null;

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
                <Badge variant="secondary" className="border border-primary/20 bg-primary/15 text-primary">
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
  );
}

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  workout: 'Treino',
  cardio: 'Cardio',
  loads: 'Cargas',
  physio: 'Fisiológico',
  history: 'Histórico',
  analysis: 'Análise Muscular',
  split: 'Split',
  onerm: '1RM',
  injuries: 'Lesões',
  share: 'Compartilhar',
  programs: 'Programas',
  settings: 'Configurações',
  admin_exercises: 'Exercícios',
  admin_users: 'Usuários',
  coach_students: 'Meus Alunos',
}

function MainApp() {
  const { user, profile } = useAuth();
  const role = profile?.role ?? 'user';
  const userKey = user?.id ?? '';

 const [currentPage, setCurrentPage] = useState<Page>('dashboard');
const [selectedStudentId, setSelectedStudentId] = useState('');
const [selectedStudentName, setSelectedStudentName] = useState('');
const [linkedCoachName, setLinkedCoachName] = useState<string | null>(null);

useEffect(() => {
  const currentTitle = pageTitles[currentPage] ?? 'AcademyK';
  document.title = `AcademyK - ${currentTitle}`;
}, [currentPage]);

useEffect(() => {
  const loadLinkedCoachName = async () => {
    if (!user?.id) {
      console.log('[linkedCoach] sem user.id');
      setLinkedCoachName(null);
      return;
    }


    try {
      console.log('[linkedCoach] user.id:', user.id);

      const { data: link, error: linkError } = await supabase
        .from('coach_students')
        .select('coach_id')
        .eq('student_id', user.id)
        .maybeSingle();

      console.log('[linkedCoach] coach_students result:', link);
      console.log('[linkedCoach] coach_students error:', linkError);

      if (linkError) throw linkError;

      if (!link?.coach_id) {
        console.log('[linkedCoach] nenhum coach_id encontrado');
        setLinkedCoachName(null);
        return;
      }

      const { data: coachProfile, error: coachError } = await supabase
        .from('profiles')
        .select('full_name,email,role')
        .eq('id', link.coach_id)
        .maybeSingle();

      console.log('[linkedCoach] profiles result:', coachProfile);
      console.log('[linkedCoach] profiles error:', coachError);

      if (coachError) throw coachError;

      const coach = (coachProfile ?? null) as CoachProfileRow | null;

      if (!coach) {
        console.log('[linkedCoach] perfil do coach não encontrado');
        setLinkedCoachName(null);
        return;
      }

      const coachName =
        coach.full_name?.trim() ||
        coach.email?.trim() ||
        null;

      console.log('[linkedCoach] coachName final:', coachName);
      setLinkedCoachName(coachName);
    } catch (e: unknown) {
      console.error('[linkedCoach] erro:', e);
      setLinkedCoachName(null);
    }
  };

  void loadLinkedCoachName();
}, [user?.id]);

useEffect(() => {
  const handleOpenWorkoutFromProgram = () => {
    setCurrentPage('workout');
  };

  window.addEventListener(
    'academy:open-workout-from-program',
    handleOpenWorkoutFromProgram as EventListener
  );

  return () => {
    window.removeEventListener(
      'academy:open-workout-from-program',
      handleOpenWorkoutFromProgram as EventListener
    );
  };
}, []);

  const {
    workoutSessions,
    setWorkoutSessions,
    cardioSessions,
    setCardioSessions,
    physiologicalData,
    setPhysiologicalData,
    settings,
    setSettings,
    reloadAppData,
  } = useAppData(userKey);

  const recoveryScores = useMemo(() => {
    return physiologicalData.map((p) => calculateRecoveryScore(p));
  }, [physiologicalData]);

  const selectedStudent = selectedStudentId
    ? { id: selectedStudentId, name: selectedStudentName || 'Aluno selecionado' }
    : null;

  const handleExitStudentMode = () => {
    setSelectedStudentId('');
    setSelectedStudentName('');
    toast.success('Modo Aluno encerrado ✅');
  };

  const handleSaveWorkout = async (workout: WorkoutSession) => {
    if (!user) return;

    try {
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

      setWorkoutSessions((prev) => [workout, ...prev]);
      toast.success('Treino salvo ✅');
      await reloadAppData();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar treino no servidor.');
    }
  };

  const handleSaveCardio = async (cardio: CardioSession) => {
    if (!user) return;

    try {
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

      setCardioSessions((prev) => [cardio, ...prev]);
      toast.success('Cardio salvo ✅');
      await reloadAppData();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar cardio no servidor.');
    }
  };

  const handleSavePhysio = async (data: PhysiologicalData) => {
    if (!user) return;

    try {
      const payload = {
        user_id: user.id,
        entry_date: data.date,
        data,
      };

      const { error } = await supabase.from('physio_entries').insert(payload);
      if (error) throw error;

      setPhysiologicalData((prev) => [data, ...prev]);

      const possibleWeight =
        (data as any)?.weight ??
        (data as any)?.bodyWeight ??
        (data as any)?.peso ??
        null;

      if (
        possibleWeight !== null &&
        possibleWeight !== undefined &&
        !Number.isNaN(Number(possibleWeight))
      ) {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ weight: Number(possibleWeight) })
          .eq('id', user.id);

        if (!profileUpdateError) {
          setSettings((prev) => ({
            ...prev,
            weight: Number(possibleWeight),
          }));
        }
      }

      toast.success('Fisiológico salvo ✅');
      await reloadAppData();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar fisiológico no servidor.');
    }
  };

  const handleSaveSettings = async (newSettings: UserSettings) => {
    if (!user) return;

    try {
      const payload = {
        name: newSettings.name ?? null,
        full_name: newSettings.name ?? null,
        age: newSettings.age ?? null,
        weight: newSettings.weight ?? null,
        height: newSettings.height ?? null,
        fitness_goal: newSettings.fitnessGoal ?? null,
        preferred_weight_unit: newSettings.preferredUnits?.weight ?? 'kg',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (error) throw error;

      setSettings(newSettings);
      toast.success('Configurações salvas no servidor ✅');
      await reloadAppData();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar configurações no servidor.');
    }
  };

  const handleClearData = async () => {
    if (!user) return;

    try {
      const userId = user.id;

      const workoutDelete = await supabase.from('workout_sessions').delete().eq('user_id', userId);
      if (workoutDelete.error) throw workoutDelete.error;

      const cardioDelete = await supabase.from('cardio_sessions').delete().eq('user_id', userId);
      if (cardioDelete.error) throw cardioDelete.error;

      const physioDelete = await supabase.from('physio_entries').delete().eq('user_id', userId);
      if (physioDelete.error) throw physioDelete.error;

      const injuriesDelete = await supabase.from('injuries').delete().eq('user_id', userId);
      if (injuriesDelete.error) throw injuriesDelete.error;

      setWorkoutSessions([]);
      setCardioSessions([]);
      setPhysiologicalData([]);

      await reloadAppData();
      toast.success('Seus registros foram apagados do servidor ✅');
    } catch (e: any) {
      console.error('Erro ao apagar dados:', e);
      toast.error(e?.message ?? 'Erro ao apagar seus dados no servidor.');
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!user?.email) {
      toast.error('Não foi possível identificar seu email.');
      return;
    }

    try {
      const redirectBase = window.location.origin;

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${redirectBase}/reset-password`,
      });

      if (error) throw error;

      toast.success('Enviamos um email para redefinir sua senha ✅');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao enviar email de redefinição de senha.');
    }
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
        return <WorkoutHistory selectedUserId={selectedStudentId ? selectedStudentId : (user?.id || '')} />;

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
        );

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
  console.log('[settings] linkedCoachName:', linkedCoachName);
  return (
    <Settings
      settings={settings}
      onSaveSettings={handleSaveSettings}
      onClearData={handleClearData}
      onRequestPasswordReset={handleRequestPasswordReset}
      coachName={linkedCoachName}
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

        <main className="min-h-screen flex-1 p-4 pb-24 lg:p-8 lg:pb-8">
          <div className="mx-auto max-w-7xl">
            <StudentModeBadge student={selectedStudent} onExit={handleExitStudentMode} />
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    const checkRecoveryMode = async () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const pathname = window.location.pathname.toLowerCase();
      const fullUrl = `${pathname}${search}${hash}`.toLowerCase();

      const looksLikeRecovery = fullUrl.includes('type=recovery');

      if (looksLikeRecovery || pathname === '/reset-password') {
        setIsRecoveryMode(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (pathname === '/reset-password' && data.session) {
        setIsRecoveryMode(true);
        return;
      }

      setIsRecoveryMode(false);
    };

    void checkRecoveryMode();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        return;
      }

      if (event === 'SIGNED_IN') {
        const pathname = window.location.pathname.toLowerCase();

        if (pathname === '/reset-password') {
          setIsRecoveryMode(true);
          return;
        }

        setIsRecoveryMode(false);
      }
    });

    const onHashChange = () => {
      void checkRecoveryMode();
    };

    window.addEventListener('hashchange', onHashChange);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1220] text-white">
        <div className="text-white/70">Carregando...</div>
      </div>
    );
  }

  if (isRecoveryMode) {
    return <ResetPassword />;
  }

  if (!user) return <AuthPage />;
  return <MainApp />;
}
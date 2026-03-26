import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  WorkoutSession,
  CardioSession,
  PhysiologicalData,
  UserSettings,
  WorkoutSplit,
} from '@/types';

type UseAppDataReturn = {
  workoutSessions: WorkoutSession[];
  setWorkoutSessions: React.Dispatch<React.SetStateAction<WorkoutSession[]>>;
  cardioSessions: CardioSession[];
  setCardioSessions: React.Dispatch<React.SetStateAction<CardioSession[]>>;
  physiologicalData: PhysiologicalData[];
  setPhysiologicalData: React.Dispatch<React.SetStateAction<PhysiologicalData[]>>;
  splits: WorkoutSplit[];
  setSplits: React.Dispatch<React.SetStateAction<WorkoutSplit[]>>;
  activeSplitId: string;
  setActiveSplitId: React.Dispatch<React.SetStateAction<string>>;
  injuries: any[];
  setInjuries: React.Dispatch<React.SetStateAction<any[]>>;
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  reloadAppData: () => Promise<void>;
};

const defaultSettings: UserSettings = {
  name: '',
  preferredUnits: { weight: 'kg', distance: 'km' },
  theme: 'dark',
};

function mapProfileToSettings(profile: any): UserSettings {
  return {
    name: profile?.name ?? profile?.full_name ?? '',
    age: profile?.age ?? undefined,
    weight: profile?.weight ?? undefined,
    height: profile?.height ?? undefined,
    fitnessGoal: profile?.fitness_goal ?? 'Geral',
    preferredUnits: {
      weight: profile?.preferred_weight_unit === 'lbs' ? 'lbs' : 'kg',
      distance: 'km',
    },
    theme: 'dark',
  };
}

function sortByDateDesc<T>(items: T[], getDate: (item: T) => string | undefined) {
  return [...items].sort((a, b) => {
    const aDate = getDate(a) ?? '';
    const bDate = getDate(b) ?? '';
    return bDate.localeCompare(aDate);
  });
}

export function useAppData(userKey: string): UseAppDataReturn {
  const [workoutSessions, setWorkoutSessions] = useState<WorkoutSession[]>([]);
  const [cardioSessions, setCardioSessions] = useState<CardioSession[]>([]);
  const [physiologicalData, setPhysiologicalData] = useState<PhysiologicalData[]>([]);
  const [splits, setSplits] = useState<WorkoutSplit[]>([]);
  const [activeSplitId, setActiveSplitId] = useState<string>('');
  const [injuries, setInjuries] = useState<any[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  const reloadAppData = useCallback(async () => {
    if (!userKey) {
      setWorkoutSessions([]);
      setCardioSessions([]);
      setPhysiologicalData([]);
      setSplits([]);
      setActiveSplitId('');
      setInjuries([]);
      setSettings(defaultSettings);
      return;
    }

    const [workoutsRes, cardioRes, physioRes, profileRes] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userKey)
        .order('session_date', { ascending: false }),

      supabase
        .from('cardio_sessions')
        .select('*')
        .eq('user_id', userKey)
        .order('session_date', { ascending: false }),

      supabase
        .from('physio_entries')
        .select('*')
        .eq('user_id', userKey)
        .order('entry_date', { ascending: false }),

      supabase
        .from('profiles')
        .select('*')
        .eq('id', userKey)
        .single(),
    ]);

    if (!workoutsRes.error) {
      const mappedWorkouts: WorkoutSession[] = (workoutsRes.data ?? []).map((row: any) => ({
        ...(row.data ?? {}),
        id: row.id,
        date: row.session_date,
        exercises: row.exercises ?? row.data?.exercises ?? [],
        totalVolume: row.total_volume ?? row.data?.totalVolume ?? 0,
        weekDay: row.data?.weekDay ?? row.weekday ?? '',
      }));

      setWorkoutSessions(sortByDateDesc(mappedWorkouts, (item) => item.date));
    }

    if (!cardioRes.error) {
      const mappedCardio: CardioSession[] = (cardioRes.data ?? []).map((row: any) => ({
        ...(row.data ?? {}),
        id: row.id,
        date: row.session_date ?? row.data?.date,
      }));

      setCardioSessions(sortByDateDesc(mappedCardio, (item) => item.date));
    }

    if (!physioRes.error) {
      const mappedPhysio: PhysiologicalData[] = (physioRes.data ?? []).map((row: any) => ({
        ...(row.data ?? {}),
        id: row.id,
        date: row.entry_date ?? row.data?.date,
      }));

      setPhysiologicalData(sortByDateDesc(mappedPhysio, (item) => item.date));
    }

    if (!profileRes.error && profileRes.data) {
      setSettings(mapProfileToSettings(profileRes.data));
    } else {
      setSettings(defaultSettings);
    }

    // Split/programa real já está no banco em outras páginas.
    // Mantemos vazio aqui até consolidar de vez a arquitetura.
    setSplits([]);
    setActiveSplitId('');

    // Lesões hoje já têm página própria integrada ao banco.
    setInjuries([]);
  }, [userKey]);

  useEffect(() => {
  const id = setTimeout(() => {
    void reloadAppData();
  }, 0);

  return () => clearTimeout(id);
}, [reloadAppData]);

  return {
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
    reloadAppData,
  };
}
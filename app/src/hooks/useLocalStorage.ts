import { useState, useEffect, useCallback } from 'react';
import type { WorkoutSession, CardioSession, PhysiologicalData, UserSettings, WorkoutSplit } from '@/types';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Estado para armazenar o valor
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Inicializar do localStorage apenas uma vez
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Retornar uma versão modificada da função setState que persiste no localStorage
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      // Permitir que o valor seja uma função
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Salvar no estado
      setStoredValue(valueToStore);
      
      // Salvar no localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

// Hook específico para o estado da aplicação FitTrack

// Hook específico para o estado da aplicação FitTrack
// Observação: nesta versão, os dados ficam no localStorage, mas agora "separam" por usuário.
// Ou seja: ao fazer login, seus dados ficam salvos no seu user.id.
export function useAppData(userKey: string) {
  const prefix = `fittrack_${userKey}_`;

  const [workoutSessions, setWorkoutSessions] = useLocalStorage<WorkoutSession[]>(`${prefix}workouts`, []);
  const [cardioSessions, setCardioSessions] = useLocalStorage<CardioSession[]>(`${prefix}cardio`, []);
  const [physiologicalData, setPhysiologicalData] = useLocalStorage<PhysiologicalData[]>(`${prefix}physio`, []);
  const [splits, setSplits] = useLocalStorage<WorkoutSplit[]>(`${prefix}splits`, []);
  const [activeSplitId, setActiveSplitId] = useLocalStorage<string>(`${prefix}active_split`, '');
  const [injuries, setInjuries] = useLocalStorage<any[]>(`${prefix}injuries`, []);
  const [settings, setSettings] = useLocalStorage<UserSettings>(`${prefix}settings`, {
    name: '',
    preferredUnits: { weight: 'kg', distance: 'km' },
    theme: 'dark',
  });

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
  };
}

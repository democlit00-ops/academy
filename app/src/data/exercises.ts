import type { ExerciseDefinition, MuscleGroup } from '@/types';

// ============================================
// TABELA DE EXERCÍCIOS DE REFERÊNCIA
// ============================================
export const EXERCISE_DEFINITIONS: ExerciseDefinition[] = [
  // PERNAS
  {
    id: 'agachamento-livre',
    name: 'Agachamento Livre',
    muscleGroup: 'Pernas',
    category: 'Força',
    loadIncrement: 5,
  },
  {
    id: 'leg-press',
    name: 'Leg Press Máquina',
    muscleGroup: 'Pernas',
    category: 'Força',
    loadIncrement: 10,
  },
  {
    id: 'extensora',
    name: 'Extensora',
    muscleGroup: 'Pernas',
    category: 'Força',
    loadIncrement: 5,
  },
  {
    id: 'afundo-smith',
    name: 'Afundo Smith',
    muscleGroup: 'Pernas',
    category: 'Força',
    loadIncrement: 2.5,
  },

  // POSTERIOR
  {
    id: 'mesa-flexora',
    name: 'Mesa Flexora',
    muscleGroup: 'Posterior',
    category: 'Força',
    loadIncrement: 5,
  },
  {
    id: 'stiff',
    name: 'Stiff',
    muscleGroup: 'Posterior',
    category: 'Força',
    loadIncrement: 5,
  },

  // PANTURRILHA → PADRONIZADA COMO PERNAS
  {
    id: 'panturrilha-em-pe',
    name: 'Panturrilha em Pé',
    muscleGroup: 'Pernas',
    category: 'Força',
    loadIncrement: 5,
  },
  {
    id: 'panturrilha-sentado',
    name: 'Panturrilha Sentado',
    muscleGroup: 'Pernas',
    category: 'Força',
    loadIncrement: 5,
  },

  // PEITO
  {
    id: 'supino-maquina',
    name: 'Supino Máquina',
    muscleGroup: 'Peito',
    category: 'Força',
    loadIncrement: 5,
  },
  {
    id: 'chest-press',
    name: 'Chest Press',
    muscleGroup: 'Peito',
    category: 'Força',
    loadIncrement: 5,
  },
  {
    id: 'crucifixo',
    name: 'Crucifixo',
    muscleGroup: 'Peito',
    category: 'Força',
    loadIncrement: 2.5,
  },

  // COSTAS
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'Costas',
    category: 'Força',
    loadIncrement: 5,
  },
  {
    id: 'remada-maquina',
    name: 'Remada Máquina',
    muscleGroup: 'Costas',
    category: 'Força',
    loadIncrement: 5,
  },
  {
    id: 'puxada-alta',
    name: 'Puxada Alta',
    muscleGroup: 'Costas',
    category: 'Força',
    loadIncrement: 5,
  },
  {
    id: 'remada-curvada',
    name: 'Remada Curvada',
    muscleGroup: 'Costas',
    category: 'Força',
    loadIncrement: 5,
  },

  // OMBROS
  {
    id: 'desenvolvimento-ombro',
    name: 'Desenvolvimento Ombro Máquina',
    muscleGroup: 'Ombros',
    category: 'Força',
    loadIncrement: 2.5,
  },
  {
    id: 'elevacao-lateral',
    name: 'Elevação Lateral',
    muscleGroup: 'Ombros',
    category: 'Força',
    loadIncrement: 2,
  },
  {
    id: 'elevacao-frontal',
    name: 'Elevação Frontal',
    muscleGroup: 'Ombros',
    category: 'Força',
    loadIncrement: 2,
  },

  // BÍCEPS
  {
    id: 'rosca-biceps-maquina',
    name: 'Rosca Bíceps Máquina',
    muscleGroup: 'Bíceps',
    category: 'Força',
    loadIncrement: 2,
  },
  {
    id: 'rosca-scott',
    name: 'Rosca Scott',
    muscleGroup: 'Bíceps',
    category: 'Força',
    loadIncrement: 2.5,
  },
  {
    id: 'rosca-martelo',
    name: 'Rosca Martelo',
    muscleGroup: 'Bíceps',
    category: 'Força',
    loadIncrement: 2,
  },

  // TRÍCEPS
  {
    id: 'triceps-mergulho',
    name: 'Tríceps Mergulho Máquina',
    muscleGroup: 'Tríceps',
    category: 'Força',
    loadIncrement: 5,
  },
  {
    id: 'triceps-polia',
    name: 'Tríceps Polia',
    muscleGroup: 'Tríceps',
    category: 'Força',
    loadIncrement: 2.5,
  },
  {
    id: 'triceps-testa',
    name: 'Tríceps Testa',
    muscleGroup: 'Tríceps',
    category: 'Força',
    loadIncrement: 2.5,
  },

  // CORE
  {
    id: 'prancha',
    name: 'Prancha',
    muscleGroup: 'Core',
    category: 'Core',
    loadIncrement: 0,
    isBodyweight: true,
  },
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    muscleGroup: 'Core',
    category: 'Core',
    loadIncrement: 0,
    isBodyweight: true,
  },
  {
    id: 'abdominal-maquina',
    name: 'Abdominal Máquina',
    muscleGroup: 'Core',
    category: 'Core',
    loadIncrement: 0,
  },
  {
    id: 'russian-twist',
    name: 'Russian Twist',
    muscleGroup: 'Core',
    category: 'Core',
    loadIncrement: 0,
    isBodyweight: true,
  },
];

// ============================================
// HELPERS
// ============================================

export const getExerciseById = (id: string): ExerciseDefinition | undefined => {
  return EXERCISE_DEFINITIONS.find((e) => e.id === id);
};

export const getExercisesByMuscleGroup = (group: MuscleGroup): ExerciseDefinition[] => {
  return EXERCISE_DEFINITIONS.filter((e) => e.muscleGroup === group);
};

export const getAllMuscleGroups = (): MuscleGroup[] => {
  const groups = new Set<MuscleGroup>();
  EXERCISE_DEFINITIONS.forEach((e) => groups.add(e.muscleGroup));
  return Array.from(groups);
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Peito',
  'Costas',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Pernas',
  'Glúteos',
  'Posterior',
  'Core',
  'Cardio',
  'Mobilidade',
];

export const WEEK_DAYS = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
] as const;

export const CARDIO_TYPES = [
  'Esteira',
  'Bike',
  'Caminhada',
  'Corrida',
  'Elíptico',
  'Remo',
  'Outro',
] as const;

export const HEART_RATE_ZONES = [
  { zone: 'Zona 1', name: 'Recuperação', range: '50-60%', color: '#22c55e' },
  { zone: 'Zona 2', name: 'Aeróbica', range: '60-70%', color: '#3b82f6' },
  { zone: 'Zona 3', name: 'Tempo', range: '70-80%', color: '#f59e0b' },
  { zone: 'Zona 4', name: 'Limiar', range: '80-90%', color: '#f97316' },
  { zone: 'Zona 5', name: 'Máxima', range: '90-100%', color: '#ef4444' },
] as const;
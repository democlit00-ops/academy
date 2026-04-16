export type AiWorkoutBankExercise = {
  name: string
  muscle_group?: string | null
  type?: string | null
  equipment?: string | null
  aliases?: string[] | null
}

export const WORKOUT_JSON_TEMPLATE = `{
  "version": 1,
  "days": [
    {
      "weekday": 1,
      "items": [
        {
          "type": "strength",
          "exercise_name": "Agachamento Goblet",
          "sets": 4,
          "reps": "10-12",
          "time_per_set_sec": null,
          "target_weight": null,
          "notes": "Cadência controlada e foco em amplitude."
        },
        {
          "type": "strength",
          "exercise_name": "Prancha frontal",
          "sets": 3,
          "reps": null,
          "time_per_set_sec": 30,
          "target_weight": null,
          "notes": "Exercício por tempo entra como strength."
        }
      ]
    },
    {
      "weekday": 3,
      "items": [
        {
          "type": "cardio",
          "exercise_name": "Bike ergométrica",
          "duration_min": 25,
          "bpm_min": 120,
          "bpm_max": 145,
          "notes": "Ritmo estável."
        }
      ]
    },
    {
      "weekday": 5,
      "items": []
    }
  ]
}`

export function buildAiWorkoutPrompt() {
  return [
    'Gere um treino semanal e responda apenas com JSON válido, sem markdown, sem comentários e sem texto antes ou depois.',
    'Formato obrigatório:',
    '{ "version": 1, "days": [ ... ] }',
    'Cada dia deve ter:',
    '- weekday: número de 1 a 7 (1=Segunda, 7=Domingo)',
    '- items: lista de itens do treino',
    'Itens aceitos:',
    '- strength: exercise_name, sets, reps, time_per_set_sec, target_weight, notes',
    '- cardio: exercise_name, duration_min, bpm_min, bpm_max, notes',
    'Regras importantes:',
    '- Mobilidade, isometria e exercícios por tempo entram como strength.',
    '- Dias vazios são permitidos com "items": [].',
    '- target_weight pode ser null.',
    '- reps pode ser null quando o exercício de strength for por tempo.',
    '- time_per_set_sec pode ser null quando o exercício for por reps.',
    '- Use nomes de exercícios claros e consistentes.',
    'Exemplo de resposta esperada:',
    WORKOUT_JSON_TEMPLATE,
  ].join('\n')
}

export function buildExerciseBankText(exercises: AiWorkoutBankExercise[]) {
  if (exercises.length === 0) {
    return 'Nenhum exercício ativo encontrado no banco.'
  }

  return exercises
    .map((exercise) => {
      const parts = [
        exercise.name,
        exercise.muscle_group || null,
        exercise.type === 'cardio' ? 'cardio' : exercise.type === 'strength' ? 'strength' : null,
        exercise.equipment || null,
        exercise.aliases && exercise.aliases.length > 0 ? `aliases: ${exercise.aliases.join(', ')}` : null,
      ].filter(Boolean)

      return `- ${parts.join(' | ')}`
    })
    .join('\n')
}

// C:\Users\kitin\Documents\GitHub\academy\app\src\lib\exerciseHelp.ts

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function extractParenthesesParts(value: string) {
  const matches = Array.from(value.matchAll(/\(([^)]+)\)/g))
  return matches
    .map((match) => normalizeWhitespace(match[1] ?? ''))
    .filter(Boolean)
}

function removeParentheses(value: string) {
  return normalizeWhitespace(value.replace(/\([^)]*\)/g, ' '))
}

function uniqueParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const part of parts) {
    const normalized = normalizeWhitespace(String(part ?? ''))
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    result.push(normalized)
  }

  return result
}

export function buildExerciseHelpQuery(
  exerciseName: string,
  aliases?: string[] | null,
  suffix = 'como fazer'
) {
  const cleanName = normalizeWhitespace(exerciseName)
  const mainWithoutParentheses = removeParentheses(cleanName)
  const parenthesesParts = extractParenthesesParts(cleanName)
  const aliasParts = (aliases ?? []).map((alias) => normalizeWhitespace(alias)).filter(Boolean)

  const parts = uniqueParts([
    mainWithoutParentheses,
    ...parenthesesParts,
    ...aliasParts,
    suffix,
  ])

  return parts.join(' ')
}

export function buildGoogleImagesUrl(exerciseName: string, aliases?: string[] | null) {
  const query = buildExerciseHelpQuery(exerciseName, aliases, 'como fazer')
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`
}

export function buildYouTubeUrl(exerciseName: string, aliases?: string[] | null) {
  const query = buildExerciseHelpQuery(exerciseName, aliases, 'execução')
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}
export type ProfileLike = {
  id?: string | null
  email?: string | null
  full_name?: string | null
}

export function getProfileDisplayName(
  profile?: ProfileLike | null,
  fallback = 'Usuário'
) {
  const fullName = profile?.full_name?.trim()
  if (fullName) return fullName

  const email = profile?.email?.trim()
  if (email) return email

  const id = profile?.id?.trim()
  if (id) return `${id.slice(0, 6)}…`

  return fallback
}
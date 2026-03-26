//academy\app\src\types\auth.ts
export type UserRole = 'admin' | 'coach' | 'user'

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole
  age?: number | null
  weight?: number | null
  height?: number | null
  fitness_goal?: string | null
  preferred_weight_unit?: 'kg' | 'lbs' | null
  created_at?: string
  updated_at?: string
}
export type UserRole = "admin" | "coach" | "user";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
};
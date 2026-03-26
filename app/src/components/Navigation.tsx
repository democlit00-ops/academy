import {
  LayoutDashboard,
  Dumbbell,
  Heart,
  TrendingUp,
  Activity,
  History,
  BarChart3,
  Settings,
  CalendarDays,
  Calculator,
  Bandage,
  Share2,
  BookOpen,
  Users,
  GraduationCap,
  X,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export type Page =
  | 'dashboard'
  | 'workout'
  | 'cardio'
  | 'loads'
  | 'physio'
  | 'history'
  | 'analysis'
  | 'split'
  | 'onerm'
  | 'injuries'
  | 'share'
  | 'programs'
  | 'settings'
  | 'admin_exercises'
  | 'admin_users'
  | 'coach_students'

interface NavigationProps {
  currentPage: Page
  onPageChange: (page: Page) => void
  selectedStudentName?: string | null
  onExitStudentMode?: () => void
}

type NavItem = {
  id: Page
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'workout', label: 'Treino', icon: Dumbbell },
  { id: 'cardio', label: 'Cardio', icon: Heart },
  { id: 'loads', label: 'Cargas', icon: TrendingUp },
  { id: 'physio', label: 'Fisiológico', icon: Activity },
  { id: 'split', label: 'Split', icon: CalendarDays },
  { id: 'onerm', label: '1RM', icon: Calculator },
  { id: 'programs', label: 'Programas', icon: BookOpen },
  { id: 'injuries', label: 'Lesões', icon: Bandage },
  { id: 'share', label: 'Compartilhar', icon: Share2 },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'analysis', label: 'Análise', icon: BarChart3 },
  { id: 'settings', label: 'Config', icon: Settings },
]

const adminItems: NavItem[] = [
  { id: 'admin_exercises', label: 'Exercícios', icon: Dumbbell },
  { id: 'admin_users', label: 'Usuários', icon: Users },
]

const coachItems: NavItem[] = [
  { id: 'coach_students', label: 'Meus Alunos', icon: GraduationCap },
]

export function Navigation({
  currentPage,
  onPageChange,
  selectedStudentName,
  onExitStudentMode,
}: NavigationProps) {
  const { profile } = useAuth()
  const role = profile?.role ?? 'user'
  const isStudentMode = !!selectedStudentName

  const visibleItems = navItems

  const renderNavButton = (item: NavItem) => {
    const Icon = item.icon
    const isActive = currentPage === item.id

    return (
      <li key={item.id}>
        <button
          onClick={() => onPageChange(item.id)}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
            isActive
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
              : 'text-muted-foreground hover:text-white hover:bg-muted'
          )}
        >
          <Icon className={cn('w-5 h-5', isActive && 'text-white')} />
          {item.label}
        </button>
      </li>
    )
  }

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Dumbbell className="h-5 w-5 text-white" />
            </div>

            <div>
              <h1 className="text-lg font-bold text-white">AcademyK</h1>
              <p className="text-xs text-muted-foreground">
                {role === 'admin' ? 'Admin' : role === 'coach' ? 'Professor' : 'Pro'}
              </p>
            </div>
          </div>

          {isStudentMode && (
            <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Eye className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="border border-primary/20 bg-primary/15 text-primary"
                    >
                      Modo Aluno
                    </Badge>
                    <span className="text-[10px] uppercase tracking-wide text-primary/80">
                      Consulta ativa
                    </span>
                  </div>

                  <p className="mt-1 truncate text-sm font-medium text-white">
                    {selectedStudentName}
                  </p>
                </div>

                {onExitStudentMode && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={onExitStudentMode}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <nav
          className="ft-sidebar-scroll flex-1 overflow-y-auto px-4 py-4"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(148,163,184,0.35) rgba(15,23,42,0.6)',
          }}
        >
          <style>
            {`
              .ft-sidebar-scroll::-webkit-scrollbar { width: 10px; }
              .ft-sidebar-scroll::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.6); }
              .ft-sidebar-scroll::-webkit-scrollbar-thumb {
                background: rgba(148, 163, 184, 0.35);
                border-radius: 999px;
              }
              .ft-sidebar-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(148, 163, 184, 0.55);
              }
            `}
          </style>

          <ul className="space-y-1">{visibleItems.map(renderNavButton)}</ul>

          {(role === 'admin' || role === 'coach') && (
            <div className="mt-6">
              <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {role === 'admin' ? 'Admin' : 'Professor'}
              </p>
              <ul className="space-y-1">
                {role === 'admin' && adminItems.map(renderNavButton)}
                {(role === 'coach' || role === 'admin') && coachItems.map(renderNavButton)}
              </ul>
            </div>
          )}
        </nav>

        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="mb-2 text-xs text-muted-foreground">Versão</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">AcademyK v2.0</p>
              {isStudentMode && (
                <Badge variant="secondary" className="text-[10px]">
                  Aluno
                </Badge>
              )}
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg lg:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {visibleItems.slice(0, 5).map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id

            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <div className={cn('rounded-lg p-1.5 transition-all', isActive && 'bg-primary/20')}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="fixed right-4 top-4 z-50 flex items-center gap-2 lg:hidden">
        {isStudentMode && onExitStudentMode && (
          <button
            onClick={onExitStudentMode}
            className="max-w-[200px] rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary"
          >
            Consulta: {selectedStudentName} • Sair
          </button>
        )}

        <button
          onClick={() => onPageChange('settings')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-white"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </>
  )
}
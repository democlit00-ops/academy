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
  Watch,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  | 'wearables'
  | 'programs'
  | 'cloud'
  | 'settings';

interface NavigationProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

const navItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'workout' as Page, label: 'Treino', icon: Dumbbell },
  { id: 'cardio' as Page, label: 'Cardio', icon: Heart },
  { id: 'loads' as Page, label: 'Cargas', icon: TrendingUp },
  { id: 'physio' as Page, label: 'Fisiológico', icon: Activity },
  { id: 'split' as Page, label: 'Split', icon: CalendarDays },
  { id: 'onerm' as Page, label: '1RM', icon: Calculator },
  { id: 'programs' as Page, label: 'Programas', icon: BookOpen },
  { id: 'injuries' as Page, label: 'Lesões', icon: Bandage },
  { id: 'share' as Page, label: 'Compartilhar', icon: Share2 },
  { id: 'wearables' as Page, label: 'Wearables', icon: Watch },
  { id: 'history' as Page, label: 'Histórico', icon: History },
  { id: 'analysis' as Page, label: 'Análise', icon: BarChart3 },
  { id: 'settings' as Page, label: 'Config', icon: Settings },
];

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border h-screen sticky top-0">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white">FitTrack</h1>
              <p className="text-xs text-muted-foreground">Pro</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
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
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-border">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">Versão</p>
            <p className="text-sm font-medium text-white">FitTrack Pro v1.0</p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <div
                  className={cn(
                    'p-1.5 rounded-lg transition-all',
                    isActive && 'bg-primary/20'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Menu Button for more options */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => onPageChange('settings')}
          className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-white"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}

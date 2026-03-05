import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  subtitle?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  unit,
  icon,
  trend,
  trendValue,
  variant = 'blue',
  subtitle,
  className,
}: StatCardProps) {
  const variantStyles = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
    green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
    orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
    red: 'from-red-500/20 to-red-600/5 border-red-500/30',
  };

  const iconStyles = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-emerald-500/20 text-emerald-400',
    orange: 'bg-orange-500/20 text-orange-400',
    purple: 'bg-purple-500/20 text-purple-400',
    red: 'bg-red-500/20 text-red-400',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 transition-all duration-300 hover:scale-[1.02]',
        variantStyles[variant],
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className={cn('rounded-lg p-2', iconStyles[variant])}>
          {icon}
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              trend === 'up' && 'bg-emerald-500/20 text-emerald-400',
              trend === 'down' && 'bg-red-500/20 text-red-400',
              trend === 'neutral' && 'bg-gray-500/20 text-gray-400'
            )}
          >
            {trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3" />}
            {trend === 'neutral' && <Minus className="h-3 w-3" />}
            {trendValue}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mt-3">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-2xl font-bold text-white">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>

      {/* Decorative glow */}
      <div
        className={cn(
          'absolute -right-4 -top-4 h-24 w-24 rounded-full blur-3xl opacity-20',
          variant === 'blue' && 'bg-blue-500',
          variant === 'green' && 'bg-emerald-500',
          variant === 'orange' && 'bg-orange-500',
          variant === 'purple' && 'bg-purple-500',
          variant === 'red' && 'bg-red-500'
        )}
      />
    </div>
  );
}

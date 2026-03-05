import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface RecoveryScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

export function RecoveryScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  className,
  showLabel = true,
}: RecoveryScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const { color, label } = useMemo(() => {
    if (score >= 80) return { color: '#22c55e', label: 'Ótima' };
    if (score >= 60) return { color: '#3b82f6', label: 'Boa' };
    if (score >= 40) return { color: '#f59e0b', label: 'Moderada' };
    return { color: '#ef4444', label: 'Baixa' };
  }, [score]);

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.5s ease-out',
              filter: `drop-shadow(0 0 6px ${color}40)`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{score}</span>
          {showLabel && (
            <span className="text-xs text-muted-foreground">{label}</span>
          )}
        </div>
      </div>

      {/* Label abaixo */}
      {showLabel && (
        <div className="mt-2 text-center">
          <span
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            Recuperação {label}
          </span>
        </div>
      )}
    </div>
  );
}

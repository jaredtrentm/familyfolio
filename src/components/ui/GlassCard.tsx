'use client';

import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  blur?: 'sm' | 'md' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function GlassCard({
  children,
  className,
  hover = true,
  blur = 'md',
  padding = 'md',
  ...props
}: GlassCardProps) {
  const blurClasses = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4 md:p-6',
    lg: 'p-6 md:p-8',
  };

  return (
    <motion.div
      className={cn(
        'glass-card rounded-xl',
        blurClasses[blur],
        paddingClasses[padding],
        hover && 'transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5',
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface GlassStatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
  className?: string;
}

export function GlassStatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: GlassStatCardProps) {
  return (
    <GlassCard className={cn('flex flex-col', className)}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </span>
        {icon && (
          <div className="text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>
      {(subtitle || trend) && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          {trend && (
            <span
              className={cn(
                'font-medium',
                trend.value >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {trend.value >= 0 ? '+' : ''}{trend.value.toFixed(2)}%
              {trend.label && <span className="ml-1">{trend.label}</span>}
            </span>
          )}
          {subtitle && (
            <span className="text-gray-500 dark:text-gray-400">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </GlassCard>
  );
}

'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'wave',
}: SkeletonProps) {
  const baseStyles = 'bg-gray-200 dark:bg-gray-700';

  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'skeleton',
    none: '',
  };

  return (
    <div
      className={cn(
        baseStyles,
        variantStyles[variant],
        animationStyles[animation],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lineHeight?: string;
  lastLineWidth?: string;
}

export function SkeletonText({
  lines = 3,
  className,
  lineHeight = '1rem',
  lastLineWidth = '60%',
}: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={lineHeight}
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
  hasImage?: boolean;
  imageHeight?: string;
  lines?: number;
}

export function SkeletonCard({
  className,
  hasImage = false,
  imageHeight = '150px',
  lines = 3,
}: SkeletonCardProps) {
  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700', className)}>
      {hasImage && (
        <Skeleton className="w-full mb-4" height={imageHeight} />
      )}
      <Skeleton variant="text" height="1.5rem" width="60%" className="mb-4" />
      <SkeletonText lines={lines} />
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" height="1rem" className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={colIdx} variant="text" height="1rem" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SkeletonChartProps {
  className?: string;
  height?: string;
  type?: 'pie' | 'bar' | 'line';
}

// Pre-computed stable heights for bar chart skeleton to avoid Math.random during render
const BAR_HEIGHTS = ['45%', '78%', '62%', '90%', '55%', '82%', '68%'];

export function SkeletonChart({
  className,
  height = '200px',
  type = 'bar',
}: SkeletonChartProps) {
  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700', className)}>
      <Skeleton variant="text" height="1.25rem" width="40%" className="mb-4" />
      {type === 'pie' ? (
        <div className="flex justify-center">
          <Skeleton variant="circular" width="180px" height="180px" />
        </div>
      ) : (
        <div className="flex items-end gap-2" style={{ height }}>
          {BAR_HEIGHTS.map((barHeight, i) => (
            <Skeleton
              key={i}
              className="flex-1"
              height={barHeight}
            />
          ))}
        </div>
      )}
    </div>
  );
}

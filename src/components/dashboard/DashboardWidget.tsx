'use client';

import { useState } from 'react';
import { X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import { getWidgetDefinition } from './WidgetRegistry';

interface DashboardWidgetProps {
  widgetId: string;
  locale: string;
  children: React.ReactNode;
  onRemove?: (widgetId: string) => void;
  isDragging?: boolean;
}

export function DashboardWidget({
  widgetId,
  locale,
  children,
  onRemove,
  isDragging,
}: DashboardWidgetProps) {
  const [isHovered, setIsHovered] = useState(false);
  const definition = getWidgetDefinition(widgetId);

  if (!definition) return null;

  const widgetName = locale === 'zh' ? definition.nameZh : definition.name;

  return (
    <div
      className={`h-full glass-card rounded-xl overflow-hidden flex flex-col transition-shadow ${
        isDragging ? 'shadow-2xl ring-2 ring-blue-500' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Widget header - only show on hover */}
      <div
        className={`flex items-center justify-between px-4 py-2 border-b border-gray-200/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/50 transition-opacity ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="drag-handle cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {widgetName}
          </span>
        </div>
        {onRemove && (
          <button
            onClick={() => onRemove(widgetId)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Widget content */}
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDefaultLayout } from '@/components/dashboard/WidgetRegistry';

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

interface UseWidgetLayoutReturn {
  layout: LayoutItem[];
  isLoading: boolean;
  isSaving: boolean;
  updateLayout: (newLayout: LayoutItem[]) => void;
  addWidget: (widgetId: string, x?: number, y?: number) => void;
  removeWidget: (widgetId: string) => void;
  resetLayout: () => void;
}

export function useWidgetLayout(): UseWidgetLayoutReturn {
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load layout from server on mount
  useEffect(() => {
    async function loadLayout() {
      try {
        const response = await fetch('/api/user/preferences');
        const data = await response.json();

        if (data.preferences?.widgetLayout) {
          setLayout(data.preferences.widgetLayout);
        } else {
          // Use default layout if none saved
          setLayout(getDefaultLayout());
        }
      } catch (error) {
        console.error('Failed to load widget layout:', error);
        setLayout(getDefaultLayout());
      } finally {
        setIsLoading(false);
      }
    }

    loadLayout();
  }, []);

  // Save layout to server (debounced)
  const saveLayout = useCallback(async (layoutToSave: LayoutItem[]) => {
    setIsSaving(true);
    try {
      await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetLayout: layoutToSave }),
      });
    } catch (error) {
      console.error('Failed to save widget layout:', error);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced layout update
  const updateLayout = useCallback((newLayout: LayoutItem[]) => {
    setLayout(newLayout);

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Save after 1 second of no changes
    const timeout = setTimeout(() => {
      saveLayout(newLayout);
    }, 1000);

    setSaveTimeout(timeout);
  }, [saveLayout, saveTimeout]);

  // Add a widget to the layout
  const addWidget = useCallback((widgetId: string, x = 0, y = Infinity) => {
    // Find the lowest y position to place the widget
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);

    const newItem: LayoutItem = {
      i: widgetId,
      x,
      y: y === Infinity ? maxY : y,
      w: 6,
      h: 4,
    };

    const newLayout = [...layout, newItem];
    updateLayout(newLayout);
  }, [layout, updateLayout]);

  // Remove a widget from the layout
  const removeWidget = useCallback((widgetId: string) => {
    const newLayout = layout.filter(item => item.i !== widgetId);
    updateLayout(newLayout);
  }, [layout, updateLayout]);

  // Reset to default layout
  const resetLayout = useCallback(() => {
    const defaultLayout = getDefaultLayout();
    updateLayout(defaultLayout);
  }, [updateLayout]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  return {
    layout,
    isLoading,
    isSaving,
    updateLayout,
    addWidget,
    removeWidget,
    resetLayout,
  };
}

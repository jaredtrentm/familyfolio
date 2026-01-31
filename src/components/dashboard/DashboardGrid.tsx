'use client';

import { useState, useMemo } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { DashboardWidget } from './DashboardWidget';
import { AddWidgetModal } from './AddWidgetModal';
import { getWidgetDefinition } from './WidgetRegistry';
import { useWidgetLayout } from '@/hooks/useWidgetLayout';
import { SpinnerRing } from '@/components/ui/ProgressRing';
import { PortfolioSummary } from './PortfolioSummary';
import { HoldingsTable } from './HoldingsTable';
import { AccountsManager } from './AccountsManager';
import { AllocationChart } from '@/components/charts/AllocationChart';
import { AssetTypeChart } from '@/components/charts/AssetTypeChart';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { HoldingsPieChart } from '@/components/charts/HoldingsPieChart';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const ReactGridLayout = require('react-grid-layout') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout: any = ReactGridLayout.WidthProvider(ReactGridLayout.default || ReactGridLayout);

interface LayoutItem {
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

interface DashboardGridProps {
  locale: string;
  holdings: Array<{
    symbol: string;
    name: string;
    quantity: number;
    costBasis: number;
    currentPrice: number;
    currentValue: number;
    gainLoss: number;
    gainLossPercent: number;
    sector: string;
  }>;
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  sectorAllocation: Record<string, number>;
  assetTypeAllocation: Record<string, number>;
  onTotalCashChange: (cash: number) => void;
}

export function DashboardGrid({
  locale,
  holdings,
  totalValue,
  totalGainLoss,
  totalGainLossPercent,
  sectorAllocation,
  assetTypeAllocation,
  onTotalCashChange,
}: DashboardGridProps) {
  const { layout, isLoading, isSaving, updateLayout, addWidget, removeWidget, resetLayout } = useWidgetLayout();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState<string | null>(null);

  // Detect if we're on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Convert layout items to include min/max sizes from widget definitions
  const layoutWithConstraints: LayoutItem[] = useMemo(() => {
    return layout.map(item => {
      const def = getWidgetDefinition(item.i);
      return {
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: def?.minSize.w,
        minH: def?.minSize.h,
        maxW: def?.maxSize?.w,
        maxH: def?.maxSize?.h,
      };
    });
  }, [layout]);

  // Handle layout change
  const handleLayoutChange = (newLayout: LayoutItem[]) => {
    // Preserve only the position/size changes, not the constraints
    const updatedLayout = newLayout.map(item => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }));
    updateLayout(updatedLayout);
  };

  // Render widget content based on ID
  const renderWidgetContent = (widgetId: string) => {
    switch (widgetId) {
      case 'portfolio-summary':
        return (
          <PortfolioSummary
            totalValue={totalValue}
            totalGainLoss={totalGainLoss}
            totalGainLossPercent={totalGainLossPercent}
            locale={locale}
          />
        );
      case 'holdings-pie':
        return <HoldingsPieChart holdings={holdings} locale={locale} />;
      case 'sector-allocation':
        return <AllocationChart data={sectorAllocation} locale={locale} />;
      case 'performance':
        return <PerformanceChart locale={locale} />;
      case 'asset-type':
        return <AssetTypeChart data={assetTypeAllocation} locale={locale} />;
      case 'holdings-table':
        return <HoldingsTable holdings={holdings} locale={locale} />;
      case 'accounts':
        return <AccountsManager locale={locale} onTotalCashChange={onTotalCashChange} />;
      case 'watchlist':
        return (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            Watchlist widget - coming soon
          </div>
        );
      case 'alerts':
        return (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            Price alerts widget - coming soon
          </div>
        );
      case 'rebalance':
        return (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            Rebalance widget - coming soon
          </div>
        );
      default:
        return null;
    }
  };

  const existingWidgetIds = layout.map(item => item.i);

  const t = (key: string) => {
    const texts: Record<string, Record<string, string>> = {
      addWidget: { en: 'Add Widget', zh: '添加小组件' },
      resetLayout: { en: 'Reset Layout', zh: '重置布局' },
      saving: { en: 'Saving...', zh: '保存中...' },
    };
    return texts[key]?.[locale] || texts[key]?.en || key;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerRing size={32} />
      </div>
    );
  }

  // Mobile: Simple stacked layout without drag
  if (isMobile) {
    return (
      <div className="space-y-4">
        {layout.map(item => (
          <div key={item.i} className="w-full">
            <DashboardWidget widgetId={item.i} locale={locale}>
              {renderWidgetContent(item.i)}
            </DashboardWidget>
          </div>
        ))}
      </div>
    );
  }

  // Desktop: Full grid layout
  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {isSaving && (
          <span className="flex items-center gap-2 text-sm text-gray-500">
            <SpinnerRing size={16} strokeWidth={2} />
            {t('saving')}
          </span>
        )}
        <button
          onClick={resetLayout}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {t('resetLayout')}
        </button>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('addWidget')}
        </button>
      </div>

      {/* Grid */}
      <GridLayout
        className="layout"
        layout={layoutWithConstraints}
        cols={12}
        rowHeight={60}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onLayoutChange={handleLayoutChange as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onDragStart={(_: any, item: any) => setIsDragging(item?.i || null)}
        onDragStop={() => setIsDragging(null)}
        draggableHandle=".drag-handle"
        isResizable
        isDraggable
        useCSSTransforms
        compactType="vertical"
        preventCollision={false}
        margin={[16, 16]}
      >
        {layout.map(item => (
          <div key={item.i}>
            <DashboardWidget
              widgetId={item.i}
              locale={locale}
              onRemove={removeWidget}
              isDragging={isDragging === item.i}
            >
              {renderWidgetContent(item.i)}
            </DashboardWidget>
          </div>
        ))}
      </GridLayout>

      {/* Add Widget Modal */}
      <AddWidgetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddWidget={(widgetId) => {
          addWidget(widgetId);
          setIsAddModalOpen(false);
        }}
        existingWidgets={existingWidgetIds}
        locale={locale}
      />
    </div>
  );
}

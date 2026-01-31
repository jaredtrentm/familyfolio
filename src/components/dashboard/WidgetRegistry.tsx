'use client';

import { PortfolioSummary } from './PortfolioSummary';
import { HoldingsTable } from './HoldingsTable';
import { AccountsManager } from './AccountsManager';
import { AllocationChart } from '@/components/charts/AllocationChart';
import { AssetTypeChart } from '@/components/charts/AssetTypeChart';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { HoldingsPieChart } from '@/components/charts/HoldingsPieChart';
import {
  LayoutDashboard,
  PieChart,
  BarChart3,
  TrendingUp,
  Table,
  Wallet,
  Star,
  Bell,
  Scale
} from 'lucide-react';

export interface WidgetDefinition {
  id: string;
  name: string;
  nameZh: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    id: 'portfolio-summary',
    name: 'Portfolio Summary',
    nameZh: '投资组合概览',
    icon: LayoutDashboard,
    defaultSize: { w: 12, h: 2 },
    minSize: { w: 6, h: 2 },
  },
  {
    id: 'holdings-pie',
    name: 'Holdings Chart',
    nameZh: '持仓分布',
    icon: PieChart,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  {
    id: 'sector-allocation',
    name: 'Sector Allocation',
    nameZh: '行业配置',
    icon: BarChart3,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  {
    id: 'performance',
    name: 'Performance',
    nameZh: '业绩表现',
    icon: TrendingUp,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  {
    id: 'asset-type',
    name: 'Asset Types',
    nameZh: '资产类型',
    icon: PieChart,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  {
    id: 'holdings-table',
    name: 'Holdings Table',
    nameZh: '持仓列表',
    icon: Table,
    defaultSize: { w: 12, h: 6 },
    minSize: { w: 6, h: 4 },
  },
  {
    id: 'accounts',
    name: 'Cash Accounts',
    nameZh: '现金账户',
    icon: Wallet,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  {
    id: 'watchlist',
    name: 'Watchlist',
    nameZh: '自选股',
    icon: Star,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  {
    id: 'alerts',
    name: 'Price Alerts',
    nameZh: '价格提醒',
    icon: Bell,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  {
    id: 'rebalance',
    name: 'Rebalance Status',
    nameZh: '再平衡状态',
    icon: Scale,
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 2 },
  },
];

export interface WidgetProps {
  locale: string;
  holdings?: Array<{
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
  totalValue?: number;
  totalGainLoss?: number;
  totalGainLossPercent?: number;
  sectorAllocation?: Record<string, number>;
  assetTypeAllocation?: Record<string, number>;
  onTotalCashChange?: (cash: number) => void;
}

export function getWidgetComponent(widgetId: string) {
  switch (widgetId) {
    case 'portfolio-summary':
      return PortfolioSummary;
    case 'holdings-pie':
      return HoldingsPieChart;
    case 'sector-allocation':
      return AllocationChart;
    case 'performance':
      return PerformanceChart;
    case 'asset-type':
      return AssetTypeChart;
    case 'holdings-table':
      return HoldingsTable;
    case 'accounts':
      return AccountsManager;
    default:
      return null;
  }
}

export function getWidgetDefinition(widgetId: string): WidgetDefinition | undefined {
  return WIDGET_DEFINITIONS.find(w => w.id === widgetId);
}

export function getDefaultLayout(): Array<{ i: string; x: number; y: number; w: number; h: number }> {
  return [
    { i: 'portfolio-summary', x: 0, y: 0, w: 12, h: 2 },
    { i: 'accounts', x: 0, y: 2, w: 12, h: 3 },
    { i: 'holdings-pie', x: 0, y: 5, w: 6, h: 4 },
    { i: 'sector-allocation', x: 6, y: 5, w: 6, h: 4 },
    { i: 'asset-type', x: 0, y: 9, w: 6, h: 4 },
    { i: 'performance', x: 6, y: 9, w: 6, h: 4 },
    { i: 'holdings-table', x: 0, y: 13, w: 12, h: 6 },
  ];
}

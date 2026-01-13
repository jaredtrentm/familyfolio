'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { PortfolioSummary } from './PortfolioSummary';
import { HoldingsTable } from './HoldingsTable';
import { AccountsManager } from './AccountsManager';
import { AllocationChart } from '@/components/charts/AllocationChart';
import { PerformanceChart } from '@/components/charts/PerformanceChart';

interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  sector: string;
}

interface DashboardClientProps {
  holdings: Holding[];
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
  sectorAllocation: Record<string, number>;
  locale: string;
  noHoldingsMessage: string;
}

export function DashboardClient({
  holdings,
  totalValue: initialTotalValue,
  totalGainLoss,
  totalGainLossPercent,
  totalDayChange,
  totalDayChangePercent,
  sectorAllocation,
  locale,
  noHoldingsMessage,
}: DashboardClientProps) {
  const router = useRouter();
  const [totalCash, setTotalCash] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTotalCashChange = useCallback((cash: number) => {
    setTotalCash(cash);
  }, []);

  const handleRefreshStockData = async () => {
    setIsRefreshing(true);
    try {
      // Force refresh stock data (will fetch new prices and sectors via AI)
      await fetch('/api/stocks', { method: 'POST' });
      // Refresh the page to get updated data
      router.refresh();
    } catch (error) {
      console.error('Failed to refresh stock data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Total portfolio value including cash
  const totalValue = initialTotalValue + totalCash;

  // Check if any holdings have "Unknown" sector
  const hasUnknownSectors = holdings.some((h) => h.sector === 'Unknown');

  return (
    <div className="space-y-6">
      {/* Refresh button if sectors are unknown */}
      {hasUnknownSectors && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Some holdings have unknown sectors. Click refresh to classify them with AI.
          </p>
          <button
            onClick={handleRefreshStockData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <PortfolioSummary
        totalValue={totalValue}
        totalGainLoss={totalGainLoss}
        totalGainLossPercent={totalGainLossPercent}
        totalDayChange={totalDayChange}
        totalDayChangePercent={totalDayChangePercent}
        locale={locale}
      />

      {/* Accounts & Cash Manager */}
      <AccountsManager locale={locale} onTotalCashChange={handleTotalCashChange} />

      {holdings.length > 0 ? (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AllocationChart data={sectorAllocation} locale={locale} />
            <PerformanceChart locale={locale} />
          </div>

          {/* Holdings Table */}
          <HoldingsTable holdings={holdings} locale={locale} />
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">{noHoldingsMessage}</p>
        </div>
      )}
    </div>
  );
}

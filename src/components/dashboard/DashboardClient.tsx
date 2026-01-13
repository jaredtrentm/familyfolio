'use client';

import { useState, useCallback } from 'react';
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
  const [totalCash, setTotalCash] = useState(0);

  const handleTotalCashChange = useCallback((cash: number) => {
    setTotalCash(cash);
  }, []);

  // Total portfolio value including cash
  const totalValue = initialTotalValue + totalCash;

  return (
    <div className="space-y-6">
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

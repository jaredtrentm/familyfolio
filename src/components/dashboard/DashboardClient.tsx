'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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

interface StockData {
  symbol: string;
  name: string;
  currentPrice: number;
  dayChange: number;
  dayChangePercent: number;
  sector: string | null;
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
  holdings: initialHoldings,
  totalValue: serverTotalValue,
  totalGainLoss: serverTotalGainLoss,
  totalGainLossPercent: serverTotalGainLossPercent,
  totalDayChange: serverTotalDayChange,
  totalDayChangePercent: serverTotalDayChangePercent,
  sectorAllocation: serverSectorAllocation,
  locale,
  noHoldingsMessage,
}: DashboardClientProps) {
  const router = useRouter();
  const [totalCash, setTotalCash] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [stockPrices, setStockPrices] = useState<Map<string, StockData>>(new Map());
  const [hasLoadedPrices, setHasLoadedPrices] = useState(false);

  const handleTotalCashChange = useCallback((cash: number) => {
    setTotalCash(cash);
  }, []);

  const handleRefreshStockData = useCallback(async () => {
    if (initialHoldings.length === 0) return;

    setIsRefreshing(true);
    try {
      // Force refresh stock data (will fetch new prices and sectors via AI)
      const response = await fetch('/api/stocks', { method: 'POST' });
      const data = await response.json();

      if (data.stocks && Array.isArray(data.stocks)) {
        const newPrices = new Map<string, StockData>();
        for (const stock of data.stocks) {
          newPrices.set(stock.symbol, {
            symbol: stock.symbol,
            name: stock.name || stock.symbol,
            currentPrice: stock.currentPrice || 0,
            dayChange: stock.dayChange || 0,
            dayChangePercent: stock.dayChangePercent || 0,
            sector: stock.sector,
          });
        }
        setStockPrices(newPrices);
        setHasLoadedPrices(true);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to refresh stock data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [initialHoldings.length]);

  // Auto-refresh stock data on mount
  useEffect(() => {
    if (initialHoldings.length > 0) {
      handleRefreshStockData();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recalculate holdings with current prices
  const holdings = useMemo(() => {
    if (!hasLoadedPrices) return initialHoldings;

    return initialHoldings.map((h) => {
      const stock = stockPrices.get(h.symbol);
      if (!stock || stock.currentPrice === 0) return h;

      const currentPrice = Math.abs(stock.currentPrice);
      const currentValue = Math.abs(h.quantity * currentPrice);
      const costBasis = Math.abs(h.costBasis);
      const gainLoss = currentValue - costBasis;
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
      const dayChange = (stock.dayChange || 0) * h.quantity;
      const dayChangePercent = stock.dayChangePercent || 0;

      return {
        ...h,
        name: stock.name || h.name,
        currentPrice,
        currentValue,
        gainLoss,
        gainLossPercent,
        dayChange,
        dayChangePercent,
        sector: stock.sector || h.sector,
      };
    }).sort((a, b) => b.currentValue - a.currentValue);
  }, [initialHoldings, stockPrices, hasLoadedPrices]);

  // Calculate totals from holdings
  const { totalValue, totalGainLoss, totalGainLossPercent, totalDayChange, totalDayChangePercent } = useMemo(() => {
    if (!hasLoadedPrices) {
      return {
        totalValue: serverTotalValue + totalCash,
        totalGainLoss: serverTotalGainLoss,
        totalGainLossPercent: serverTotalGainLossPercent,
        totalDayChange: serverTotalDayChange,
        totalDayChangePercent: serverTotalDayChangePercent,
      };
    }

    const holdingsValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const gainLoss = holdingsValue - totalCostBasis;
    const dayChange = holdings.reduce((sum, h) => sum + h.dayChange, 0);
    const total = holdingsValue + totalCash;

    return {
      totalValue: total,
      totalGainLoss: gainLoss,
      totalGainLossPercent: totalCostBasis > 0 ? (gainLoss / totalCostBasis) * 100 : 0,
      totalDayChange: dayChange,
      totalDayChangePercent: holdingsValue > 0 ? (dayChange / holdingsValue) * 100 : 0,
    };
  }, [holdings, totalCash, hasLoadedPrices, serverTotalValue, serverTotalGainLoss, serverTotalGainLossPercent, serverTotalDayChange, serverTotalDayChangePercent]);

  // Calculate sector allocation from holdings
  const sectorAllocation = useMemo(() => {
    if (!hasLoadedPrices) return serverSectorAllocation;

    return holdings.reduce((acc, h) => {
      const sector = h.sector || 'Unknown';
      acc[sector] = (acc[sector] || 0) + h.currentValue;
      return acc;
    }, {} as Record<string, number>);
  }, [holdings, hasLoadedPrices, serverSectorAllocation]);

  // Check if any holdings have "Unknown" sector
  const hasUnknownSectors = holdings.some((h) => h.sector === 'Unknown');

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
            <div className="space-y-3">
              <AllocationChart data={sectorAllocation} locale={locale} />
              {/* Refresh sectors warning */}
              {hasUnknownSectors && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-center justify-between">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Some holdings have unknown sectors.
                  </p>
                  <button
                    onClick={handleRefreshStockData}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Classifying...' : 'Classify with AI'}
                  </button>
                </div>
              )}
            </div>
            <PerformanceChart locale={locale} />
          </div>

          {/* Holdings Table with refresh button */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {lastRefresh && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Last updated: {lastRefresh.toLocaleTimeString()}
                  </span>
                )}
                {isRefreshing && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    Fetching latest prices...
                  </span>
                )}
              </div>
              <button
                onClick={handleRefreshStockData}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh stock prices"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Updating...' : 'Update Prices'}
              </button>
            </div>
            <HoldingsTable holdings={holdings} locale={locale} />
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">{noHoldingsMessage}</p>
        </div>
      )}
    </div>
  );
}

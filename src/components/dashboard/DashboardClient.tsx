'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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
  sector: string;
}

interface StockData {
  symbol: string;
  name: string;
  currentPrice: number;
  sector: string | null;
}

interface DashboardClientProps {
  holdings: Holding[];
  locale: string;
  noHoldingsMessage: string;
}

export function DashboardClient({
  holdings: initialHoldings,
  locale,
  noHoldingsMessage,
}: DashboardClientProps) {
  const [totalCash, setTotalCash] = useState(0);
  const [stockPrices, setStockPrices] = useState<Map<string, StockData>>(new Map());

  const handleTotalCashChange = useCallback((cash: number) => {
    setTotalCash(cash);
  }, []);

  // Fetch latest stock data (prices and sectors) from cache
  const refreshStockData = useCallback(async () => {
    if (initialHoldings.length === 0) return;

    try {
      // Refresh stock data cache
      const response = await fetch('/api/stocks', { method: 'POST' });
      const data = await response.json();

      if (data.error) {
        console.error('[Dashboard] API error:', data.error);
        return;
      }

      if (data.stocks && Array.isArray(data.stocks)) {
        const newPrices = new Map<string, StockData>();
        for (const stock of data.stocks) {
          const normalizedSymbol = stock.symbol.toUpperCase().trim();
          newPrices.set(normalizedSymbol, {
            symbol: normalizedSymbol,
            name: stock.name || normalizedSymbol,
            currentPrice: stock.currentPrice || 0,
            sector: stock.sector,
          });
        }
        setStockPrices(newPrices);
      }
    } catch (error) {
      console.error('[Dashboard] Failed to refresh stock data:', error);
    }
  }, [initialHoldings.length]);

  // Auto-refresh stock data on mount and every 5 minutes
  useEffect(() => {
    if (initialHoldings.length === 0) return;

    // Initial refresh
    refreshStockData();

    // Set up periodic refresh every 5 minutes
    const intervalId = setInterval(() => {
      console.log('[Dashboard] Auto-refreshing stock prices...');
      refreshStockData();
    }, 5 * 60 * 1000); // 5 minutes

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recalculate holdings with current prices
  const holdings = useMemo(() => {
    return initialHoldings.map((h) => {
      // Normalize symbol for matching
      const normalizedSymbol = h.symbol.toUpperCase().trim();
      const stock = stockPrices.get(normalizedSymbol);

      // Use fetched price if available and valid, otherwise keep original
      const currentPrice = (stock && stock.currentPrice > 0)
        ? Math.abs(stock.currentPrice)
        : Math.abs(h.currentPrice);
      const quantity = Math.abs(h.quantity);
      const currentValue = quantity * currentPrice;
      const costBasis = Math.abs(h.costBasis);
      const gainLoss = currentValue - costBasis;
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

      return {
        ...h,
        symbol: normalizedSymbol,
        name: stock?.name || h.name,
        quantity,
        currentPrice,
        currentValue,
        costBasis,
        gainLoss,
        gainLossPercent,
        sector: stock?.sector || h.sector,
      };
    }).sort((a, b) => b.currentValue - a.currentValue);
  }, [initialHoldings, stockPrices]);

  // Calculate totals from holdings - always use current holdings data
  const { totalValue, totalGainLoss, totalGainLossPercent } = useMemo(() => {
    const holdingsValue = holdings.reduce((sum, h) => sum + Math.abs(h.currentValue), 0);
    const totalCostBasis = holdings.reduce((sum, h) => sum + Math.abs(h.costBasis), 0);
    const gainLoss = holdingsValue - totalCostBasis;
    const total = holdingsValue + totalCash;

    return {
      totalValue: Math.abs(total),
      totalGainLoss: gainLoss,
      totalGainLossPercent: totalCostBasis > 0 ? (gainLoss / totalCostBasis) * 100 : 0,
    };
  }, [holdings, totalCash]);

  // Calculate sector allocation from holdings - always use current data
  const sectorAllocation = useMemo(() => {
    return holdings.reduce((acc, h) => {
      const sector = h.sector || 'Unknown';
      acc[sector] = (acc[sector] || 0) + Math.abs(h.currentValue);
      return acc;
    }, {} as Record<string, number>);
  }, [holdings]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <PortfolioSummary
        totalValue={totalValue}
        totalGainLoss={totalGainLoss}
        totalGainLossPercent={totalGainLossPercent}
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

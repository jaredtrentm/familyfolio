'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { PortfolioSummary } from './PortfolioSummary';
import { HoldingsTable } from './HoldingsTable';
import { AccountsManager } from './AccountsManager';
import { AllocationChart } from '@/components/charts/AllocationChart';
import { AssetTypeChart } from '@/components/charts/AssetTypeChart';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { HoldingsPieChart } from '@/components/charts/HoldingsPieChart';
import { classifyAssetType, type AssetType } from '@/lib/asset-types';
import { Skeleton, SkeletonChart, SkeletonTable } from '@/components/ui/Skeleton';
import { SpinnerRing } from '@/components/ui/ProgressRing';
import { RefreshCw } from 'lucide-react';

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
  isEtf?: boolean;
}

interface EtfHolding {
  holdingSymbol: string;
  holdingName: string | null;
  weight: number;
  sector: string | null;
}

type EtfHoldingsMap = Record<string, EtfHolding[]>;

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
  const [etfHoldings, setEtfHoldings] = useState<EtfHoldingsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTotalCashChange = useCallback((cash: number) => {
    setTotalCash(cash);
  }, []);

  // Fetch latest stock data (prices and sectors) from cache
  const refreshStockData = useCallback(async (showRefreshing = false) => {
    if (initialHoldings.length === 0) {
      setIsLoading(false);
      return;
    }

    if (showRefreshing) setIsRefreshing(true);

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
            isEtf: stock.isEtf || stock.sector === 'ETF',
          });
        }
        setStockPrices(newPrices);
      }

      // Store ETF holdings for sector breakdown
      if (data.etfHoldings) {
        setEtfHoldings(data.etfHoldings);
      }
    } catch (error) {
      console.error('[Dashboard] Failed to refresh stock data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [initialHoldings.length]);

  const handleManualRefresh = () => {
    refreshStockData(true);
  };

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

  // Calculate sector allocation from holdings - break down ETFs into underlying sectors
  const sectorAllocation = useMemo(() => {
    const allocation: Record<string, number> = {};

    for (const h of holdings) {
      const normalizedSymbol = h.symbol.toUpperCase().trim();
      const stock = stockPrices.get(normalizedSymbol);
      const isEtf = stock?.isEtf || h.sector === 'ETF';
      const holdingValue = Math.abs(h.currentValue);

      // If this is an ETF and we have its holdings, distribute value by sector
      if (isEtf && etfHoldings[normalizedSymbol] && etfHoldings[normalizedSymbol].length > 0) {
        const etfComponents = etfHoldings[normalizedSymbol];
        let totalWeight = 0;

        // First pass: add up weights for components with known sectors
        for (const component of etfComponents) {
          if (component.sector && component.sector !== 'ETF') {
            totalWeight += component.weight;
          }
        }

        // Second pass: distribute value proportionally
        if (totalWeight > 0) {
          for (const component of etfComponents) {
            if (component.sector && component.sector !== 'ETF') {
              const sectorValue = (holdingValue * component.weight) / totalWeight;
              allocation[component.sector] = (allocation[component.sector] || 0) + sectorValue;
            }
          }
        } else {
          // If no sector info available, fall back to "Diversified" instead of "ETF"
          allocation['Diversified'] = (allocation['Diversified'] || 0) + holdingValue;
        }
      } else {
        // Not an ETF or no holdings data - use direct sector
        const sector = h.sector === 'ETF' ? 'Diversified' : (h.sector || 'Unknown');
        allocation[sector] = (allocation[sector] || 0) + holdingValue;
      }
    }

    return allocation;
  }, [holdings, stockPrices, etfHoldings]);

  // Calculate asset type allocation (stocks, bonds, real estate, etc.)
  const assetTypeAllocation = useMemo(() => {
    const allocation = holdings.reduce((acc, h) => {
      const assetType = classifyAssetType(h.symbol, h.sector);
      acc[assetType] = (acc[assetType] || 0) + Math.abs(h.currentValue);
      return acc;
    }, {} as Record<AssetType, number>);

    // Add cash to the allocation
    if (totalCash > 0) {
      allocation['Cash'] = (allocation['Cash'] || 0) + totalCash;
    }

    return allocation;
  }, [holdings, totalCash]);

  // Show skeleton loading state
  if (isLoading && initialHoldings.length > 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Summary skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-6">
            <Skeleton width="40%" height="1rem" className="mb-4" />
            <Skeleton width="60%" height="2rem" />
          </div>
          <div className="glass-card rounded-xl p-6">
            <Skeleton width="40%" height="1rem" className="mb-4" />
            <Skeleton width="60%" height="2rem" />
          </div>
        </div>

        {/* Accounts skeleton */}
        <div className="glass-card rounded-xl p-6">
          <Skeleton width="30%" height="1.5rem" className="mb-4" />
          <div className="space-y-2">
            <Skeleton height="2.5rem" />
            <Skeleton height="2.5rem" />
          </div>
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart type="pie" />
          <SkeletonChart type="bar" />
        </div>

        {/* Table skeleton */}
        <SkeletonTable rows={5} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh button */}
      {holdings.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {isRefreshing ? (
              <SpinnerRing size={16} strokeWidth={2} />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      )}

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
            <HoldingsPieChart holdings={holdings} locale={locale} />
            <AllocationChart data={sectorAllocation} locale={locale} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssetTypeChart data={assetTypeAllocation} locale={locale} />
            <PerformanceChart locale={locale} />
          </div>

          {/* Holdings Table */}
          <HoldingsTable holdings={holdings} locale={locale} />
        </>
      ) : (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">{noHoldingsMessage}</p>
        </div>
      )}
    </div>
  );
}

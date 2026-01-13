'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PerformanceChartProps {
  locale: string;
}

type TimePeriod = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '5Y' | 'MAX';

interface HistoryData {
  date: string;
  value: number;
  costBasis: number;
}

interface Summary {
  startValue: number;
  endValue: number;
  change: number;
  changePercent: number;
}

const TIME_PERIODS: TimePeriod[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y', 'MAX'];

export function PerformanceChart({ locale }: PerformanceChartProps) {
  const t = useTranslations('dashboard');
  const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

  const [period, setPeriod] = useState<TimePeriod>('1M');
  const [history, setHistory] = useState<HistoryData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/portfolio/history?period=${period}`);
        if (response.ok) {
          const data = await response.json();
          setHistory(data.history || []);
          setSummary(data.summary || null);
        }
      } catch (error) {
        console.error('Failed to fetch portfolio history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [period]);

  const isPositive = summary ? summary.change >= 0 : true;
  const chartColor = isPositive ? '#10B981' : '#EF4444';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('performance')}
          </h3>
          {summary && !isLoading && (
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  'flex items-center gap-1 text-sm font-medium',
                  isPositive ? 'text-green-600' : 'text-red-600'
                )}
              >
                {isPositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {formatCurrency(Math.abs(summary.change), 'USD', localeCode)}
                <span className="text-gray-500 dark:text-gray-400">
                  ({isPositive ? '+' : '-'}
                  {Math.abs(summary.changePercent).toFixed(2)}%)
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
        {TIME_PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
              period === p
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            No data available for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                  return `$${value}`;
                }}
                domain={['dataMin', 'dataMax']}
              />
              <Tooltip
                formatter={(value) => [
                  formatCurrency(Number(value) || 0, 'USD', localeCode),
                  'Portfolio Value',
                ]}
                contentStyle={{
                  backgroundColor: 'var(--tooltip-bg, #fff)',
                  border: '1px solid var(--tooltip-border, #e5e7eb)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

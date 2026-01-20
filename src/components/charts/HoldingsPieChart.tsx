'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface Holding {
  symbol: string;
  name: string;
  currentValue: number;
}

interface HoldingsPieChartProps {
  holdings: Holding[];
  locale: string;
}

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#A855F7', // violet
];

export function HoldingsPieChart({ holdings, locale }: HoldingsPieChartProps) {
  const t = useTranslations('dashboard');
  const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

  // Process holdings: group small holdings (<3%) into "Other"
  const chartData = useMemo(() => {
    const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    if (total === 0) return [];

    const threshold = total * 0.03; // 3% threshold
    const mainHoldings: { name: string; symbol: string; value: number }[] = [];
    let otherValue = 0;

    // Sort by value descending
    const sorted = [...holdings].sort((a, b) => b.currentValue - a.currentValue);

    for (const h of sorted) {
      if (h.currentValue >= threshold) {
        mainHoldings.push({
          name: h.name || h.symbol,
          symbol: h.symbol,
          value: h.currentValue,
        });
      } else {
        otherValue += h.currentValue;
      }
    }

    // Add "Other" category if there are small holdings
    if (otherValue > 0) {
      mainHoldings.push({
        name: 'Other',
        symbol: 'OTHER',
        value: otherValue,
      });
    }

    return mainHoldings;
  }, [holdings]);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('holdings')}
        </h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No holdings data
        </div>
      </div>
    );
  }

  // Custom label for pie slices
  const renderCustomizedLabel = (props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    percent?: number;
    name?: string;
  }) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
    if (percent < 0.05) return null; // Don't show label for slices less than 5%

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
        style={{ fontSize: '11px', fontWeight: 600 }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('holdings')}
      </h3>
      <div className="flex flex-col lg:flex-row items-center gap-4">
        {/* Pie Chart */}
        <div className="h-56 w-56 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={renderCustomizedLabel}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.symbol}
                    fill={COLORS[index % COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, props) => [
                  formatCurrency(Number(value) || 0, 'USD', localeCode),
                  props.payload.symbol !== 'OTHER' ? props.payload.symbol : 'Other',
                ]}
                contentStyle={{
                  backgroundColor: 'var(--tooltip-bg, #fff)',
                  border: '1px solid var(--tooltip-border, #e5e7eb)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Custom Legend */}
        <div className="flex-1 w-full">
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {chartData.map((item, index) => {
              const percentage = ((item.value / total) * 100).toFixed(1);
              return (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white block truncate">
                        {item.symbol !== 'OTHER' ? item.symbol : 'Other'}
                      </span>
                      {item.symbol !== 'OTHER' && item.name !== item.symbol && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                          {item.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {percentage}%
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                      {formatCurrency(item.value, 'USD', localeCode)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

interface PortfolioSummaryProps {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  locale: string;
}

export function PortfolioSummary({
  totalValue,
  totalGainLoss,
  totalGainLossPercent,
  locale,
}: PortfolioSummaryProps) {
  const t = useTranslations('dashboard');

  const cards = [
    {
      title: t('totalValue'),
      value: formatCurrency(totalValue, 'USD', locale === 'zh' ? 'zh-CN' : 'en-US'),
      icon: DollarSign,
      color: 'blue',
    },
    {
      title: t('totalGain'),
      value: formatCurrency(Math.abs(totalGainLoss), 'USD', locale === 'zh' ? 'zh-CN' : 'en-US'),
      change: totalGainLossPercent,
      icon: totalGainLoss >= 0 ? TrendingUp : TrendingDown,
      color: totalGainLoss >= 0 ? 'green' : 'red',
      isPositive: totalGainLoss >= 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const colorClasses = {
          blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
          green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
          red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
        };

        return (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {card.title}
              </span>
              <div className={cn('p-2 rounded-lg', colorClasses[card.color as keyof typeof colorClasses])}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {'isPositive' in card && !card.isPositive && '-'}
                {card.value}
              </span>
              {card.change !== undefined && (
                <span
                  className={cn(
                    'text-sm font-medium',
                    card.isPositive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {card.isPositive ? '+' : ''}{card.change.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { motion } from 'framer-motion';

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
      value: totalValue,
      icon: DollarSign,
      color: 'blue',
    },
    {
      title: t('totalGain'),
      value: Math.abs(totalGainLoss),
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
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="glass-card rounded-xl p-6 hover-lift"
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
                <AnimatedNumber
                  value={card.value}
                  prefix="$"
                  decimals={2}
                  locale={locale}
                />
              </span>
              {card.change !== undefined && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 }}
                  className={cn(
                    'text-sm font-medium',
                    card.isPositive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {card.isPositive ? '+' : ''}{card.change.toFixed(2)}%
                </motion.span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

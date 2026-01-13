'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatCurrency, formatDate, formatNumber, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, CheckCircle, Clock, DollarSign, Percent } from 'lucide-react';

interface RealizedGain {
  id: string;
  date: string;
  symbol: string;
  quantity: number;
  proceeds: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
}

interface UnrealizedGain {
  symbol: string;
  name: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
}

interface GainsClientProps {
  realizedGains: RealizedGain[];
  unrealizedGains: UnrealizedGain[];
  totalRealizedGain: number;
  totalRealizedProceeds: number;
  totalRealizedCostBasis: number;
  totalRealizedGainPercent: number;
  totalUnrealizedGain: number;
  totalUnrealizedValue: number;
  totalUnrealizedCostBasis: number;
  totalUnrealizedGainPercent: number;
  locale: string;
}

type TabType = 'unrealized' | 'realized';

export function GainsClient({
  realizedGains,
  unrealizedGains,
  totalRealizedGain,
  totalRealizedCostBasis,
  totalRealizedGainPercent,
  totalUnrealizedGain,
  totalUnrealizedValue,
  totalUnrealizedCostBasis,
  totalUnrealizedGainPercent,
  locale,
}: GainsClientProps) {
  const t = useTranslations('gains');
  const [activeTab, setActiveTab] = useState<TabType>('unrealized');

  const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

  const tabs = [
    { id: 'unrealized' as const, label: t('unrealized'), icon: Clock },
    { id: 'realized' as const, label: t('realized'), icon: CheckCircle },
  ];

  const totalGain = activeTab === 'unrealized' ? totalUnrealizedGain : totalRealizedGain;
  const totalCostBasis = activeTab === 'unrealized' ? totalUnrealizedCostBasis : totalRealizedCostBasis;
  const totalGainPercent = activeTab === 'unrealized' ? totalUnrealizedGainPercent : totalRealizedGainPercent;
  const totalValue = activeTab === 'unrealized' ? totalUnrealizedValue : totalRealizedGain + totalRealizedCostBasis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {activeTab === 'unrealized' ? t('currentValue') : t('totalProceeds')}
            </span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalValue, 'USD', localeCode)}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700">
              <DollarSign className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('costBasis')}
            </span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalCostBasis, 'USD', localeCode)}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              'p-2 rounded-lg',
              totalGain >= 0
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20'
            )}>
              {totalGain >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('totalGain')}
            </span>
          </div>
          <span className={cn(
            'text-2xl font-bold',
            totalGain >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          )}>
            {totalGain >= 0 ? '+' : ''}
            {formatCurrency(totalGain, 'USD', localeCode)}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              'p-2 rounded-lg',
              totalGainPercent >= 0
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20'
            )}>
              <Percent className={cn(
                'w-5 h-5',
                totalGainPercent >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              )} />
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('return')}
            </span>
          </div>
          <span className={cn(
            'text-2xl font-bold',
            totalGainPercent >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          )}>
            {totalGainPercent >= 0 ? '+' : ''}
            {totalGainPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'unrealized' ? (
        <UnrealizedGainsTable gains={unrealizedGains} localeCode={localeCode} t={t} />
      ) : (
        <RealizedGainsTable gains={realizedGains} localeCode={localeCode} t={t} />
      )}
    </div>
  );
}

function UnrealizedGainsTable({
  gains,
  localeCode,
  t,
}: {
  gains: UnrealizedGain[];
  localeCode: string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (gains.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          {t('noUnrealized')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('symbol')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('shares')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('price')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('value')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('costBasis')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('gain')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {gains.map((gain) => (
              <tr key={gain.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {gain.symbol}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {gain.name}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                  {formatNumber(gain.quantity, localeCode)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                  {formatCurrency(gain.currentPrice, 'USD', localeCode)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(gain.currentValue, 'USD', localeCode)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                  {formatCurrency(gain.costBasis, 'USD', localeCode)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className={cn(
                    'text-sm font-medium',
                    gain.gain >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}>
                    <div>
                      {gain.gain >= 0 ? '+' : ''}
                      {formatCurrency(gain.gain, 'USD', localeCode)}
                    </div>
                    <div className="text-xs opacity-75">
                      ({gain.gainPercent >= 0 ? '+' : ''}{gain.gainPercent.toFixed(2)}%)
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RealizedGainsTable({
  gains,
  localeCode,
  t,
}: {
  gains: RealizedGain[];
  localeCode: string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (gains.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
        <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          {t('noRealized')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('date')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('symbol')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('shares')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('proceeds')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('costBasis')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('gain')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {gains.map((gain) => (
              <tr key={gain.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatDate(gain.date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {gain.symbol}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                  {formatNumber(gain.quantity, localeCode)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(gain.proceeds, 'USD', localeCode)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                  {formatCurrency(gain.costBasis, 'USD', localeCode)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className={cn(
                    'text-sm font-medium',
                    gain.gain >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}>
                    <div>
                      {gain.gain >= 0 ? '+' : ''}
                      {formatCurrency(gain.gain, 'USD', localeCode)}
                    </div>
                    <div className="text-xs opacity-75">
                      ({gain.gainPercent >= 0 ? '+' : ''}{gain.gainPercent.toFixed(2)}%)
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

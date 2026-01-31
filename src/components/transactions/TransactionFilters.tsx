'use client';

import { useState, useEffect } from 'react';
import { Filter, X, ChevronDown, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Account {
  id: string;
  name: string;
}

interface TransactionFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  accounts: Account[];
  locale: string;
}

export interface FilterState {
  type: string | null;
  accountId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  symbol: string | null;
}

export function TransactionFilters({ onFilterChange, accounts, locale }: TransactionFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    type: null,
    accountId: null,
    dateFrom: null,
    dateTo: null,
    symbol: null,
  });

  const hasActiveFilters = Object.values(filters).some(v => v !== null);

  const t = (key: string) => {
    const texts: Record<string, Record<string, string>> = {
      filters: { en: 'Filters', zh: '筛选' },
      type: { en: 'Type', zh: '类型' },
      account: { en: 'Account', zh: '账户' },
      dateRange: { en: 'Date Range', zh: '日期范围' },
      symbol: { en: 'Symbol', zh: '代码' },
      all: { en: 'All', zh: '全部' },
      clearAll: { en: 'Clear All', zh: '清除全部' },
      from: { en: 'From', zh: '从' },
      to: { en: 'To', zh: '至' },
      buy: { en: 'Buy', zh: '买入' },
      sell: { en: 'Sell', zh: '卖出' },
      dividend: { en: 'Dividend', zh: '股息' },
      transferIn: { en: 'Transfer In', zh: '转入' },
      transferOut: { en: 'Transfer Out', zh: '转出' },
    };
    return texts[key]?.[locale] || texts[key]?.en || key;
  };

  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const updateFilter = (key: keyof FilterState, value: string | null) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? null : value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      type: null,
      accountId: null,
      dateFrom: null,
      dateTo: null,
      symbol: null,
    });
  };

  const transactionTypes = [
    { value: 'BUY', label: t('buy') },
    { value: 'SELL', label: t('sell') },
    { value: 'DIVIDEND', label: t('dividend') },
    { value: 'TRANSFER_IN', label: t('transferIn') },
    { value: 'TRANSFER_OUT', label: t('transferOut') },
  ];

  return (
    <div className="mb-4">
      {/* Filter toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          hasActiveFilters
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">{t('filters')}</span>
        {hasActiveFilters && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
            {Object.values(filters).filter(v => v !== null).length}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded filters */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Transaction Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t('type')}
                  </label>
                  <select
                    value={filters.type || ''}
                    onChange={e => updateFilter('type', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('all')}</option>
                    {transactionTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Account */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t('account')}
                  </label>
                  <select
                    value={filters.accountId || ''}
                    onChange={e => updateFilter('accountId', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('all')}</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Symbol */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t('symbol')}
                  </label>
                  <input
                    type="text"
                    value={filters.symbol || ''}
                    onChange={e => updateFilter('symbol', e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t('dateRange')}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="date"
                        value={filters.dateFrom || ''}
                        onChange={e => updateFilter('dateFrom', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-gray-400">-</span>
                    <div className="relative flex-1">
                      <input
                        type="date"
                        value={filters.dateTo || ''}
                        onChange={e => updateFilter('dateTo', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Clear filters button */}
              {hasActiveFilters && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    {t('clearAll')}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

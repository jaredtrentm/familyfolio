'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WatchlistItem {
  id: string;
  symbol: string;
  notes: string | null;
  addedAt: string;
  name: string | null;
  currentPrice: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  sector: string | null;
}

interface WatchlistClientProps {
  locale: string;
}

export function WatchlistClient({ locale }: WatchlistClientProps) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const t = (key: string) => {
    const texts: Record<string, Record<string, string>> = {
      title: { en: 'Watchlist', zh: '自选股' },
      subtitle: { en: 'Track stocks you\'re interested in', zh: '追踪您感兴趣的股票' },
      addSymbol: { en: 'Add Symbol', zh: '添加代码' },
      symbolPlaceholder: { en: 'Enter symbol (e.g., AAPL)', zh: '输入代码（如 AAPL）' },
      add: { en: 'Add', zh: '添加' },
      cancel: { en: 'Cancel', zh: '取消' },
      noItems: { en: 'Your watchlist is empty', zh: '您的自选股列表为空' },
      noItemsDesc: { en: 'Add symbols to track their prices', zh: '添加代码以追踪价格' },
      price: { en: 'Price', zh: '价格' },
      change: { en: 'Change', zh: '涨跌' },
      sector: { en: 'Sector', zh: '行业' },
      addedOn: { en: 'Added', zh: '添加于' },
    };
    return texts[key]?.[locale] || texts[key]?.en || key;
  };

  const fetchWatchlist = useCallback(async () => {
    try {
      const response = await fetch('/api/watchlist');
      const data = await response.json();
      if (data.watchlist) {
        setWatchlist(data.watchlist);
      }
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Refresh when page becomes visible (user navigates back to this tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchWatchlist();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchWatchlist]);

  const handleAdd = async () => {
    if (!newSymbol.trim()) return;

    setIsAdding(true);
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: newSymbol.trim() }),
      });

      if (response.ok) {
        setNewSymbol('');
        setShowAddForm(false);
        fetchWatchlist();
      }
    } catch (error) {
      console.error('Failed to add to watchlist:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/watchlist?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWatchlist(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error('Failed to remove from watchlist:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '—';
    return `$${price.toFixed(2)}`;
  };

  const formatChange = (change: number | null, percent: number | null) => {
    if (change === null || percent === null) return '—';
    const sign = change >= 0 ? '+' : '';
    return `${sign}$${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500" />
            {t('title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('addSymbol')}
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newSymbol}
                  onChange={e => setNewSymbol(e.target.value.toUpperCase())}
                  placeholder={t('symbolPlaceholder')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  autoFocus
                />
                <button
                  onClick={handleAdd}
                  disabled={isAdding || !newSymbol.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {t('add')}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSymbol('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Watchlist */}
      {watchlist.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Star className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('noItems')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {t('noItemsDesc')}
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Symbol
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {t('price')}
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {t('change')}
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">
                  {t('sector')}
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">
                  {t('addedOn')}
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((item, index) => {
                const isPositive = (item.dayChange || 0) >= 0;

                return (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {item.symbol}
                        </span>
                        {item.name && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                            {item.name}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatPrice(item.currentPrice)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`flex items-center justify-end gap-1 ${
                        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {isPositive ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span className="font-medium">
                          {formatChange(item.dayChange, item.dayChangePercent)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-gray-600 dark:text-gray-400">
                        {item.sector || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right hidden sm:table-cell">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(item.addedAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRemove(item.id)}
                        disabled={deletingId === item.id}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

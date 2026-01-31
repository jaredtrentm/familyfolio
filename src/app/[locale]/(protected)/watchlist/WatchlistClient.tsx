'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, Loader2, Target, Calendar, Activity, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NewsWidget } from '@/components/news/NewsWidget';

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
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  volume: number | null;
  averageVolume: number | null;
  targetPrice: number | null;
  earningsDate: string | null;
  beta: number | null;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      week52Range: { en: '52W Range', zh: '52周范围' },
      peRatio: { en: 'P/E', zh: '市盈率' },
      marketCap: { en: 'Mkt Cap', zh: '市值' },
      dividend: { en: 'Div Yield', zh: '股息率' },
      volume: { en: 'Volume', zh: '成交量' },
      avgVolume: { en: 'Avg Vol', zh: '平均成交量' },
      target: { en: 'Target', zh: '目标价' },
      earnings: { en: 'Earnings', zh: '财报日' },
      beta: { en: 'Beta', zh: '贝塔' },
      upside: { en: 'upside', zh: '上涨空间' },
      downside: { en: 'downside', zh: '下跌空间' },
      high: { en: 'H', zh: '高' },
      low: { en: 'L', zh: '低' },
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

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchWatchlist();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      const response = await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' });
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

  const formatLargeNumber = (num: number | null) => {
    if (num === null) return '—';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const formatVolume = (vol: number | null) => {
    if (vol === null) return '—';
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
    return vol.toLocaleString();
  };

  const formatPercent = (val: number | null, decimals = 2) => {
    if (val === null) return '—';
    return `${val.toFixed(decimals)}%`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const get52WeekPosition = (item: WatchlistItem) => {
    if (!item.currentPrice || !item.fiftyTwoWeekHigh || !item.fiftyTwoWeekLow) return null;
    const range = item.fiftyTwoWeekHigh - item.fiftyTwoWeekLow;
    if (range <= 0) return 50;
    return ((item.currentPrice - item.fiftyTwoWeekLow) / range) * 100;
  };

  const getTargetUpside = (item: WatchlistItem) => {
    if (!item.currentPrice || !item.targetPrice) return null;
    return ((item.targetPrice - item.currentPrice) / item.currentPrice) * 100;
  };

  const getVolumeRatio = (item: WatchlistItem) => {
    if (!item.volume || !item.averageVolume) return null;
    return item.volume / item.averageVolume;
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
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {t('add')}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewSymbol(''); }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Watchlist */}
        <div className="lg:col-span-2">
          {watchlist.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Star className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('noItems')}</h3>
              <p className="text-gray-500 dark:text-gray-400">{t('noItemsDesc')}</p>
            </div>
          ) : (
            <div className="space-y-4">
          {watchlist.map((item, index) => {
            const isPositive = (item.dayChange || 0) >= 0;
            const position52W = get52WeekPosition(item);
            const targetUpside = getTargetUpside(item);
            const volumeRatio = getVolumeRatio(item);
            const isExpanded = expandedId === item.id;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card rounded-xl overflow-hidden"
              >
                {/* Main Row */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-gray-900 dark:text-white">{item.symbol}</span>
                          {item.sector && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                              {item.sector}
                            </span>
                          )}
                        </div>
                        {item.name && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{item.name}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Price & Change */}
                      <div className="text-right">
                        <div className="font-semibold text-lg text-gray-900 dark:text-white">
                          {formatPrice(item.currentPrice)}
                        </div>
                        <div className={`flex items-center justify-end gap-1 text-sm ${
                          isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>{formatPercent(item.dayChangePercent)}</span>
                        </div>
                      </div>

                      {/* Quick Stats (desktop) */}
                      <div className="hidden lg:flex items-center gap-4">
                        {/* 52W Range Mini */}
                        {position52W !== null && (
                          <div className="w-24">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('week52Range')}</div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full relative">
                              <div
                                className="absolute top-0 h-2 w-1 bg-blue-600 rounded-full transform -translate-x-1/2"
                                style={{ left: `${Math.min(Math.max(position52W, 2), 98)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Target Price */}
                        {targetUpside !== null && (
                          <div className="text-right min-w-[70px]">
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('target')}</div>
                            <div className={`text-sm font-medium ${targetUpside >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {targetUpside >= 0 ? '+' : ''}{targetUpside.toFixed(1)}%
                            </div>
                          </div>
                        )}

                        {/* P/E */}
                        {item.peRatio && (
                          <div className="text-right min-w-[50px]">
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('peRatio')}</div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{item.peRatio.toFixed(1)}</div>
                          </div>
                        )}
                      </div>

                      {/* Expand/Delete buttons */}
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                          disabled={deletingId === item.id}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deletingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {/* 52 Week Range */}
                          <div className="col-span-2">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              {t('week52Range')}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{formatPrice(item.fiftyTwoWeekLow)}</span>
                              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full relative">
                                {position52W !== null && (
                                  <>
                                    <div
                                      className="absolute top-0 left-0 h-2 bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 rounded-full"
                                      style={{ width: '100%', opacity: 0.3 }}
                                    />
                                    <div
                                      className="absolute top-1/2 w-3 h-3 bg-blue-600 border-2 border-white dark:border-gray-800 rounded-full transform -translate-y-1/2 -translate-x-1/2 shadow"
                                      style={{ left: `${Math.min(Math.max(position52W, 2), 98)}%` }}
                                    />
                                  </>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">{formatPrice(item.fiftyTwoWeekHigh)}</span>
                            </div>
                          </div>

                          {/* Market Cap */}
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('marketCap')}</div>
                            <div className="font-medium text-gray-900 dark:text-white">{formatLargeNumber(item.marketCap)}</div>
                          </div>

                          {/* P/E Ratio */}
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('peRatio')}</div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {item.peRatio ? item.peRatio.toFixed(2) : '—'}
                            </div>
                          </div>

                          {/* Dividend Yield */}
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('dividend')}</div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {item.dividendYield ? `${item.dividendYield.toFixed(2)}%` : '—'}
                            </div>
                          </div>

                          {/* Beta */}
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('beta')}</div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {item.beta ? item.beta.toFixed(2) : '—'}
                            </div>
                          </div>

                          {/* Volume */}
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                              <Activity className="w-3 h-3" />
                              {t('volume')}
                            </div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {formatVolume(item.volume)}
                              {volumeRatio !== null && (
                                <span className={`ml-1 text-xs ${volumeRatio > 1.5 ? 'text-orange-500' : volumeRatio < 0.5 ? 'text-gray-400' : 'text-gray-500'}`}>
                                  ({volumeRatio.toFixed(1)}x)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Avg Volume */}
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('avgVolume')}</div>
                            <div className="font-medium text-gray-900 dark:text-white">{formatVolume(item.averageVolume)}</div>
                          </div>

                          {/* Analyst Target */}
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              {t('target')}
                            </div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {formatPrice(item.targetPrice)}
                              {targetUpside !== null && (
                                <span className={`ml-1 text-xs ${targetUpside >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ({targetUpside >= 0 ? '+' : ''}{targetUpside.toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Earnings Date */}
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {t('earnings')}
                            </div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {formatDate(item.earningsDate)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
            </div>
          )}
        </div>

        {/* News Sidebar */}
        <div className="space-y-6">
          {/* Market News */}
          <NewsWidget maxItems={5} />

          {/* Symbol-specific news for expanded item */}
          {expandedId && watchlist.find(w => w.id === expandedId) && (
            <NewsWidget
              symbol={watchlist.find(w => w.id === expandedId)?.symbol}
              title={`${watchlist.find(w => w.id === expandedId)?.symbol} News`}
              maxItems={5}
            />
          )}
        </div>
      </div>
    </div>
  );
}

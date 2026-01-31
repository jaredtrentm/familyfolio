'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  isActive: boolean;
  triggeredAt: string | null;
  createdAt: string;
  currentPrice: number | null;
  stockName: string | null;
}

interface AlertsClientProps {
  locale: string;
}

export function AlertsClient({ locale }: AlertsClientProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [newSymbol, setNewSymbol] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCondition, setNewCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');

  const t = (key: string) => {
    const texts: Record<string, Record<string, string>> = {
      title: { en: 'Price Alerts', zh: '价格提醒' },
      subtitle: { en: 'Get notified when stocks reach your target price', zh: '当股票达到目标价格时获得通知' },
      createAlert: { en: 'Create Alert', zh: '创建提醒' },
      symbol: { en: 'Symbol', zh: '代码' },
      targetPrice: { en: 'Target Price', zh: '目标价格' },
      condition: { en: 'Condition', zh: '条件' },
      above: { en: 'Price goes above', zh: '价格高于' },
      below: { en: 'Price goes below', zh: '价格低于' },
      create: { en: 'Create', zh: '创建' },
      cancel: { en: 'Cancel', zh: '取消' },
      noAlerts: { en: 'No price alerts yet', zh: '暂无价格提醒' },
      noAlertsDesc: { en: 'Create alerts to get notified of price movements', zh: '创建提醒以获得价格变动通知' },
      active: { en: 'Active', zh: '活跃' },
      triggered: { en: 'Triggered', zh: '已触发' },
      currentPrice: { en: 'Current', zh: '当前' },
      target: { en: 'Target', zh: '目标' },
    };
    return texts[key]?.[locale] || texts[key]?.en || key;
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts');
      const data = await response.json();
      if (data.alerts) {
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Refresh when page becomes visible (user navigates back to this tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAlerts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAlerts]);

  const handleCreate = async () => {
    if (!newSymbol.trim() || !newPrice) return;

    setIsAdding(true);
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newSymbol.trim(),
          targetPrice: parseFloat(newPrice),
          condition: newCondition,
        }),
      });

      if (response.ok) {
        setNewSymbol('');
        setNewPrice('');
        setNewCondition('ABOVE');
        setShowAddForm(false);
        fetchAlerts();
      }
    } catch (error) {
      console.error('Failed to create alert:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/alerts?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete alert:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

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
            <Bell className="w-6 h-6 text-blue-500" />
            {t('title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('createAlert')}
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
            <div className="glass-card rounded-xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('symbol')}
                  </label>
                  <input
                    type="text"
                    value={newSymbol}
                    onChange={e => setNewSymbol(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('condition')}
                  </label>
                  <select
                    value={newCondition}
                    onChange={e => setNewCondition(e.target.value as 'ABOVE' | 'BELOW')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ABOVE">{t('above')}</option>
                    <option value="BELOW">{t('below')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('targetPrice')}
                  </label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    placeholder="150.00"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={isAdding || !newSymbol.trim() || !newPrice}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isAdding ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {t('create')}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewSymbol('');
                      setNewPrice('');
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alerts list */}
      {alerts.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('noAlerts')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {t('noAlertsDesc')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert, index) => {
            const isTriggered = !!alert.triggeredAt;
            const ConditionIcon = alert.condition === 'ABOVE' ? TrendingUp : TrendingDown;
            const progress = alert.currentPrice
              ? alert.condition === 'ABOVE'
                ? Math.min((alert.currentPrice / alert.targetPrice) * 100, 100)
                : Math.min((alert.targetPrice / alert.currentPrice) * 100, 100)
              : 0;

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`glass-card rounded-xl p-4 ${
                  isTriggered ? 'border-2 border-green-500' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="font-bold text-lg text-gray-900 dark:text-white">
                      {alert.symbol}
                    </span>
                    {alert.stockName && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                        {alert.stockName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isTriggered ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                        <Check className="w-3 h-3" />
                        {t('triggered')}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                        {t('active')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <ConditionIcon className={`w-4 h-4 ${
                    alert.condition === 'ABOVE'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {alert.condition === 'ABOVE' ? t('above') : t('below')}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatPrice(alert.targetPrice)}
                  </span>
                </div>

                {alert.currentPrice && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500 dark:text-gray-400">{t('currentPrice')}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatPrice(alert.currentPrice)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          progress >= 100
                            ? 'bg-green-500'
                            : progress >= 80
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => handleDelete(alert.id)}
                    disabled={deletingId === alert.id}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === alert.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

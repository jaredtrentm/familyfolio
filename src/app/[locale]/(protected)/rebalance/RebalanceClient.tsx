'use client';

import { useState, useEffect, useCallback } from 'react';
import { Scale, Plus, Trash2, TrendingUp, TrendingDown, Loader2, Check, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RebalanceTarget {
  id: string;
  targetType: 'SYMBOL' | 'SECTOR' | 'ASSET_TYPE';
  identifier: string;
  targetPercent: number;
}

interface RebalanceClientProps {
  locale: string;
}

export function RebalanceClient({ locale }: RebalanceClientProps) {
  const [targets, setTargets] = useState<RebalanceTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [newType, setNewType] = useState<'SYMBOL' | 'SECTOR' | 'ASSET_TYPE'>('SYMBOL');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newPercent, setNewPercent] = useState('');

  const t = (key: string) => {
    const texts: Record<string, Record<string, string>> = {
      title: { en: 'Portfolio Rebalancing', zh: '投资组合再平衡' },
      subtitle: { en: 'Set target allocations for your portfolio', zh: '设置您投资组合的目标配置' },
      addTarget: { en: 'Add Target', zh: '添加目标' },
      targetType: { en: 'Target Type', zh: '目标类型' },
      symbol: { en: 'Symbol', zh: '股票代码' },
      sector: { en: 'Sector', zh: '行业' },
      assetType: { en: 'Asset Type', zh: '资产类型' },
      identifier: { en: 'Identifier', zh: '标识' },
      targetPercent: { en: 'Target %', zh: '目标百分比' },
      add: { en: 'Add', zh: '添加' },
      cancel: { en: 'Cancel', zh: '取消' },
      noTargets: { en: 'No rebalancing targets set', zh: '未设置再平衡目标' },
      noTargetsDesc: { en: 'Add targets to track your portfolio allocation', zh: '添加目标以跟踪您的投资组合配置' },
      totalAllocation: { en: 'Total Allocation', zh: '总配置' },
      remaining: { en: 'Remaining', zh: '剩余' },
      symbolTargets: { en: 'Symbol Targets', zh: '股票目标' },
      sectorTargets: { en: 'Sector Targets', zh: '行业目标' },
      assetTypeTargets: { en: 'Asset Type Targets', zh: '资产类型目标' },
    };
    return texts[key]?.[locale] || texts[key]?.en || key;
  };

  const fetchTargets = useCallback(async () => {
    try {
      const response = await fetch('/api/rebalance/targets');
      const data = await response.json();
      if (data.targets) {
        setTargets(data.targets);
      }
    } catch (error) {
      console.error('Failed to fetch targets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const handleAdd = async () => {
    if (!newIdentifier.trim() || !newPercent) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/rebalance/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: newType,
          identifier: newIdentifier.trim(),
          targetPercent: parseFloat(newPercent),
        }),
      });

      if (response.ok) {
        setNewIdentifier('');
        setNewPercent('');
        setShowAddForm(false);
        fetchTargets();
      }
    } catch (error) {
      console.error('Failed to add target:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/rebalance/targets?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTargets(prev => prev.filter(target => target.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete target:', error);
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate totals by type
  const symbolTargets = targets.filter(t => t.targetType === 'SYMBOL');
  const sectorTargets = targets.filter(t => t.targetType === 'SECTOR');
  const assetTypeTargets = targets.filter(t => t.targetType === 'ASSET_TYPE');

  const symbolTotal = symbolTargets.reduce((sum, t) => sum + t.targetPercent, 0);
  const sectorTotal = sectorTargets.reduce((sum, t) => sum + t.targetPercent, 0);
  const assetTypeTotal = assetTypeTargets.reduce((sum, t) => sum + t.targetPercent, 0);

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
            <Scale className="w-6 h-6 text-purple-500" />
            {t('title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('addTarget')}
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
                    {t('targetType')}
                  </label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as typeof newType)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="SYMBOL">{t('symbol')}</option>
                    <option value="SECTOR">{t('sector')}</option>
                    <option value="ASSET_TYPE">{t('assetType')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('identifier')}
                  </label>
                  <input
                    type="text"
                    value={newIdentifier}
                    onChange={e => setNewIdentifier(e.target.value.toUpperCase())}
                    placeholder={newType === 'SYMBOL' ? 'AAPL' : newType === 'SECTOR' ? 'Technology' : 'Stocks'}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('targetPercent')}
                  </label>
                  <input
                    type="number"
                    value={newPercent}
                    onChange={e => setNewPercent(e.target.value)}
                    placeholder="10"
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={isSaving || !newIdentifier.trim() || !newPercent}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {t('add')}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewIdentifier('');
                      setNewPercent('');
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

      {/* Targets */}
      {targets.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Scale className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('noTargets')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {t('noTargetsDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Symbol targets */}
          {symbolTargets.length > 0 && (
            <TargetSection
              title={t('symbolTargets')}
              targets={symbolTargets}
              total={symbolTotal}
              onDelete={handleDelete}
              deletingId={deletingId}
              locale={locale}
              t={t}
            />
          )}

          {/* Sector targets */}
          {sectorTargets.length > 0 && (
            <TargetSection
              title={t('sectorTargets')}
              targets={sectorTargets}
              total={sectorTotal}
              onDelete={handleDelete}
              deletingId={deletingId}
              locale={locale}
              t={t}
            />
          )}

          {/* Asset type targets */}
          {assetTypeTargets.length > 0 && (
            <TargetSection
              title={t('assetTypeTargets')}
              targets={assetTypeTargets}
              total={assetTypeTotal}
              onDelete={handleDelete}
              deletingId={deletingId}
              locale={locale}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TargetSection({
  title,
  targets,
  total,
  onDelete,
  deletingId,
  locale,
  t,
}: {
  title: string;
  targets: RebalanceTarget[];
  total: number;
  onDelete: (id: string) => void;
  deletingId: string | null;
  locale: string;
  t: (key: string) => string;
}) {
  const isOverAllocated = total > 100;
  const remaining = 100 - total;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('totalAllocation')}: <span className={`font-medium ${isOverAllocated ? 'text-red-600' : 'text-green-600'}`}>{total.toFixed(1)}%</span>
          </span>
          {isOverAllocated && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <AlertTriangle className="w-4 h-4" />
              Over 100%
            </span>
          )}
        </div>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {targets.map((target, index) => (
          <motion.div
            key={target.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-4">
              <span className="font-medium text-gray-900 dark:text-white">
                {target.identifier}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(target.targetPercent, 100)}%` }}
                />
              </div>
              <span className="w-16 text-right font-medium text-gray-900 dark:text-white">
                {target.targetPercent.toFixed(1)}%
              </span>
              <button
                onClick={() => onDelete(target.id)}
                disabled={deletingId === target.id}
                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {deletingId === target.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

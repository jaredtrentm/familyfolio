'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Check, Sparkles, CheckSquare, Square, Trash2 } from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  type: string;
  symbol: string;
  description: string | null;
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  currency: string;
  isDuplicateFlag: boolean;
  duplicateOfId: string | null;
  duplicateScore: number | null;
}

interface UnclaimedClientProps {
  transactions: Transaction[];
  locale: string;
  userId: string;
}

export function UnclaimedClient({ transactions, locale, userId }: UnclaimedClientProps) {
  const t = useTranslations('unclaimed');
  const tTx = useTranslations('transactions');
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((tx) => tx.id)));
    }
  };

  const handleClaim = async (transactionIds: string[]) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/transactions/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to claim transactions');
      }

      setSelected(new Set());
      router.refresh();
    } catch (error) {
      console.error('Claim error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiClaim = async () => {
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai/suggest-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: transactions.map((tx) => tx.id) }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI suggestions');
      }

      const { suggestedIds } = await response.json();
      setSelected(new Set(suggestedIds));
    } catch (error) {
      console.error('AI claim error:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDeleteDuplicate = async (e: React.MouseEvent, transactionId: string) => {
    e.stopPropagation(); // Prevent row selection

    if (!confirm(t('deleteDuplicateConfirm'))) {
      return;
    }

    setDeletingId(transactionId);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/delete-duplicate`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to delete duplicate');
        return;
      }

      router.refresh();
    } catch (error) {
      console.error('Delete duplicate error:', error);
      alert('Failed to delete duplicate');
    } finally {
      setDeletingId(null);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'BUY':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'SELL':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'DIVIDEND':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'TRANSFER_IN':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'TRANSFER_OUT':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  if (transactions.length === 0) {
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

        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            {t('noUnclaimed')}
          </p>
        </div>
      </div>
    );
  }

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

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {selected.size === transactions.length ? (
            <CheckSquare className="w-5 h-5" />
          ) : (
            <Square className="w-5 h-5" />
          )}
          {selected.size === transactions.length ? 'Deselect All' : 'Select All'}
        </button>

        <button
          onClick={handleAiClaim}
          disabled={isAiLoading || transactions.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-5 h-5" />
          {isAiLoading ? 'Analyzing...' : t('aiClaim')}
        </button>

        {selected.size > 0 && (
          <button
            onClick={() => handleClaim(Array.from(selected))}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Check className="w-5 h-5" />
            {isLoading ? 'Claiming...' : `${t('claimSelected')} (${selected.size})`}
          </button>
        )}
      </div>

      {/* Transactions list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {tTx('date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {tTx('type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {tTx('symbol')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {tTx('quantity')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {tTx('amount')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <span className="sr-only">{t('likelyDuplicate')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => toggleSelect(tx.id)}
                  className={cn(
                    'cursor-pointer transition-colors',
                    tx.isDuplicateFlag && 'bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500',
                    selected.has(tx.id)
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : !tx.isDuplicateFlag && 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                  )}
                >
                  <td className="px-4 py-4">
                    <div
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                        selected.has(tx.id)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300 dark:border-gray-600'
                      )}
                    >
                      {selected.has(tx.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded',
                        getTypeColor(tx.type)
                      )}
                    >
                      {tTx(`types.${tx.type}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {tx.symbol}
                    </div>
                    {tx.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                        {tx.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                    {tx.quantity.toLocaleString(localeCode)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(tx.amount, tx.currency, localeCode)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {tx.isDuplicateFlag && (
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className="text-lg animate-pulse"
                          title={t('likelyDuplicate')}
                        >
                          🚩🚩
                        </span>
                        <button
                          onClick={(e) => handleDeleteDuplicate(e, tx.id)}
                          disabled={deletingId === tx.id}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                          title={t('deleteDuplicate')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

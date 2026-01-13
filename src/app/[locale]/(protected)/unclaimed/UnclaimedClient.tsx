'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Check, Sparkles, CheckSquare, Square, Trash2, Search, X, MessageSquare } from 'lucide-react';

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
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // AI Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

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
      setHighlighted(new Set());
      setSearchMessage(null);
      router.refresh();
    } catch (error) {
      console.error('Claim error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiSuggest = async () => {
    setIsAiLoading(true);
    setSearchMessage(null);
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
      setHighlighted(new Set());
      if (suggestedIds.length > 0) {
        setSearchMessage(`AI found ${suggestedIds.length} transactions that likely belong to you based on your history.`);
      } else {
        setSearchMessage('AI could not find patterns to suggest. Try claiming some transactions first to establish patterns.');
      }
    } catch (error) {
      console.error('AI suggest error:', error);
      setSearchMessage('Failed to get AI suggestions. Please try again.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchMessage(null);
    try {
      const response = await fetch('/api/ai/search-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          transactionIds: transactions.map((tx) => tx.id),
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const { matchingIds, message } = await response.json();
      setHighlighted(new Set(matchingIds));
      setSelected(new Set(matchingIds));
      setSearchMessage(message);
    } catch (error) {
      console.error('AI search error:', error);
      setSearchMessage('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchMessage(null);
    setHighlighted(new Set());
  };

  const handleDeleteDuplicate = async (e: React.MouseEvent, transactionId: string) => {
    e.stopPropagation();

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
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'SELL':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'DIVIDEND':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
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

      {/* AI Search */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
        <form onSubmit={handleAiSearch} className="flex gap-2">
          <div className="relative flex-1">
            <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Ask AI: "Show me Apple purchases from last summer" or "Find all dividend transactions"'
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isSearching}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 transition-colors disabled:opacity-50"
          >
            {isSearching ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            Search
          </button>
        </form>

        {/* AI Response Message */}
        {searchMessage && (
          <div className="mt-3 flex items-start gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-700 dark:text-gray-300">{searchMessage}</p>
          </div>
        )}
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
          onClick={handleAiSuggest}
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
                    highlighted.has(tx.id) && !selected.has(tx.id) && 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500',
                    selected.has(tx.id)
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : !tx.isDuplicateFlag && !highlighted.has(tx.id) && 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
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

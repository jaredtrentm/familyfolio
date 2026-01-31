'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Wallet, Check, X, Edit2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

interface Account {
  id: string;
  name: string;
  cashBalance: number;
  isShared: boolean;
}

interface AccountsManagerProps {
  locale: string;
  onTotalCashChange?: (total: number) => void;
}

export function AccountsManager({ locale, onTotalCashChange }: AccountsManagerProps) {
  const t = useTranslations('accounts');
  const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountCash, setNewAccountCash] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCash, setEditingCash] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    const totalCash = accounts.reduce((sum, acc) => sum + acc.cashBalance, 0);
    onTotalCashChange?.(totalCash);
  }, [accounts, onTotalCashChange]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) return;

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAccountName.trim(),
          cashBalance: Number(newAccountCash) || 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAccounts([...accounts, data.account]);
        setNewAccountName('');
        setNewAccountCash('');
        setShowAddForm(false);
      }
    } catch (error) {
      console.error('Failed to add account:', error);
    }
  };

  const handleUpdateCash = async (id: string) => {
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashBalance: Number(editingCash) || 0 }),
      });

      if (response.ok) {
        setAccounts(accounts.map(acc =>
          acc.id === id ? { ...acc, cashBalance: Number(editingCash) || 0 } : acc
        ));
        setEditingId(null);
        setEditingCash('');
      }
    } catch (error) {
      console.error('Failed to update account:', error);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;

    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAccounts(accounts.filter(acc => acc.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const totalCash = accounts.reduce((sum, acc) => sum + acc.cashBalance, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('title')}
          </h3>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Add Account Form */}
      {showAddForm && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder={t('accountNamePlaceholder')}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={newAccountCash}
              onChange={(e) => setNewAccountCash(e.target.value)}
              placeholder={t('cashBalancePlaceholder')}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleAddAccount}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewAccountName(''); setNewAccountCash(''); }}
              className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Accounts List */}
      {isLoading ? (
        <div className="text-center py-4 text-gray-500">{t('loading')}</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
          {t('noAccounts')}
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {account.name}
              </span>
              <div className="flex items-center gap-2">
                {editingId === account.id ? (
                  <>
                    <input
                      type="number"
                      value={editingCash}
                      onChange={(e) => setEditingCash(e.target.value)}
                      className="w-28 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdateCash(account.id)}
                      className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditingCash(''); }}
                      className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(account.cashBalance, 'USD', localeCode)}
                    </span>
                    <button
                      onClick={() => { setEditingId(account.id); setEditingCash(String(account.cashBalance)); }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(account.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Total Cash */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('totalCash')}
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {formatCurrency(totalCash, 'USD', localeCode)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

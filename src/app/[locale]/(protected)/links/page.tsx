'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Plus,
  ExternalLink,
  Trash2,
  Pencil,
  X,
  Check,
  Link2,
  Building2,
  Search,
  Newspaper,
  MoreHorizontal,
} from 'lucide-react';

interface Link {
  id: string;
  name: string;
  url: string;
  accountId: string | null;
  category: string;
}

interface Account {
  id: string;
  name: string;
}

export default function LinksPage() {
  const t = useTranslations('links');
  const router = useRouter();

  const [links, setLinks] = useState<Link[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    accountId: '',
    category: 'other',
  });

  const categories = [
    { id: 'account', label: t('categoryAccount'), icon: Building2 },
    { id: 'research', label: t('categoryResearch'), icon: Search },
    { id: 'news', label: t('categoryNews'), icon: Newspaper },
    { id: 'other', label: t('categoryOther'), icon: MoreHorizontal },
  ];

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const response = await fetch('/api/links');
      if (response.ok) {
        const data = await response.json();
        setLinks(data.links);
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Failed to fetch links:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowAddForm(false);
        setFormData({ name: '', url: '', accountId: '', category: 'other' });
        fetchLinks();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add link');
      }
    } catch (error) {
      console.error('Add link error:', error);
      alert('Failed to add link');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/links/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchLinks();
      } else {
        alert('Failed to delete link');
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const groupedLinks = links.reduce(
    (acc, link) => {
      const key = link.accountId || 'general';
      if (!acc[key]) acc[key] = [];
      acc[key].push(link);
      return acc;
    },
    {} as Record<string, Link[]>
  );

  const getCategoryIcon = (category: string) => {
    const cat = categories.find((c) => c.id === category);
    return cat?.icon || MoreHorizontal;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('addLink')}
        </button>
      </div>

      {/* Add Link Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('addLink')}
              </h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('name')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Schwab Login"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('url')}
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://www.schwab.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('account')} ({t('optional')})
                </label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">{t('noAccount')}</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('category')}
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Links Display */}
      {links.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <Link2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">{t('noLinks')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* General Links (not associated with account) */}
          {groupedLinks['general'] && groupedLinks['general'].length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('generalLinks')}
                </h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {groupedLinks['general'].map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    onDelete={handleDelete}
                    deletingId={deletingId}
                    getCategoryIcon={getCategoryIcon}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Account-specific Links */}
          {accounts.map((account) => {
            const accountLinks = groupedLinks[account.id];
            if (!accountLinks || accountLinks.length === 0) return null;

            return (
              <div
                key={account.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {account.name}
                    </h3>
                  </div>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {accountLinks.map((link) => (
                    <LinkRow
                      key={link.id}
                      link={link}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                      getCategoryIcon={getCategoryIcon}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LinkRow({
  link,
  onDelete,
  deletingId,
  getCategoryIcon,
  t,
}: {
  link: Link;
  onDelete: (id: string) => void;
  deletingId: string | null;
  getCategoryIcon: (category: string) => React.ComponentType<{ className?: string }>;
  t: ReturnType<typeof useTranslations>;
}) {
  const Icon = getCategoryIcon(link.category);

  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 dark:text-white truncate">
            {link.name}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {link.url}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <ExternalLink className="w-5 h-5" />
        </a>
        <button
          onClick={() => onDelete(link.id)}
          disabled={deletingId === link.id}
          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

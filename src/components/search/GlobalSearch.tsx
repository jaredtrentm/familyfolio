'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowRight, Receipt, TrendingUp, Star, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  id: string;
  type: 'transaction' | 'holding' | 'closed' | 'watchlist';
  title: string;
  subtitle: string;
  url: string;
  meta?: {
    amount?: number;
    gainLoss?: number;
    date?: string;
  };
}

interface GlobalSearchProps {
  locale: string;
}

export function GlobalSearch({ locale }: GlobalSearchProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = (key: string) => {
    const texts: Record<string, Record<string, string>> = {
      placeholder: { en: 'Search transactions, holdings...', zh: '搜索交易、持仓...' },
      noResults: { en: 'No results found', zh: '未找到结果' },
      transactions: { en: 'Transactions', zh: '交易' },
      holdings: { en: 'Holdings', zh: '持仓' },
      closedPositions: { en: 'Closed Positions', zh: '已平仓' },
      watchlist: { en: 'Watchlist', zh: '自选股' },
      typeToSearch: { en: 'Type to search...', zh: '输入以搜索...' },
      pressEsc: { en: 'Press ESC to close', zh: '按 ESC 关闭' },
    };
    return texts[key]?.[locale] || texts[key]?.en || key;
  };

  // Keyboard shortcut to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      // / to open (when not in an input)
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName)) {
        e.preventDefault();
        setIsOpen(true);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search function
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.results) {
        setResults(data.results);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, search]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    router.push(result.url);
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'transaction':
        return Receipt;
      case 'holding':
        return TrendingUp;
      case 'watchlist':
        return Star;
      default:
        return Search;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'transaction':
        return t('transactions');
      case 'holding':
        return t('holdings');
      case 'closed':
        return t('closedPositions');
      case 'watchlist':
        return t('watchlist');
      default:
        return '';
    }
  };

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">{t('placeholder')}</span>
        <kbd className="hidden sm:inline ml-2 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">
          {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}K
        </kbd>
      </button>

      {/* Search modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 sm:pt-32 px-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <Search className="w-5 h-5 text-gray-400" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('placeholder')}
                  className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-500"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto">
                {query ? (
                  results.length > 0 ? (
                    <div className="py-2">
                      {Object.entries(groupedResults).map(([type, items]) => (
                        <div key={type}>
                          <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            {getTypeLabel(type)}
                          </div>
                          {items.map((result, index) => {
                            const globalIndex = results.findIndex(r => r.id === result.id);
                            const Icon = getTypeIcon(result.type);
                            const isSelected = globalIndex === selectedIndex;

                            return (
                              <button
                                key={result.id}
                                onClick={() => handleSelect(result)}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50 dark:bg-blue-900/30'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <Icon className={`w-4 h-4 ${
                                  isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${
                                    isSelected
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : 'text-gray-900 dark:text-white'
                                  }`}>
                                    {result.title}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {result.subtitle}
                                  </p>
                                </div>
                                {result.meta?.amount && (
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    ${result.meta.amount.toFixed(2)}
                                  </span>
                                )}
                                <ArrowRight className={`w-4 h-4 ${
                                  isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'
                                }`} />
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : !isLoading ? (
                    <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      {t('noResults')}
                    </div>
                  ) : null
                ) : (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {t('typeToSearch')}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd>
                    select
                  </span>
                </div>
                <span>{t('pressEsc')}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

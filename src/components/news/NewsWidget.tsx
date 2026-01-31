'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Newspaper, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  image: string | null;
  symbol: string | null;
  publishedAt: string;
  category: string;
}

interface NewsWidgetProps {
  symbol?: string;
  title?: string;
  maxItems?: number;
}

export function NewsWidget({ symbol, title, maxItems = 5 }: NewsWidgetProps) {
  const t = useTranslations('news');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = symbol
        ? `/api/news?symbol=${encodeURIComponent(symbol)}`
        : '/api/news';

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setNews(data.news.slice(0, maxItems));
      }
    } catch (err) {
      setError('Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    // Refresh news every 10 minutes
    const interval = setInterval(fetchNews, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [symbol]);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {title || (symbol ? `${symbol} ${t('news')}` : t('marketNews'))}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchNews();
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title={t('refresh')}
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4">
          {loading && news.length === 0 ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              <p>{error}</p>
              <button
                onClick={fetchNews}
                className="mt-2 text-sm text-blue-500 hover:text-blue-600"
              >
                {t('tryAgain')}
              </button>
            </div>
          ) : news.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              {t('noNews')}
            </div>
          ) : (
            <div className="space-y-4">
              {news.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="flex gap-3">
                    {item.image && (
                      <img
                        src={item.image}
                        alt=""
                        className="w-16 h-16 rounded object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2 transition-colors">
                        {item.headline}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{item.source}</span>
                        <span>·</span>
                        <span>{formatTimeAgo(item.publishedAt)}</span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact version for sidebar or smaller spaces
export function NewsWidgetCompact({ symbol }: { symbol?: string }) {
  const t = useTranslations('news');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const url = symbol
          ? `/api/news?symbol=${encodeURIComponent(symbol)}`
          : '/api/news';
        const response = await fetch(url);
        const data = await response.json();
        setNews(data.news?.slice(0, 3) || []);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [symbol]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('noNews')}</p>
    );
  }

  return (
    <div className="space-y-2">
      {news.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1"
        >
          {item.headline}
        </a>
      ))}
    </div>
  );
}

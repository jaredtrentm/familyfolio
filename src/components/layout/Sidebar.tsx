'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Inbox,
  Upload,
  MessageSquare,
  Download,
  Settings,
  LogOut,
  TrendingUp,
  Link2,
  Star,
  Bell,
  Scale,
} from 'lucide-react';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { ThemeToggleCompact } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';

interface SidebarProps {
  locale: string;
}

export function Sidebar({ locale }: SidebarProps) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: `/${locale}/dashboard`, label: t('dashboard'), icon: LayoutDashboard },
    { href: `/${locale}/gains`, label: t('gains'), icon: TrendingUp },
    { href: `/${locale}/transactions`, label: t('transactions'), icon: Receipt },
    { href: `/${locale}/unclaimed`, label: t('unclaimed'), icon: Inbox },
    { href: `/${locale}/watchlist`, label: t('watchlist') || 'Watchlist', icon: Star },
    { href: `/${locale}/alerts`, label: t('alerts') || 'Alerts', icon: Bell },
    { href: `/${locale}/rebalance`, label: t('rebalance') || 'Rebalance', icon: Scale },
    { href: `/${locale}/import`, label: t('import'), icon: Upload },
    { href: `/${locale}/links`, label: t('links'), icon: Link2 },
    { href: `/${locale}/chat`, label: t('chat'), icon: MessageSquare },
    { href: `/${locale}/export`, label: t('export'), icon: Download },
  ];

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push(`/${locale}/login`);
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {tCommon('appName')}
        </h1>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <GlobalSearch locale={locale} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Theme
          </span>
          <ThemeToggleCompact />
        </div>
        <Link
          href={`/${locale}/settings`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Settings className="w-5 h-5" />
          {t('settings')}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {tAuth('logout')}
        </button>
      </div>
    </div>
  );
}

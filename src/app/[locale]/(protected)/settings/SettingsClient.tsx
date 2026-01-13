'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Globe, Key, Lock, Trash2 } from 'lucide-react';

interface SettingsClientProps {
  locale: string;
  user: {
    id: string;
    name: string;
    email: string;
    locale: string;
  };
}

export function SettingsClient({ locale, user }: SettingsClientProps) {
  const t = useTranslations('settings');
  const router = useRouter();
  const [selectedLocale, setSelectedLocale] = useState(locale);
  const [isChangingLocale, setIsChangingLocale] = useState(false);

  const handleLocaleChange = async (newLocale: string) => {
    setIsChangingLocale(true);
    try {
      const response = await fetch('/api/auth/update-locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      });

      if (response.ok) {
        setSelectedLocale(newLocale);
        router.push(`/${newLocale}/settings`);
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to update locale:', error);
    } finally {
      setIsChangingLocale(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
      </div>

      <div className="space-y-4">
        {/* Language Setting */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('language')}
            </h2>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleLocaleChange('en')}
              disabled={isChangingLocale}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedLocale === 'en'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              English
            </button>
            <button
              onClick={() => handleLocaleChange('zh')}
              disabled={isChangingLocale}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedLocale === 'zh'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              中文
            </button>
          </div>
        </div>

        {/* Change PIN */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('changePin')}
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Set a 4-digit PIN for quick login access.
          </p>
          <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {t('changePin')}
          </button>
        </div>

        {/* Change Password */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('changePassword')}
            </h2>
          </div>
          <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {t('changePassword')}
          </button>
        </div>

        {/* Account Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Account
          </h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500">Name:</span> {user.name}</p>
            <p><span className="text-gray-500">Email:</span> {user.email}</p>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
              {t('deleteAccount')}
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Permanently delete your account and all associated data.
          </p>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            {t('deleteAccount')}
          </button>
        </div>
      </div>
    </div>
  );
}

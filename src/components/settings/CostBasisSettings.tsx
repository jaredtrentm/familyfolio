'use client';

import { useState, useEffect } from 'react';
import { Calculator, Check, Loader2 } from 'lucide-react';
import { formatCostBasisMethod, getCostBasisMethodDescription, type CostBasisMethod } from '@/lib/cost-basis';

interface CostBasisSettingsProps {
  locale: string;
}

export function CostBasisSettings({ locale }: CostBasisSettingsProps) {
  const [method, setMethod] = useState<CostBasisMethod>('FIFO');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch('/api/user/preferences');
        const data = await response.json();
        if (data.preferences?.costBasisMethod) {
          setMethod(data.preferences.costBasisMethod as CostBasisMethod);
        }
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPreferences();
  }, []);

  const handleChange = async (newMethod: CostBasisMethod) => {
    setMethod(newMethod);
    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costBasisMethod: newMethod }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error('Failed to save preference:', error);
    } finally {
      setSaving(false);
    }
  };

  const methods: CostBasisMethod[] = ['FIFO', 'LIFO', 'HIFO', 'SPECID'];

  const labels: Record<string, Record<CostBasisMethod, string>> = {
    en: {
      FIFO: 'First In, First Out (FIFO)',
      LIFO: 'Last In, First Out (LIFO)',
      HIFO: 'Highest Cost First (HIFO)',
      SPECID: 'Specific Identification',
    },
    zh: {
      FIFO: '先进先出 (FIFO)',
      LIFO: '后进先出 (LIFO)',
      HIFO: '高成本优先 (HIFO)',
      SPECID: '具体识别',
    },
  };

  const descriptions: Record<string, Record<CostBasisMethod, string>> = {
    en: {
      FIFO: 'Sells oldest shares first. Default IRS method.',
      LIFO: 'Sells newest shares first. May result in higher short-term gains.',
      HIFO: 'Sells highest-cost shares first to minimize taxable gains.',
      SPECID: 'Choose specific lots to sell for maximum tax control.',
    },
    zh: {
      FIFO: '先卖出最早购买的股份。IRS默认方法。',
      LIFO: '先卖出最新购买的股份。可能导致更高的短期收益。',
      HIFO: '先卖出成本最高的股份以减少应税收益。',
      SPECID: '选择特定批次出售以获得最大税务控制。',
    },
  };

  const t = (key: string) => {
    const texts: Record<string, Record<string, string>> = {
      title: { en: 'Cost Basis Method', zh: '成本基础计算方法' },
      description: { en: 'Choose how to calculate cost basis when selling shares', zh: '选择卖出股票时如何计算成本基础' },
    };
    return texts[key]?.[locale] || texts[key]?.en || key;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-2">
        <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('title')}
        </h3>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
        {saved && <Check className="w-4 h-4 text-green-500" />}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {t('description')}
      </p>

      <div className="space-y-3">
        {methods.map((m) => (
          <button
            key={m}
            onClick={() => handleChange(m)}
            className={`w-full p-4 rounded-lg border text-left transition-colors ${
              method === m
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`font-medium ${
                method === m
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {labels[locale]?.[m] || labels.en[m]}
              </span>
              {method === m && (
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {descriptions[locale]?.[m] || descriptions.en[m]}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

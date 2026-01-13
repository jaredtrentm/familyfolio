'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, FileSpreadsheet, Archive, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ExportPage() {
  const t = useTranslations('export');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExport = async (format: 'pdf' | 'excel' | 'zip') => {
    setIsExporting(format);

    try {
      const response = await fetch(`/api/export?format=${format}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const extensions = { pdf: 'pdf', excel: 'xlsx', zip: 'zip' };
      a.download = `portfolio-export.${extensions[format]}`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(null);
    }
  };

  const exportOptions = [
    {
      id: 'pdf',
      icon: FileText,
      label: t('exportPdf'),
      description: 'Download a PDF report of your portfolio',
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      id: 'excel',
      icon: FileSpreadsheet,
      label: t('exportExcel'),
      description: 'Export transactions to Excel spreadsheet',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      id: 'zip',
      icon: Archive,
      label: t('exportZip'),
      description: 'Download all data in a ZIP archive',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t('title')}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          const isLoading = isExporting === option.id;

          return (
            <button
              key={option.id}
              onClick={() => handleExport(option.id as 'pdf' | 'excel' | 'zip')}
              disabled={isExporting !== null}
              className={cn(
                'flex flex-col items-center p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all disabled:opacity-50',
                isLoading && 'ring-2 ring-blue-500'
              )}
            >
              <div className={cn('p-4 rounded-full mb-4', option.bgColor)}>
                {isLoading ? (
                  <Loader2 className={cn('w-8 h-8 animate-spin', option.color)} />
                ) : (
                  <Icon className={cn('w-8 h-8', option.color)} />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {option.label}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {option.description}
              </p>
              <div className="mt-4 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
                <Download className="w-4 h-4" />
                <span>Download</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  FileText,
  FileSpreadsheet,
  Archive,
  Download,
  Loader2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ExportPage() {
  const t = useTranslations('export');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

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

  const handleAnnualReport = async (year: number) => {
    setIsExporting(`annual-${year}`);

    try {
      const response = await fetch(`/api/export/annual-report?year=${year}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `annual-report-${year}.html`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Annual report error:', error);
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
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t('title')}
      </h1>

      {/* Annual Reports Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          {t('annualReports')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('annualReportsDescription')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Previous Year Report */}
          <button
            onClick={() => handleAnnualReport(previousYear)}
            disabled={isExporting !== null}
            className={cn(
              'flex items-start p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 hover:border-purple-300 dark:hover:border-purple-700 transition-all disabled:opacity-50 text-left',
              isExporting === `annual-${previousYear}` && 'ring-2 ring-purple-500'
            )}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  {isExporting === `annual-${previousYear}` ? (
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t('withAiSummary')}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {previousYear} {t('annualReport')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('annualReportDesc')}
              </p>
              <div className="mt-4 flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium">
                <Download className="w-4 h-4" />
                <span>{t('download')}</span>
              </div>
            </div>
          </button>

          {/* Current Year Report */}
          <button
            onClick={() => handleAnnualReport(currentYear)}
            disabled={isExporting !== null}
            className={cn(
              'flex items-start p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all disabled:opacity-50 text-left',
              isExporting === `annual-${currentYear}` && 'ring-2 ring-blue-500'
            )}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  {isExporting === `annual-${currentYear}` ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t('withAiSummary')}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {currentYear} {t('annualReport')} ({t('yearToDate')})
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('annualReportDescYtd')}
              </p>
              <div className="mt-4 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
                <Download className="w-4 h-4" />
                <span>{t('download')}</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Standard Exports */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('standardExports')}
        </h2>
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
                  <span>{t('download')}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

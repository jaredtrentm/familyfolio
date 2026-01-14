'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  FileText,
  FileSpreadsheet,
  Archive,
  Download,
  Loader2,
  Calendar,
  Sparkles,
  Receipt,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ExportFormat = 'html' | 'excel' | 'pdf';

interface YearOption {
  year: number;
  label: string;
  isYtd?: boolean;
}

export default function ExportPage() {
  const t = useTranslations('export');
  const locale = useLocale();
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('html');
  const [showYearPicker, setShowYearPicker] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  // Generate year options (last 5 years + current)
  const yearOptions: YearOption[] = [
    { year: currentYear, label: `${currentYear} (${t('yearToDate')})`, isYtd: true },
    ...Array.from({ length: 5 }, (_, i) => ({
      year: currentYear - 1 - i,
      label: `${currentYear - 1 - i}`,
    })),
  ];

  const formatOptions: { id: ExportFormat; label: string; icon: typeof FileText }[] = [
    { id: 'html', label: t('formatHtml') || 'Website (HTML)', icon: FileText },
    { id: 'excel', label: t('formatExcel') || 'Excel', icon: FileSpreadsheet },
    { id: 'pdf', label: t('formatPdf') || 'PDF', icon: FileText },
  ];

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

      const extensions = { pdf: 'html', excel: 'xlsx', zip: 'zip' };
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

  const handleAnnualReport = async (year: number, format: ExportFormat) => {
    setIsExporting(`annual-${year}`);
    setShowYearPicker(null);

    try {
      const response = await fetch(`/api/export/annual-report?year=${year}&format=${format}&locale=${locale}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const extensions = { html: 'html', excel: 'xlsx', pdf: 'html' };
      a.download = `annual-report-${year}.${extensions[format]}`;

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

  const handleGainsReport = async (year: number, format: ExportFormat) => {
    setIsExporting(`gains-${year}`);
    setShowYearPicker(null);

    try {
      const response = await fetch(`/api/export/gains-report?year=${year}&format=${format}&locale=${locale}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const extensions = { html: 'html', excel: 'xlsx', pdf: 'html' };
      a.download = `gains-report-${year}.${extensions[format]}`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Gains report error:', error);
    } finally {
      setIsExporting(null);
    }
  };

  const exportOptions = [
    {
      id: 'pdf',
      icon: FileText,
      label: t('exportPdf'),
      description: t('exportPdfDesc') || 'Download a report of your portfolio',
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      id: 'excel',
      icon: FileSpreadsheet,
      label: t('exportExcel'),
      description: t('exportExcelDesc') || 'Export transactions to Excel spreadsheet',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      id: 'zip',
      icon: Archive,
      label: t('exportZip'),
      description: t('exportZipDesc') || 'Download all data in a ZIP archive',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t('title')}
      </h1>

      {/* Gains/Loss Tax Report Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          {t('gainsReport') || 'Capital Gains/Loss Report'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('gainsReportDescription') || 'Detailed report of realized gains and losses for tax preparation, with acquisition dates and holding periods.'}
        </p>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t('withAiSummary')}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                {t('gainsReportTitle') || 'Tax Gains/Loss Report'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('gainsReportDesc') || 'Long-term vs short-term gains breakdown with lot-level acquisition dates'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Year Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowYearPicker(showYearPicker === 'gains' ? null : 'gains')}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg min-w-[140px] hover:border-gray-300 dark:hover:border-gray-600"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedYear || currentYear - 1}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {showYearPicker === 'gains' && (
                  <div className="absolute top-full mt-1 left-0 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                    {yearOptions.map((opt) => (
                      <button
                        key={opt.year}
                        onClick={() => {
                          setSelectedYear(opt.year);
                          setShowYearPicker(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Format Selector */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {formatOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedFormat(opt.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      selectedFormat === opt.id
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    )}
                  >
                    {opt.id.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Download Button */}
              <button
                onClick={() => handleGainsReport(selectedYear || currentYear - 1, selectedFormat)}
                disabled={isExporting !== null}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isExporting?.startsWith('gains-') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {t('download')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Annual Reports Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          {t('annualReports')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('annualReportsDescription')}
        </p>

        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t('withAiSummary')}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                {t('annualReport')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('annualReportDesc')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Year Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowYearPicker(showYearPicker === 'annual' ? null : 'annual')}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg min-w-[140px] hover:border-gray-300 dark:hover:border-gray-600"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedYear || currentYear - 1}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {showYearPicker === 'annual' && (
                  <div className="absolute top-full mt-1 left-0 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                    {yearOptions.map((opt) => (
                      <button
                        key={opt.year}
                        onClick={() => {
                          setSelectedYear(opt.year);
                          setShowYearPicker(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Format Selector */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {formatOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedFormat(opt.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      selectedFormat === opt.id
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    )}
                  >
                    {opt.id.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Download Button */}
              <button
                onClick={() => handleAnnualReport(selectedYear || currentYear - 1, selectedFormat)}
                disabled={isExporting !== null}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isExporting?.startsWith('annual-') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {t('download')}
              </button>
            </div>
          </div>
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

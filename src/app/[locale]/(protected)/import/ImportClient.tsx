'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Image, Check, X, Loader2 } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';

interface DataUpload {
  id: string;
  filename: string;
  fileType: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface ImportClientProps {
  uploadHistory: DataUpload[];
  locale: string;
}

export function ImportClient({ uploadHistory, locale }: ImportClientProps) {
  const t = useTranslations('import');
  const router = useRouter();

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFiles(files);
    }
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/import', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }
      }

      router.refresh();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Loader2 className="w-4 h-4 text-gray-400" />;
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === 'csv') {
      return <FileText className="w-5 h-5 text-green-500" />;
    }
    return <Image className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* Upload area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
          isUploading && 'opacity-50 pointer-events-none'
        )}
      >
        <input
          type="file"
          onChange={handleFileInput}
          multiple
          accept=".csv,.png,.jpg,.jpeg,.pdf"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center">
          {isUploading ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          ) : (
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
          )}
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {isUploading ? t('processing') : t('dragDrop')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {t('supportedFormats')}
          </p>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {uploadError}
        </div>
      )}

      {/* Upload history */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('uploadHistory')}
          </h2>
        </div>

        {uploadHistory.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {t('noUploads')}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {uploadHistory.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <div className="flex-shrink-0">
                  {getFileIcon(upload.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {upload.filename}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(upload.createdAt)}
                  </p>
                  {upload.errorMessage && (
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                      {upload.errorMessage}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {getStatusIcon(upload.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

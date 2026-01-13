'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Image, Check, X, Loader2, Trash2, ChevronDown } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';

interface Account {
  id: string;
  name: string;
}

interface DataUpload {
  id: string;
  filename: string;
  fileType: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  accountId: string | null;
  accountName: string | null;
}

interface ImportClientProps {
  uploadHistory: DataUpload[];
  accounts: Account[];
  locale: string;
}

export function ImportClient({ uploadHistory: initialHistory, accounts, locale }: ImportClientProps) {
  const t = useTranslations('import');
  const router = useRouter();

  const [uploadHistory, setUploadHistory] = useState(initialHistory);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Import options modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [claimImmediately, setClaimImmediately] = useState(false);

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
      showImportOptions(files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      showImportOptions(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const showImportOptions = (file: File) => {
    setPendingFile(file);
    setSelectedAccountId('');
    setClaimImmediately(false);
    setShowImportModal(true);
  };

  const handleImport = async () => {
    if (!pendingFile) return;

    setShowImportModal(false);
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      if (selectedAccountId) {
        formData.append('accountId', selectedAccountId);
      }
      formData.append('claimImmediately', String(claimImmediately));

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      router.refresh();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setPendingFile(null);
    }
  };

  const handleDeleteUpload = async (uploadId: string) => {
    if (!confirm('Delete this upload and all its transactions?')) return;

    try {
      const response = await fetch(`/api/uploads/${uploadId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setUploadHistory(uploadHistory.filter(u => u.id !== uploadId));
      }
    } catch (error) {
      console.error('Failed to delete upload:', error);
    }
  };

  const handleUpdateAccount = async (uploadId: string, accountId: string) => {
    try {
      const response = await fetch(`/api/uploads/${uploadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: accountId || null }),
      });

      if (response.ok) {
        const account = accounts.find(a => a.id === accountId);
        setUploadHistory(uploadHistory.map(u =>
          u.id === uploadId
            ? { ...u, accountId: accountId || null, accountName: account?.name || null }
            : u
        ));
      }
    } catch (error) {
      console.error('Failed to update upload account:', error);
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
          accept=".csv,.png,.jpg,.jpeg,.gif,.webp"
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
            CSV, PNG, JPG, GIF, WebP
          </p>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {uploadError}
        </div>
      )}

      {/* Import Options Modal */}
      {showImportModal && pendingFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Import Options
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Importing: {pendingFile.name}
            </p>

            <div className="space-y-4">
              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Source Account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">-- Select Account --</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {accounts.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Add accounts in Dashboard first
                  </p>
                )}
              </div>

              {/* Claim Immediately */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="claimImmediately"
                  checked={claimImmediately}
                  onChange={(e) => setClaimImmediately(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="claimImmediately" className="text-sm text-gray-700 dark:text-gray-300">
                  Add to My Transactions immediately
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2 ml-7">
                {claimImmediately
                  ? 'Transactions will be added directly to your portfolio'
                  : 'Transactions will go to Unclaimed for review'}
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowImportModal(false); setPendingFile(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Import
              </button>
            </div>
          </div>
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

                {/* Account Selector */}
                {upload.status === 'completed' && (
                  <div className="flex-shrink-0">
                    <select
                      value={upload.accountId || ''}
                      onChange={(e) => handleUpdateAccount(upload.id, e.target.value)}
                      className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      <option value="">No Account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex-shrink-0 flex items-center gap-2">
                  {getStatusIcon(upload.status)}
                  <button
                    onClick={() => handleDeleteUpload(upload.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="Delete upload"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

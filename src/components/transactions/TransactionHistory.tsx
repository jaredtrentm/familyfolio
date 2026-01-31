'use client';

import { useState, useEffect } from 'react';
import { X, History, RotateCcw, Loader2, User } from 'lucide-react';
import { formatHistoryDate, describeHistoryEntry, canRevertTo, type HistoryEntry } from '@/lib/transaction-history';

interface TransactionHistoryProps {
  transactionId: string;
  isOpen: boolean;
  onClose: () => void;
  onRevert?: () => void;
}

export function TransactionHistory({ transactionId, isOpen, onClose, onRevert }: TransactionHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, transactionId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/history`);
      const data = await response.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (historyId: string) => {
    setReverting(historyId);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId }),
      });

      if (response.ok) {
        await fetchHistory();
        onRevert?.();
      }
    } catch (error) {
      console.error('Failed to revert:', error);
    } finally {
      setReverting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[70vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5" />
            Transaction History
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No history available
            </p>
          ) : (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`relative pl-6 pb-4 ${
                    index < history.length - 1 ? 'border-l-2 border-gray-200 dark:border-gray-700' : ''
                  }`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-500" />

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {describeHistoryEntry(entry)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {entry.user && (
                          <>
                            <User className="w-3 h-3" />
                            <span>{entry.user.name}</span>
                            <span>-</span>
                          </>
                        )}
                        <span>{formatHistoryDate(entry.createdAt)}</span>
                      </div>
                    </div>

                    {canRevertTo(entry) && (
                      <button
                        onClick={() => handleRevert(entry.id)}
                        disabled={reverting === entry.id}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-50"
                      >
                        {reverting === entry.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Revert
                      </button>
                    )}
                  </div>

                  {/* Show changes for UPDATE */}
                  {entry.changeType === 'UPDATE' && entry.previousData && entry.newData && (
                    <div className="mt-2 text-xs bg-gray-50 dark:bg-gray-900 rounded p-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-500">Before:</span>
                          <pre className="mt-1 text-gray-600 dark:text-gray-400 overflow-x-auto">
                            {formatChangeData(entry.previousData as Record<string, unknown>)}
                          </pre>
                        </div>
                        <div>
                          <span className="text-gray-500">After:</span>
                          <pre className="mt-1 text-gray-600 dark:text-gray-400 overflow-x-auto">
                            {formatChangeData(entry.newData as Record<string, unknown>)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function formatChangeData(data: Record<string, unknown>): string {
  const relevant: string[] = [];
  const fields = ['type', 'symbol', 'quantity', 'price', 'amount', 'notes'];

  for (const field of fields) {
    if (data[field] !== undefined && data[field] !== null) {
      let value = data[field];
      if (typeof value === 'number') {
        value = value.toFixed(field === 'quantity' ? 4 : 2);
      }
      relevant.push(`${field}: ${value}`);
    }
  }

  return relevant.join('\n');
}

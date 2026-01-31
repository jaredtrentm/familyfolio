'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Users, UserPlus, Check, X, Trash2, Loader2, Mail } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface ShareRequest {
  id: string;
  status: string;
  createdAt: string;
  requester?: User;
  target?: User;
}

interface Connection {
  id: string;
  connectedUser: User;
  createdAt: string;
}

interface ShareData {
  sentRequests: ShareRequest[];
  receivedRequests: ShareRequest[];
  activeConnections: Connection[];
}

export function ShareManager() {
  const t = useTranslations('share');
  const [data, setData] = useState<ShareData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/share-requests');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch share data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSending(true);
    setMessage(null);

    try {
      const response = await fetch('/api/share-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: result.message || 'Request sent!' });
        setEmail('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to send request' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send request' });
    } finally {
      setIsSending(false);
    }
  };

  const handleRespond = async (id: string, status: 'approved' | 'denied') => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/share-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to respond to request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/share-requests/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to remove:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('title')}
        </h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {t('description')}
      </p>

      {/* Send Request Form */}
      <form onSubmit={handleSendRequest} className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('inviteByEmail')}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('enterEmail')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={isSending || !email.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {t('send')}
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
      </form>

      {/* Pending Requests (Received) */}
      {data?.receivedRequests && data.receivedRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('pendingRequests')}
          </h3>
          <div className="space-y-2">
            {data.receivedRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {request.requester?.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {request.requester?.email}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond(request.id, 'approved')}
                    disabled={processingId === request.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {processingId === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {t('approve')}
                  </button>
                  <button
                    onClick={() => handleRespond(request.id, 'denied')}
                    disabled={processingId === request.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    {t('deny')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Connections */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('connectedUsers')}
        </h3>
        {data?.activeConnections && data.activeConnections.length > 0 ? (
          <div className="space-y-2">
            {data.activeConnections.map((connection) => (
              <div
                key={connection.id}
                className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {connection.connectedUser.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {connection.connectedUser.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(connection.id)}
                  disabled={processingId === connection.id}
                  className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm rounded-lg disabled:opacity-50 transition-colors"
                >
                  {processingId === connection.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {t('remove')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            {t('noConnections')}
          </p>
        )}
      </div>

      {/* Sent Requests (Pending) */}
      {data?.sentRequests && data.sentRequests.filter(r => r.status === 'pending').length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('sentRequests')}
          </h3>
          <div className="space-y-2">
            {data.sentRequests
              .filter((r) => r.status === 'pending')
              .map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {request.target?.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {request.target?.email} - {t('awaitingResponse')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(request.id)}
                    disabled={processingId === request.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {processingId === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    {t('cancel')}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

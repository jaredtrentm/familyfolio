'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, RefreshCw, Trash2, Building2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface PlaidAccount {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  isActive: boolean;
}

interface PlaidConnection {
  id: string;
  institutionName: string;
  institutionId: string | null;
  status: string;
  lastSyncedAt: string | null;
  consentExpiresAt: string | null;
  accounts: PlaidAccount[];
  createdAt: string;
}

export function PlaidLink() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [connections, setConnections] = useState<PlaidConnection[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing connections
  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/plaid/sync');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Get link token
  const getLinkToken = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.linkToken) {
        setLinkToken(data.linkToken);
      } else {
        setError('Failed to initialize connection');
      }
    } catch (err) {
      setError('Failed to initialize connection');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle successful link
  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata.institution?.institution_id,
            institutionName: metadata.institution?.name,
          }),
        });
        const data = await res.json();
        if (data.success) {
          await fetchConnections();
          setLinkToken(null);
        } else {
          setError(data.error || 'Failed to connect institution');
        }
      } catch (err) {
        setError('Failed to connect institution');
      } finally {
        setIsLoading(false);
      }
    },
    [fetchConnections]
  );

  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess,
    onExit: () => {
      setLinkToken(null);
    },
  };

  const { open, ready } = usePlaidLink(config);

  // Auto-open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  // Sync transactions for a connection
  const handleSync = async (connectionId: string) => {
    setIsSyncing(connectionId);
    try {
      const res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchConnections();
        alert(`Imported ${data.imported} new transactions`);
      } else {
        setError(data.error || 'Failed to sync');
      }
    } catch (err) {
      setError('Failed to sync transactions');
    } finally {
      setIsSyncing(null);
    }
  };

  // Delete a connection
  const handleDelete = async (connectionId: string) => {
    try {
      const res = await fetch(`/api/plaid/sync?connectionId=${connectionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchConnections();
      } else {
        setError('Failed to disconnect');
      }
    } catch (err) {
      setError('Failed to disconnect');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Connected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending_expiration':
        return <Badge variant="secondary">Needs Reauth</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Connected Institutions
        </CardTitle>
        <CardDescription>
          Securely connect your brokerage accounts to automatically import transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Existing connections */}
        {connections.length > 0 && (
          <div className="space-y-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{conn.institutionName}</span>
                    {getStatusBadge(conn.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {conn.accounts.length} account{conn.accounts.length !== 1 ? 's' : ''} connected
                  </div>
                  {conn.lastSyncedAt && (
                    <div className="text-xs text-muted-foreground">
                      Last synced: {new Date(conn.lastSyncedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(conn.id)}
                    disabled={isSyncing === conn.id}
                  >
                    {isSyncing === conn.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-1">Sync</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Institution?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the connection to {conn.institutionName}. Your imported
                          transactions will not be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(conn.id)}>
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connect new institution button */}
        <Button
          onClick={getLinkToken}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Link2 className="h-4 w-4 mr-2" />
          )}
          Connect New Institution
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Powered by Plaid. Your credentials are never shared with FamilyFolio.
        </p>
      </CardContent>
    </Card>
  );
}

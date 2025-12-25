'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui';
import { HardDrive, Check, X, Loader2, FolderOpen, RefreshCw, Plus, Clock, AlertCircle } from 'lucide-react';
import { DriveFolderSelector } from './drive-folder-selector';
import { clientLog } from '@/lib/client-logger';
import type { DriveConnectionStatus, WatchedFolderInfo } from '@/lib/google/drive-types';

export function DriveConnect() {
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingFolderId, setSyncingFolderId] = useState<string | null>(null);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/google/drive/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      clientLog.error('Failed to fetch Drive status', { error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Check for success/error in URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'drive_connected') {
      setSuccessMessage('Google Drive connected successfully!');
      setError(null);
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh status to get updated data
      fetchStatus();
    } else if (params.get('error')?.startsWith('drive_')) {
      setError('Failed to connect Google Drive. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchStatus]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/google/drive/auth');
      if (!response.ok) {
        throw new Error('Failed to initiate authorization');
      }

      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (err) {
      setError('Failed to connect to Google Drive');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Drive? All watched folders will be removed.')) {
      return;
    }

    setIsDisconnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/google/drive/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setStatus({
        ...status!,
        connected: false,
        provider: null,
        watchedFolders: [],
        pendingImportsCount: 0,
      });
      setSuccessMessage('Google Drive disconnected');
    } catch (err) {
      setError('Failed to disconnect Drive');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async (folderId?: string) => {
    if (folderId) {
      setSyncingFolderId(folderId);
    } else {
      setIsSyncing(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/google/drive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: folderId ? JSON.stringify({ folderId }) : undefined,
      });

      if (!response.ok) {
        throw new Error('Failed to sync');
      }

      const result = await response.json();
      setSuccessMessage(
        `Sync complete: ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed`
      );

      // Refresh status
      await fetchStatus();
    } catch (err) {
      setError('Failed to sync folders');
    } finally {
      setIsSyncing(false);
      setSyncingFolderId(null);
    }
  };

  const handleFolderAdded = async () => {
    setShowFolderSelector(false);
    setSuccessMessage('Folder added to watch list');
    await fetchStatus();
  };

  const handleRemoveFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Remove "${folderName}" from watched folders?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/google/drive/folders/${folderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove folder');
      }

      setSuccessMessage('Folder removed');
      await fetchStatus();
    } catch (err) {
      setError('Failed to remove folder');
    }
  };

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100">
            <HardDrive className="h-5 w-5 text-surface-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">
              Google Drive
            </h2>
            <p className="text-sm text-surface-500">
              Integration not configured
            </p>
          </div>
        </div>
        <p className="text-sm text-surface-500">
          Google Drive integration is not configured for this deployment.
          Contact your administrator to enable it.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          status.connected ? 'bg-primary-50' : 'bg-surface-100'
        }`}>
          <HardDrive className={`h-5 w-5 ${
            status.connected ? 'text-primary-600' : 'text-surface-600'
          }`} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-surface-900">
            Google Drive
          </h2>
          <p className="text-sm text-surface-500">
            {status.connected
              ? 'Auto-import meeting transcripts from Google Meet'
              : 'Connect to automatically import meeting transcripts'
            }
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-lg bg-success-50 p-3 text-sm text-success-700 flex items-center gap-2">
          <Check className="h-4 w-4 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {status.connected ? (
        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50/50 p-4">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-surface-900">Connected</p>
                <p className="text-sm text-surface-500">
                  {status.connectedAt && `Since ${new Date(status.connectedAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSync()}
                isLoading={isSyncing}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Sync Now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                isLoading={isDisconnecting}
                className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
              >
                <X className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            </div>
          </div>

          {/* Watched Folders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-surface-700">Watched Folders</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFolderSelector(true)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add Folder
              </Button>
            </div>

            {status.watchedFolders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-surface-200 p-4 text-center">
                <FolderOpen className="h-8 w-8 mx-auto text-surface-400 mb-2" />
                <p className="text-sm text-surface-500">
                  No folders being watched yet.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFolderSelector(true)}
                  className="mt-2"
                >
                  Add Meet Recordings Folder
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {status.watchedFolders.map((folder) => (
                  <WatchedFolderCard
                    key={folder.id}
                    folder={folder}
                    onRemove={() => handleRemoveFolder(folder.id, folder.folderName)}
                    onSync={() => handleSync(folder.id)}
                    isSyncing={syncingFolderId === folder.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pending Imports */}
          {status.pendingImportsCount > 0 && (
            <div className="rounded-lg bg-warning-50 p-3 text-sm text-warning-700">
              {status.pendingImportsCount} file(s) pending import
            </div>
          )}

          {/* Localhost hint */}
          {status.watchedFolders.length > 0 && !status.watchedFolders.some(f => f.webhookActive) && (
            <p className="text-xs text-surface-400 mt-2">
              Tip: On localhost, click &quot;Sync Now&quot; to fetch new files. Real-time sync requires a public URL.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Button
            onClick={handleConnect}
            isLoading={isConnecting}
            leftIcon={<HardDrive className="h-4 w-4" />}
          >
            Connect Google Drive
          </Button>

          <p className="text-xs text-surface-400">
            We only request read-only access to your Drive files.
            We will never modify your files.
          </p>
        </div>
      )}

      {/* Folder Selector Modal */}
      {showFolderSelector && (
        <DriveFolderSelector
          onSelect={handleFolderAdded}
          onCancel={() => setShowFolderSelector(false)}
        />
      )}
    </div>
  );
}

function WatchedFolderCard({
  folder,
  onRemove,
  onSync,
  isSyncing,
}: {
  folder: WatchedFolderInfo;
  onRemove: () => void;
  onSync: () => void;
  isSyncing: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-surface-200 bg-surface-50 p-3">
      <div className="flex items-center gap-3">
        <FolderOpen className="h-5 w-5 text-surface-400" />
        <div>
          <p className="font-medium text-surface-900">{folder.folderName}</p>
          <div className="flex items-center gap-2 text-xs text-surface-500">
            {folder.webhookActive ? (
              <span className="flex items-center gap-1 text-success-600">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                Real-time sync
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Hourly sync
              </span>
            )}
            {folder.lastSyncAt && (
              <>
                <span className="text-surface-300">|</span>
                <span>Last sync: {new Date(folder.lastSyncAt).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          className="text-surface-500 hover:text-primary-600"
          title="Sync this folder now"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-surface-400 hover:text-danger-600"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

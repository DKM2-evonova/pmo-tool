'use client';

import { useState, useEffect } from 'react';
import { Button, Input } from '@/components/ui';
import { Folder, Search, Loader2, Check, X, ExternalLink } from 'lucide-react';
import type { DriveFile } from '@/lib/google/drive-types';

interface DriveFolderSelectorProps {
  onSelect: () => void;
  onCancel: () => void;
}

interface FolderOption {
  id: string;
  name: string;
  webViewLink?: string;
}

export function DriveFolderSelector({ onSelect, onCancel }: DriveFolderSelectorProps) {
  const [meetRecordingsFolder, setMeetRecordingsFolder] = useState<FolderOption | null>(null);
  const [isLoadingMeetFolder, setIsLoadingMeetFolder] = useState(true);
  const [meetFolderAlreadyWatched, setMeetFolderAlreadyWatched] = useState(false);

  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [selectedFolder, setSelectedFolder] = useState<FolderOption | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect Meet Recordings folder
  useEffect(() => {
    async function detectMeetRecordings() {
      try {
        const response = await fetch('/api/google/drive/folders/meet-recordings');
        if (response.ok) {
          const data = await response.json();
          if (data.found) {
            setMeetRecordingsFolder(data.folder);
            setMeetFolderAlreadyWatched(data.alreadyWatched);
          }
        }
      } catch (err) {
        console.error('Failed to detect Meet Recordings folder:', err);
      } finally {
        setIsLoadingMeetFolder(false);
      }
    }
    detectMeetRecordings();
  }, []);

  // Search for folders
  useEffect(() => {
    if (!showSearch) return;

    async function searchFolders() {
      setIsLoadingFolders(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) {
          params.set('search', searchQuery);
        }

        const response = await fetch(`/api/google/drive/folders?${params}`);
        if (response.ok) {
          const data = await response.json();
          setFolders(data.files || []);
        }
      } catch (err) {
        console.error('Failed to search folders:', err);
      } finally {
        setIsLoadingFolders(false);
      }
    }

    const debounce = setTimeout(searchFolders, 300);
    return () => clearTimeout(debounce);
  }, [showSearch, searchQuery]);

  const handleAddFolder = async (folder: FolderOption) => {
    setIsAdding(true);
    setError(null);

    try {
      const response = await fetch('/api/google/drive/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: folder.id,
          folderName: folder.name,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add folder');
      }

      onSelect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add folder');
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add Watched Folder</h2>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Meet Recordings Folder Suggestion */}
          {isLoadingMeetFolder ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
            </div>
          ) : meetRecordingsFolder && !meetFolderAlreadyWatched ? (
            <div className="rounded-lg border-2 border-primary-200 bg-primary-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-0.5 rounded">
                  Recommended
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Folder className="h-5 w-5 text-primary-600" />
                  <div>
                    <p className="font-medium text-surface-900">{meetRecordingsFolder.name}</p>
                    <p className="text-xs text-surface-500">
                      Google Meet automatically saves recordings here
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAddFolder(meetRecordingsFolder)}
                  isLoading={isAdding && selectedFolder?.id === meetRecordingsFolder.id}
                  disabled={isAdding}
                >
                  Add
                </Button>
              </div>
            </div>
          ) : meetFolderAlreadyWatched ? (
            <div className="rounded-lg border border-surface-200 bg-surface-50 p-4">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-success-600" />
                <p className="text-sm text-surface-600">
                  Meet Recordings folder is already being watched
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-surface-200 bg-surface-50 p-4">
              <p className="text-sm text-surface-600">
                No "Meet Recordings" folder found. This folder is created automatically when you
                record a Google Meet meeting.
              </p>
            </div>
          )}

          {/* Search Other Folders */}
          <div className="border-t pt-4">
            {!showSearch ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setShowSearch(true)}
                leftIcon={<Search className="h-4 w-4" />}
              >
                Browse Other Folders
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                  <Input
                    type="text"
                    placeholder="Search folders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>

                <div className="max-h-60 overflow-y-auto rounded-lg border border-surface-200">
                  {isLoadingFolders ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
                    </div>
                  ) : folders.length === 0 ? (
                    <div className="py-8 text-center text-sm text-surface-500">
                      {searchQuery ? 'No folders found' : 'Type to search folders'}
                    </div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {folders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => {
                            setSelectedFolder(folder);
                            handleAddFolder(folder);
                          }}
                          disabled={isAdding}
                          className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-surface-50 disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3">
                            <Folder className="h-4 w-4 text-surface-400" />
                            <span className="text-sm text-surface-900">{folder.name}</span>
                          </div>
                          {isAdding && selectedFolder?.id === folder.id && (
                            <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

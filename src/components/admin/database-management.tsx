'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Modal, ModalFooter } from '@/components/ui/modal';

interface DeletionCounts {
  audit_logs: number;
  llm_metrics: number;
  evidence: number;
  action_items: number;
  decisions: number;
  risks: number;
  meetings: number;
}

export function DatabaseManagement() {
  const [isFirstModalOpen, setIsFirstModalOpen] = useState(false);
  const [isSecondModalOpen, setIsSecondModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    deleted?: DeletionCounts;
    error?: string;
  } | null>(null);

  const handleFirstConfirm = () => {
    setIsFirstModalOpen(false);
    setIsSecondModalOpen(true);
  };

  const handleClearDatabase = async () => {
    setIsClearing(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/clear-database', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear database');
      }

      setResult({ success: true, deleted: data.deleted });
    } catch (error) {
      setResult({
        success: false,
        error: (error as Error).message,
      });
    } finally {
      setIsClearing(false);
      setIsSecondModalOpen(false);
    }
  };

  const handleCloseResult = () => {
    setResult(null);
    if (result?.success) {
      window.location.reload();
    }
  };

  return (
    <>
      {/* Clear Database Button */}
      <button
        onClick={() => setIsFirstModalOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-danger-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger-700 disabled:opacity-50"
        disabled={isClearing}
      >
        <Trash2 className="h-4 w-4" />
        Clear All Data
      </button>

      {/* First Confirmation Modal */}
      <Modal
        isOpen={isFirstModalOpen}
        onClose={() => setIsFirstModalOpen(false)}
        title="Clear Database?"
        description="This action will remove all meetings and associated data."
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-warning-50 p-4">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning-600" />
            <div className="text-sm text-warning-800">
              <p className="font-medium">Warning: This will delete:</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>All meetings and transcripts</li>
                <li>All action items</li>
                <li>All decisions</li>
                <li>All risks</li>
                <li>All evidence records</li>
                <li>All LLM processing metrics</li>
                <li>All audit logs</li>
              </ul>
            </div>
          </div>

          <p className="text-sm text-surface-600">
            Projects and user accounts will be preserved.
          </p>
        </div>

        <ModalFooter>
          <button
            onClick={() => setIsFirstModalOpen(false)}
            className="rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50"
          >
            Cancel
          </button>
          <button
            onClick={handleFirstConfirm}
            className="rounded-lg bg-danger-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger-700"
          >
            Continue
          </button>
        </ModalFooter>
      </Modal>

      {/* Second Confirmation Modal (Final Warning) */}
      <Modal
        isOpen={isSecondModalOpen}
        onClose={() => setIsSecondModalOpen(false)}
        title="Final Confirmation Required"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-danger-50 p-4">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-danger-600" />
            <div className="text-sm text-danger-800">
              <p className="font-semibold">
                This action cannot be undone!
              </p>
              <p className="mt-1">
                All meeting data will be permanently deleted from the database.
                This is a destructive operation intended for testing purposes only.
              </p>
            </div>
          </div>

          <p className="text-center text-sm font-medium text-surface-900">
            Are you absolutely sure you want to proceed?
          </p>
        </div>

        <ModalFooter>
          <button
            onClick={() => setIsSecondModalOpen(false)}
            disabled={isClearing}
            className="rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleClearDatabase}
            disabled={isClearing}
            className="flex items-center gap-2 rounded-lg bg-danger-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger-700 disabled:opacity-50"
          >
            {isClearing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Yes, Clear Everything
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>

      {/* Result Modal */}
      <Modal
        isOpen={result !== null}
        onClose={handleCloseResult}
        title={result?.success ? 'Database Cleared' : 'Error'}
        size="md"
      >
        {result?.success ? (
          <div className="space-y-4">
            <p className="text-sm text-surface-600">
              The database has been cleared successfully. The following records were deleted:
            </p>
            <div className="rounded-lg bg-surface-50 p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-surface-500">Meetings:</dt>
                <dd className="font-medium text-surface-900">{result.deleted?.meetings || 0}</dd>
                <dt className="text-surface-500">Action Items:</dt>
                <dd className="font-medium text-surface-900">{result.deleted?.action_items || 0}</dd>
                <dt className="text-surface-500">Decisions:</dt>
                <dd className="font-medium text-surface-900">{result.deleted?.decisions || 0}</dd>
                <dt className="text-surface-500">Risks:</dt>
                <dd className="font-medium text-surface-900">{result.deleted?.risks || 0}</dd>
                <dt className="text-surface-500">Evidence:</dt>
                <dd className="font-medium text-surface-900">{result.deleted?.evidence || 0}</dd>
                <dt className="text-surface-500">LLM Metrics:</dt>
                <dd className="font-medium text-surface-900">{result.deleted?.llm_metrics || 0}</dd>
                <dt className="text-surface-500">Audit Logs:</dt>
                <dd className="font-medium text-surface-900">{result.deleted?.audit_logs || 0}</dd>
              </dl>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg bg-danger-50 p-4">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-danger-600" />
            <p className="text-sm text-danger-800">{result?.error}</p>
          </div>
        )}

        <ModalFooter>
          <button
            onClick={handleCloseResult}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            {result?.success ? 'Reload Page' : 'Close'}
          </button>
        </ModalFooter>
      </Modal>
    </>
  );
}

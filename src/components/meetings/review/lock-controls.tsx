'use client';

import { Button } from '@/components/ui';
import { Tooltip } from '@/components/ui/tooltip';
import { Lock, Unlock, HelpCircle } from 'lucide-react';
import type { Profile } from '@/types/database';

interface LockBannerProps {
  lockHolder: Profile;
  isAdmin: boolean;
  onForceUnlock: () => void;
}

export function LockBanner({
  lockHolder,
  isAdmin,
  onForceUnlock,
}: LockBannerProps) {
  return (
    <div className="card border-warning-200 bg-warning-50">
      <div className="flex items-center gap-3">
        <Lock className="h-5 w-5 text-warning-600" />
        <div className="flex-1">
          <p className="font-medium text-warning-700">
            Locked by {lockHolder.full_name || lockHolder.email}
          </p>
          <p className="text-sm text-warning-600">
            Currently reviewing. Please wait or contact them.
          </p>
        </div>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={onForceUnlock}>
            <Unlock className="h-4 w-4" />
            Force Unlock
          </Button>
        )}
      </div>
    </div>
  );
}

interface LockControlsProps {
  hasLock: boolean;
  isPublishing: boolean;
  canPublish: boolean;
  onAcquireLock: () => void;
  onReleaseLock: () => void;
  onPublish: () => void;
}

export function LockControls({
  hasLock,
  isPublishing,
  canPublish,
  onAcquireLock,
  onReleaseLock,
  onPublish,
}: LockControlsProps) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {hasLock ? (
            <>
              <Lock className="h-5 w-5 text-success-500" />
              <span className="text-sm text-surface-600">
                You are reviewing this meeting
              </span>
            </>
          ) : (
            <>
              <Unlock className="h-5 w-5 text-surface-400" />
              <span className="text-sm text-surface-600">
                Click to start reviewing
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {hasLock ? (
            <>
              <Tooltip
                content="Stop reviewing without saving changes. This allows others to review instead."
                position="bottom"
              >
                <Button variant="secondary" onClick={onReleaseLock}>
                  <Unlock className="h-4 w-4" />
                  Release Lock
                </Button>
              </Tooltip>
              <Tooltip
                content="Save all accepted items to the project and complete the review."
                position="bottom"
              >
                <Button
                  onClick={onPublish}
                  isLoading={isPublishing}
                  disabled={!canPublish}
                >
                  Publish Changes
                </Button>
              </Tooltip>
            </>
          ) : (
            <Button onClick={onAcquireLock}>Start Review</Button>
          )}
        </div>
      </div>

      {/* Helper text explaining actions */}
      {hasLock && (
        <div className="flex items-start gap-2 rounded-lg bg-surface-50 p-3 text-xs text-surface-600">
          <HelpCircle className="h-4 w-4 flex-shrink-0 text-surface-400 mt-0.5" />
          <div className="space-y-1">
            <p>
              <span className="font-medium text-surface-700">Release Lock:</span>{' '}
              Exit the review without publishing. Your edits won&apos;t be saved, but another team member can take over.
            </p>
            <p>
              <span className="font-medium text-surface-700">Publish Changes:</span>{' '}
              Finalize the review and add all accepted action items, decisions, and risks to the project.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

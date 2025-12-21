'use client';

import { Button } from '@/components/ui';
import { Lock, Unlock } from 'lucide-react';
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
    <div className="card flex items-center justify-between">
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
            <Button variant="secondary" onClick={onReleaseLock}>
              Release Lock
            </Button>
            <Button
              onClick={onPublish}
              isLoading={isPublishing}
              disabled={!canPublish}
            >
              Publish Changes
            </Button>
          </>
        ) : (
          <Button onClick={onAcquireLock}>Start Review</Button>
        )}
      </div>
    </div>
  );
}

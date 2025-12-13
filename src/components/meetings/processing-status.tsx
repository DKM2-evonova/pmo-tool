'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

interface ProcessingStatusProps {
  meetingId: string;
  projectId: string;
  initialStatus: string;
}

type ProcessingStep =
  | 'loading_context'
  | 'processing'
  | 'validating'
  | 'checking_duplicates'
  | 'complete'
  | 'failed';

export function ProcessingStatus({
  meetingId,
  projectId,
  initialStatus,
}: ProcessingStatusProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ProcessingStep>(
    initialStatus === 'Failed' ? 'failed' : 'loading_context'
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const steps = [
    { id: 'loading_context', label: 'Loading project context...' },
    { id: 'processing', label: 'Processing transcript with AI...' },
    { id: 'validating', label: 'Validating output...' },
    { id: 'checking_duplicates', label: 'Checking for duplicates...' },
    { id: 'complete', label: 'Processing complete!' },
  ];

  useEffect(() => {
    if (initialStatus === 'Failed') {
      return;
    }

    const processTranscript = async () => {
      try {
        // Update meeting status to Processing
        setCurrentStep('loading_context');
        setProgress(10);

        // Call the processing API
        setCurrentStep('processing');
        setProgress(30);

        const response = await fetch(`/api/meetings/${meetingId}/process`, {
          method: 'POST',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Processing failed');
        }

        setCurrentStep('validating');
        setProgress(70);

        // Small delay to show validation step
        await new Promise((r) => setTimeout(r, 500));

        setCurrentStep('checking_duplicates');
        setProgress(90);

        await new Promise((r) => setTimeout(r, 500));

        setCurrentStep('complete');
        setProgress(100);

        // Redirect to review page after a moment
        setTimeout(() => {
          router.push(`/meetings/${meetingId}`);
        }, 1500);
      } catch (err) {
        console.error('Processing error:', err);
        setCurrentStep('failed');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    processTranscript();
  }, [meetingId, initialStatus, router]);

  const handleRetry = () => {
    setError(null);
    setCurrentStep('loading_context');
    setProgress(0);
    // Re-trigger processing
    router.refresh();
  };

  return (
    <div className="card">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="h-2 overflow-hidden rounded-full bg-surface-100">
          <div
            className="h-full bg-primary-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const stepIndex = steps.findIndex((s) => s.id === currentStep);
          const isComplete =
            index < stepIndex ||
            (currentStep === 'complete' && index === steps.length - 1);
          const isCurrent = step.id === currentStep;
          const isPending = index > stepIndex;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 ${
                isPending ? 'opacity-40' : ''
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center">
                {isComplete ? (
                  <CheckCircle className="h-6 w-6 text-success-500" />
                ) : isCurrent ? (
                  currentStep === 'failed' ? (
                    <XCircle className="h-6 w-6 text-danger-500" />
                  ) : (
                    <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                  )
                ) : (
                  <div className="h-3 w-3 rounded-full bg-surface-300" />
                )}
              </div>
              <span
                className={`text-sm ${
                  isCurrent
                    ? 'font-medium text-surface-900'
                    : 'text-surface-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error state */}
      {currentStep === 'failed' && (
        <div className="mt-6 rounded-lg bg-danger-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-danger-500" />
            <div className="flex-1">
              <p className="font-medium text-danger-700">Processing Failed</p>
              <p className="mt-1 text-sm text-danger-600">{error}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="danger" onClick={handleRetry}>
              Retry Processing
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/meetings')}
            >
              Back to Meetings
            </Button>
          </div>
        </div>
      )}

      {/* Success state */}
      {currentStep === 'complete' && (
        <div className="mt-6 rounded-lg bg-success-50 p-4 text-center">
          <CheckCircle className="mx-auto h-8 w-8 text-success-500" />
          <p className="mt-2 font-medium text-success-700">
            Processing Complete!
          </p>
          <p className="text-sm text-success-600">
            Redirecting to review...
          </p>
        </div>
      )}
    </div>
  );
}


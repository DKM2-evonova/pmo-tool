'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';

interface ProcessingStatusProps {
  meetingId: string;
  projectId: string;
  initialStatus: string;
  estimatedProcessingMs?: number; // Estimated processing time based on historical data
}

type ProcessingStep =
  | 'loading_context'
  | 'processing'
  | 'validating'
  | 'checking_duplicates'
  | 'complete'
  | 'failed';

// Sub-stages shown during AI processing to keep users engaged
const AI_PROCESSING_SUBSTAGES = [
  { message: 'Scanning document structure...', icon: '📄' },
  { message: 'Parsing conversation flow...', icon: '💬' },
  { message: 'Identifying key participants...', icon: '👥' },
  { message: 'Extracting discussion topics...', icon: '🎯' },
  { message: 'Detecting action items...', icon: '✅' },
  { message: 'Analyzing decision points...', icon: '🔍' },
  { message: 'Identifying potential risks...', icon: '⚠️' },
  { message: 'Understanding context and nuances...', icon: '🧠' },
  { message: 'Cross-referencing project history...', icon: '📊' },
  { message: 'Resolving owner assignments...', icon: '👤' },
  { message: 'Generating meeting summary...', icon: '📝' },
  { message: 'Polishing insights...', icon: '✨' },
  { message: 'Almost there, finalizing analysis...', icon: '🚀' },
];

export function ProcessingStatus({
  meetingId,
  projectId,
  initialStatus,
  estimatedProcessingMs = 30000,
}: ProcessingStatusProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ProcessingStep>(
    initialStatus === 'Failed' ? 'failed' : 'loading_context'
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [aiSubstageIndex, setAiSubstageIndex] = useState(0);
  const substageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const steps = [
    { id: 'loading_context', label: 'Loading project context...' },
    { id: 'processing', label: 'Processing transcript with AI...' },
    { id: 'validating', label: 'Validating output...' },
    { id: 'checking_duplicates', label: 'Checking for duplicates...' },
    { id: 'complete', label: 'Processing complete!' },
  ];

  // Calculate substage interval based on estimated processing time
  // We want to show enough substages to fill the expected time, but not too fast
  const calculateSubstageInterval = () => {
    const numSubstages = AI_PROCESSING_SUBSTAGES.length;
    // Use 80% of estimated time to cycle through substages (leave buffer for variance)
    const targetDuration = estimatedProcessingMs * 0.8;
    // Calculate interval, but keep it between 1.5s (fast) and 6s (slow)
    const calculatedInterval = targetDuration / numSubstages;
    return Math.max(1500, Math.min(6000, calculatedInterval));
  };

  const substageInterval = calculateSubstageInterval();
  
  // Determine if we should show substages at all (skip if very fast processing expected)
  const showSubstages = estimatedProcessingMs > 8000;

  // Handle AI substage cycling during processing
  useEffect(() => {
    if (currentStep === 'processing' && showSubstages) {
      // Start cycling through substages
      substageIntervalRef.current = setInterval(() => {
        setAiSubstageIndex((prev) => {
          // Cycle through substages, but slow down towards the end
          const nextIndex = prev + 1;
          if (nextIndex >= AI_PROCESSING_SUBSTAGES.length) {
            // Stay on the last substage
            return AI_PROCESSING_SUBSTAGES.length - 1;
          }
          return nextIndex;
        });
        // Also increment progress slightly during processing
        setProgress((prev) => Math.min(prev + 2, 65));
      }, substageInterval);
    } else {
      // Clear interval when not processing
      if (substageIntervalRef.current) {
        clearInterval(substageIntervalRef.current);
        substageIntervalRef.current = null;
      }
    }

    return () => {
      if (substageIntervalRef.current) {
        clearInterval(substageIntervalRef.current);
      }
    };
  }, [currentStep, substageInterval, showSubstages]);

  useEffect(() => {
    if (initialStatus === 'Failed') {
      return;
    }

    const processTranscript = async () => {
      try {
        // Update meeting status to Processing
        setCurrentStep('loading_context');
        setProgress(10);

        // Call the processing API with timeout
        setCurrentStep('processing');
        setProgress(30);

        // Create abort controller for timeout (5 minutes max for LLM processing)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

        let response: Response;
        try {
          response = await fetch(`/api/meetings/${meetingId}/process`, {
            method: 'POST',
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

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
        redirectTimeoutRef.current = setTimeout(() => {
          router.push(`/meetings/${meetingId}`);
        }, 1500);
      } catch (err) {
        console.error('Processing error:', err);
        setCurrentStep('failed');

        // Provide user-friendly error messages
        let errorMessage = 'Unknown error';
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            errorMessage = 'Processing timed out. The AI is taking longer than expected. Please try again.';
          } else {
            errorMessage = err.message;
          }
        }
        setError(errorMessage);
      }
    };

    processTranscript();

    // Cleanup: cancel redirect timeout if component unmounts
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [meetingId, initialStatus, router]);

  const handleRetry = () => {
    setError(null);
    setCurrentStep('loading_context');
    setProgress(0);
    setAiSubstageIndex(0);
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
          const isProcessingStep = step.id === 'processing';

          return (
            <div key={step.id}>
              <div
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
              
              {/* AI Processing substages - only shown if processing takes more than 8 seconds */}
              {isProcessingStep && isCurrent && currentStep !== 'failed' && showSubstages && (
                <div className="ml-11 mt-3 overflow-hidden rounded-lg border border-primary-100 bg-gradient-to-r from-primary-50 to-purple-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl animate-pulse" role="img" aria-label="status">
                      {AI_PROCESSING_SUBSTAGES[aiSubstageIndex].icon}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-primary-700 transition-all duration-300">
                        {AI_PROCESSING_SUBSTAGES[aiSubstageIndex].message}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-purple-400" />
                        <p className="text-xs text-surface-500">
                          AI is carefully analyzing your meeting transcript
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Substage progress dots */}
                  <div className="mt-3 flex items-center gap-1">
                    {AI_PROCESSING_SUBSTAGES.slice(0, 8).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                          i <= aiSubstageIndex
                            ? 'bg-primary-400'
                            : 'bg-surface-200'
                        }`}
                      />
                    ))}
                    {aiSubstageIndex >= 8 && (
                      <div className="ml-1 text-xs text-primary-400">
                        +{Math.min(aiSubstageIndex - 7, 5)}
                      </div>
                    )}
                  </div>
                </div>
              )}
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


'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Select, Input } from '@/components/ui';
import { TranscriptUpload } from './transcript-upload';
import { AttendeeInput } from './attendee-input';
import { CategorySelector } from './category-selector';
import {
  Upload,
  Chrome,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import type { MeetingCategory } from '@/types/enums';
import type { MeetingAttendee } from '@/types/database';

interface MeetingIngestionProps {
  projects: Array<{ id: string; name: string }>;
  preselectedProjectId?: string;
}

type Step = 'project' | 'source' | 'category' | 'review';

export function MeetingIngestion({
  projects,
  preselectedProjectId,
}: MeetingIngestionProps) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('project');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [projectId, setProjectId] = useState(preselectedProjectId || '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [transcriptText, setTranscriptText] = useState('');
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [category, setCategory] = useState<MeetingCategory | ''>('');

  const canProceed = () => {
    switch (step) {
      case 'project':
        return projectId && title;
      case 'source':
        return transcriptText.trim().length > 0;
      case 'category':
        return category !== '';
      default:
        return true;
    }
  };

  const handleNext = () => {
    const steps: Step[] = ['project', 'source', 'category', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: Step[] = ['project', 'source', 'category', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Create meeting record
      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          project_id: projectId,
          title,
          date,
          transcript_text: transcriptText,
          attendees,
          category,
          status: 'Draft',
        })
        .select()
        .single();

      if (error) throw error;

      // Navigate to the meeting processing page
      router.push(`/meetings/${meeting.id}/process`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['project', 'source', 'category', 'review'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === s
                    ? 'bg-primary-600 text-white'
                    : ['project', 'source', 'category', 'review'].indexOf(
                          step
                        ) > i
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-surface-100 text-surface-400'
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && (
                <div
                  className={`mx-2 h-0.5 w-12 sm:w-20 md:w-28 ${
                    ['project', 'source', 'category', 'review'].indexOf(step) >
                    i
                      ? 'bg-primary-200'
                      : 'bg-surface-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-surface-500">
          <span>Project</span>
          <span>Transcript</span>
          <span>Category</span>
          <span>Review</span>
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-[300px]">
        {step === 'project' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-surface-900">
              Select Project & Meeting Details
            </h2>
            <Select
              label="Project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select a project"
            />
            <Input
              label="Meeting Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Status Update"
            />
            <Input
              label="Meeting Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        )}

        {step === 'source' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-surface-900">
              Add Transcript & Attendees
            </h2>

            <TranscriptUpload
              value={transcriptText}
              onChange={setTranscriptText}
            />

            <div className="border-t border-surface-200 pt-6">
              <AttendeeInput
                attendees={attendees}
                onChange={setAttendees}
              />
            </div>
          </div>
        )}

        {step === 'category' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-surface-900">
              Select Meeting Category
            </h2>
            <p className="text-surface-500">
              Choose the category that best describes this meeting. This
              determines what outputs will be generated.
            </p>

            <CategorySelector
              value={category}
              onChange={(c) => setCategory(c)}
            />
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-surface-900">
              Review & Process
            </h2>

            <div className="space-y-4 rounded-lg border border-surface-200 p-4">
              <div className="flex justify-between">
                <span className="text-surface-500">Project</span>
                <span className="font-medium text-surface-900">
                  {projects.find((p) => p.id === projectId)?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Meeting Title</span>
                <span className="font-medium text-surface-900">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Date</span>
                <span className="font-medium text-surface-900">{date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Category</span>
                <span className="font-medium text-surface-900">{category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Transcript Length</span>
                <span className="font-medium text-surface-900">
                  {transcriptText.length.toLocaleString()} characters
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Attendees</span>
                <span className="font-medium text-surface-900">
                  {attendees.length} people
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-primary-50 p-4">
              <p className="text-sm text-primary-700">
                <strong>What happens next:</strong> The transcript will be
                processed using AI to extract action items, decisions, risks,
                and a meeting recap. You&apos;ll be able to review and edit all
                extracted items before publishing.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex justify-between border-t border-surface-200 pt-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={step === 'project'}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        {step === 'review' ? (
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Start Processing
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Continue
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}


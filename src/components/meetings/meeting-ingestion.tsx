'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Select, Input } from '@/components/ui';
import { TranscriptUpload, UploadedFileInfo } from './transcript-upload';
import { AttendeeInput } from './attendee-input';
import { CategorySelector } from './category-selector';
import { CalendarEventPicker } from '@/components/google';
import { useToast } from '@/components/ui/toast';
import {
  Upload,
  Chrome,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Calendar,
  X,
} from 'lucide-react';
import type { MeetingCategory } from '@/types/enums';
import type { MeetingAttendee } from '@/types/database';
import type { CalendarEvent } from '@/lib/google/types';

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
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('project');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calendar integration state
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEvent | null>(null);

  // Form data
  const [projectId, setProjectId] = useState(preselectedProjectId || '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [transcriptText, setTranscriptText] = useState('');
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [category, setCategory] = useState<MeetingCategory | ''>('');
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);

  // Check if calendar is connected on mount
  useEffect(() => {
    async function checkCalendarStatus() {
      try {
        const response = await fetch('/api/google/calendar/status');
        if (response.ok) {
          const data = await response.json();
          setIsCalendarConnected(data.connected);
        }
      } catch (error) {
        console.error('Failed to check calendar status:', error);
      }
    }
    checkCalendarStatus();
  }, []);

  // Handle calendar event selection
  const handleCalendarEventSelect = (event: CalendarEvent) => {
    setSelectedCalendarEvent(event);
    setTitle(event.title);
    setDate(event.startTime.split('T')[0]);

    // Convert calendar attendees to meeting attendees
    const meetingAttendees: MeetingAttendee[] = event.attendees.map((a) => ({
      name: a.name || a.email.split('@')[0],
      email: a.email,
    }));
    setAttendees(meetingAttendees);

    setShowCalendarPicker(false);
  };

  // Clear calendar selection
  const handleClearCalendarSelection = () => {
    setSelectedCalendarEvent(null);
    setTitle('');
    setDate(new Date().toISOString().split('T')[0]);
    setAttendees([]);
  };

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
      // Create meeting record first to get the ID
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

      // Upload source file to storage if one was provided
      if (uploadedFile) {
        const filePath = `${projectId}/${meeting.id}/${uploadedFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('meeting-files')
          .upload(filePath, uploadedFile.file, {
            contentType: uploadedFile.type,
            upsert: true,
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          // Continue anyway - the meeting is created, just without the file
        } else {
          // Update meeting with file info
          await supabase
            .from('meetings')
            .update({
              source_file_path: filePath,
              source_file_name: uploadedFile.name,
              source_file_type: uploadedFile.type,
            })
            .eq('id', meeting.id);
        }
      }

      // Navigate to the meeting processing page
      router.push(`/meetings/${meeting.id}/process`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      showToast('Failed to create meeting. Please try again.', 'error');
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

            {/* Calendar Event Picker */}
            {isCalendarConnected && !showCalendarPicker && (
              <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4">
                {selectedCalendarEvent ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary-600" />
                      <div>
                        <p className="font-medium text-surface-900">
                          Imported from Calendar
                        </p>
                        <p className="text-sm text-surface-500">
                          {selectedCalendarEvent.title} - {selectedCalendarEvent.attendees.length} attendees
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearCalendarSelection}
                    >
                      <X className="h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary-600" />
                      <div>
                        <p className="font-medium text-surface-900">
                          Import from Google Calendar
                        </p>
                        <p className="text-sm text-surface-500">
                          Auto-fill meeting details and attendees
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowCalendarPicker(true)}
                    >
                      Select Meeting
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Calendar Picker Modal/Inline */}
            {showCalendarPicker && (
              <div className="rounded-lg border border-surface-200 bg-white p-4">
                <CalendarEventPicker
                  onSelect={handleCalendarEventSelect}
                  onCancel={() => setShowCalendarPicker(false)}
                />
              </div>
            )}

            {!showCalendarPicker && (
              <>
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
              </>
            )}
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
              onFileUploaded={setUploadedFile}
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
              <div className="flex justify-between">
                <span className="text-surface-500">Source File</span>
                <span className="font-medium text-surface-900">
                  {uploadedFile ? uploadedFile.name : 'Pasted text (no file)'}
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


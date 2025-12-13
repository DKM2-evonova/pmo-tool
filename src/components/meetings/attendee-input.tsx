'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { Plus, X, Users, Upload } from 'lucide-react';
import type { MeetingAttendee } from '@/types/database';

interface AttendeeInputProps {
  attendees: MeetingAttendee[];
  onChange: (attendees: MeetingAttendee[]) => void;
}

export function AttendeeInput({ attendees, onChange }: AttendeeInputProps) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const handleAddAttendee = () => {
    onChange([...attendees, { name: '', email: null }]);
  };

  const handleRemoveAttendee = (index: number) => {
    onChange(attendees.filter((_, i) => i !== index));
  };

  const handleUpdateAttendee = (
    index: number,
    field: 'name' | 'email',
    value: string
  ) => {
    const updated = attendees.map((a, i) =>
      i === index ? { ...a, [field]: value || null } : a
    );
    onChange(updated);
  };

  const handleParse = () => {
    // Parse common formats:
    // - "Name <email@example.com>"
    // - "Name, email@example.com"
    // - "Name (email@example.com)"
    // - Just "Name"
    // - Just "email@example.com"

    const lines = pasteText.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);
    const parsed: MeetingAttendee[] = [];

    for (const line of lines) {
      // Try "Name <email>" format
      const angleMatch = line.match(/^(.+?)\s*<([^>]+)>$/);
      if (angleMatch) {
        parsed.push({ name: angleMatch[1].trim(), email: angleMatch[2].trim() });
        continue;
      }

      // Try "Name (email)" format
      const parenMatch = line.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (parenMatch) {
        parsed.push({ name: parenMatch[1].trim(), email: parenMatch[2].trim() });
        continue;
      }

      // Try email only
      const emailMatch = line.match(/^[\w.-]+@[\w.-]+\.\w+$/);
      if (emailMatch) {
        const name = line.split('@')[0].replace(/[._]/g, ' ');
        parsed.push({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          email: line,
        });
        continue;
      }

      // Just a name
      if (line.length > 0) {
        parsed.push({ name: line, email: null });
      }
    }

    onChange([...attendees, ...parsed]);
    setPasteText('');
    setShowPaste(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="label mb-0">
          <Users className="mr-2 inline h-4 w-4" />
          Attendees
        </label>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPaste(!showPaste)}
          >
            <Upload className="h-4 w-4" />
            Paste List
          </Button>
          <Button variant="ghost" size="sm" onClick={handleAddAttendee}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {showPaste && (
        <div className="space-y-2 rounded-lg border border-surface-200 p-4">
          <p className="text-sm text-surface-500">
            Paste attendee names and emails. Supports formats like:
            <br />
            &quot;John Doe &lt;john@example.com&gt;&quot;, &quot;Jane Smith,
            jane@example.com&quot;
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste attendee list here..."
            rows={4}
            className="input resize-none text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPaste(false);
                setPasteText('');
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleParse} disabled={!pasteText.trim()}>
              Parse & Add
            </Button>
          </div>
        </div>
      )}

      {attendees.length > 0 ? (
        <div className="space-y-2">
          {attendees.map((attendee, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={attendee.name}
                onChange={(e) => handleUpdateAttendee(index, 'name', e.target.value)}
                placeholder="Name"
                className="flex-1"
              />
              <Input
                value={attendee.email || ''}
                onChange={(e) => handleUpdateAttendee(index, 'email', e.target.value)}
                placeholder="Email (optional)"
                type="email"
                className="flex-1"
              />
              <button
                onClick={() => handleRemoveAttendee(index)}
                className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-danger-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-surface-500">
          No attendees added. Attendees help with owner resolution during
          processing.
        </p>
      )}
    </div>
  );
}


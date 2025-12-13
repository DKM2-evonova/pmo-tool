/**
 * Owner Identity Resolution Pipeline
 * Based on 05_OWNER_IDENTITY_RESOLUTION.md
 */

import Fuse from 'fuse.js';
import type { Profile, MeetingAttendee } from '@/types/database';
import type { LLMOwner } from '@/types/llm-contract';
import type { OwnerResolutionStatus } from '@/types/enums';

export interface ResolvedOwner {
  name: string;
  email: string | null;
  resolvedUserId: string | null;
  resolutionStatus: OwnerResolutionStatus;
  confidence: number;
  candidates: Array<{
    userId: string;
    name: string;
    email: string;
    score: number;
  }>;
}

interface ResolutionContext {
  projectMembers: Profile[];
  attendees: MeetingAttendee[];
}

/**
 * Resolve owner identity using the 6-step pipeline
 */
export function resolveOwner(
  owner: LLMOwner,
  context: ResolutionContext
): ResolvedOwner {
  const { projectMembers, attendees } = context;

  // Step 1: Direct email match
  if (owner.email) {
    const directMatch = projectMembers.find(
      (m) => m.email.toLowerCase() === owner.email?.toLowerCase()
    );
    if (directMatch) {
      return {
        name: owner.name,
        email: owner.email,
        resolvedUserId: directMatch.id,
        resolutionStatus: 'resolved',
        confidence: 1.0,
        candidates: [],
      };
    }
  }

  // Step 2: Email inference from attendees
  if (!owner.email && attendees.length > 0) {
    const attendeeMatch = attendees.find((a) =>
      a.name.toLowerCase().includes(owner.name.toLowerCase()) ||
      owner.name.toLowerCase().includes(a.name.toLowerCase())
    );
    if (attendeeMatch?.email) {
      const memberMatch = projectMembers.find(
        (m) => m.email.toLowerCase() === attendeeMatch.email?.toLowerCase()
      );
      if (memberMatch) {
        return {
          name: owner.name,
          email: attendeeMatch.email,
          resolvedUserId: memberMatch.id,
          resolutionStatus: 'needs_confirmation',
          confidence: 0.8,
          candidates: [{
            userId: memberMatch.id,
            name: memberMatch.full_name || memberMatch.email,
            email: memberMatch.email,
            score: 0.8,
          }],
        };
      }
    }
  }

  // Step 3: Conference room heuristic
  const conferenceRoomKeywords = [
    'room',
    'conference',
    'meeting room',
    'boardroom',
  ];
  const isConferenceRoom = conferenceRoomKeywords.some(
    (keyword) => owner.name.toLowerCase().includes(keyword)
  );
  if (isConferenceRoom) {
    return {
      name: owner.name,
      email: null,
      resolvedUserId: null,
      resolutionStatus: 'conference_room',
      confidence: 0,
      candidates: [],
    };
  }

  // Step 4: Fuzzy match against project roster
  const fuse = new Fuse(projectMembers, {
    keys: ['full_name', 'email'],
    threshold: 0.4,
    includeScore: true,
  });

  const fuzzyResults = fuse.search(owner.name);

  if (fuzzyResults.length === 1) {
    const match = fuzzyResults[0];
    const confidence = 1 - (match.score || 0);
    return {
      name: owner.name,
      email: match.item.email,
      resolvedUserId: match.item.id,
      resolutionStatus: confidence > 0.7 ? 'needs_confirmation' : 'ambiguous',
      confidence,
      candidates: [{
        userId: match.item.id,
        name: match.item.full_name || match.item.email,
        email: match.item.email,
        score: confidence,
      }],
    };
  }

  // Step 5: Ambiguous - multiple matches
  if (fuzzyResults.length > 1) {
    const candidates = fuzzyResults.slice(0, 5).map((r) => ({
      userId: r.item.id,
      name: r.item.full_name || r.item.email,
      email: r.item.email,
      score: 1 - (r.score || 0),
    }));

    return {
      name: owner.name,
      email: owner.email,
      resolvedUserId: null,
      resolutionStatus: 'ambiguous',
      confidence: 0,
      candidates,
    };
  }

  // Step 6: Fallback - Unknown
  return {
    name: owner.name,
    email: owner.email,
    resolvedUserId: null,
    resolutionStatus: 'unknown',
    confidence: 0,
    candidates: [],
  };
}

/**
 * Check if owner resolution is blocking publish
 */
export function isOwnerResolutionBlocking(
  resolutionStatus: OwnerResolutionStatus
): boolean {
  return ['unknown', 'ambiguous', 'conference_room'].includes(resolutionStatus);
}

/**
 * Get human-readable status label
 */
export function getResolutionStatusLabel(
  status: OwnerResolutionStatus
): string {
  const labels: Record<OwnerResolutionStatus, string> = {
    resolved: 'Resolved',
    needs_confirmation: 'Needs Confirmation',
    ambiguous: 'Ambiguous Owner',
    conference_room: 'Conference Room',
    unknown: 'Unknown',
  };
  return labels[status];
}


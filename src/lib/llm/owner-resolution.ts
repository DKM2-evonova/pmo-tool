/**
 * Owner Identity Resolution Pipeline
 * Based on 05_OWNER_IDENTITY_RESOLUTION.md
 */

import Fuse from 'fuse.js';
import type { Profile, MeetingAttendee } from '@/types/database';
import type { LLMOwner } from '@/types/llm-contract';
import type { OwnerResolutionStatus } from '@/types/enums';
import { loggers } from '@/lib/logger';

const log = loggers.owner;

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
  
  log.debug('Starting owner resolution', {
    ownerName: owner.name,
    ownerEmail: owner.email,
    projectMemberCount: projectMembers.length,
    attendeeCount: attendees.length,
  });

  // Step 1: Direct email match
  if (owner.email) {
    const directMatch = projectMembers.find(
      (m) => m.email.toLowerCase() === owner.email?.toLowerCase()
    );
    if (directMatch) {
      log.debug('Step 1: Direct email match found', {
        ownerName: owner.name,
        matchedUserId: directMatch.id,
        matchedEmail: directMatch.email,
      });
      return {
        name: owner.name,
        email: owner.email,
        resolvedUserId: directMatch.id,
        resolutionStatus: 'resolved',
        confidence: 1.0,
        candidates: [],
      };
    }
    log.debug('Step 1: No direct email match', { email: owner.email });
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
        log.debug('Step 2: Email inferred from attendee list', {
          ownerName: owner.name,
          attendeeName: attendeeMatch.name,
          inferredEmail: attendeeMatch.email,
          matchedUserId: memberMatch.id,
        });
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
    log.debug('Step 2: No attendee email match found', { ownerName: owner.name });
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
    log.debug('Step 3: Detected conference room', { ownerName: owner.name });
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
  log.debug('Step 4: Fuzzy search completed', {
    ownerName: owner.name,
    resultCount: fuzzyResults.length,
    topMatches: fuzzyResults.slice(0, 3).map(r => ({
      name: r.item.full_name,
      score: r.score,
    })),
  });

  if (fuzzyResults.length === 1) {
    const match = fuzzyResults[0];
    const confidence = 1 - (match.score || 0);
    const status = confidence > 0.7 ? 'needs_confirmation' : 'ambiguous';
    log.info('Owner resolved via fuzzy match', {
      ownerName: owner.name,
      matchedName: match.item.full_name,
      confidence,
      status,
    });
    return {
      name: owner.name,
      email: match.item.email,
      resolvedUserId: match.item.id,
      resolutionStatus: status,
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

    log.warn('Step 5: Ambiguous owner - multiple candidates', {
      ownerName: owner.name,
      candidateCount: candidates.length,
      candidates: candidates.map(c => ({ name: c.name, score: c.score })),
    });
    return {
      name: owner.name,
      email: owner.email,
      resolvedUserId: null,
      resolutionStatus: 'ambiguous',
      confidence: 0,
      candidates,
    };
  }

  // Step 6: Fallback - Unknown (can be accepted as placeholder later)
  log.warn('Step 6: Unknown owner - no matches found', {
    ownerName: owner.name,
    ownerEmail: owner.email,
  });
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
  return ['ambiguous', 'conference_room'].includes(resolutionStatus);
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
    placeholder: 'Placeholder',
  };
  return labels[status];
}


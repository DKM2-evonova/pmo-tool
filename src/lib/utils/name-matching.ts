/**
 * Name Matching Utility
 * Provides fuzzy matching for detecting similar names when adding contacts
 */

import Fuse from 'fuse.js';

export interface PersonMatch {
  id: string;
  name: string;
  email: string | null;
  type: 'user' | 'contact';
  score: number; // 0-1, higher is better match
}

export interface SimilarNameResult {
  hasSimilarNames: boolean;
  matches: PersonMatch[];
}

/**
 * Find people with similar names in the existing roster
 * Uses Fuse.js fuzzy matching with a threshold tuned for name similarity
 *
 * @param name - The name to check
 * @param existingPeople - Array of existing users and contacts
 * @param threshold - Fuse.js threshold (0 = exact match, 1 = match anything). Default 0.4
 * @returns Object with hasSimilarNames flag and array of matches
 */
export function findSimilarNames(
  name: string,
  existingPeople: Array<{
    id: string;
    name: string;
    email: string | null;
    type: 'user' | 'contact';
  }>,
  threshold: number = 0.4
): SimilarNameResult {
  if (!name.trim() || existingPeople.length === 0) {
    return { hasSimilarNames: false, matches: [] };
  }

  const normalizedName = name.trim().toLowerCase();

  // Check for exact match first (case-insensitive)
  const exactMatch = existingPeople.find(
    (p) => p.name.toLowerCase() === normalizedName
  );
  if (exactMatch) {
    return {
      hasSimilarNames: true,
      matches: [{
        id: exactMatch.id,
        name: exactMatch.name,
        email: exactMatch.email,
        type: exactMatch.type,
        score: 1.0,
      }],
    };
  }

  // Use Fuse.js for fuzzy matching
  const fuse = new Fuse(existingPeople, {
    keys: ['name'],
    threshold,
    includeScore: true,
  });

  const results = fuse.search(name.trim());

  if (results.length === 0) {
    return { hasSimilarNames: false, matches: [] };
  }

  // Convert results to PersonMatch format
  const matches: PersonMatch[] = results.slice(0, 5).map((r) => ({
    id: r.item.id,
    name: r.item.name,
    email: r.item.email,
    type: r.item.type,
    score: 1 - (r.score || 0), // Invert score so higher = better match
  }));

  return {
    hasSimilarNames: true,
    matches,
  };
}

/**
 * Build a unified roster of people from project members and contacts
 * for use with findSimilarNames
 */
export function buildPeopleRoster(
  projectMembers: Array<{ id: string; full_name: string | null; email: string }>,
  projectContacts: Array<{ id: string; name: string; email: string | null }>
): Array<{ id: string; name: string; email: string | null; type: 'user' | 'contact' }> {
  return [
    ...projectMembers.map((m) => ({
      id: m.id,
      name: m.full_name || m.email,
      email: m.email,
      type: 'user' as const,
    })),
    ...projectContacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      type: 'contact' as const,
    })),
  ];
}

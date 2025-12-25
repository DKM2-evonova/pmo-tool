/**
 * Client-side milestone dependency validation
 * Validates predecessor/successor relationships before submitting to server
 */

export interface MilestoneForValidation {
  id: string;
  name: string;
  predecessor_id: string | null;
  target_date?: string | null;
}

export interface DependencyValidationResult {
  valid: boolean;
  errors: DependencyError[];
  warnings: DependencyWarning[];
}

export interface DependencyError {
  milestoneId: string;
  milestoneName: string;
  type: 'self_reference' | 'circular' | 'missing_predecessor' | 'invalid_date_order';
  message: string;
}

export interface DependencyWarning {
  milestoneId: string;
  milestoneName: string;
  type: 'date_before_predecessor';
  message: string;
}

/**
 * Validate all milestone dependencies in a project
 * Checks for:
 * - Self-references (milestone depending on itself)
 * - Circular dependencies (A -> B -> C -> A)
 * - Missing predecessors (referencing non-existent milestone)
 * - Date order warnings (milestone date before predecessor date)
 */
export function validateMilestoneDependencies(
  milestones: MilestoneForValidation[]
): DependencyValidationResult {
  const errors: DependencyError[] = [];
  const warnings: DependencyWarning[] = [];
  const idSet = new Set(milestones.map((m) => m.id));
  const milestoneMap = new Map(milestones.map((m) => [m.id, m]));

  for (const milestone of milestones) {
    if (!milestone.predecessor_id) continue;

    // Check for self-reference
    if (milestone.id === milestone.predecessor_id) {
      errors.push({
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        type: 'self_reference',
        message: `"${milestone.name}" cannot depend on itself`,
      });
      continue;
    }

    // Check predecessor exists
    if (!idSet.has(milestone.predecessor_id)) {
      errors.push({
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        type: 'missing_predecessor',
        message: `"${milestone.name}" references a non-existent predecessor`,
      });
      continue;
    }

    // Check for circular dependency
    const circularCheck = detectCircularDependency(milestone, milestoneMap);
    if (circularCheck.isCircular) {
      errors.push({
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        type: 'circular',
        message: `Circular dependency: ${circularCheck.chain?.join(' → ')}`,
      });
      continue;
    }

    // Check date order (warning only)
    if (milestone.target_date) {
      const predecessor = milestoneMap.get(milestone.predecessor_id);
      if (predecessor?.target_date) {
        const milestoneDate = new Date(milestone.target_date);
        const predecessorDate = new Date(predecessor.target_date);
        if (milestoneDate < predecessorDate) {
          warnings.push({
            milestoneId: milestone.id,
            milestoneName: milestone.name,
            type: 'date_before_predecessor',
            message: `"${milestone.name}" is scheduled before its predecessor "${predecessor.name}"`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detect if adding this dependency would create a circular reference
 */
function detectCircularDependency(
  milestone: MilestoneForValidation,
  milestoneMap: Map<string, MilestoneForValidation>,
  maxDepth: number = 100
): { isCircular: boolean; chain?: string[] } {
  const visited = new Set<string>();
  const chain: string[] = [milestone.name];
  let current = milestone.predecessor_id;

  while (current && visited.size < maxDepth) {
    if (visited.has(current)) {
      // We've seen this before in our walk, but it's not the starting milestone
      // This shouldn't happen in a valid DAG, but let's be safe
      break;
    }

    if (current === milestone.id) {
      // Found the starting milestone - this is a cycle
      const cyclingMilestone = milestoneMap.get(current);
      chain.push(cyclingMilestone?.name || current);
      return { isCircular: true, chain };
    }

    visited.add(current);
    const predecessor = milestoneMap.get(current);
    if (predecessor) {
      chain.push(predecessor.name);
      current = predecessor.predecessor_id;
    } else {
      current = null;
    }
  }

  return { isCircular: false };
}

/**
 * Check if a specific predecessor assignment would be valid
 * Used for real-time validation as user selects predecessor
 */
export function canSetPredecessor(
  milestoneId: string,
  predecessorId: string | null,
  allMilestones: MilestoneForValidation[]
): { valid: boolean; error?: string } {
  if (!predecessorId) {
    return { valid: true };
  }

  if (milestoneId === predecessorId) {
    return { valid: false, error: 'A milestone cannot depend on itself' };
  }

  const milestoneMap = new Map(allMilestones.map((m) => [m.id, m]));
  const milestone = milestoneMap.get(milestoneId);

  if (!milestone) {
    return { valid: false, error: 'Milestone not found' };
  }

  if (!milestoneMap.has(predecessorId)) {
    return { valid: false, error: 'Predecessor not found' };
  }

  // Create a temporary version with the new predecessor to check for cycles
  const tempMilestone = { ...milestone, predecessor_id: predecessorId };
  const circularCheck = detectCircularDependency(tempMilestone, milestoneMap);

  if (circularCheck.isCircular) {
    return {
      valid: false,
      error: `This would create a circular dependency: ${circularCheck.chain?.join(' → ')}`,
    };
  }

  return { valid: true };
}

/**
 * Get all milestones in the dependency chain (predecessors) of a given milestone
 */
export function getPredecessorChain(
  milestoneId: string,
  allMilestones: MilestoneForValidation[],
  maxDepth: number = 100
): MilestoneForValidation[] {
  const milestoneMap = new Map(allMilestones.map((m) => [m.id, m]));
  const chain: MilestoneForValidation[] = [];
  const milestone = milestoneMap.get(milestoneId);

  if (!milestone) return chain;

  let current = milestone.predecessor_id;
  let depth = 0;

  while (current && depth < maxDepth) {
    const predecessor = milestoneMap.get(current);
    if (!predecessor) break;

    chain.push(predecessor);
    current = predecessor.predecessor_id;
    depth++;
  }

  return chain;
}

/**
 * Get all milestones that depend on a given milestone (successors)
 */
export function getSuccessorChain(
  milestoneId: string,
  allMilestones: MilestoneForValidation[],
  maxDepth: number = 100
): MilestoneForValidation[] {
  const successors: MilestoneForValidation[] = [];
  const queue: { milestone: MilestoneForValidation; depth: number }[] = [];

  // Find direct successors
  const directSuccessors = allMilestones.filter((m) => m.predecessor_id === milestoneId);
  directSuccessors.forEach((m) => queue.push({ milestone: m, depth: 1 }));

  while (queue.length > 0) {
    const { milestone, depth } = queue.shift()!;
    if (depth > maxDepth) continue;

    successors.push(milestone);

    // Find successors of this milestone
    const nextSuccessors = allMilestones.filter((m) => m.predecessor_id === milestone.id);
    nextSuccessors.forEach((m) => queue.push({ milestone: m, depth: depth + 1 }));
  }

  return successors;
}

/**
 * Get milestones that can be selected as predecessors for a given milestone
 * Excludes: the milestone itself, its successors (would create cycle)
 */
export function getAvailablePredecessors(
  milestoneId: string,
  allMilestones: MilestoneForValidation[]
): MilestoneForValidation[] {
  const successors = getSuccessorChain(milestoneId, allMilestones);
  const successorIds = new Set(successors.map((m) => m.id));

  return allMilestones.filter((m) => m.id !== milestoneId && !successorIds.has(m.id));
}

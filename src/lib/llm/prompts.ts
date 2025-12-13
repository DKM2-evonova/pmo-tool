/**
 * LLM Prompt Templates for Meeting Processing
 */

import type { MeetingCategory } from '@/types/enums';
import type { ActionItem, Decision, Risk, MeetingAttendee } from '@/types/database';

const SCHEMA_VERSION = 'pmo_tool.v1';

interface PromptContext {
  category: MeetingCategory;
  transcript: string;
  attendees: MeetingAttendee[];
  openActionItems: ActionItem[];
  openDecisions: Decision[];
  openRisks: Risk[];
}

const categoryInstructions: Record<MeetingCategory, string> = {
  Project: `This is a PROJECT meeting (status update, working session).
Focus on:
- Detailed recap of discussion points
- Action items with clear owners and due dates
- Risks and issues identified
- Progress updates on existing items`,

  Governance: `This is a GOVERNANCE meeting (steering committee, board review).
Focus on:
- Executive-level recap
- Strategic decisions with clear outcomes
- High-level risks and their business impact
- Every decision MUST have an outcome specified`,

  Discovery: `This is a DISCOVERY meeting (requirements gathering, interviews).
Focus on:
- Comprehensive recap capturing all insights
- Action items for follow-up research
- Preliminary decisions and assumptions
- Key findings and learnings`,

  Alignment: `This is an ALIGNMENT meeting (stakeholder alignment, retrospective).
Focus on:
- Recap of alignment topics discussed
- Tone analysis is CRITICAL for this meeting type
- Assess each participant's happiness (Low/Med/High) and buy-in (Low/Med/High)
- Note any concerns or resistance expressed`,

  Remediation: `This is a REMEDIATION meeting (incident review, root cause analysis).
Focus on:
- Detailed recap of the incident/issue
- Fishbone diagram IS REQUIRED - identify root causes
- RAID items (Risks, Actions, Issues, Decisions)
- Corrective and preventive actions`,
};

export function buildProcessingPrompt(context: PromptContext): string {
  const {
    category,
    transcript,
    attendees,
    openActionItems,
    openDecisions,
    openRisks,
  } = context;

  const existingContext = buildExistingItemsContext(
    openActionItems,
    openDecisions,
    openRisks
  );

  return `You are a PMO (Project Management Office) assistant analyzing a meeting transcript.

${categoryInstructions[category]}

## Existing Open Items (for context - prefer UPDATE/CLOSE over CREATE for these)
${existingContext}

## Attendees
${attendees.map((a) => `- ${a.name}${a.email ? ` <${a.email}>` : ''}`).join('\n') || 'No attendee list provided'}

## Meeting Transcript
${transcript}

## Output Requirements

Return a JSON object matching this exact schema:

\`\`\`json
{
  "schema_version": "${SCHEMA_VERSION}",
  "meeting": {
    "category": "${category}",
    "title": "Meeting title inferred from transcript",
    "date": "YYYY-MM-DD",
    "attendees": [{"name": "string", "email": "string or null"}]
  },
  "recap": {
    "summary": "2-3 paragraph summary of the meeting",
    "highlights": ["Key point 1", "Key point 2", "..."]
  },
  "tone": {
    "overall": "Description of overall meeting tone",
    "participants": [
      {
        "name": "Participant name",
        "tone": "Description of their tone",
        "happiness": "Low|Med|High",
        "buy_in": "Low|Med|High"
      }
    ]
  },
  "action_items": [
    {
      "operation": "create|update|close",
      "external_id": "ID of existing item if update/close, null if create",
      "title": "Brief action title",
      "description": "Detailed description",
      "status": "Open|In Progress|Closed",
      "owner": {"name": "string", "email": "string or null"},
      "due_date": "YYYY-MM-DD or null",
      "evidence": [{"quote": "Exact quote from transcript", "speaker": "Speaker name or null", "timestamp": "HH:MM:SS or null"}]
    }
  ],
  "decisions": [
    {
      "operation": "create|update",
      "title": "Decision title",
      "rationale": "Why this decision was made",
      "impact": "Expected impact",
      "decision_maker": {"name": "string", "email": "string or null"},
      "outcome": "What was decided (REQUIRED for Governance)",
      "evidence": [{"quote": "...", "speaker": "...", "timestamp": "..."}]
    }
  ],
  "risks": [
    {
      "operation": "create|update|close",
      "title": "Risk title",
      "description": "Risk description",
      "probability": "Low|Med|High",
      "impact": "Low|Med|High",
      "mitigation": "Mitigation strategy",
      "owner": {"name": "string", "email": "string or null"},
      "status": "Open|In Progress|Closed",
      "evidence": [{"quote": "...", "speaker": "...", "timestamp": "..."}]
    }
  ],
  "fishbone": {
    "enabled": ${category === 'Remediation'},
    ${category === 'Remediation' ? `"outline": {
      "problem_statement": "Clear statement of the problem",
      "categories": [
        {"name": "People", "causes": ["cause1", "cause2"]},
        {"name": "Process", "causes": ["cause1"]},
        {"name": "Technology", "causes": []},
        {"name": "Environment", "causes": []}
      ]
    }` : '"outline": null'}
  }
}
\`\`\`

## Critical Rules

1. EVIDENCE IS REQUIRED: Every action_item, decision, and risk MUST have at least one evidence quote from the transcript.
2. PREFER UPDATE/CLOSE: If an existing item is discussed, use "update" or "close" operation with the external_id.
3. OWNER ASSIGNMENT: Try to identify owners from attendees. Use exact names from the attendee list when possible.
4. DATES: Infer due dates from context (e.g., "by end of week", "next Monday"). Use ISO format YYYY-MM-DD.
5. ${category === 'Remediation' ? 'FISHBONE IS REQUIRED: Create a root cause analysis.' : 'FISHBONE: Set enabled to false.'}
6. ${category === 'Governance' ? 'OUTCOME IS REQUIRED: Every decision must have a clear outcome.' : ''}
7. ${category === 'Alignment' ? 'TONE IS CRITICAL: Carefully assess each participant\'s happiness and buy-in.' : ''}

Return ONLY the JSON object, no additional text.`;
}

function buildExistingItemsContext(
  actionItems: ActionItem[],
  decisions: Decision[],
  risks: Risk[]
): string {
  const sections: string[] = [];

  if (actionItems.length > 0) {
    sections.push(`### Action Items
${actionItems
  .map(
    (ai) =>
      `- [ID: ${ai.id}] ${ai.title} (${ai.status}) - Owner: ${ai.owner_name || 'Unassigned'}`
  )
  .join('\n')}`);
  }

  if (decisions.length > 0) {
    sections.push(`### Decisions
${decisions.map((d) => `- [ID: ${d.id}] ${d.title}`).join('\n')}`);
  }

  if (risks.length > 0) {
    sections.push(`### Risks
${risks
  .map(
    (r) =>
      `- [ID: ${r.id}] ${r.title} (${r.status}) - ${r.probability}/${r.impact}`
  )
  .join('\n')}`);
  }

  return sections.length > 0
    ? sections.join('\n\n')
    : 'No existing open items for this project.';
}


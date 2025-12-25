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
    "summary": "2-3 paragraph executive summary of the meeting",
    "highlights": ["Key point 1", "Key point 2", "..."],
    "key_topics": [
      {
        "topic": "Topic title",
        "discussion": "Detailed summary of what was discussed about this topic (2-4 sentences)",
        "participants": ["Name1", "Name2"],
        "outcome": "Resolution or conclusion reached (null if still open)"
      }
    ],
    "action_items_summary": [
      {
        "title": "Action item title (must match an action_item from the action_items array)",
        "owner": "Owner name",
        "due_date": "YYYY-MM-DD or null",
        "status": "Open|In Progress|Closed"
      }
    ],
    "outstanding_topics": [
      {
        "topic": "Unresolved topic title",
        "context": "Why this topic was raised and what was discussed",
        "blockers": ["Blocker 1", "Blocker 2"],
        "suggested_next_steps": ["Next step 1", "Next step 2"]
      }
    ]
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
      "evidence": [{"quote": "Exact quote from transcript", "speaker": "Speaker name or null", "timestamp": "HH:MM:SS or null"}],
      "change_summary": "For update/close: brief explanation of what changed (e.g., 'Marked complete per team confirmation', 'Due date extended to accommodate vendor delays')"
    }
  ],
  "decisions": [
    {
      "operation": "create|update",
      "external_id": "ID of existing decision if update, null if create",
      "title": "Decision title",
      "rationale": "Why this decision was made",
      "impact": "Expected impact description",
      "category": "PROCESS_OP_MODEL|TECHNOLOGY_SYSTEMS|DATA_REPORTING|PEOPLE_CHANGE_MGMT|GOVERNANCE_COMPLIANCE|STRATEGY_COMMERCIAL",
      "impact_areas": ["SCOPE", "COST_BUDGET", "TIME_SCHEDULE", "RISK", "CUSTOMER_EXP"],
      "status": "PROPOSED|APPROVED|REJECTED",
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
8. KEY TOPICS: Identify 3-5 major discussion topics. Include detailed context about what was discussed and who participated.
9. ACTION ITEMS SUMMARY: The action_items_summary in recap MUST correspond to items in the action_items array. Include all action items.
10. OUTSTANDING TOPICS: Identify any topics that were raised but NOT resolved in this meeting. Include blockers and suggested next steps.

## Decision Classification Rules

11. DECISION CATEGORY (required - assign exactly ONE):
   - PROCESS_OP_MODEL: Workflows, SOPs, business logic, operating model changes
   - TECHNOLOGY_SYSTEMS: Infrastructure, tech stack, tools, system architecture
   - DATA_REPORTING: KPIs, database schema, analytics, data definitions
   - PEOPLE_CHANGE_MGMT: Org structure, training, roles, UX/UI, staffing
   - GOVERNANCE_COMPLIANCE: Legal, security, audit, policies, SOX, regulatory
   - STRATEGY_COMMERCIAL: Budget, vendor selection, scope, MVP, partnerships

12. DECISION IMPACT AREAS (select 1-5 that apply):
   - SCOPE: Changes to project scope or requirements
   - COST_BUDGET: Budget or cost implications
   - TIME_SCHEDULE: Timeline or schedule impact
   - RISK: Risk profile changes
   - CUSTOMER_EXP: Customer experience impact

13. DECISION STATUS (set based on meeting discussion):
   - PROPOSED: Decision was raised but needs further discussion/approval
   - APPROVED: Decision was clearly approved in this meeting
   - REJECTED: Decision was explicitly rejected

## Action Item Update Detection

When processing existing open action items, actively look for these signals:

### Status Change Indicators:
- "We finished X" / "X is done" / "completed the work on X" / "closed out X" → operation: "close", status: "Closed"
- "X is now in progress" / "started working on X" / "picking up X" / "making progress on X" → operation: "update", status: "In Progress"
- "X is blocked" / "we're stuck on X" / "waiting on X" / "can't proceed with X" → operation: "update", add blocker to description

### Scope/Detail Changes:
- New requirements added to existing task → operation: "update", expand description
- Due date mentioned ("need X by Friday", "pushed out the deadline") → operation: "update", set due_date
- Owner reassignment ("Sarah will take over X", "handing off to John") → operation: "update", change owner

### Examples:
- "We closed out the authentication work last week" → close operation with change_summary: "Completed - confirmed in meeting"
- "The API integration task is about 80% done" → update operation with status: "In Progress", change_summary: "Progress update: 80% complete"
- "John finished the design review" → If design review is an existing action item, close it with change_summary: "Completed by John"
- "We need to push the deadline for the reporting feature" → update operation with new due_date and change_summary: "Due date extended per team discussion"

### change_summary Field (REQUIRED for update/close):
For every update or close operation, provide a brief change_summary explaining what changed:
- For close: "Completed - [evidence/reason]"
- For status update: "Status changed to In Progress - [reason]"
- For due date change: "Due date updated - [reason]"
- For owner change: "Reassigned from [old] to [new] - [reason]"
- For scope change: "Description updated to include [change] - [reason]"

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
      `- [ID: ${ai.id}] ${ai.title}
    Status: ${ai.status}
    Owner: ${ai.owner_name || 'Unassigned'}
    Due: ${ai.due_date || 'Not set'}
    Description: ${ai.description ? ai.description.substring(0, 100) + (ai.description.length > 100 ? '...' : '') : 'No description'}`
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


/**
 * Executive Summary Generation for Project Status Reports
 * Generates AI-powered executive summaries based on project activity data
 */

import { getLLMClient } from './client';
import { loggers } from '@/lib/logger';

const log = loggers.llm;

/**
 * Context structure for executive summary generation
 */
export interface ExecutiveSummaryContext {
  projectName: string;
  reportDate: Date;
  actionItems: {
    total: number;
    open: number;
    inProgress: number;
    overdue: number;
    recentlyCompleted: number;
    items: Array<{
      title: string;
      status: string;
      owner: string;
      dueDate: string | null;
      isOverdue: boolean;
      isRecentlyCompleted?: boolean;
    }>;
  };
  risks: {
    total: number;
    highSeverity: number;
    items: Array<{
      title: string;
      probability: string;
      impact: string;
      mitigation: string;
      owner: string;
    }>;
  };
  decisions: {
    total: number;
    recentCount: number;
    items: Array<{
      title: string;
      outcome: string | null;
      impact: string | null;
      status: string;
      decisionDate: string | null;
    }>;
  };
  milestones: {
    total: number;
    completed: number;
    inProgress: number;
    behindSchedule: number;
    notStarted: number;
    upcoming: Array<{
      name: string;
      targetDate: string | null;
      status: string;
    }>;
  };
}

export interface ExecutiveSummaryResult {
  success: boolean;
  summary?: string;
  error?: string;
  model: string;
  latencyMs: number;
}

/**
 * Format a date string for display
 */
function formatDateForPrompt(dateString: string | null): string {
  if (!dateString) return 'Not set';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Build the prompt for executive summary generation
 */
export function buildExecutiveSummaryPrompt(context: ExecutiveSummaryContext): string {
  const { projectName, reportDate, actionItems, risks, decisions, milestones } = context;

  const reportDateStr = reportDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Format action items for the prompt (limit to most relevant)
  const actionItemsSection = actionItems.items.length > 0
    ? actionItems.items.slice(0, 10).map(ai => {
        let status = ai.status;
        if (ai.isOverdue) status += ' (OVERDUE)';
        if (ai.isRecentlyCompleted) status = 'Recently Completed';
        return `- "${ai.title}" | ${status} | Owner: ${ai.owner} | Due: ${formatDateForPrompt(ai.dueDate)}`;
      }).join('\n')
    : 'No action items tracked';

  // Format risks for the prompt (prioritize high severity)
  const sortedRisks = [...risks.items].sort((a, b) => {
    const severityOrder = { High: 0, Med: 1, Low: 2 };
    const aScore = (severityOrder[a.probability as keyof typeof severityOrder] ?? 2) +
                   (severityOrder[a.impact as keyof typeof severityOrder] ?? 2);
    const bScore = (severityOrder[b.probability as keyof typeof severityOrder] ?? 2) +
                   (severityOrder[b.impact as keyof typeof severityOrder] ?? 2);
    return aScore - bScore;
  });

  const risksSection = sortedRisks.length > 0
    ? sortedRisks.slice(0, 5).map(r =>
        `- "${r.title}" | Probability: ${r.probability} | Impact: ${r.impact} | Owner: ${r.owner}\n  Mitigation: ${r.mitigation || 'Not defined'}`
      ).join('\n')
    : 'No open risks';

  // Format decisions for the prompt (recent first)
  const decisionsSection = decisions.items.length > 0
    ? decisions.items.slice(0, 5).map(d =>
        `- "${d.title}" | Status: ${d.status} | Date: ${formatDateForPrompt(d.decisionDate)}\n  Outcome: ${d.outcome || 'Pending'}`
      ).join('\n')
    : 'No decisions recorded';

  // Format milestones for the prompt
  const milestonesSection = milestones.upcoming.length > 0
    ? milestones.upcoming.slice(0, 5).map(m =>
        `- "${m.name}" | Status: ${m.status} | Target: ${formatDateForPrompt(m.targetDate)}`
      ).join('\n')
    : 'No milestones defined';

  return `You are a senior Project Management Office (PMO) analyst generating an executive summary for a weekly project status report.

## Project Information
Project: ${projectName}
Report Date: ${reportDateStr}
Reporting Period: Last 7 Days

## Current Status Metrics

### Action Items Overview
- Total Open/In Progress: ${actionItems.open + actionItems.inProgress}
- Open Items: ${actionItems.open}
- In Progress: ${actionItems.inProgress}
- Overdue Items: ${actionItems.overdue}
- Completed This Week: ${actionItems.recentlyCompleted}

### Risk Overview
- Total Open Risks: ${risks.total}
- High Severity Risks: ${risks.highSeverity} (High probability OR High impact)

### Decisions Overview
- Total Decisions: ${decisions.total}
- Decisions Made This Week: ${decisions.recentCount}

### Milestone Progress
- Total Milestones: ${milestones.total}
- Completed: ${milestones.completed}
- In Progress: ${milestones.inProgress}
- Behind Schedule: ${milestones.behindSchedule}
- Not Started: ${milestones.notStarted}

## Key Items Detail

### Action Items (Top ${Math.min(actionItems.items.length, 10)})
${actionItemsSection}

### Open Risks (Top ${Math.min(risks.items.length, 5)})
${risksSection}

### Recent Decisions (Top ${Math.min(decisions.items.length, 5)})
${decisionsSection}

### Upcoming Milestones
${milestonesSection}

## Instructions

Write a professional executive summary (3-4 paragraphs, 300-400 words total) that covers:

**Paragraph 1 - Overall Project Status:**
Provide a high-level assessment of where the project stands. Comment on milestone progress and overall project health. Set the tone for the rest of the summary.

**Paragraph 2 - Key Accomplishments & Progress:**
Highlight recently completed action items (if any), approved decisions, and positive developments from this reporting period. Acknowledge team progress.

**Paragraph 3 - Critical Items Requiring Attention:**
This is the MOST IMPORTANT paragraph. Call out:
- Overdue action items BY NAME if any exist (there are ${actionItems.overdue} overdue items)
- High-severity risks BY NAME and their mitigation status
- Any blockers or issues that need immediate resolution
Be specific and direct. Stakeholders need to know exactly what requires their attention.

**Paragraph 4 - Outlook & Next Steps:**
Briefly describe upcoming milestones (especially any behind schedule), key priorities for the next week, and any decisions or support needed from stakeholders.

## Writing Guidelines

- Use professional, concise language suitable for executive stakeholders
- Be SPECIFIC with names, dates, and facts from the data provided
- Prioritize the most impactful items over minor details
- If there are overdue items, you MUST mention them explicitly by name
- If there are high-severity risks, summarize the top 1-2 with mitigation status
- Write in flowing prose paragraphs - do NOT use bullet points, numbered lists, or headers
- Do NOT include section labels like "Overall Status:" in your output
- Keep total length to 300-400 words
- Be honest about project challenges - don't sugarcoat issues

Return ONLY the executive summary text (3-4 paragraphs), no additional formatting, headers, or commentary.`;
}

/**
 * Generate an executive summary for a project status report
 */
export async function generateExecutiveSummary(
  context: ExecutiveSummaryContext
): Promise<ExecutiveSummaryResult> {
  const startTime = Date.now();

  log.info('Starting executive summary generation', {
    projectName: context.projectName,
    actionItemsCount: context.actionItems.total,
    risksCount: context.risks.total,
    decisionsCount: context.decisions.total,
    milestonesCount: context.milestones.total,
    overdueCount: context.actionItems.overdue,
    highSeverityRisks: context.risks.highSeverity,
  });

  try {
    const client = getLLMClient();
    const prompt = buildExecutiveSummaryPrompt(context);

    // Use generate (not generateJSON) since we want prose text output
    const response = await client.generate(
      prompt,
      'You are an expert PMO analyst who writes clear, professional executive summaries for project status reports. You focus on actionable insights and clearly communicate both achievements and areas of concern.',
      { jsonMode: false }
    );

    const latencyMs = Date.now() - startTime;

    // Clean up the response - remove any markdown or extra whitespace
    let summary = response.content.trim();

    // Remove markdown code blocks if present
    summary = summary.replace(/^```[\s\S]*?\n/, '').replace(/\n```$/, '');

    // Remove any leading/trailing quotes
    summary = summary.replace(/^["']|["']$/g, '');

    log.info('Executive summary generated successfully', {
      projectName: context.projectName,
      model: response.model,
      isFallback: response.isFallback,
      latencyMs,
      summaryLength: summary.length,
      wordCount: summary.split(/\s+/).length,
    });

    return {
      success: true,
      summary,
      model: response.model,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log.error('Executive summary generation failed', {
      projectName: context.projectName,
      latencyMs,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
      model: 'none',
      latencyMs,
    };
  }
}

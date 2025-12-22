'use client';

import { useState, useEffect } from 'react';
import { FileBarChart, CheckSquare, AlertTriangle, FileText } from 'lucide-react';
import { ProjectSelector } from '@/components/reports/project-selector';
import { ReportTabs } from '@/components/reports/report-tabs';
import { ActionItemsLog } from '@/components/reports/action-items-log';
import { RisksLog } from '@/components/reports/risks-log';
import { DecisionsLog } from '@/components/reports/decisions-log';
import { MilestonesLog } from '@/components/reports/milestones-log';
import { StatusReportExport } from '@/components/reports/status-report-export';
import type { ActionItemWithOwner, RiskWithOwner, DecisionWithMaker, Milestone } from '@/types/database';

interface Project {
  id: string;
  name: string;
}

interface ProjectStatusClientProps {
  projects: Project[];
}

interface ReportData {
  project: Project;
  actionItems: ActionItemWithOwner[];
  risks: RiskWithOwner[];
  decisions: DecisionWithMaker[];
  milestones: Milestone[];
}

type TabType = 'action-items' | 'risks' | 'decisions' | 'milestones';

export function ProjectStatusClient({ projects }: ProjectStatusClientProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('action-items');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Fetch report data when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setReportData(null);
      return;
    }

    const fetchReportData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/reports/project-status?projectId=${selectedProjectId}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch report data');
        }

        const data = await response.json();
        setReportData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setReportData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [selectedProjectId]);

  const tabCounts = {
    'action-items': reportData?.actionItems.length || 0,
    'risks': reportData?.risks.length || 0,
    'decisions': reportData?.decisions.length || 0,
    'milestones': reportData?.milestones.length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Project Status Report</h1>
        <p className="mt-1 text-surface-500">
          Generate consolidated status reports for your projects
        </p>
      </div>

      {/* Controls Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ProjectSelector
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
        />

        {reportData && (
          <StatusReportExport
            projectName={reportData.project.name}
            actionItems={reportData.actionItems}
            risks={reportData.risks}
            decisions={reportData.decisions}
            milestones={reportData.milestones}
            disabled={isLoading}
          />
        )}
      </div>

      {/* Content Area */}
      {!selectedProjectId ? (
        // No project selected
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <FileBarChart className="mb-4 h-12 w-12 text-surface-300" />
          <h3 className="text-lg font-medium text-surface-900">Select a Project</h3>
          <p className="mt-1 text-surface-500">
            Choose a project from the dropdown to view its status report
          </p>
        </div>
      ) : isLoading ? (
        // Loading state
        <div className="card">
          <div className="space-y-4">
            <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-100" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-100" />
              ))}
            </div>
          </div>
        </div>
      ) : error ? (
        // Error state
        <div className="card border-danger-200 bg-danger-50">
          <div className="flex items-center gap-3 text-danger-700">
            <AlertTriangle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </div>
      ) : reportData ? (
        // Report content
        <div className="space-y-4">
          {/* Tabs */}
          <ReportTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={tabCounts}
          />

          {/* Tab Content */}
          <div className="card">
            {activeTab === 'action-items' && (
              <ActionItemsLog items={reportData.actionItems} />
            )}
            {activeTab === 'risks' && (
              <RisksLog items={reportData.risks} />
            )}
            {activeTab === 'decisions' && (
              <DecisionsLog items={reportData.decisions} />
            )}
            {activeTab === 'milestones' && (
              <MilestonesLog items={reportData.milestones} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useMemo, useState, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MilestoneWithPredecessor } from '@/types/database';
import { MilestoneStatus } from '@/types/enums';
import { cn } from '@/lib/utils';

interface MilestoneGanttProps {
  milestones: MilestoneWithPredecessor[];
}

// Constants for layout
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 50;
const LEFT_PANEL_WIDTH = 250;
const DAY_WIDTH = 30;
const MILESTONE_HEIGHT = 24;
const MILESTONE_RADIUS = 4;

// Status colors
const statusColors: Record<string, { fill: string; stroke: string; text: string }> = {
  'Not Started': { fill: '#F3F4F6', stroke: '#9CA3AF', text: '#4B5563' },
  'In Progress': { fill: '#EEF2FF', stroke: '#4F46E5', text: '#3730A3' },
  'Behind Schedule': { fill: '#FEF3C7', stroke: '#D97706', text: '#92400E' },
  'Complete': { fill: '#DCFCE7', stroke: '#16A34A', text: '#166534' },
};

export function MilestoneGantt({ milestones }: MilestoneGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);

  // Calculate date range
  const { startDate, endDate, totalDays, months } = useMemo(() => {
    const dates = milestones
      .filter((m) => m.target_date)
      .map((m) => new Date(m.target_date!));

    if (dates.length === 0) {
      // Default to current month if no dates
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return {
        startDate: start,
        endDate: end,
        totalDays: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        months: getMonthsInRange(start, end),
      };
    }

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add padding (1 month before and after)
    const start = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);

    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      startDate: start,
      endDate: end,
      totalDays,
      months: getMonthsInRange(start, end),
    };
  }, [milestones]);

  // Calculate today line position
  const todayPosition = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today < startDate || today > endDate) return null;
    const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff * DAY_WIDTH;
  }, [startDate, endDate]);

  // Sort milestones by target_date
  const sortedMilestones = useMemo(() => {
    return [...milestones].sort((a, b) => {
      if (!a.target_date && !b.target_date) return 0;
      if (!a.target_date) return 1;
      if (!b.target_date) return -1;
      return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
    });
  }, [milestones]);

  // Calculate milestone positions
  const milestonePositions = useMemo(() => {
    return sortedMilestones.map((m) => {
      if (!m.target_date) return { x: 0, visible: false };
      const date = new Date(m.target_date);
      const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return { x: daysDiff * DAY_WIDTH, visible: true };
    });
  }, [sortedMilestones, startDate]);

  // Build dependency lines
  const dependencyLines = useMemo(() => {
    return sortedMilestones
      .map((m, index) => {
        if (!m.predecessor_id) return null;
        const predecessorIndex = sortedMilestones.findIndex((p) => p.id === m.predecessor_id);
        if (predecessorIndex === -1) return null;

        const fromPos = milestonePositions[predecessorIndex];
        const toPos = milestonePositions[index];

        if (!fromPos.visible || !toPos.visible) return null;

        return {
          from: { x: fromPos.x, y: predecessorIndex * ROW_HEIGHT + ROW_HEIGHT / 2 },
          to: { x: toPos.x, y: index * ROW_HEIGHT + ROW_HEIGHT / 2 },
        };
      })
      .filter(Boolean);
  }, [sortedMilestones, milestonePositions]);

  const timelineWidth = totalDays * DAY_WIDTH;
  const chartHeight = sortedMilestones.length * ROW_HEIGHT;

  // Scroll handlers
  const handleScrollLeft = () => {
    setScrollOffset((prev) => Math.max(0, prev - 200));
  };

  const handleScrollRight = () => {
    setScrollOffset((prev) => Math.min(timelineWidth - 600, prev + 200));
  };

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-surface-500">
        <Calendar className="h-12 w-12 mb-4 text-surface-300" />
        <p>No milestones to display</p>
        <p className="text-sm">Add milestones with target dates to see the timeline</p>
      </div>
    );
  }

  const milestonesWithDates = sortedMilestones.filter((m) => m.target_date);
  if (milestonesWithDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-surface-500">
        <Calendar className="h-12 w-12 mb-4 text-surface-300" />
        <p>No milestones have target dates</p>
        <p className="text-sm">Add target dates to see the timeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-surface-600">
          Timeline View • {milestonesWithDates.length} milestone
          {milestonesWithDates.length !== 1 && 's'} with dates
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScrollLeft}
            disabled={scrollOffset <= 0}
            className="rounded-lg border border-surface-200 p-1.5 hover:bg-surface-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={handleScrollRight}
            disabled={scrollOffset >= timelineWidth - 600}
            className="rounded-lg border border-surface-200 p-1.5 hover:bg-surface-50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Gantt Chart */}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-surface-200 bg-white"
      >
        <div className="flex">
          {/* Left Panel - Milestone Names */}
          <div
            className="flex-shrink-0 border-r border-surface-200 bg-surface-50"
            style={{ width: LEFT_PANEL_WIDTH }}
          >
            {/* Header */}
            <div
              className="border-b border-surface-200 px-3 flex items-center font-medium text-surface-700"
              style={{ height: HEADER_HEIGHT }}
            >
              Milestone
            </div>
            {/* Rows */}
            {sortedMilestones.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'border-b border-surface-100 px-3 flex items-center text-sm',
                  hoveredMilestone === m.id && 'bg-primary-50'
                )}
                style={{ height: ROW_HEIGHT }}
                onMouseEnter={() => setHoveredMilestone(m.id)}
                onMouseLeave={() => setHoveredMilestone(null)}
              >
                <div className="truncate" title={m.name}>
                  {m.name}
                </div>
              </div>
            ))}
          </div>

          {/* Right Panel - Timeline */}
          <div className="flex-1 overflow-hidden">
            <div
              className="relative"
              style={{
                transform: `translateX(-${scrollOffset}px)`,
                width: timelineWidth,
              }}
            >
              {/* Header - Months */}
              <div
                className="flex border-b border-surface-200"
                style={{ height: HEADER_HEIGHT }}
              >
                {months.map((month, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 border-r border-surface-200 px-2 flex items-center justify-center text-sm font-medium text-surface-700"
                    style={{ width: month.days * DAY_WIDTH }}
                  >
                    {month.label}
                  </div>
                ))}
              </div>

              {/* Chart Area */}
              <svg
                width={timelineWidth}
                height={chartHeight}
                className="block"
              >
                {/* Grid lines (vertical - days) */}
                {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, i) => (
                  <line
                    key={i}
                    x1={i * 7 * DAY_WIDTH}
                    y1={0}
                    x2={i * 7 * DAY_WIDTH}
                    y2={chartHeight}
                    stroke="#E5E7EB"
                    strokeDasharray="2,2"
                  />
                ))}

                {/* Grid lines (horizontal - rows) */}
                {sortedMilestones.map((_, i) => (
                  <line
                    key={i}
                    x1={0}
                    y1={(i + 1) * ROW_HEIGHT}
                    x2={timelineWidth}
                    y2={(i + 1) * ROW_HEIGHT}
                    stroke="#F3F4F6"
                  />
                ))}

                {/* Today line */}
                {todayPosition !== null && (
                  <g>
                    <line
                      x1={todayPosition}
                      y1={0}
                      x2={todayPosition}
                      y2={chartHeight}
                      stroke="#DC2626"
                      strokeWidth={2}
                      strokeDasharray="4,4"
                    />
                    <text
                      x={todayPosition + 4}
                      y={12}
                      fontSize={10}
                      fill="#DC2626"
                      fontWeight="bold"
                    >
                      Today
                    </text>
                  </g>
                )}

                {/* Dependency arrows */}
                {dependencyLines.map((line, i) => {
                  if (!line) return null;
                  const { from, to } = line;
                  const midX = (from.x + to.x) / 2;

                  return (
                    <g key={i}>
                      <path
                        d={`M ${from.x + 10} ${from.y}
                            C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x - 10} ${to.y}`}
                        fill="none"
                        stroke="#9CA3AF"
                        strokeWidth={1.5}
                        strokeDasharray="4,2"
                        markerEnd="url(#arrowhead)"
                      />
                    </g>
                  );
                })}

                {/* Arrow marker definition */}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
                  </marker>
                </defs>

                {/* Milestone markers */}
                {sortedMilestones.map((m, index) => {
                  const pos = milestonePositions[index];
                  if (!pos.visible) return null;

                  const colors = statusColors[m.status] || statusColors['Not Started'];
                  const y = index * ROW_HEIGHT + (ROW_HEIGHT - MILESTONE_HEIGHT) / 2;
                  const isHovered = hoveredMilestone === m.id;

                  return (
                    <g
                      key={m.id}
                      onMouseEnter={() => setHoveredMilestone(m.id)}
                      onMouseLeave={() => setHoveredMilestone(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Milestone diamond/bar */}
                      <rect
                        x={pos.x - 40}
                        y={y}
                        width={80}
                        height={MILESTONE_HEIGHT}
                        rx={MILESTONE_RADIUS}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={isHovered ? 2 : 1}
                        className="transition-all"
                      />
                      {/* Status indicator */}
                      {m.status === MilestoneStatus.Complete && (
                        <circle
                          cx={pos.x - 30}
                          cy={y + MILESTONE_HEIGHT / 2}
                          r={6}
                          fill={colors.stroke}
                        />
                      )}
                      {m.status === MilestoneStatus.InProgress && (
                        <circle
                          cx={pos.x - 30}
                          cy={y + MILESTONE_HEIGHT / 2}
                          r={6}
                          fill="none"
                          stroke={colors.stroke}
                          strokeWidth={2}
                          strokeDasharray="8,4"
                        />
                      )}
                      {/* Date label */}
                      <text
                        x={pos.x}
                        y={y + MILESTONE_HEIGHT / 2 + 4}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={500}
                        fill={colors.text}
                      >
                        {formatShortDate(m.target_date!)}
                      </text>

                      {/* Hover tooltip */}
                      {isHovered && (
                        <g>
                          <rect
                            x={pos.x - 75}
                            y={y - 45}
                            width={150}
                            height={40}
                            rx={4}
                            fill="#1F2937"
                            opacity={0.95}
                          />
                          <text
                            x={pos.x}
                            y={y - 28}
                            textAnchor="middle"
                            fontSize={11}
                            fill="white"
                            fontWeight={500}
                          >
                            {m.name.length > 20 ? m.name.substring(0, 20) + '...' : m.name}
                          </text>
                          <text
                            x={pos.x}
                            y={y - 12}
                            textAnchor="middle"
                            fontSize={10}
                            fill="#9CA3AF"
                          >
                            {m.status} • {formatFullDate(m.target_date!)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-surface-600">
        <span className="font-medium">Status:</span>
        {Object.entries(statusColors).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className="h-3 w-6 rounded"
              style={{ backgroundColor: colors.fill, border: `1px solid ${colors.stroke}` }}
            />
            <span>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper functions
function getMonthsInRange(start: Date, end: Date) {
  const months: { label: string; days: number }[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Calculate visible days in this month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const visibleStart = monthStart < start ? start : monthStart;
    const visibleEnd = monthEnd > end ? end : monthEnd;

    const visibleDays =
      Math.ceil((visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    months.push({
      label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      days: visibleDays,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

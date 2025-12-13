'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FishboneData, FishboneCategory } from '@/types/database';

interface FishboneDiagramProps {
  fishbone: FishboneData;
}

export function FishboneDiagram({ fishbone }: FishboneDiagramProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(fishbone.outline?.categories.map((c) => c.name) || [])
  );

  if (!fishbone.enabled || !fishbone.outline) {
    return null;
  }

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const colors = [
    'bg-danger-50 border-danger-200 text-danger-700',
    'bg-warning-50 border-warning-200 text-warning-700',
    'bg-primary-50 border-primary-200 text-primary-700',
    'bg-success-50 border-success-200 text-success-700',
    'bg-surface-100 border-surface-300 text-surface-700',
  ];

  return (
    <div className="card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-900">
        <AlertTriangle className="h-5 w-5" />
        Root Cause Analysis (Fishbone)
      </h2>

      {/* Problem Statement */}
      <div className="mb-6 rounded-lg bg-danger-50 p-4">
        <h3 className="mb-1 text-sm font-medium text-danger-600">
          Problem Statement
        </h3>
        <p className="font-medium text-danger-700">
          {fishbone.outline.problem_statement}
        </p>
      </div>

      {/* Visual Fishbone Diagram */}
      <div className="relative mb-6 overflow-x-auto">
        <svg
          viewBox="0 0 800 400"
          className="w-full min-w-[600px]"
          style={{ maxHeight: '400px' }}
        >
          {/* Main spine */}
          <line
            x1="100"
            y1="200"
            x2="700"
            y2="200"
            stroke="currentColor"
            strokeWidth="3"
            className="text-surface-400"
          />

          {/* Arrow head */}
          <polygon
            points="700,200 680,190 680,210"
            fill="currentColor"
            className="text-danger-500"
          />

          {/* Problem box */}
          <rect
            x="700"
            y="170"
            width="90"
            height="60"
            rx="4"
            className="fill-danger-100 stroke-danger-400"
            strokeWidth="2"
          />
          <text
            x="745"
            y="205"
            textAnchor="middle"
            className="fill-danger-700 text-xs font-medium"
          >
            Problem
          </text>

          {/* Category bones */}
          {fishbone.outline.categories.slice(0, 6).map((category, index) => {
            const isTop = index % 2 === 0;
            const xPos = 200 + (index * 80);
            const yEnd = isTop ? 80 : 320;

            return (
              <g key={category.name}>
                {/* Main bone */}
                <line
                  x1={xPos}
                  y1="200"
                  x2={xPos + 60}
                  y2={yEnd}
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-surface-400"
                />
                {/* Category label */}
                <text
                  x={xPos + 65}
                  y={isTop ? yEnd - 10 : yEnd + 15}
                  className="fill-surface-700 text-xs font-medium"
                >
                  {category.name}
                </text>
                {/* Cause lines */}
                {category.causes.slice(0, 3).map((_, causeIndex) => {
                  const causeY =
                    200 + (isTop ? -1 : 1) * (30 + causeIndex * 25);
                  const causeX = xPos + (causeIndex + 1) * 15;
                  return (
                    <line
                      key={causeIndex}
                      x1={causeX}
                      y1={causeY}
                      x2={causeX + 20}
                      y2={causeY + (isTop ? -15 : 15)}
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-surface-300"
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Expandable Categories */}
      <div className="space-y-3">
        {fishbone.outline.categories.map((category, index) => (
          <div
            key={category.name}
            className={cn(
              'rounded-lg border p-4',
              colors[index % colors.length]
            )}
          >
            <button
              onClick={() => toggleCategory(category.name)}
              className="flex w-full items-center justify-between"
            >
              <span className="font-medium">{category.name}</span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/50 px-2 py-0.5 text-xs">
                  {category.causes.length} causes
                </span>
                {expandedCategories.has(category.name) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </button>

            {expandedCategories.has(category.name) && category.causes.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-current/10 pt-3">
                {category.causes.map((cause, causeIndex) => (
                  <li
                    key={causeIndex}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {cause}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


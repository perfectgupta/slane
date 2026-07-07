/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { Play, Pause, Clock, AlarmClockPlus } from "lucide-react";
// helpers
import { cn } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// services
import { IssueService } from "@/services/issue";
// components
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { ManualTimeLogModal } from "./time-tracking-modal";

const issueService = new IssueService();

interface IIssueTimelogProperty {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
}

const pad = (n: number) => n.toString().padStart(2, "0");

const formatDuration = (totalSeconds: number) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

export const IssueTimelogProperty = observer(function IssueWorklogProperty(props: IIssueTimelogProperty) {
  const { workspaceSlug, projectId, issueId, disabled } = props;

  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);

  // Pull the issue directly from the MobX store
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const issue = getIssueById(issueId);

  // Extract ID and Start Time safely (Flat vs Nested)
  const activeLogId = issue?.running_time_log?.id || (issue as any)?.running_time_log_id;
  const activeLogStart = issue?.running_time_log?.start_time || (issue as any)?.running_time_log_start;
  const isRunning = !!activeLogId && !!activeLogStart;

  const [displaySeconds, setDisplaySeconds] = useState(issue?.total_tracked_seconds ?? 0);
  const [isMutating, setIsMutating] = useState(false);

  // Sync display time and handle the visual tick
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const updateDisplayTime = () => {
      const baseSeconds = issue?.total_tracked_seconds ?? 0;

      if (activeLogStart) {
        const startTime = new Date(activeLogStart).getTime();
        const now = Date.now();
        const activeSeconds = Math.floor((now - startTime) / 1000);
        setDisplaySeconds(baseSeconds + Math.max(0, activeSeconds));
      } else {
        setDisplaySeconds(baseSeconds);
      }
    };

    updateDisplayTime();

    if (isRunning) {
      interval = setInterval(updateDisplayTime, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, issue?.total_tracked_seconds, activeLogStart]);

  const toggleTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!workspaceSlug || !projectId || !issue || disabled || isMutating) return;

    setIsMutating(true);
    try {
      if (isRunning && activeLogId) {
        // STOP TIMER
        const response = await issueService.stopTimeLog(workspaceSlug, projectId, issueId, activeLogId);
        const responseData = response.data || response;

        runInAction(() => {
          // Clear both nested and flat states
          issue.running_time_log = null;
          (issue as any).running_time_log_id = null;
          (issue as any).running_time_log_start = null;

          if (responseData && responseData.time_seconds !== undefined) {
            issue.total_tracked_seconds = (issue.total_tracked_seconds ?? 0) + responseData.time_seconds;
          }
        });
      } else {
        // START TIMER
        const payload = { tracking_start_time: new Date().toISOString() };
        const response = await issueService.startTimeLog(workspaceSlug, projectId, issueId, payload);
        const responseData = response.data || response;

        runInAction(() => {
          // Update nested state
          issue.running_time_log = {
            id: responseData.id,
            start_time: responseData.tracking_start_time,
          };
          // Set flat keys to ensure complete sync
          (issue as any).running_time_log_id = responseData.id;
          (issue as any).running_time_log_start = responseData.tracking_start_time;
        });
      }
    } catch (error) {
      console.error("Timer Error:", error);
    } finally {
      setIsMutating(false);
    }
  };

  if (!issue) return null;

  return (
    <>
      <SidebarPropertyListItem icon={Clock} label="Time tracking">
        <div className="flex h-7.5 w-full grow items-center gap-3">
          <button
            type="button"
            onClick={toggleTimer}
            disabled={disabled || isMutating}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
              isRunning
                ? "border-red-500 bg-red-500/10 text-red-500"
                : "border-subtle text-secondary hover:bg-surface-1",
              (disabled || isMutating) && "cursor-not-allowed opacity-50"
            )}
            aria-label={isRunning ? "Stop timer" : "Start timer"}
          >
            {isRunning ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
            )}
          </button>

          {/* New Manual Log Button */}
          <button
            type="button"
            onClick={() => setIsManualModalOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-1 hover:text-primary"
            title="Log time manually"
          >
            <AlarmClockPlus className="h-4 w-4" />
          </button>

          <span
            className={cn(
              "text-body-xs-medium tabular-nums transition-colors",
              isRunning ? "text-accent-primary" : "text-secondary"
            )}
          >
            {formatDuration(displaySeconds)}
          </span>
        </div>
      </SidebarPropertyListItem>
      {/* New Modal component */}
      <ManualTimeLogModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        workspaceSlug={workspaceSlug}
        issue={issue}
      />
    </>
  );
});

/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { useParams } from "next/navigation";
import { Play, Pause, AlarmClockPlus } from "lucide-react";
// types
import type { TIssue } from "@plane/types";
// helpers
import { cn } from "@plane/utils";
// services
import { IssueService } from "@/services/issue";
import { ManualTimeLogModal } from "../../properties/time-tracking-modal";

const issueService = new IssueService();

type Props = {
  issue: TIssue & {
    // Add these flat keys to the type definition locally just in case
    running_time_log_id?: string | null;
    running_time_log_start?: string | null;
  };
  disabled?: boolean;
};

const pad = (n: number) => n.toString().padStart(2, "0");

const formatDuration = (totalSeconds: number) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

export const SpreadsheetTimeTrackingColumn = observer(function SpreadsheetTimeTrackingColumn(props: Props) {
  const { issue, disabled } = props;
  const { workspaceSlug } = useParams();

  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);

  // --- THE FIX: Safely extract ID and Start Time from EITHER flat or nested payloads ---
  const activeLogId = issue?.running_time_log?.id || issue?.running_time_log_id;
  const activeLogStart = issue?.running_time_log?.start_time || issue?.running_time_log_start;
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

    if (!workspaceSlug || !issue.project_id || disabled || isMutating) return;

    setIsMutating(true);
    try {
      if (isRunning && activeLogId) {
        // STOP TIMER
        const response = await issueService.stopTimeLog(
          workspaceSlug.toString(),
          issue.project_id,
          issue.id,
          activeLogId // Use the extracted ID here
        );

        const responseData = response.data || response;

        runInAction(() => {
          // Clear both nested and flat states
          issue.running_time_log = null;
          issue.running_time_log_id = null;
          issue.running_time_log_start = null;

          if (responseData && responseData.time_seconds !== undefined) {
            issue.total_tracked_seconds = (issue.total_tracked_seconds ?? 0) + responseData.time_seconds;
          }
        });
      } else {
        // START TIMER
        const payload = { tracking_start_time: new Date().toISOString() };

        const response = await issueService.startTimeLog(workspaceSlug.toString(), issue.project_id, issue.id, payload);

        const responseData = response.data || response;

        runInAction(() => {
          // Update nested state (which takes precedence in our logic)
          issue.running_time_log = {
            id: responseData.id,
            start_time: responseData.tracking_start_time,
          };
          // Also set flat keys to ensure complete sync
          issue.running_time_log_id = responseData.id;
          issue.running_time_log_start = responseData.tracking_start_time;
        });
      }
    } catch (error) {
      console.error("Timer Error:", error);
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="flex h-11 items-center border-b-[0.5px] border-subtle px-page-x group-[.selected-issue-row]:bg-accent-primary/5 group-[.selected-issue-row]:hover:bg-accent-primary/10">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTimer}
          disabled={disabled || isMutating}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            isRunning ? "border-red-500 bg-red-500/10 text-red-500" : "border-subtle text-secondary hover:bg-surface-1",
            (disabled || isMutating) && "cursor-not-allowed opacity-50"
          )}
          aria-label={isRunning ? "Stop timer" : "Start timer"}
        >
          {isRunning ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
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

        <span className={cn("text-sm tabular-nums", isRunning && "text-accent-primary")}>
          {formatDuration(displaySeconds)}
        </span>
      </div>

      {/* New Modal component */}
      <ManualTimeLogModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        workspaceSlug={workspaceSlug}
        issue={issue}
      />
    </div>
  );
});

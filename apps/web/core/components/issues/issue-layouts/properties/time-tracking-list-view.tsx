/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { Play, Pause, AlarmClockPlus } from "lucide-react";
// helpers
import { cn } from "@plane/utils";
// i18n
// ui
import { Tooltip } from "@plane/propel/tooltip";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// services
import { IssueService } from "@/services/issue";
// components
import { ManualTimeLogModal } from "./time-tracking-modal";

const issueService = new IssueService();

interface IIssueTimelogProperty {
  workspaceSlug: string;
  projectId: string;
  issue: any; // Passed directly from the list layout instead of using useIssueDetail
  disabled?: boolean;
  buttonVariant?: "border-with-text" | "border-without-text" | "transparent-without-text";
  renderByDefault?: boolean;
  className?: string;
}

const pad = (n: number) => n.toString().padStart(2, "0");

const formatDuration = (totalSeconds: number) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

export const IssueTimelogPropertyListView = observer(function IssueTimelogProperty(props: IIssueTimelogProperty) {
  const {
    workspaceSlug,
    projectId,
    issue,
    disabled,
    buttonVariant = "border-with-text",
    renderByDefault = true,
    className,
  } = props;

  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);

  // hooks
  const { isMobile } = usePlatformOS();

  // Extract ID and Start Time safely (Flat vs Nested)
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
    e.preventDefault();
    e.stopPropagation();

    if (!workspaceSlug || !projectId || !issue || disabled || isMutating) return;

    setIsMutating(true);
    try {
      if (isRunning && activeLogId) {
        // STOP TIMER
        const response = await issueService.stopTimeLog(workspaceSlug, projectId, issue.id, activeLogId);
        const responseData = response.data || response;

        runInAction(() => {
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
        const response = await issueService.startTimeLog(workspaceSlug, projectId, issue.id, payload);
        const responseData = response.data || response;

        runInAction(() => {
          issue.running_time_log = {
            id: responseData.id,
            start_time: responseData.tracking_start_time,
          };
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

  if (!issue) return null;

  const hideText = buttonVariant.includes("without-text");

  return (
    <>
      <Tooltip
        tooltipHeading={"Time Tracking"}
        tooltipContent={formatDuration(displaySeconds)}
        isMobile={isMobile}
        renderByDefault={renderByDefault}
      >
        <div
          className={cn(
            "flex h-full items-center gap-1.5 rounded-sm px-2 py-0.5",
            buttonVariant.includes("border")
              ? "border-[0.5px] border-strong bg-layer-2"
              : "hover:bg-layer-transparent-hover",
            isRunning && buttonVariant.includes("border") ? "border-accent-primary bg-accent-primary/10" : "",
            hideText && "px-1", // Compact if text is hidden
            className
          )}
        >
          <button
            type="button"
            onClick={toggleTimer}
            disabled={disabled || isMutating}
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-colors",
              isRunning ? "text-red-500 hover:bg-red-500/10" : "text-secondary hover:bg-surface-1 hover:text-primary",
              (disabled || isMutating) && "cursor-not-allowed opacity-50"
            )}
            aria-label={isRunning ? "Stop timer" : "Start timer"}
          >
            {isRunning ? (
              <Pause className="h-2.5 w-2.5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-2.5 w-2.5 fill-current" />
            )}
          </button>

          {!hideText && (
            <span
              className={cn(
                "flex-grow truncate text-body-xs-medium tabular-nums transition-colors",
                isRunning ? "text-accent-primary" : "text-secondary"
              )}
            >
              {formatDuration(displaySeconds)}
            </span>
          )}

          {!hideText && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsManualModalOpen(true);
              }}
              disabled={disabled}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-secondary transition-colors hover:bg-surface-1 hover:text-primary"
              title="Log time manually"
            >
              <AlarmClockPlus className="h-3 w-3" />
            </button>
          )}
        </div>
      </Tooltip>

      <ManualTimeLogModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        workspaceSlug={workspaceSlug}
        issue={issue}
      />
    </>
  );
});

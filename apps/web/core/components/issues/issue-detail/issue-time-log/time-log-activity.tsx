/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { Clock, Pencil, Trash2 } from "lucide-react";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// services
import { IssueService } from "@/services/issue";
// UI wrapper
import { Button } from "@plane/propel/button";
import { EModalWidth, Input, ModalCore } from "@plane/ui";
import { renderFormattedTime, renderFormattedDate } from "@plane/utils";

const issueService = new IssueService();

type TIssueTimeLogFeed = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

// Formats seconds into "1h 4m 5s"
const formatDuration = (totalSeconds: number) => {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return "0s";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
};

// Formats date based on Today vs Older
// Formats date based on Today vs Older (Forces AM/PM)
const formatLogDate = (dateString: string | null | undefined) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const today = new Date();

  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return isToday ? renderFormattedTime(date, "12-hour") : renderFormattedDate(date);
};

const parseTimeToSeconds = (str: string) => {
  let totalSeconds = 0;
  const hMatch = str.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*h/i);
  const mMatch = str.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*m/i);
  const sMatch = str.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*s/i);

  if (hMatch) totalSeconds += parseFloat(hMatch[1]) * 3600;
  if (mMatch) totalSeconds += parseFloat(mMatch[1]) * 60;
  if (sMatch) totalSeconds += parseFloat(sMatch[1]);
  if (!hMatch && !mMatch && !sMatch && !isNaN(Number(str)) && str.trim() !== "") {
    totalSeconds += Number(str) * 60;
  }
  return Math.floor(totalSeconds);
};

export const StandaloneTimeLogFeed = observer(function StandaloneTimeLogFeed(props: TIssueTimeLogFeed) {
  const { workspaceSlug, projectId, issueId } = props;

  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logToEdit, setLogToEdit] = useState<any | null>(null); // State for the edit modal

  const { getUserDetails } = useMember();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const issue = getIssueById(issueId);

  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      try {
        const response = await issueService.getTimeLogs(workspaceSlug, projectId, issueId);
        const data = response?.data || response || [];
        if (isMounted) setTimeLogs(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch time logs", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchLogs();
    return () => {
      isMounted = false;
    };
  }, [workspaceSlug, projectId, issueId]);

  const handleDelete = async (logId: string, timeSeconds: number) => {
    const isConfirmed = window.confirm("Are you sure you want to delete this time log?");
    if (!isConfirmed) return;

    try {
      await issueService.deleteTimeLog(workspaceSlug, projectId, issueId, logId);
      // Remove from local UI state
      setTimeLogs((prev) => prev.filter((log) => log.id !== logId));

      // Safely subtract time from the main issue store
      if (issue && issue.total_tracked_seconds !== undefined) {
        runInAction(() => {
          issue.total_tracked_seconds = Math.max(0, issue.total_tracked_seconds! - timeSeconds);
        });
      }
    } catch (error) {
      console.error("Failed to delete time log", error);
    }
  };

  if (isLoading || timeLogs.length === 0) return null;

  return (
    <div className="space-y-4 pt-6">
      <div className="text-h6 text-custom-text-100 mb-4 font-medium">Time Logs</div>

      <div className="flex flex-col">
        {timeLogs.map((log, index) => {
          // Hide currently running timers from the history list
          if (log.tracking_start_time && !log.tracking_end_time) return null;

          const user = getUserDetails(log.created_by);
          const userName = user?.display_name || "Unknown user";
          const isLast = index === timeLogs.length - 1;

          return (
            <div key={log.id} className="group relative flex gap-3">
              {/* Timeline connecting line */}
              {!isLast && <div className="bg-subtle absolute top-6 bottom-[-8px] left-[11px] z-0 w-[2px]" />}

              {/* Timeline Icon */}
              <div className="relative z-10 mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-subtle bg-surface-1">
                <Clock className="h-3.5 w-3.5 text-secondary" />
              </div>

              {/* Content and Actions container */}
              <div className="flex flex-grow justify-between pb-4">
                <span className="text-sm text-custom-text-200 leading-6">
                  <span className="text-custom-text-100 font-medium">{userName}</span> recorded{" "}
                  <span className="text-custom-text-100 font-medium">{formatDuration(log.time_seconds)}</span>
                  {/* Case 2: Timer log */}
                  {log.tracking_start_time && log.tracking_end_time ? (
                    <>
                      {" "}
                      from{" "}
                      <span className="text-custom-text-100 font-medium">
                        {formatLogDate(log.tracking_start_time)}
                      </span>{" "}
                      to{" "}
                      <span className="text-custom-text-100 font-medium">{formatLogDate(log.tracking_end_time)}</span>
                    </>
                  ) : (
                    /* Case 1: Manual log */
                    <>
                      {" "}
                      at <span className="text-custom-text-100 font-medium">{formatLogDate(log.created_at)}</span>
                    </>
                  )}
                </span>

                {/* Actions (Hidden by default, shown on hover via 'group-hover') */}
                <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setLogToEdit(log)}
                    className="hover:text-custom-text-100 hover:bg-surface-3 flex h-6 w-6 items-center justify-center rounded border border-subtle bg-surface-2 text-secondary transition-colors"
                    title="Edit log"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(log.id, log.time_seconds)}
                    className="text-red-500 hover:bg-red-500/10 flex h-6 w-6 items-center justify-center rounded border border-subtle bg-surface-2 transition-colors"
                    title="Delete log"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* The Edit Modal */}
      {logToEdit && (
        <EditTimeLogModal
          isOpen={!!logToEdit}
          onClose={() => setLogToEdit(null)}
          logData={logToEdit}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issue={issue}
          onSuccess={(updatedLog: any) => {
            // Update the UI list with the new data
            setTimeLogs((prev) => prev.map((l) => (l.id === updatedLog.id ? updatedLog : l)));
            setLogToEdit(null);
          }}
        />
      )}
    </div>
  );
});

// --- EDIT MODAL COMPONENT ---
const EditTimeLogModal = ({ isOpen, onClose, logData, workspaceSlug, projectId, issue, onSuccess }: any) => {
  const [timeString, setTimeString] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill the input with the current duration when modal opens
  useEffect(() => {
    if (logData) {
      const h = Math.floor(logData.time_seconds / 3600);
      const m = Math.floor((logData.time_seconds % 3600) / 60);
      let prefill = "";
      if (h > 0) prefill += `${h}h `;
      if (m > 0) prefill += `${m}m`;
      setTimeString(prefill.trim() || `${logData.time_seconds}s`);
    }
  }, [logData]);

  const parsedSeconds = parseTimeToSeconds(timeString);

  const handleSubmit = async () => {
    if (parsedSeconds <= 0) return;
    setIsSubmitting(true);
    try {
      const response = await issueService.updateTimeLog(workspaceSlug, projectId, issue.id, logData.id, {
        time_seconds: parsedSeconds,
      });
      const responseData = response.data || response;

      // Update the main issue store total time
      if (issue && issue.total_tracked_seconds !== undefined) {
        runInAction(() => {
          const timeDifference = parsedSeconds - logData.time_seconds;
          issue.total_tracked_seconds = Math.max(0, issue.total_tracked_seconds! + timeDifference);
        });
      }
      onSuccess(responseData);
    } catch (error) {
      console.error("Failed to update time log", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} width={EModalWidth.MD}>
      <div className="flex flex-col gap-4 p-5">
        <h3 className="text-xl text-custom-text-100 font-medium">Edit Time Log</h3>
        <div>
          <Input
            type="text"
            placeholder="e.g. 1h 30m"
            value={timeString}
            onChange={(e) => setTimeString(e.target.value)}
            className="w-full"
          />
          <div className="text-xs text-custom-text-300 mt-2 flex items-center justify-between">
            <span>
              Use <strong>h</strong>, <strong>m</strong>, and <strong>s</strong>
            </span>
            {parsedSeconds > 0 && (
              <span className="text-accent-primary">New duration: {formatDuration(parsedSeconds)}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t-[0.5px] border-subtle px-5 py-4">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={parsedSeconds <= 0 || isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </ModalCore>
  );
};

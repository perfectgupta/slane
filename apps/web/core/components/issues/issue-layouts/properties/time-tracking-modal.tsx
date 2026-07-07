import { IssueService } from "@/services/issue";
import { Button } from "@plane/propel/button";
import type { TIssue } from "@plane/types";
import { EModalWidth, Input, ModalCore } from "@plane/ui";
import { runInAction } from "mobx";
import { useState } from "react";

const issueService = new IssueService();

interface ManualTimeLogModalProperty {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  issue?: TIssue & {
    // Add these flat keys to the type definition locally just in case
    running_time_log_id?: string | null;
    running_time_log_start?: string | null;
  };
}

// Smart parser for strings like "1h 30m" or "45m"
const parseTimeToSeconds = (str: string) => {
  let totalSeconds = 0;
  const hMatch = str.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*h/i);
  const mMatch = str.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*m/i);
  const sMatch = str.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*s/i);

  if (hMatch) totalSeconds += parseFloat(hMatch[1]) * 3600;
  if (mMatch) totalSeconds += parseFloat(mMatch[1]) * 60;
  if (sMatch) totalSeconds += parseFloat(sMatch[1]);

  // Fallback: If they just type a number (e.g., "30"), default to minutes
  if (!hMatch && !mMatch && !sMatch && !isNaN(Number(str)) && str.trim() !== "") {
    totalSeconds += Number(str) * 60;
  }

  return Math.floor(totalSeconds);
};

export const ManualTimeLogModal = ({ isOpen, onClose, workspaceSlug, issue }: ManualTimeLogModalProperty) => {
  const [timeString, setTimeString] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedSeconds = parseTimeToSeconds(timeString);

  const handleSubmit = async () => {
    if (!issue || !issue.project_id) {
      return;
    }

    if (parsedSeconds <= 0) return;

    setIsSubmitting(true);
    try {
      await issueService.startTimeLog(workspaceSlug, issue?.project_id, issue.id, {
        time_seconds: parsedSeconds,
      });

      // Update the MobX store immediately so the UI ticks up without refreshing
      runInAction(() => {
        issue.total_tracked_seconds = (issue.total_tracked_seconds ?? 0) + parsedSeconds;
      });

      setTimeString(""); // reset input
      onClose();
    } catch (error) {
      console.error("Failed to log time manually", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} width={EModalWidth.MD} key={issue?.id}>
      <div className="flex flex-col gap-4 p-5">
        <h3 className="text-xl text-custom-text-100 font-medium">Log Time</h3>

        <div>
          <Input
            type="text"
            placeholder="e.g. 1h 30m"
            value={timeString}
            onChange={(e) => setTimeString(e.target.value.replace('"', ""))}
            className="w-full"
          />
          <div className="text-custom-text-300 mt-4 flex items-center justify-between text-14">
            <span>
              Use <strong>h</strong>, <strong>m</strong>, and <strong>s</strong>. Example "1h", "1h 30m"
            </span>
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

/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  CornerDownLeft,
  CornerDownRight,
  RefreshCcw,
  Sparkles,
  TriangleAlert,
  Wand2,
  X,
} from "lucide-react";
// plane editor
import type { EditorRefApi } from "@plane/editor";
// plane ui
import { Button } from "@plane/propel/button";
import { Tooltip } from "@plane/propel/tooltip";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input } from "@plane/ui";
// components
import { RichTextEditor } from "@/components/editor/rich-text";
// plane web services
import { AIService } from "@/services/ai.service";

const aiService = new AIService();

type Props = {
  editorRef: EditorRefApi | null;
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceSlug: string;
  pageTitle?: string;
};

// Quick Actions Configuration
const QUICK_ACTIONS = [
  {
    key: "summarize",
    label: "Summarize",
    icon: BookOpen,
    instruction: "Summarize the following text clearly and concisely.",
  },
  {
    key: "fix_grammar",
    label: "Fix Grammar",
    icon: Wand2,
    instruction: "Fix all spelling and grammar issues in the text, keeping the original tone.",
  },
  {
    key: "make_shorter",
    label: "Make Shorter",
    icon: ArrowDownToLine,
    instruction: "Make the text shorter and more direct.",
  },
  {
    key: "make_longer",
    label: "Make Longer",
    icon: ArrowUpFromLine,
    instruction: "Expand on the text and make it more detailed.",
  },
];

export function EditorAIMenu(props: Props) {
  const { editorRef, isOpen, onClose, workspaceId, workspaceSlug, pageTitle } = props;

  // States
  const [customPrompt, setCustomPrompt] = useState("");
  const [response, setResponse] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectionContext, setSelectionContext] = useState<string>("");

  // Track last payload for regeneration
  const [lastTaskParams, setLastTaskParams] = useState<{
    task: string;
    prompt: string;
  } | null>(null);

  // Refs
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize selection on open
  useEffect(() => {
    if (isOpen) {
      const text = editorRef?.getSelectedText() || "";
      setSelectionContext(text);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setCustomPrompt("");
      setResponse(undefined);
      setIsGenerating(false);
      setLastTaskParams(null);
    }
  }, [isOpen, editorRef]);

  // Handle outside click and Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Core API Caller: EXCLUSIVELY uses createGptTask
  const callAIAssistant = async (instruction: string, contextString: string) => {
    if (!workspaceSlug) return;

    setIsGenerating(true);
    setResponse(undefined);
    setLastTaskParams({ task: instruction, prompt: contextString });

    try {
      // 1. Trigger the specific createGptTask endpoint
      const res = await aiService.createGptTask(workspaceSlug.toString(), {
        prompt: contextString || "",
        task: instruction,
      });

      // 2. Safely extract response (prefer HTML if your API returns it, fallback to raw response)
      const finalResponse = res.response_html || res.response;

      if (!finalResponse || finalResponse === "") {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Error!",
          message: "No response could be generated. This may be due to insufficient context.",
        });
      } else {
        setResponse(finalResponse);
      }
    } catch (err: any) {
      const errorMsg =
        err?.status === 429
          ? err?.data?.error || "You have reached the maximum number of requests."
          : err?.data?.error || "Failed to generate AI response. Please try again.";

      setToast({
        type: TOAST_TYPE.ERROR,
        title: "AI Error",
        message: errorMsg,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper: Get best available text context
  const getContextString = () => {
    const editorContent = (editorRef as any)?.getEditorText?.() || "";

    // Priority: Highlighted Text -> Full Editor Text -> Page Title
    return selectionContext || editorContent || (pageTitle ? `Document Title: ${pageTitle}` : "");
  };

  // Handle Quick Action Click
  const handleQuickAction = (instruction: string) => {
    const contextStr = getContextString();

    if (!contextStr.trim()) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Editor is empty",
        message: "Please write or select some text to use quick actions.",
      });
      return;
    }

    callAIAssistant(instruction, contextStr);
  };

  // Handle Custom Prompt Submit
  const handleCustomSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!customPrompt.trim()) return;

    callAIAssistant(customPrompt, getContextString());
  };

  // Handle Re-generate
  const handleRegenerate = () => {
    if (lastTaskParams) {
      callAIAssistant(lastTaskParams.task, lastTaskParams.prompt);
    }
  };

  // Handle Insertion
  // Handle Insertion
  const handleInsertText = (insertOnNextLine: boolean) => {
    if (!response) return;

    if (selectionContext) {
      // Replace or insert below specific highlighted text
      editorRef?.insertText(response, insertOnNextLine);
    } else {
      // If no text was highlighted, cleanly append to the bottom of the document
      editorRef?.insertAtBottom?.(response);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="bg-custom-backdrop/20 fixed inset-0 z-9999 flex items-center justify-center backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="shadow-2xl flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-subtle bg-surface-1">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle bg-surface-2 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-accent-primary/10 text-accent-primary">
              <Sparkles className="size-3.5" />
            </span>
            <span className="text-14 font-semibold text-primary">AI Assistant</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-layer-1 hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="vertical-scrollbar flex max-h-[500px] flex-col overflow-y-auto px-5 py-4">
          {/* Selected Text Context Indicator */}
          {selectionContext && !response && !isGenerating && (
            <div className="mb-5 rounded-lg border border-subtle bg-surface-2 p-3 text-13">
              <span className="mb-1 block text-11 font-medium tracking-wide text-tertiary uppercase">Context</span>
              <p className="line-clamp-3 text-secondary italic">"{selectionContext}"</p>
            </div>
          )}

          {/* Initial State: Quick Actions */}
          {!response && !isGenerating && (
            <div className="mb-2">
              <span className="mb-3 block text-12 font-medium tracking-wide text-tertiary uppercase">
                Quick Actions
              </span>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => handleQuickAction(action.instruction)}
                    className="flex items-center gap-3 rounded-lg border border-subtle bg-surface-1 p-3 text-left transition-all hover:border-strong hover:bg-surface-2"
                  >
                    <span className="flex size-8 items-center justify-center rounded-md bg-layer-1 text-secondary">
                      <action.icon className="size-4" />
                    </span>
                    <span className="text-13 font-medium text-primary">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-10 text-secondary">
              <RefreshCcw className="mb-3 size-6 animate-spin text-accent-primary" />
              <p className="text-13 font-medium text-primary">Pi is writing...</p>
            </div>
          )}

          {/* Response State */}
          {response && !isGenerating && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="rounded-lg border border-subtle bg-surface-2 p-4">
                <span className="mb-2 flex items-center gap-1.5 text-11 font-medium tracking-wide text-accent-primary uppercase">
                  <Sparkles className="size-3.5" />
                  Response
                </span>
                <div className="text-13">
                  <RichTextEditor
                    displayConfig={{ fontSize: "small-font" }}
                    editable={false}
                    id="editor-ai-response"
                    initialValue={response}
                    containerClassName="!p-0 border-none bg-transparent"
                    editorClassName="!pl-0"
                    workspaceId={workspaceId}
                    workspaceSlug={workspaceSlug}
                  />
                </div>
              </div>

              {/* Insertion Actions */}
              <div className="mt-4 flex items-center justify-end gap-3">
                <Button variant="primary" size="sm" onClick={handleRegenerate}>
                  <RefreshCcw className="mr-1.5 size-3.5" />
                  Regenerate
                </Button>
                {selectionContext && (
                  <Button variant="primary" size="sm" onClick={() => handleInsertText(false)}>
                    Replace selection
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={() => handleInsertText(true)}>
                  <CornerDownRight className="mr-1.5 size-3.5" />
                  {selectionContext ? "Insert below" : "Insert at bottom"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Input Footer */}
        <div className="border-t border-subtle bg-surface-1 p-4">
          <form onSubmit={handleCustomSubmit} className="relative flex items-center gap-3">
            <Input
              ref={inputRef}
              id="ai-custom-prompt"
              name="prompt"
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={
                selectionContext ? "Tell AI what action to perform on this content..." : "Ask AI anything..."
              }
              className="w-full pr-12 pl-3 text-13"
              disabled={isGenerating}
            />
            <Tooltip tooltipContent="Send to AI">
              <button
                type="submit"
                disabled={!customPrompt.trim() || isGenerating}
                className="absolute right-2 grid size-7 place-items-center rounded bg-accent-primary text-white transition-opacity disabled:opacity-50"
              >
                <CornerDownLeft className="size-3.5" />
              </button>
            </Tooltip>
          </form>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-11 text-tertiary">
              <TriangleAlert className="size-3" />
              <span>By using this feature, you consent to sharing content with a 3rd party service.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

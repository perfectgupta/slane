/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Ref } from "react";
import React, { useEffect, useState, useRef, Fragment } from "react";
import type { Placement } from "@popperjs/core";
import { Controller, useForm } from "react-hook-form"; // services
import { usePopper } from "react-popper";
import { AlertCircle, Sparkles, X, ArrowUpRight, CornerDownLeft } from "lucide-react";
import { Popover, Transition } from "@headlessui/react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input } from "@plane/ui";
// components
import { RichTextEditor } from "@/components/editor/rich-text";
// services
import { AIService } from "@/services/ai.service";
const aiService = new AIService();

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  onResponse: (response: any) => void;
  onError?: (error: any) => void;
  placement?: Placement;
  prompt?: string;
  button: React.ReactNode;
  className?: string;
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
};

type FormData = {
  prompt: string;
  task: string;
};

export function GptAssistantPopover(props: Props) {
  const {
    isOpen,
    handleClose,
    onResponse,
    onError,
    placement,
    prompt,
    button,
    className = "",
    workspaceId,
    workspaceSlug,
    projectId,
  } = props;
  // states
  const [response, setResponse] = useState("");
  const [invalidResponse, setInvalidResponse] = useState(false);
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  const responseRef = useRef<EditorRefApi>(null);
  // popper
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: placement ?? "auto",
  });
  // form
  const {
    handleSubmit,
    control,
    reset,
    setFocus,
    formState: { isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      prompt: prompt || "",
      task: "",
    },
  });

  const onClose = () => {
    handleClose();
    setResponse("");
    setInvalidResponse(false);
    reset();
  };

  const handleServiceError = (err: any) => {
    const error = err?.data?.error;
    const errorMessage =
      err?.status === 429
        ? error || "You have reached the maximum number of requests of 50 requests per month per user."
        : error || "Some error occurred. Please try again.";

    setToast({
      type: TOAST_TYPE.ERROR,
      title: "Error!",
      message: errorMessage,
    });

    if (onError) onError(err);
  };

  const callAIService = async (formData: FormData) => {
    try {
      const res = await aiService.createGptTask(workspaceSlug.toString(), {
        prompt: prompt || "",
        task: formData.task,
      });

      setResponse(res.response_html);
      setFocus("task");

      setInvalidResponse(res.response === "");
    } catch (err) {
      handleServiceError(err);
    }
  };

  const handleInvalidTask = () => {
    setToast({
      type: TOAST_TYPE.ERROR,
      title: "Error!",
      message: "Please enter some task to get AI assistance.",
    });
  };

  const handleAIResponse = async (formData: FormData) => {
    if (!workspaceSlug) return;

    if (formData.task === "") {
      handleInvalidTask();
      return;
    }

    await callAIService(formData);
  };

  useEffect(() => {
    if (isOpen) setFocus("task");
  }, [isOpen, setFocus]);

  useEffect(() => {
    editorRef.current?.setEditorValue(prompt || "");
  }, [editorRef, prompt]);

  useEffect(() => {
    responseRef.current?.setEditorValue(`<p>${response}</p>`);
  }, [response, responseRef]);

  useEffect(() => {
    const handleEnterKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit(handleAIResponse)();
      }
    };

    const handleEscapeKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEnterKeyPress);
      window.addEventListener("keydown", handleEscapeKeyPress);
    }

    return () => {
      window.removeEventListener("keydown", handleEnterKeyPress);
      window.removeEventListener("keydown", handleEscapeKeyPress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, handleSubmit, onClose]);

  const generateResponseButtonText = isSubmitting ? "Generating..." : response === "" ? "Generate" : "Generate again";

  return (
    <Popover as="div" className="relative w-min text-left">
      <Popover.Button as={Fragment}>
        <button ref={setReferenceElement} className="flex items-center" tabIndex={-1}>
          {button}
        </button>
      </Popover.Button>
      <Transition
        show={isOpen}
        as={React.Fragment}
        enter="transition ease-out duration-150"
        enterFrom="transform opacity-0 scale-95 translate-y-1"
        enterTo="transform opacity-100 scale-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Popover.Panel
          as="div"
          className={`shadow-xl fixed z-10 flex w-full max-w-full min-w-[34rem] flex-col overflow-hidden rounded-xl border border-subtle bg-surface-1 ${className}`}
          ref={setPopperElement as Ref<HTMLDivElement>}
          style={styles.popper}
          {...attributes.popper}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-primary/10 text-accent-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-13 font-semibold text-primary">AI Assistant</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-surface-2 hover:text-primary"
              aria-label="Close AI assistant"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="vertical-scroll-enable flex max-h-72 flex-col gap-3 overflow-y-auto px-4 pt-3">
            {prompt && (
              <div className="text-13">
                <span className="mb-1 block text-12 font-medium tracking-wide text-tertiary uppercase">Content</span>
                <RichTextEditor
                  editable={false}
                  id="ai-assistant-content"
                  initialValue={prompt}
                  containerClassName="-m-3"
                  ref={editorRef}
                  workspaceId={workspaceId}
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                />
              </div>
            )}

            <Transition
              show={response !== ""}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 -translate-y-1"
              enterTo="opacity-100 translate-y-0"
            >
              <div className="rounded-lg border border-subtle bg-surface-2 p-3 text-13">
                <span className="mb-1 flex items-center gap-1 text-12 font-medium tracking-wide text-accent-primary uppercase">
                  <Sparkles className="h-3 w-3" />
                  Response
                </span>
                <RichTextEditor
                  editable={false}
                  id="ai-assistant-response"
                  initialValue={`<p>${response}</p>`}
                  ref={responseRef}
                  workspaceId={workspaceId}
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                />
              </div>
            </Transition>

            {invalidResponse && (
              <div className="border-danger-primary/20 flex items-start gap-2 rounded-lg border bg-danger-primary/5 p-3 text-13 text-danger-primary">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>No response could be generated. This may be due to insufficient content or task information.</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4 pt-3">
            <Controller
              control={control}
              name="task"
              render={({ field: { value, onChange, ref } }) => (
                <Input
                  id="task"
                  name="task"
                  type="text"
                  value={value}
                  onChange={onChange}
                  ref={ref}
                  placeholder={
                    prompt && prompt !== "" ? "Tell AI what action to perform on this content..." : "Ask AI anything..."
                  }
                  className="w-full"
                />
              )}
            />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-12 text-tertiary">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Shared with a 3rd party AI service.</span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {response !== "" ? (
                  <Button variant="primary" onClick={handleSubmit(handleAIResponse)} loading={isSubmitting} size="sm">
                    {generateResponseButtonText}
                  </Button>
                ) : (
                  <Button variant="primary" onClick={handleSubmit(handleAIResponse)} loading={isSubmitting} size="sm">
                    <span className="flex items-center gap-1.5">
                      {generateResponseButtonText}
                      {!isSubmitting && <CornerDownLeft className="h-3.5 w-3.5" />}
                    </span>
                  </Button>
                )}
                {response !== "" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      onResponse(response);
                      onClose();
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      Use this response
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}

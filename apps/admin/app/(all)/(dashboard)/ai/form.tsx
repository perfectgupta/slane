/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useForm } from "react-hook-form";
import { Lightbulb } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration, TInstanceAIConfigurationKeys } from "@plane/types";
// components
import { ControllerInput } from "@/components/common/controller-input";
// hooks
import { useInstance } from "@/hooks/store";

type IInstanceAIForm = {
  config: IFormattedInstanceConfiguration;
};

type AIFormValues = Record<TInstanceAIConfigurationKeys, string>;

// Simplified to just handle the provider selection list
const PROVIDERS: Record<string, string> = {
  ollama: "Ollama",
  anthropic: "Anthropic",
  gemini: "Gemini",
  groq: "Groq",
};

export function InstanceAIForm(props: IInstanceAIForm) {
  const { config } = props;
  // store
  const { updateInstanceConfigurations } = useInstance();

  // form data
  const {
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AIFormValues>({
    defaultValues: {
      LLM_PROVIDER: config["LLM_PROVIDER"] || "ollama",
      LLM_MODEL: config["LLM_MODEL"] || "gemma4:31b",
      LLM_API_KEY: config["LLM_API_KEY"] || "",
    },
  });

  const selectedProvider = watch("LLM_PROVIDER") || "ollama";

  const onSubmit = async (formData: AIFormValues) => {
    const payload: Partial<AIFormValues> = { ...formData };

    await updateInstanceConfigurations(payload)
      .then(() =>
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Success",
          message: "AI Settings updated successfully",
        })
      )
      .catch((err) => console.error(err));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <div className="pb-1 text-18 font-medium text-primary">LLM Integration</div>
          <div className="text-13 font-regular text-tertiary">Configure your global instance LLM provider.</div>
        </div>

        <div className="grid w-full grid-cols-1 items-start gap-x-12 gap-y-8 lg:grid-cols-3">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-13 font-medium text-secondary">LLM Provider</label>
            <select
              {...control.register("LLM_PROVIDER")}
              className="border-custom-border-200 bg-custom-background-100 text-sm focus:border-accent-primary h-10 w-full rounded border px-3 focus:outline-none"
            >
              {Object.entries(PROVIDERS).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
            <div className="text-xs text-tertiary">Select the model framework provider.</div>
          </div>

          {/* Text Input for Model */}
          <ControllerInput
            control={control}
            type="text"
            name="LLM_MODEL"
            label="LLM Model"
            description="Enter the specific model ID (e.g., gpt-4o, llama3-8b-8192)."
            placeholder="gemma4:31b"
            error={Boolean(errors.LLM_MODEL)}
            required={true}
          />

          {/* API Key Input Field */}
          <ControllerInput
            control={control}
            type="password"
            name="LLM_API_KEY"
            label="API Key"
            description="Enter the secure API authorization key matching your selected provider."
            placeholder={selectedProvider === "ollama" ? "Not required for default local setups" : "sk-..."}
            error={Boolean(errors.LLM_API_KEY)}
            required={selectedProvider !== "ollama"}
          />
        </div>
      </div>

      <div className="flex flex-col items-start gap-4">
        <Button variant="primary" size="lg" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
          {isSubmitting ? "Saving" : "Save changes"}
        </Button>

        <div className="relative inline-flex items-center gap-1.5 rounded-sm border border-accent-subtle bg-accent-subtle px-4 py-2 text-caption-sm-regular text-accent-secondary">
          <Lightbulb className="size-4" />
          <div>
            If you have a preferred AI models vendor, please get in{" "}
            <a className="font-medium underline" href="https://plane.so/contact">
              touch with us.
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

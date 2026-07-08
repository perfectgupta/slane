import { useRef, useState } from "react";
import { Combobox } from "@headlessui/react";

import { CheckIcon, SearchIcon, ChevronDownIcon } from "@plane/propel/icons";
import { ComboDropDown } from "@plane/ui";
import { cn } from "@plane/utils";
import { usePopper } from "react-popper";
import { useDropdown } from "@/hooks/use-dropdown";

const PROVIDERS = [
  { value: "ollama", label: "Ollama" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
  { value: "groq", label: "Groq" },
];

// ----------------------------------------------------------------------------
// Custom Combobox Dropdown for LLM Provider
// ----------------------------------------------------------------------------
export function LLMProviderDropdown({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "bottom-start",
    modifiers: [
      {
        name: "preventOverflow",
        options: { padding: 12 },
      },
    ],
  });

  const { handleClose, handleKeyDown, handleOnClick, searchInputKeyDown } = useDropdown({
    dropdownRef,
    inputRef,
    isOpen,
    onClose: () => setQuery(""),
    onOpen: () => {},
    query,
    setIsOpen,
    setQuery,
  });

  const dropdownOnChange = (val: string | undefined) => {
    if (val) {
      onChange(val);
      handleClose();
    }
  };

  const filteredOptions =
    query === ""
      ? PROVIDERS
      : PROVIDERS.filter((provider) => provider.label.toLowerCase().includes(query.toLowerCase()));

  const selectedProvider = PROVIDERS.find((p) => p.value === value);

  const comboButton = (
    <button
      ref={setReferenceElement}
      type="button"
      className={cn(
        "border-custom-border-200 bg-custom-background-100 text-sm focus:border-accent-primary flex h-10 w-full items-center justify-between rounded border px-3 focus:outline-none",
        {
          "cursor-not-allowed text-secondary opacity-50": disabled,
          "cursor-pointer": !disabled,
        }
      )}
      onClick={handleOnClick}
      disabled={disabled}
    >
      <span className="truncate" role="label">
        {selectedProvider ? selectedProvider.label : "Select Provider"}
      </span>
      <ChevronDownIcon className="h-4 w-4 flex-shrink-0 text-secondary" aria-hidden="true" />
    </button>
  );

  return (
    <ComboDropDown
      as="div"
      ref={dropdownRef}
      className="w-full"
      value={value}
      onChange={dropdownOnChange}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      button={comboButton}
    >
      {isOpen && (
        <Combobox.Options className="fixed z-10" static>
          <div
            className="text-sm my-1 w-full min-w-[240px] rounded-sm border-[0.5px] border-strong bg-surface-1 px-2 py-2.5 shadow-raised-200 focus:outline-none"
            ref={setPopperElement}
            style={styles.popper}
            {...attributes.popper}
          >
            <div className="flex items-center gap-1.5 rounded-sm border border-subtle bg-surface-2 px-2">
              <SearchIcon className="h-3.5 w-3.5 text-placeholder" strokeWidth={1.5} />
              <Combobox.Input
                as="input"
                ref={inputRef}
                className="text-sm w-full bg-transparent py-1.5 text-secondary placeholder:text-placeholder focus:outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search providers..."
                onKeyDown={searchInputKeyDown}
              />
            </div>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <Combobox.Option key={option.value} value={option.value}>
                    {({ active, selected }) => (
                      <div
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-2 py-1.5 select-none",
                          {
                            "bg-layer-transparent-hover": active,
                            "text-primary": selected,
                            "text-secondary": !selected,
                          }
                        )}
                      >
                        <span className="flex-grow truncate">{option.label}</span>
                        {selected && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                      </div>
                    )}
                  </Combobox.Option>
                ))
              ) : (
                <p className="text-sm px-2 py-1 text-placeholder italic">No matching providers</p>
              )}
            </div>
          </div>
        </Combobox.Options>
      )}
    </ComboDropDown>
  );
}

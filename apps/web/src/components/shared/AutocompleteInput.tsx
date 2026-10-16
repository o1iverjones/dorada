import { useState, useRef, useEffect } from "react";
import { Input } from "../ui/input.js";

interface Option {
  value: string;
  label: string;
}

interface AutocompleteInputProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onLabelChange?: (label: string) => void;
  /** Called with the raw input text so the parent can do server-side filtering */
  onSearchChange?: (text: string) => void;
  placeholder?: string;
  /** If true, the stored value is the label text itself (free-text fields like referring physician) */
  freeText?: boolean;
}

export function AutocompleteInput({ options, value, onChange, onSearchChange, placeholder, freeText = false }: AutocompleteInputProps) {
  const selectedLabel = freeText ? value : (options.find((o) => o.value === value)?.label ?? "");
  const [inputText, setInputText] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTypingRef = useRef(false);

  // Keep input text in sync when value changes externally (e.g. form reset, prefill)
  // but NOT while the user is actively typing — otherwise incoming search results reset the input
  useEffect(() => {
    if (isTypingRef.current) return;
    setInputText(freeText ? value : (options.find((o) => o.value === value)?.label ?? ""));
  }, [value, freeText, options]);

  // Close on outside click and clear typing flag
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        isTypingRef.current = false;
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = onSearchChange
    ? options
    : inputText.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(inputText.toLowerCase()))
      : options;

  function handleInputChange(text: string) {
    isTypingRef.current = true;
    setInputText(text);
    setOpen(true);
    onSearchChange?.(text);
    if (freeText) onChange(text);
    else if (!text) onChange("");
  }

  function handleSelect(opt: Option) {
    isTypingRef.current = false;
    setInputText(opt.label);
    onChange(freeText ? opt.label : opt.value);
    setOpen(false);
  }

  function handleBlur() {
    isTypingRef.current = false;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      isTypingRef.current = false;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={inputText}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {filtered.map((opt) => (
            <li
              key={opt.value}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
                (freeText ? inputText : value) === (freeText ? opt.label : opt.value)
                  ? "bg-accent font-medium"
                  : ""
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

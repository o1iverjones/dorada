import { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button.js";

const SUGGESTIONS = [
  "Agendada y Asignada",
  "Autorizada",
  "Invoiced",
  "LC no follow up",
  "LC no show",
  "confirmada con la clinica",
  "Email - Autorization pending",
  "NO ASIGNAR SIN AUTO",
  "PRIVADO NO Follow up",
];

interface NoteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  placeholder?: string;
  maxLength?: number;
  saveLabel?: string;
}

export function NoteInput({ value, onChange, onSave, isSaving, placeholder, maxLength = 800, saveLabel = "Save" }: NoteInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const matches = value.trim()
    ? SUGGESTIONS.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : SUGGESTIONS;

  const showDropdown = open && matches.length > 0;

  function select(suggestion: string) {
    onChange(suggestion);
    setOpen(false);
    setActiveIndex(-1);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(matches[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIndex(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          rows={3}
          placeholder={placeholder}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {showDropdown && (
          <ul className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-md border bg-popover shadow-md">
            {matches.map((s, i) => (
              <li
                key={s}
                onMouseDown={(e) => { e.preventDefault(); select(s); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{value.length}/{maxLength}</span>
        <Button size="sm" disabled={!value.trim() || isSaving} onClick={onSave}>{saveLabel}</Button>
      </div>
    </div>
  );
}

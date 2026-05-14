import { useState, useRef, useEffect } from "react";
import { Input } from "../ui/input.js";

const PRESETS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
];

/** Convert a minutes value to its display label (preset label or "X min" fallback). */
function minutesToLabel(mins: number): string {
  const preset = PRESETS.find((p) => p.minutes === mins);
  if (preset) return preset.label;
  if (mins % 60 === 0) return `${mins / 60} hour${mins / 60 !== 1 ? "s" : ""}`;
  return `${mins} min`;
}

/**
 * Parse a free-text duration string into minutes.
 * Handles: "15 min", "2 hours", "1h", "1h30m", "90", "1:30", "1.5 hours" etc.
 * Returns null if not parseable.
 */
function parseToMinutes(text: string): number | null {
  const s = text.trim().toLowerCase();
  if (!s) return null;

  // "1:30" or "1:05"
  const colonMatch = s.match(/^(\d+):(\d{2})$/);
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);

  // "1h30m", "1h 30m", "1h30"
  const hm = s.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs|our|ours)?\s*(\d+)?\s*m?$/);
  if (hm) {
    const hours = parseFloat(hm[1]);
    const extraMins = hm[2] ? parseInt(hm[2]) : 0;
    return Math.round(hours * 60) + extraMins;
  }

  // "2 hours", "1.5 hour", "1h"
  const hourOnly = s.match(/^(\d+(?:\.\d+)?)\s*(?:h(?:r|rs|our|ours)?)$/);
  if (hourOnly) return Math.round(parseFloat(hourOnly[1]) * 60);

  // "90 min", "45 mins", "45 minutes"
  const minOnly = s.match(/^(\d+(?:\.\d+)?)\s*(?:m(?:in|ins|inutes?)?)$/);
  if (minOnly) return Math.round(parseFloat(minOnly[1]));

  // plain number → minutes
  const plain = s.match(/^(\d+)$/);
  if (plain) return parseInt(plain[1]);

  return null;
}

interface DurationInputProps {
  /** Current value in minutes */
  value: number;
  /** Called with the new value in minutes */
  onChange: (minutes: number) => void;
  className?: string;
}

export function DurationInput({ value, onChange, className }: DurationInputProps) {
  const [text, setText] = useState(() => minutesToLabel(value));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep display in sync when value changes externally (e.g. form reset / prefill)
  useEffect(() => {
    setText(minutesToLabel(value));
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = text.trim()
    ? PRESETS.filter((p) => p.label.toLowerCase().includes(text.toLowerCase()))
    : PRESETS;

  function commit(raw: string) {
    const mins = parseToMinutes(raw);
    if (mins != null && mins >= 5) {
      onChange(mins);
      setText(minutesToLabel(mins));
    } else {
      // Revert to last valid value
      setText(minutesToLabel(value));
    }
  }

  function handleSelect(preset: (typeof PRESETS)[number]) {
    setText(preset.label);
    onChange(preset.minutes);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <Input
        value={text}
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          // Small delay so onMouseDown on a list item fires first
          setTimeout(() => {
            commit(e.target.value);
            setOpen(false);
          }, 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="e.g. 2 hours"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {filtered.map((preset) => (
            <li
              key={preset.minutes}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(preset);
              }}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
                value === preset.minutes ? "bg-accent font-medium" : ""
              }`}
            >
              {preset.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

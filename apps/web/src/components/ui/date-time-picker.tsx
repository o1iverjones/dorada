import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";
import { Input } from "./input.js";
import { cn } from "../../lib/utils.js";

const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

interface DateTimePickerProps {
  value: string; // "YYYY-MM-DDTHH:MM" or ""
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/** Splits "YYYY-MM-DDTHH:MM" into { date, hour, minute } with safe defaults. */
function parse(value: string) {
  if (!value) return { date: "", hour: "08", minute: "00" };
  const sep = value.indexOf("T");
  const date = sep >= 0 ? value.slice(0, sep) : value;
  const time = sep >= 0 ? value.slice(sep + 1) : "";
  const [rawHour = "08", rawMinute = "00"] = time.split(":");
  const hour = rawHour.padStart(2, "0") || "08";
  // Snap minute to nearest 15-min slot
  const minute = MINUTES.reduce((best, m) =>
    Math.abs(parseInt(m) - parseInt(rawMinute)) < Math.abs(parseInt(best) - parseInt(rawMinute)) ? m : best
  );
  return { date, hour, minute };
}

export function DateTimePicker({ value, onChange, className, disabled }: DateTimePickerProps) {
  const { date, hour, minute } = parse(value);

  function emit(d: string, h: string, m: string) {
    // Always emit if we have a date; default h/m if somehow still blank
    if (d) onChange(`${d}T${h || "08"}:${m || "00"}`);
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Date */}
      <Input
        type="date"
        value={date}
        disabled={disabled}
        className="h-7 text-sm w-36 cursor-pointer"
        onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
        onChange={(e) => emit(e.target.value, hour, minute)}
      />

      {/* Hour */}
      <Select value={hour} onValueChange={(h) => emit(date, h, minute)} disabled={disabled}>
        <SelectTrigger className="h-7 w-16 text-sm px-2">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-sm text-muted-foreground">:</span>

      {/* Minute */}
      <Select value={minute} onValueChange={(m) => emit(date, hour, m)} disabled={disabled}>
        <SelectTrigger className="h-7 w-16 text-sm px-2">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

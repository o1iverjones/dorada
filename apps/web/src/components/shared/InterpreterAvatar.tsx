import { useRef } from "react";
import { cn } from "../../lib/utils.js";

interface InterpreterAvatarProps {
  name: string;
  url?: string | null;
  size?: "sm" | "lg";
  editable?: boolean;
  onUpload?: (file: File) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function InterpreterAvatar({ name, url, size = "sm", editable = false, onUpload }: InterpreterAvatarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = size === "lg"
    ? "h-24 w-24 text-2xl"
    : "h-9 w-9 text-sm";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onUpload) onUpload(file);
    // reset so the same file can be re-selected if needed
    e.target.value = "";
  }

  const avatar = url ? (
    <img
      src={url}
      alt={name}
      className={cn("rounded-full object-cover", sizeClasses)}
    />
  ) : (
    <div className={cn(
      "rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground select-none",
      sizeClasses,
    )}>
      {getInitials(name)}
    </div>
  );

  if (!editable) return avatar;

  return (
    <div className="relative group w-fit">
      {avatar}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center",
          size === "lg" ? "text-xs" : "text-[10px]",
        )}
      >
        {size === "lg" ? "Change" : ""}
        {size === "sm" && <span className="sr-only">Change photo</span>}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button.js";
import { ImageIcon, X } from "lucide-react";
import { useToast } from "../../hooks/use-toast.js";

const SUGGESTION_KEYS = [
  "notes.scheduled_and_assigned",
  "notes.authorized",
  "notes.call_auth_pending",
  "notes.confirmed_with_patient",
  "notes.confirmed_with_clinic",
  "notes.email_auth_pending",
  "notes.follow_up_telemed",
  "notes.invoiced",
  "notes.lc_no_follow_up",
  "notes.lc_no_show",
  "notes.no_follow_up",
  "notes.do_not_assign_without_auth",
  "notes.private_no_follow_up",
  "notes.returned_by",
  "notes.reported",
  "notes.requested",
  "notes.double_booking",
  "notes.paid",
  "notes.texted_patient",
  "notes.text_for_authorization",
  "notes.call_for_authorization",
  "notes.email_for_authorization",
  "notes.cancelled_by_clinic",
  "notes.cancelled_by_patient",
  "notes.cancelled",
  "notes.cancelled_by_agency",
  "notes.telemed",
  "notes.in_person",
  "notes.in_person_but_telemed",
  "notes.changed_time_waiting_order",
];

interface NoteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave: (imageUrl?: string | null) => void | Promise<void>;
  isSaving: boolean;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  maxLength?: number;
  saveLabel?: string;
}

export function NoteInput({ value, onChange, onSave, isSaving, onUploadImage, placeholder, maxLength = 800, saveLabel = "Save" }: NoteInputProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => SUGGESTION_KEYS.map((k) => t(k)), [t]);
  const matches = value.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions;

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onUploadImage) return;
    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    setImageUrl(null);
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      setImageUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Image upload failed", description: msg, variant: "destructive" });
      setImagePreview(null);
      setImageUrl(null);
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected if needed
      e.target.value = "";
    }
  }

  function removeImage() {
    setImagePreview(null);
    setImageUrl(null);
  }

  async function handleSave() {
    await onSave(imageUrl);
    setImagePreview(null);
    setImageUrl(null);
  }

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

      {/* Image preview */}
      {imagePreview && (
        <div className="relative inline-block">
          <img
            src={imagePreview}
            alt="attachment preview"
            className="h-24 w-auto rounded-md border object-cover"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40">
              <span className="text-xs text-white">Uploading…</span>
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={removeImage}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{value.length}/{maxLength}</span>
          {onUploadImage && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {imagePreview ? "Change image" : "Add image"}
              </button>
            </>
          )}
        </div>
        <Button size="sm" disabled={(!value.trim() && !imageUrl) || isSaving || uploading} onClick={handleSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.js";
import { NoteInput } from "./NoteInput.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { useEntityNotes, useAddEntityNote, useUploadEntityNoteImage, type EntityType } from "../../hooks/useEntityNotes.js";
import { StickyNote } from "lucide-react";

interface AdminNotesCardProps {
  entity: EntityType;
  id: string;
  /** Optional legacy free-text note (e.g. an imported note) shown read-only below the list. */
  legacyNote?: string | null;
  /** Tag label for the legacy note chip (default "Imported"). */
  legacyTag?: string;
  /** Optional source shown next to the legacy tag (e.g. "Nowsta"). */
  legacySource?: string;
}

interface NoteRow {
  id: string;
  admin_name: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

export function AdminNotesCard({ entity, id, legacyNote, legacyTag = "Imported", legacySource }: AdminNotesCardProps) {
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data } = useEntityNotes(entity, id);
  const addNote = useAddEntityNote(entity, id);
  const uploadImage = useUploadEntityNoteImage(entity, id);
  const [noteText, setNoteText] = useState("");

  const notes = (data as NoteRow[] | undefined) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-4 w-4" /> {t("appointments.admin_notes")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <NoteInput
          value={noteText}
          onChange={setNoteText}
          onSave={async (imgUrl) => {
            await addNote.mutateAsync({ content: noteText.trim(), image_url: imgUrl });
            setNoteText("");
          }}
          isSaving={addNote.isPending}
          onUploadImage={async (file) => {
            const res = await uploadImage.mutateAsync(file);
            return res.url;
          }}
          placeholder={t("appointments.admin_notes_placeholder")}
          saveLabel={t("common.save")}
        />

        {legacyNote && (
          <div className="space-y-1 border-t pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{legacyTag}</span>
              {legacySource && <span>{legacySource}</span>}
            </div>
            <p className="text-sm whitespace-pre-wrap">{legacyNote}</p>
          </div>
        )}

        {notes.length > 0 && (
          <div className="space-y-3 border-t pt-3">
            {notes.map((n) => (
              <div key={n.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{n.admin_name}</span>
                  <span>·</span>
                  <span>{formatInTz(n.created_at, { dateStyle: "medium", timeStyle: "short" }, tz)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                {n.image_url && (
                  <a href={n.image_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={n.image_url}
                      alt="note attachment"
                      className="mt-1 max-h-48 w-auto rounded-md border object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

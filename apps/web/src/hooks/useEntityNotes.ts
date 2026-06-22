import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

/**
 * Generic hooks for the shared "admin notes + activity log + status" pattern.
 * Every entity exposes the same REST shape:
 *   GET  /<base>/:id/admin-notes
 *   POST /<base>/:id/admin-notes
 *   POST /<base>/:id/note-image
 *   GET  /<base>/:id/activity
 * so one set of hooks (keyed by entity) replaces the per-entity copies.
 */
export type EntityType = "clinic" | "agency" | "insurance_company" | "patient" | "interpreter" | "appointment";

/** Entity → REST base path (also the React Query key root, matching existing caches). */
const BASE: Record<EntityType, string> = {
  clinic: "clinics",
  agency: "agencies",
  insurance_company: "insurance-companies",
  patient: "patients",
  interpreter: "interpreters",
  appointment: "appointments",
};

export function entityBasePath(entity: EntityType): string {
  return BASE[entity];
}

export function useEntityNotes(entity: EntityType, id: string) {
  const base = BASE[entity];
  return useQuery({
    queryKey: [base, id, "notes"],
    queryFn: () => api.get<unknown[]>(`/${base}/${id}/admin-notes`),
    enabled: !!id,
  });
}

export function useEntityActivity(entity: EntityType, id: string) {
  const base = BASE[entity];
  return useQuery({
    queryKey: [base, id, "activity"],
    queryFn: () => api.get<unknown[]>(`/${base}/${id}/activity`),
    enabled: !!id,
  });
}

export function useAddEntityNote(entity: EntityType, id: string) {
  const base = BASE[entity];
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, image_url }: { content: string; image_url?: string | null }) =>
      api.post(`/${base}/${id}/admin-notes`, { content, image_url }),
    onSuccess: () => {
      // Adding a note also writes a "note_added" activity entry, so refresh both
      // the entity's notes + activity panels and the org-wide dashboard log.
      qc.invalidateQueries({ queryKey: [base, id, "notes"] });
      qc.invalidateQueries({ queryKey: [base, id, "activity"] });
      qc.invalidateQueries({ queryKey: ["activity-log"] });
    },
  });
}

export function useUploadEntityNoteImage(entity: EntityType, id: string) {
  const base = BASE[entity];
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.uploadFile<{ url: string }>(`/${base}/${id}/note-image`, fd);
    },
  });
}

/** Entities that support deactivate / reactivate. */
export type StatusEntity = "clinic" | "agency" | "insurance_company" | "interpreter";

/**
 * Unified deactivate / reactivate for entities that support it.
 * Interpreters use REST verbs (DELETE to deactivate, POST /reactivate);
 * clinics / agencies / insurance companies use PATCH { is_active }.
 */
export function useEntityStatus(entity: StatusEntity, id: string) {
  const base = BASE[entity];
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [base, id] });
    qc.invalidateQueries({ queryKey: [base] });
  };

  const deactivate = useMutation({
    mutationFn: () =>
      entity === "interpreter"
        ? api.delete(`/${base}/${id}`)
        : api.patch(`/${base}/${id}`, { is_active: false }),
    onSuccess: invalidate,
  });

  const reactivate = useMutation({
    mutationFn: () =>
      entity === "interpreter"
        ? api.post(`/${base}/${id}/reactivate`, {})
        : api.patch(`/${base}/${id}`, { is_active: true }),
    onSuccess: invalidate,
  });

  return { deactivate, reactivate };
}

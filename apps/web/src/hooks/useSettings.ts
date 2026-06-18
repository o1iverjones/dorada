import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useSystemSettings() {
  return useQuery({
    queryKey: ["system-settings"],
    queryFn: () => api.get("/settings"),
  });
}

export function useUpdateSystemSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch("/settings", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-settings"] }),
  });
}

export function useLanguages() {
  return useQuery({
    queryKey: ["languages"],
    queryFn: () => api.get<{ data: unknown[] }>("/settings/languages"),
  });
}

export function useAppointmentTypes() {
  return useQuery({
    queryKey: ["appointment-types"],
    queryFn: () => api.get<{ data: unknown[] }>("/settings/appointment-types"),
  });
}

export function useUpdateAppointmentType(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; pay_model?: string; minimum_billable_minutes?: number }) =>
      api.patch(`/settings/appointment-types/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-settings"] }),
  });
}

export function useDeleteAppointmentType(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/settings/appointment-types/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-settings"] }),
  });
}

export function useInterpreterRates() {
  return useQuery({
    queryKey: ["interpreter-rates"],
    queryFn: () => api.get<{ data: Array<{ id: string; title: string; amount: number }> }>("/settings/interpreter-rates"),
  });
}

export function useOrgTimezone(): string {
  const { data } = useSystemSettings();
  return (data as Record<string, unknown> | undefined)?.timezone as string ?? "America/Los_Angeles";
}

export function useLongAppointmentThreshold(): number {
  const { data } = useSystemSettings();
  return (data as Record<string, unknown> | undefined)?.long_appointment_alert_minutes as number ?? 105;
}

export function useShowLanguage(): boolean {
  const { data } = useSystemSettings();
  const val = (data as Record<string, unknown> | undefined)?.show_language;
  return val === undefined ? true : Boolean(val);
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.get<{ data: unknown[]; unread_count: number }>("/alerts"),
    refetchInterval: 30_000,
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/alerts/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useMarkAllAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch("/alerts/read-all", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useLocaleStrings(locale: string) {
  return useQuery({
    queryKey: ["locale-strings", locale],
    queryFn: () => api.get<{ data: unknown[] }>(`/settings/locale-strings?locale=${locale}`),
  });
}

export interface ReminderConfig {
  id: string;
  offset_minutes: number;
  label: string;
}

export function useReminderConfigs() {
  return useQuery({
    queryKey: ["reminder-configs"],
    queryFn: () => api.get<ReminderConfig[]>("/settings/reminder-configs"),
  });
}

export function useCreateReminderConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { offset_minutes: number; label: string }) =>
      api.post<ReminderConfig>("/settings/reminder-configs", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminder-configs"] }),
  });
}

export function useUpdateReminderConfig(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { offset_minutes?: number; label?: string }) =>
      api.patch<ReminderConfig>(`/settings/reminder-configs/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminder-configs"] }),
  });
}

export function useDeleteReminderConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/settings/reminder-configs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminder-configs"] }),
  });
}

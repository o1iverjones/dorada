import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/reports/generate", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-jobs"] }),
  });
}

export function useReportJob(jobId: string) {
  return useQuery({
    queryKey: ["report-jobs", jobId],
    queryFn: () => api.get(`/reports/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as { status?: string } | undefined;
      return data?.status === "completed" || data?.status === "failed" ? false : 3000;
    },
  });
}

export function useReportJobs() {
  return useQuery({
    queryKey: ["report-jobs"],
    queryFn: () => api.get<{ data: unknown[] }>("/reports/jobs"),
  });
}

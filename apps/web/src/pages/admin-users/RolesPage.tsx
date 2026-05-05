import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { Plus } from "lucide-react";

const PERMISSIONS = [
  "manage_interpreters",
  "manage_clinics",
  "manage_admin_users",
  "view_reports",
  "manage_appointments",
  "manage_system_settings",
] as const;

export function RolesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", permissions: {} as Record<string, boolean> });

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<{ data: unknown[] }>("/roles"),
  });

  const create = useMutation({
    mutationFn: (body: unknown) => api.post("/roles", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); setOpen(false); },
  });

  async function handleCreate() {
    try {
      await create.mutateAsync({
        name: form.name,
        permissions: Object.entries(form.permissions).filter(([, v]) => v).map(([k]) => k),
      });
      toast({ title: t("roles.created") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("roles.title")}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("roles.new")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {((roles?.data ?? []) as Array<Record<string, unknown>>).map((role) => (
          <Card key={role.id as string}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {role.name as string}
                {role.is_system && <span className="text-xs text-muted-foreground">{t("roles.system")}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {PERMISSIONS.map((perm) => {
                  const has = (role.permissions as string[] ?? []).includes(perm);
                  return (
                    <div key={perm} className="flex items-center gap-2 text-sm">
                      <span className={has ? "text-green-600" : "text-muted-foreground"}>{has ? "✓" : "✗"}</span>
                      <span className={has ? "" : "text-muted-foreground"}>{t(`permissions.${perm}`)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <DialogHeader><DialogTitle>{t("roles.new")}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label>{t("roles.name")}</Label>
                <Input value={form.name} onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("roles.permissions")}</Label>
                {PERMISSIONS.map((perm) => (
                  <label key={perm} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!form.permissions[perm]}
                      onChange={(e) => setForm(s => ({ ...s, permissions: { ...s.permissions, [perm]: e.target.checked } }))}
                    />
                    {t(`permissions.${perm}`)}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={create.isPending || !form.name}>{t("common.create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

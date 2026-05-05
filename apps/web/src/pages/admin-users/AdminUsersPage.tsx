import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { Plus, Link } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AdminUsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role_id: "" });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<{ data: unknown[] }>("/admin-users"),
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<{ data: unknown[] }>("/roles"),
  });

  const create = useMutation({
    mutationFn: (body: unknown) => api.post("/admin-users", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setOpen(false); },
  });

  async function handleCreate() {
    try {
      const payload: Record<string, unknown> = { name: form.name, email: form.email, password: form.password };
      if (form.role_id) payload.role_id = form.role_id;
      await create.mutateAsync(payload);
      toast({ title: t("admin_users.created") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const columns = [
    { key: "name", header: t("admin_users.name") },
    { key: "email", header: t("admin_users.email") },
    { key: "role_name", header: t("admin_users.role"), render: (r: Record<string, unknown>) => (r.role as Record<string, unknown>)?.name as string ?? "—" },
    { key: "is_active", header: t("common.status"), render: (r: Record<string, unknown>) => (
      <Badge variant={r.is_active ? "success" : "secondary"}>{r.is_active ? t("common.active") : t("common.inactive")}</Badge>
    )},
    { key: "mfa_enabled", header: "2FA", render: (r: Record<string, unknown>) => (
      <Badge variant={r.mfa_enabled ? "success" : "warning"}>{r.mfa_enabled ? t("common.enabled") : t("common.disabled")}</Badge>
    )},
  ];

  return (
    <div>
      <PageHeader
        title={t("admin_users.title")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin-users/roles")}>
              {t("admin_users.manage_roles")}
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> {t("admin_users.new")}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns as never}
          data={(users?.data ?? []) as Array<{ id: string } & Record<string, unknown>>}
          emptyMessage={t("admin_users.empty")}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <DialogHeader><DialogTitle>{t("admin_users.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              {(["name", "email"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label>{t(`admin_users.${field}`)}</Label>
                  <Input value={form[field]} onChange={(e) => setForm(s => ({ ...s, [field]: e.target.value }))} />
                </div>
              ))}
              <div className="space-y-1">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm(s => ({ ...s, password: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("admin_users.role")}</Label>
                <select className="w-full rounded-md border p-2 text-sm" value={form.role_id} onChange={(e) => setForm(s => ({ ...s, role_id: e.target.value }))}>
                  <option value="">{t("common.select")}</option>
                  {((roles?.data ?? []) as Array<{ id: string; name: string }>).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={create.isPending || !form.name || !form.email || form.password.length < 10}>{t("common.create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

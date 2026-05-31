import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInsuranceCompany, useUpdateInsuranceCompany, useInsuranceCompanyActivity } from "../../hooks/useInsuranceCompanies.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { PhoneInput } from "../../components/ui/PhoneInput.js";
import { formatPhone, formatPhoneInput } from "../../lib/phone.js";
import { Label } from "../../components/ui/label.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { ClipboardList, AlertTriangle } from "lucide-react";
import { useAuthStore } from "../../store/auth.js";

export function InsuranceCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data, isLoading } = useInsuranceCompany(id!);
  const update = useUpdateInsuranceCompany(id!);
  const { data: activityLog } = useInsuranceCompanyActivity(id!);

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission("manage_clinics");

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>{t("common.not_found")}</p>;

  const company = data as Record<string, unknown>;
  const isActive = (company.is_active as boolean) !== false;

  function startEdit() {
    setForm({
      name: (company.name as string) ?? "",
      phone: formatPhoneInput((company.phone as string) ?? ""),
      fax: formatPhoneInput((company.fax as string) ?? ""),
      email: (company.email as string) ?? "",
      address: (company.address as string) ?? "",
      city: (company.city as string) ?? "",
      state: (company.state as string) ?? "",
      zip_code: (company.zip_code as string) ?? "",
    });
    setEditing(true);
  }

  async function save() {
    try {
      const body: Record<string, unknown> = {};
      if (form.name) body.name = form.name;
      body.phone = form.phone || null;
      body.fax = form.fax || null;
      body.email = form.email || null;
      body.address = form.address || null;
      body.city = form.city || null;
      body.state = form.state || null;
      body.zip_code = form.zip_code || null;
      await update.mutateAsync(body);
      toast({ title: t("common.saved") });
      setEditing(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const textFields = [
    { key: "name", label: t("insurance_companies.name"), type: "text" },
    { key: "email", label: t("insurance_companies.email"), type: "email" },
    { key: "address", label: t("insurance_companies.address"), type: "text" },
    { key: "city", label: t("insurance_companies.city"), type: "text" },
    { key: "state", label: t("insurance_companies.state"), type: "text" },
    { key: "zip_code", label: t("insurance_companies.zip_code"), type: "text" },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {company.name as string}
            {!isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" /> {t("insurance_companies.deactivated")}
              </span>
            )}
          </span>
        }
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button onClick={save} disabled={update.isPending}>{t("common.save")}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={startEdit}>{t("common.edit")}</Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details card */}
        <Card>
          <CardHeader><CardTitle>{t("insurance_companies.details")}</CardTitle></CardHeader>
          <CardContent>
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {textFields.map(({ key, label, type }) => (
                  <div key={key} className="space-y-1">
                    <Label>{label}</Label>
                    <Input
                      type={type}
                      value={form[key] ?? ""}
                      onChange={(e) => setForm(s => ({ ...s, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label>{t("insurance_companies.phone")}</Label>
                  <PhoneInput value={form.phone ?? ""} onChange={(v) => setForm(s => ({ ...s, phone: v }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t("insurance_companies.fax")}</Label>
                  <PhoneInput value={form.fax ?? ""} onChange={(v) => setForm(s => ({ ...s, fax: v }))} />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">{t("insurance_companies.name")}</p>
                  <p className="font-medium">{company.name as string ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("insurance_companies.phone")}</p>
                  <p className="font-medium">{formatPhone(company.phone as string)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("insurance_companies.fax")}</p>
                  <p className="font-medium">{formatPhone(company.fax as string)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("insurance_companies.email")}</p>
                  <p className="font-medium">{company.email as string ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("insurance_companies.address")}</p>
                  <p className="font-medium">{company.address as string ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("insurance_companies.city")}</p>
                  <p className="font-medium">{company.city as string ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("insurance_companies.state")}</p>
                  <p className="font-medium">{company.state as string ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("insurance_companies.zip_code")}</p>
                  <p className="font-medium">{company.zip_code as string ?? "—"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> {t("dashboard.activity_log")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!((activityLog as Array<Record<string, unknown>>) ?? []).length ? (
              <p className="text-sm text-muted-foreground">{t("appointments.no_activity")}</p>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-4">
                {(activityLog as Array<Record<string, unknown>>).map((entry) => (
                  <li key={entry.id as string} className="ml-4">
                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border bg-background border-border" />
                    <p className="text-xs text-muted-foreground">
                      {formatInTz(entry.created_at as string, { dateStyle: "medium", timeStyle: "short" }, tz)}
                      {" · "}
                      <span className="font-medium text-foreground">{entry.admin_name as string}</span>
                    </p>
                    <p className="text-sm mt-0.5 capitalize">
                      {String(entry.action).replace(/_/g, " ")}
                      {entry.detail ? <span className="text-muted-foreground"> — {entry.detail as string}</span> : null}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status card */}
      {canManage && (
        <Card className={!isActive ? "border-red-200 dark:border-red-900" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {!isActive && <AlertTriangle className="h-4 w-4 text-red-500" />}
              {t("insurance_companies.status")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isActive ? t("insurance_companies.status_active_description") : t("insurance_companies.status_inactive_description")}
            </p>
            {isActive ? (
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 hover:bg-destructive/10 transition-colors">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => setDeactivateDialogOpen(true)}
                  className="h-4 w-4 accent-destructive"
                />
                <span className="text-sm font-medium text-destructive">{t("insurance_companies.deactivate_label")}</span>
              </label>
            ) : (
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-green-300 bg-green-50 p-3 hover:bg-green-100 transition-colors dark:border-green-800 dark:bg-green-950/30 dark:hover:bg-green-950/50">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => setReactivateDialogOpen(true)}
                  className="h-4 w-4 accent-green-600"
                />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">{t("insurance_companies.reactivate_label")}</span>
              </label>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deactivate dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> {t("insurance_companies.deactivate_confirm_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("insurance_companies.deactivate_confirm_body")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={update.isPending}
              onClick={async () => {
                try {
                  await update.mutateAsync({ is_active: false });
                  setDeactivateDialogOpen(false);
                  toast({ title: t("insurance_companies.deactivated_toast") });
                } catch {
                  toast({ title: t("common.error"), variant: "destructive" });
                }
              }}
            >
              {t("insurance_companies.deactivate_confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate dialog */}
      <Dialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("insurance_companies.reactivate_confirm_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("insurance_companies.reactivate_confirm_body")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivateDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={update.isPending}
              onClick={async () => {
                try {
                  await update.mutateAsync({ is_active: true });
                  setReactivateDialogOpen(false);
                  toast({ title: t("insurance_companies.reactivated") });
                } catch {
                  toast({ title: t("common.error"), variant: "destructive" });
                }
              }}
            >
              {t("insurance_companies.reactivate_confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

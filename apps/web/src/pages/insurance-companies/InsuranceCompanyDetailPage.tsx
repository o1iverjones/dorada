import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInsuranceCompany, useUpdateInsuranceCompany } from "../../hooks/useInsuranceCompanies.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { AdminNotesCard } from "../../components/shared/AdminNotesCard.js";
import { ActivityLogCard } from "../../components/shared/ActivityLogCard.js";
import { DeactivateCard } from "../../components/shared/DeactivateCard.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { PhoneInput } from "../../components/ui/PhoneInput.js";
import { formatPhoneInput } from "../../lib/phone.js";
import { PhoneLink } from "../../components/shared/PhoneLink.js";
import { Label } from "../../components/ui/label.js";
import { toast } from "../../hooks/use-toast.js";
import { AlertTriangle } from "lucide-react";
import { useAuthStore } from "../../store/auth.js";

export function InsuranceCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data, isLoading } = useInsuranceCompany(id!);
  const update = useUpdateInsuranceCompany(id!);

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission("manage_clinics");

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

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
                <p className="font-medium"><PhoneLink phone={company.phone as string} /></p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("insurance_companies.fax")}</p>
                <p className="font-medium"><PhoneLink phone={company.fax as string} /></p>
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

      {/* Admin Notes + Activity Log */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminNotesCard entity="insurance_company" id={id!} />
        <ActivityLogCard entity="insurance_company" id={id!} />
      </div>

      {/* Status */}
      {canManage && <DeactivateCard entity="insurance_company" id={id!} isActive={isActive} />}
    </div>
  );
}

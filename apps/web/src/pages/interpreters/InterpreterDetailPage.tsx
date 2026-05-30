import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInterpreter, useUpdateInterpreter, useDeactivateInterpreter } from "../../hooks/useInterpreters.js";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { PhoneInput } from "../../components/ui/PhoneInput.js";
import { formatPhone, formatPhoneInput } from "../../lib/phone.js";
import { Label } from "../../components/ui/label.js";
import { toast } from "../../hooks/use-toast.js";
import { InterpreterAvatar } from "../../components/shared/InterpreterAvatar.js";
import { api } from "../../lib/api.js";

export function InterpreterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useInterpreter(id!);
  const update = useUpdateInterpreter(id!);
  const deactivate = useDeactivateInterpreter(id!);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [photoUploading, setPhotoUploading] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>{t("common.not_found")}</p>;

  const interp = data as Record<string, unknown>;

  function startEdit() {
    const ec = interp.emergency_contact as Record<string, unknown> | null;
    setEditForm({
      name: interp.name,
      phone: formatPhoneInput(interp.phone as string ?? ""),
      email: interp.email ?? "",
      type: interp.type,
      pay_rate: interp.pay_rate,
      notes: interp.notes ?? "",
      emergency_contact_name: ec?.name ?? "",
      emergency_contact_phone: formatPhoneInput(ec?.phone as string ?? ""),
      certificate_number: interp.certificate_number ?? "",
      zip_code: interp.zip_code ?? "",
      coverage_range_miles: interp.coverage_range_miles ?? "",
    });
    setEditing(true);
  }

  async function saveEdit() {
    try {
      const f = editForm as Record<string, unknown>;
      const payload: Record<string, unknown> = {};
      if (f.name) payload.name = f.name;
      if (f.phone) payload.phone = f.phone;
      if (f.type) payload.type = f.type;
      payload.email = (f.email as string)?.trim() || null;
      if (f.pay_rate !== "" && f.pay_rate != null) payload.pay_rate = Number(f.pay_rate);
      payload.notes = (f.notes as string)?.trim() || null;
      payload.certificate_number = (f.certificate_number as string)?.trim() || null;
      payload.zip_code = (f.zip_code as string)?.trim() || null;
      payload.coverage_range_miles = (f.coverage_range_miles as string) !== "" && f.coverage_range_miles != null
        ? Number(f.coverage_range_miles)
        : null;
      const ecName = String(f.emergency_contact_name ?? "").trim();
      const ecPhone = String(f.emergency_contact_phone ?? "").trim();
      if (ecName || ecPhone) {
        payload.emergency_contact = { name: ecName, phone: ecPhone };
      }
      await update.mutateAsync(payload);
      toast({ title: t("common.saved") });
      setEditing(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.uploadFile(`/interpreters/${id}/photo`, formData);
      await qc.invalidateQueries({ queryKey: ["interpreters", id] });
      toast({ title: "Photo updated." });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleDeactivate() {
    try {
      await deactivate.mutateAsync(undefined);
      toast({ title: t("interpreters.deactivated") });
      navigate("/interpreters");
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={interp.name as string}
        actions={
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button onClick={saveEdit} disabled={update.isPending}>{t("common.save")}</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={startEdit}>{t("common.edit")}</Button>
                {interp.is_active && (
                  <Button variant="destructive" onClick={handleDeactivate} disabled={deactivate.isPending}>
                    {t("interpreters.deactivate")}
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <InterpreterAvatar
                name={interp.name as string}
                url={interp.profile_picture_url as string | null}
                size="lg"
                editable={!editing && !photoUploading}
                onUpload={handlePhotoUpload}
              />
              <div>
                <CardTitle>{t("interpreters.profile")}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Click photo to change</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <div className="space-y-3">
                {(["name", "email"] as const).map((field) => (
                  <div key={field} className="space-y-1">
                    <Label>{t(`interpreters.${field}`)}</Label>
                    <Input
                      value={editForm[field] as string ?? ""}
                      onChange={(e) => setEditForm(s => ({ ...s, [field]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label>{t("interpreters.phone")}</Label>
                  <PhoneInput
                    value={editForm.phone as string ?? ""}
                    onChange={(v) => setEditForm(s => ({ ...s, phone: v }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("interpreters.type")}</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editForm.type as string ?? ""}
                    onChange={(e) => setEditForm(s => ({ ...s, type: e.target.value }))}
                  >
                    <option value="certified">{t("interpreters.certified")}</option>
                    <option value="qualified">{t("interpreters.qualified")}</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <Field label={t("interpreters.type")} value={
                  <Badge variant={interp.type === "certified" ? "default" : "secondary"}>{interp.type as string}</Badge>
                } />
                <Field label={t("interpreters.phone")} value={formatPhone(interp.phone as string)} />
                <Field label={t("interpreters.email")} value={interp.email as string} />
                <Field label={t("interpreters.status")} value={
                  <Badge variant={interp.is_active ? "success" : "secondary"}>
                    {interp.is_active ? t("common.active") : t("common.inactive")}
                  </Badge>
                } />
                <Field label={t("interpreters.languages")} value={(interp.languages as string[] ?? []).join(", ")} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("interpreters.compensation")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-1">
                <Label>{t("interpreters.pay_rate")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.pay_rate as number ?? ""}
                  onChange={(e) => setEditForm(s => ({ ...s, pay_rate: parseFloat(e.target.value) }))}
                />
              </div>
            ) : (
              <>
                <Field label={t("interpreters.pay_rate")} value={interp.pay_rate ? `$${interp.pay_rate}/hr` : t("interpreters.default_rate")} />
                <Field label={t("interpreters.payment_method")} value={interp.payment_method as string ?? "—"} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("interpreters.emergency_contact")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("interpreters.emergency_name")}</Label>
                  <Input
                    value={editForm.emergency_contact_name as string ?? ""}
                    onChange={(e) => setEditForm(s => ({ ...s, emergency_contact_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("interpreters.emergency_phone")}</Label>
                  <PhoneInput
                    value={editForm.emergency_contact_phone as string ?? ""}
                    onChange={(v) => setEditForm(s => ({ ...s, emergency_contact_phone: v }))}
                  />
                </div>
              </div>
            ) : (
              <>
                <Field label={t("interpreters.emergency_name")} value={(interp.emergency_contact as Record<string, unknown>)?.name as string ?? "—"} />
                <Field label={t("interpreters.emergency_phone")} value={formatPhone((interp.emergency_contact as Record<string, unknown>)?.phone as string)} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("interpreters.coverage")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("interpreters.zip_code")}</Label>
                  <Input
                    value={editForm.zip_code as string ?? ""}
                    onChange={(e) => setEditForm(s => ({ ...s, zip_code: e.target.value }))}
                    placeholder="e.g. 90210"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("interpreters.coverage_range_miles")}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={editForm.coverage_range_miles as number ?? ""}
                    onChange={(e) => setEditForm(s => ({ ...s, coverage_range_miles: e.target.value }))}
                    placeholder="e.g. 25"
                  />
                </div>
              </div>
            ) : (
              <>
                <Field label={t("interpreters.zip_code")} value={interp.zip_code as string ?? "—"} />
                <Field label={t("interpreters.coverage_range_miles")} value={interp.coverage_range_miles != null ? `${interp.coverage_range_miles} mi` : "—"} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Use editForm.type in edit mode so the card activates immediately when the user changes type */}
        <Card className={(editing ? editForm.type : interp.type) !== "certified" ? "opacity-40 pointer-events-none select-none" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("interpreters.certification")}
              {(editing ? editForm.type : interp.type) !== "certified" && (
                <span className="text-xs font-normal text-muted-foreground">({t("interpreters.certified_only")})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-1">
                <Label>{t("interpreters.certificate_number")}</Label>
                <Input
                  value={editForm.certificate_number as string ?? ""}
                  onChange={(e) => setEditForm(s => ({ ...s, certificate_number: e.target.value }))}
                  placeholder={t("common.optional")}
                />
              </div>
            ) : (
              <Field label={t("interpreters.certificate_number")} value={interp.certificate_number as string ?? "—"} />
            )}
          </CardContent>
        </Card>

        {(editing || interp.notes) && (
          <Card>
            <CardHeader><CardTitle>{t("interpreters.notes")}</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <textarea
                  className="w-full rounded-md border p-2 text-sm"
                  rows={4}
                  value={editForm.notes as string ?? ""}
                  onChange={(e) => setEditForm(s => ({ ...s, notes: e.target.value }))}
                />
              ) : (
                <p className="text-sm">{interp.notes as string}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

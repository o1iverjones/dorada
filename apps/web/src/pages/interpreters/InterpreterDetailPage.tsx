import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInterpreter, useUpdateInterpreter, useDeactivateInterpreter, useInterpreterCities } from "../../hooks/useInterpreters.js";
import { useShowLanguage } from "../../hooks/useSettings.js";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { PhoneInput } from "../../components/ui/PhoneInput.js";
import { formatPhoneInput } from "../../lib/phone.js";
import { PhoneLink } from "../../components/shared/PhoneLink.js";
import { Label } from "../../components/ui/label.js";
import { toast } from "../../hooks/use-toast.js";
import { InterpreterAvatar } from "../../components/shared/InterpreterAvatar.js";
import { api } from "../../lib/api.js";
import { X } from "lucide-react";

export function InterpreterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showLanguage = useShowLanguage();
  const { data, isLoading } = useInterpreter(id!);
  const update = useUpdateInterpreter(id!);
  const deactivate = useDeactivateInterpreter(id!);
  const { data: allCities } = useInterpreterCities();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cityInput, setCityInput] = useState("");

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
      pay_rate_certified: interp.pay_rate_certified,
      certificate_date: (interp.certificate_date as string | null | undefined) ?? "",
      notes: interp.notes ?? "",
      emergency_contact_name: ec?.name ?? "",
      emergency_contact_phone: formatPhoneInput(ec?.phone as string ?? ""),
      certificate_number: interp.certificate_number ?? "",
      address_line1: interp.address_line1 ?? "",
      address_line2: interp.address_line2 ?? "",
      city: interp.city ?? "",
      state: interp.state ?? "",
      zip_code: interp.zip_code ?? "",
      preferred_cities: (interp.preferred_cities as string[] | undefined) ?? [],
      payment_method: interp.payment_method ?? "",
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
      payload.pay_rate_certified = (f.pay_rate_certified !== "" && f.pay_rate_certified != null) ? Number(f.pay_rate_certified) : null;
      payload.certificate_date = (f.certificate_date as string)?.trim() || null;
      payload.notes = (f.notes as string)?.trim() || null;
      payload.certificate_number = (f.certificate_number as string)?.trim() || null;
      payload.address_line1 = (f.address_line1 as string)?.trim() || null;
      payload.address_line2 = (f.address_line2 as string)?.trim() || null;
      payload.city = (f.city as string)?.trim() || null;
      payload.state = (f.state as string)?.trim() || null;
      payload.zip_code = (f.zip_code as string)?.trim() || null;
      payload.preferred_cities = (f.preferred_cities as string[]) ?? [];
      payload.payment_method = (f.payment_method as string)?.trim() || null;
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
                    <option value="qualified">{t("interpreters.qualified")}</option>
                    <option value="certified">{t("interpreters.certified")}</option>
                    <option value="qualified_and_certified">{t("interpreters.qualified_and_certified")}</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <Field label={t("interpreters.type")} value={
                  <Badge variant={interp.type === "qualified" ? "secondary" : "default"}>
                    {t(`interpreters.${interp.type as string}`, { defaultValue: interp.type as string })}
                  </Badge>
                } />
                <Field label={t("interpreters.phone")} value={<PhoneLink phone={interp.phone as string} />} />
                <Field label={t("interpreters.email")} value={interp.email as string} />
                <Field label={t("interpreters.status")} value={
                  <Badge variant={interp.is_active ? "success" : "secondary"}>
                    {interp.is_active ? t("common.active") : t("common.inactive")}
                  </Badge>
                } />
                {showLanguage && <Field label={t("interpreters.languages")} value={(interp.languages as string[] ?? []).join(", ")} />}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("interpreters.compensation")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("interpreters.pay_rate_qualified")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.pay_rate as number ?? ""}
                    onChange={(e) => setEditForm(s => ({ ...s, pay_rate: parseFloat(e.target.value) }))}
                  />
                </div>
                {/* Pay rate Certified — enabled for certified and qualified_and_certified */}
                <div className={`space-y-1 ${editForm.type !== "certified" && editForm.type !== "qualified_and_certified" ? "opacity-40 pointer-events-none select-none" : ""}`}>
                  <Label>{t("interpreters.pay_rate_certified")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    disabled={editForm.type !== "certified" && editForm.type !== "qualified_and_certified"}
                    value={editForm.pay_rate_certified as number ?? ""}
                    onChange={(e) => setEditForm(s => ({ ...s, pay_rate_certified: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("interpreters.payment_method")}</Label>
                  <Input
                    value={editForm.payment_method as string ?? ""}
                    onChange={(e) => setEditForm(s => ({ ...s, payment_method: e.target.value }))}
                    placeholder="—"
                  />
                </div>
              </div>
            ) : (
              <>
                <Field label={t("interpreters.pay_rate_qualified")} value={interp.pay_rate ? `$${interp.pay_rate}/hr` : t("interpreters.default_rate")} />
                {(interp.type === "certified" || interp.type === "qualified_and_certified") && (
                  <Field label={t("interpreters.pay_rate_certified")} value={interp.pay_rate_certified ? `$${interp.pay_rate_certified}/hr` : t("interpreters.default_rate")} />
                )}
                <Field label={t("interpreters.payment_method")} value={interp.payment_method as string ?? "—"} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("interpreters.address")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("interpreters.address_line1")}</Label>
                  <Input
                    value={editForm.address_line1 as string ?? ""}
                    onChange={(e) => setEditForm(s => ({ ...s, address_line1: e.target.value }))}
                    placeholder="e.g. 123 Main St"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("interpreters.address_line2")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                  <Input
                    value={editForm.address_line2 as string ?? ""}
                    onChange={(e) => setEditForm(s => ({ ...s, address_line2: e.target.value }))}
                    placeholder="e.g. Apt 4B"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t("interpreters.city")}</Label>
                    <Input
                      value={editForm.city as string ?? ""}
                      onChange={(e) => setEditForm(s => ({ ...s, city: e.target.value }))}
                      placeholder="e.g. Los Angeles"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("interpreters.state")}</Label>
                    <Input
                      value={editForm.state as string ?? ""}
                      onChange={(e) => setEditForm(s => ({ ...s, state: e.target.value }))}
                      placeholder="e.g. CA"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{t("interpreters.zip_code")}</Label>
                  <Input
                    value={editForm.zip_code as string ?? ""}
                    onChange={(e) => setEditForm(s => ({ ...s, zip_code: e.target.value }))}
                    placeholder="e.g. 90210"
                  />
                </div>
              </div>
            ) : (() => {
              const line1 = (interp.address_line1 as string | null | undefined) || "";
              const line2 = (interp.address_line2 as string | null | undefined) || "";
              const city  = (interp.city  as string | null | undefined) || "";
              const state = (interp.state as string | null | undefined) || "";
              const zip   = (interp.zip_code as string | null | undefined) || "";
              const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
              const hasAddress = line1 || city || state || zip;
              if (!hasAddress) return <p className="text-sm text-muted-foreground">—</p>;
              return (
                <div className="text-sm font-medium leading-6">
                  {line1 && <p>{line1}</p>}
                  {line2 && <p>{line2}</p>}
                  {cityStateZip && <p>{cityStateZip}</p>}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("interpreters.coverage")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                {/* Clickable city chips from all cities in use */}
                {(allCities ?? []).length > 0 && (() => {
                  const selected = (editForm.preferred_cities as string[]) ?? [];
                  const filtered = cityInput.trim()
                    ? (allCities ?? []).filter((c) => c.toLowerCase().includes(cityInput.trim().toLowerCase()))
                    : (allCities ?? []);
                  if (filtered.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {filtered.map((city) => {
                        const isSelected = selected.includes(city);
                        return (
                          <button
                            key={city}
                            type="button"
                            onClick={() => setEditForm(s => {
                              const cur = (s.preferred_cities as string[]) ?? [];
                              return {
                                ...s,
                                preferred_cities: isSelected
                                  ? cur.filter((c) => c !== city)
                                  : [...cur, city],
                              };
                            })}
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                              isSelected
                                ? "bg-emerald-100 border-emerald-400 text-emerald-800 hover:bg-emerald-200"
                                : "bg-muted border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                            }`}
                          >
                            {city}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Search / add new city */}
                <div className="flex gap-2">
                  <Input
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    placeholder={t("interpreters.preferred_cities_placeholder")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const city = cityInput.trim();
                        if (!city) return;
                        const current = (editForm.preferred_cities as string[]) ?? [];
                        if (!current.includes(city)) {
                          setEditForm(s => ({ ...s, preferred_cities: [...current, city] }));
                        }
                        setCityInput("");
                      }
                    }}
                  />
                  {cityInput.trim() && !(allCities ?? []).some((c) => c.toLowerCase() === cityInput.trim().toLowerCase()) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const city = cityInput.trim();
                        const current = (editForm.preferred_cities as string[]) ?? [];
                        if (!current.includes(city)) {
                          setEditForm(s => ({ ...s, preferred_cities: [...current, city] }));
                        }
                        setCityInput("");
                      }}
                    >
                      {t("common.add")}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground mb-2">{t("interpreters.preferred_cities")}</p>
                {((interp.preferred_cities as string[] | undefined) ?? []).length === 0 ? (
                  <p className="text-muted-foreground italic">{t("interpreters.no_preferred_cities")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {((interp.preferred_cities as string[]) ?? []).map((city) => (
                      <span key={city} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                        {city}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = ((interp.preferred_cities as string[]) ?? []).filter((c) => c !== city);
                            update.mutate({ preferred_cities: updated }, {
                              onError: () => toast({ title: t("common.error"), variant: "destructive" }),
                            });
                          }}
                          className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label={`Remove ${city}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
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
                <Field label={t("interpreters.emergency_phone")} value={<PhoneLink phone={(interp.emergency_contact as Record<string, unknown>)?.phone as string} />} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Use editForm.type in edit mode so the card activates immediately when the user changes type */}
        {(() => {
          const activeType = (editing ? editForm.type : interp.type) as string;
          const isCertifiedType = activeType === "certified" || activeType === "qualified_and_certified";
          return (
            <Card className={!isCertifiedType ? "opacity-40 pointer-events-none select-none" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t("interpreters.certification")}
                  {!isCertifiedType && (
                    <span className="text-xs font-normal text-muted-foreground">({t("interpreters.certified_only")})</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {editing ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>{t("interpreters.certificate_number")}</Label>
                      <Input
                        value={editForm.certificate_number as string ?? ""}
                        onChange={(e) => setEditForm(s => ({ ...s, certificate_number: e.target.value }))}
                        placeholder={t("common.optional")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("interpreters.certificate_date")}</Label>
                      <Input
                        type="date"
                        value={editForm.certificate_date as string ?? ""}
                        onChange={(e) => setEditForm(s => ({ ...s, certificate_date: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <Field label={t("interpreters.certificate_number")} value={interp.certificate_number as string ?? "—"} />
                    <Field label={t("interpreters.certificate_date")} value={
                      interp.certificate_date
                        ? new Date(interp.certificate_date as string).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
                        : "—"
                    } />
                  </>
                )}
              </CardContent>
            </Card>
          );
        })()}

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

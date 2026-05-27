import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCreateAppointment, useAppointments } from "../../hooks/useAppointments.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { fromTzDateTimeInput } from "../../lib/timezone.js";
import { useClinics } from "../../hooks/useClinics.js";
import { useInsuranceAgencies } from "../../hooks/useInsuranceAgencies.js";
import { usePatients } from "../../hooks/usePatients.js";
import { useSystemSettings, useInterpreterRates } from "../../hooks/useSettings.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { AutocompleteInput } from "../../components/shared/AutocompleteInput.js";
import { DurationInput } from "../../components/shared/DurationInput.js";
import { Card, CardContent } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { useEffect } from "react";
import { toast } from "../../hooks/use-toast.js";
import { DateTimePicker } from "../../components/ui/date-time-picker.js";

const LANGUAGES = ["Spanish", "French", "Tagalog", "Russian", "Mandarin"];

const schema = z.object({
  date_time: z.string().min(1),
  duration_minutes: z.coerce.number().min(15),
  type_id: z.string().min(1),
  language: z.string().min(1),
  interpreter_type_required: z.enum(["certified", "qualified"]),
  clinic_id: z.string().min(1),
  insurance_agency_id: z.string().min(1),
  patient_id: z.string().min(1),
  referring_physician: z.string().transform((v) => v || undefined).optional(),
  po_number: z.string().optional(),
  pre_auth_amount: z.coerce.number().default(0),
  pre_auth_mileage: z.coerce.number().default(0),
});

type FormData = z.infer<typeof schema>;

export function NewAppointmentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { prefill?: Partial<FormData> } | null)?.prefill;
  const tz = useOrgTimezone();
  const create = useCreateAppointment();

  const { data: clinics } = useClinics({ limit: "500" });
  const { data: agencies } = useInsuranceAgencies({ limit: "500" });
  const { data: patients } = usePatients({ limit: "500" });
  const { data: settings } = useSystemSettings();
  const { data: ratesData } = useInterpreterRates();
  const { data: pastAppts } = useAppointments({ limit: "200" });

  const apptTypes = ((settings as Record<string, unknown> | undefined)?.appointment_types ?? []) as Array<{ id: string; name: string }>;
  const certQualTypes = apptTypes.filter((ty) => ty.name === "Certified" || ty.name === "Qualified");
  const interpreterRates = ratesData?.data ?? [];

  const clinicOptions = ((clinics?.data ?? []) as Array<{ id: string; name: string; is_active?: boolean }>)
    .filter((c) => c.is_active !== false)
    .map((c) => ({ value: c.id, label: c.name }));
  const agencyOptions = ((agencies?.data ?? []) as Array<{ id: string; name: string }>)
    .map((a) => ({ value: a.id, label: a.name }));
  const patientOptions = ((patients?.data ?? []) as Array<{ id: string; name: string }>)
    .map((p) => ({ value: p.id, label: p.name }));
  const physicianOptions = Array.from(
    new Set(
      ((pastAppts?.data ?? []) as Array<{ referring_physician?: string }>)
        .map((a) => a.referring_physician)
        .filter(Boolean) as string[]
    )
  ).map((name) => ({ value: name, label: name }));

  const { register, control, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      interpreter_type_required: "qualified",
      duration_minutes: 120,
      pre_auth_amount: 0,
      pre_auth_mileage: 0,
      language: "Spanish",
      ...prefill,
    },
  });

  // Once settings load, pre-select the Qualified appointment type (skip if duplicating — type already set)
  useEffect(() => {
    if (prefill?.type_id) return;
    const qualifiedType = certQualTypes.find((ty) => ty.name === "Qualified");
    if (qualifiedType) setValue("type_id", qualifiedType.id);
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: FormData) {
    try {
      const appt = await create.mutateAsync({
        ...data,
        date_time: fromTzDateTimeInput(data.date_time, tz),
        pre_auth_mileage: Math.round(data.pre_auth_mileage),
      }) as { id: string };
      toast({ title: t("appointments.created") });
      navigate(`/appointments/${appt.id}`);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  return (
    <div>
      <PageHeader title={prefill ? t("appointments.duplicate_title") : t("appointments.new")} />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("appointments.date_time")} error={errors.date_time?.message}>
              <Controller name="date_time" control={control} render={({ field }) => (
                <DateTimePicker value={field.value ?? ""} onChange={field.onChange} />
              )} />
            </FormField>

            <FormField label={t("appointments.duration")} error={errors.duration_minutes?.message}>
              <Controller name="duration_minutes" control={control} render={({ field }) => (
                <DurationInput value={field.value ?? 120} onChange={field.onChange} />
              )} />
            </FormField>

            <div className="space-y-2">
              <Label>{t("appointments.type")}</Label>
              {errors.type_id && <p className="text-sm text-destructive">{errors.type_id.message}</p>}
              <Controller name="type_id" control={control} render={({ field }) => (
                <div className="flex gap-2">
                  {certQualTypes.map((ty) => (
                    <button
                      key={ty.id}
                      type="button"
                      onClick={() => {
                        field.onChange(ty.id);
                        setValue("interpreter_type_required", ty.name.toLowerCase() as "certified" | "qualified");
                      }}
                      className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                        field.value === ty.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {ty.name}
                    </button>
                  ))}
                </div>
              )} />
            </div>

            <div className="col-span-full space-y-2">
              <Label>{t("appointments.language")}</Label>
              {errors.language && <p className="text-sm text-destructive">{errors.language.message}</p>}
              <Controller name="language" control={control} render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => field.onChange(lang)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        field.value === lang
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )} />
            </div>


<FormField label={t("appointments.clinic")} error={errors.clinic_id?.message}>
              <Controller name="clinic_id" control={control} render={({ field }) => (
                <AutocompleteInput
                  options={clinicOptions}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t("common.search")}
                />
              )} />
            </FormField>

            <FormField label={t("appointments.insurance_agency")} error={errors.insurance_agency_id?.message}>
              <Controller name="insurance_agency_id" control={control} render={({ field }) => (
                <AutocompleteInput
                  options={agencyOptions}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t("common.search")}
                />
              )} />
            </FormField>

            <FormField label={t("appointments.patient")} error={errors.patient_id?.message}>
              <Controller name="patient_id" control={control} render={({ field }) => (
                <AutocompleteInput
                  options={patientOptions}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t("common.search")}
                />
              )} />
            </FormField>

            <FormField label={t("appointments.referring_physician")} error={errors.referring_physician?.message}>
              <Controller name="referring_physician" control={control} render={({ field }) => (
                <AutocompleteInput
                  options={physicianOptions}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t("common.search")}
                  freeText
                />
              )} />
            </FormField>

            <FormField label={t("appointments.po_number")} error={errors.po_number?.message}>
              <Input {...register("po_number")} placeholder="—" />
            </FormField>

            <FormField label={t("settings.interpreter_rates")} error={errors.pre_auth_amount?.message}>
              <Controller name="pre_auth_amount" control={control} render={({ field }) => (
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                >
                  <option value="">{t("common.select")}</option>
                  {interpreterRates.map((r) => (
                    <option key={r.id} value={r.amount}>
                      {r.title} — ${r.amount.toFixed(2)}
                    </option>
                  ))}
                </select>
              )} />
            </FormField>

            <FormField label={t("appointments.pre_auth_mileage")} error={errors.pre_auth_mileage?.message}>
              <Input type="number" step="0.1" min={0} {...register("pre_auth_mileage")} />
            </FormField>

            <div className="col-span-full flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? t("common.saving") : t("common.create")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

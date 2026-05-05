import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCreateAppointment } from "../../hooks/useAppointments.js";
import { useClinics } from "../../hooks/useClinics.js";
import { useInsuranceAgencies } from "../../hooks/useInsuranceAgencies.js";
import { usePatients } from "../../hooks/usePatients.js";
import { useAppointmentTypes } from "../../hooks/useSettings.js";

const LANGUAGES = ["English", "Spanish", "French", "Tagalog", "Russian", "Mandarin"];
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Card, CardContent } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { toast } from "../../hooks/use-toast.js";

const schema = z.object({
  date_time: z.string().min(1),
  duration_minutes: z.coerce.number().min(15),
  type_id: z.string().min(1),
  language: z.string().min(1),
  interpreter_type_required: z.enum(["certified", "qualified"]),
  clinic_id: z.string().min(1),
  insurance_agency_id: z.string().min(1),
  patient_id: z.string().min(1),
  referring_physician: z.string().optional(),
  pre_auth_amount: z.coerce.number().default(0),
  pre_auth_mileage: z.coerce.number().default(0),
});

type FormData = z.infer<typeof schema>;

export function NewAppointmentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateAppointment();

  const { data: clinics } = useClinics();
  const { data: agencies } = useInsuranceAgencies();
  const { data: patients } = usePatients();
  const { data: types } = useAppointmentTypes();

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { interpreter_type_required: "qualified", duration_minutes: 60, pre_auth_amount: 0, pre_auth_mileage: 0 },
  });

  async function onSubmit(data: FormData) {
    try {
      const appt = await create.mutateAsync(data) as { id: string };
      toast({ title: t("appointments.created") });
      navigate(`/appointments/${appt.id}`);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  return (
    <div>
      <PageHeader title={t("appointments.new")} />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("appointments.date_time")} error={errors.date_time?.message}>
              <Input type="datetime-local" {...register("date_time")} />
            </FormField>

            <FormField label={t("appointments.duration_minutes")} error={errors.duration_minutes?.message}>
              <Input type="number" min={15} step={15} {...register("duration_minutes")} />
            </FormField>

            <FormField label={t("appointments.type")} error={errors.type_id?.message}>
              <Controller name="type_id" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                  <SelectContent>
                    {((types?.data ?? []) as Array<{ id: string; name: string }>).map((ty) => (
                      <SelectItem key={ty.id} value={ty.id}>{ty.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </FormField>

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

            <FormField label={t("appointments.interpreter_type")} error={errors.interpreter_type_required?.message}>
              <Controller name="interpreter_type_required" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="certified">{t("interpreters.certified")}</SelectItem>
                    <SelectItem value="qualified">{t("interpreters.qualified")}</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </FormField>

            <FormField label={t("appointments.clinic")} error={errors.clinic_id?.message}>
              <Controller name="clinic_id" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                  <SelectContent>
                    {((clinics?.data ?? []) as Array<{ id: string; name: string }>).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </FormField>

            <FormField label={t("appointments.insurance_agency")} error={errors.insurance_agency_id?.message}>
              <Controller name="insurance_agency_id" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                  <SelectContent>
                    {((agencies?.data ?? []) as Array<{ id: string; name: string }>).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </FormField>

            <FormField label={t("appointments.patient")} error={errors.patient_id?.message}>
              <Controller name="patient_id" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                  <SelectContent>
                    {((patients?.data ?? []) as Array<{ id: string; name: string }>).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </FormField>

            <FormField label={t("appointments.referring_physician")} error={errors.referring_physician?.message}>
              <Input {...register("referring_physician")} />
            </FormField>

            <FormField label={t("appointments.pre_auth_amount")} error={errors.pre_auth_amount?.message}>
              <Input type="number" step="0.01" min={0} {...register("pre_auth_amount")} />
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

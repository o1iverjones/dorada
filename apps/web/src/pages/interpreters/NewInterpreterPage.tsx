import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCreateInterpreter } from "../../hooks/useInterpreters.js";
import { useSystemSettings } from "../../hooks/useSettings.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Card, CardContent } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { PhoneInput } from "../../components/ui/PhoneInput.js";
import { Label } from "../../components/ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { toast } from "../../hooks/use-toast.js";

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  type: z.enum(["certified", "qualified"]),
  languages: z.array(z.string()).min(1),
  address: z.string().optional(),
  pay_rate: z.coerce.number().optional(),
  payment_method: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function NewInterpreterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateInterpreter();
  const { data: settings } = useSystemSettings();
  const langs = ((settings as Record<string, unknown> | undefined)?.languages ?? []) as Array<{ code: string; name: string; active: boolean }>;

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "qualified", languages: [] },
  });

  const selectedLangs = watch("languages") ?? [];

  function toggleLanguage(lang: string) {
    setValue(
      "languages",
      selectedLangs.includes(lang) ? selectedLangs.filter((l) => l !== lang) : [...selectedLangs, lang],
    );
  }

  async function onSubmit(data: FormData) {
    try {
      const { emergency_contact_name, emergency_contact_phone, ...rest } = data;
      const payload = {
        ...rest,
        emergency_contact: emergency_contact_name ? { name: emergency_contact_name, phone: emergency_contact_phone } : undefined,
      };
      const created = await create.mutateAsync(payload) as { id: string };
      toast({ title: t("interpreters.created") });
      navigate(`/interpreters/${created.id}`);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  return (
    <div>
      <PageHeader title={t("interpreters.new")} />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <F label={t("interpreters.name")} error={errors.name?.message}>
              <Input {...register("name")} />
            </F>
            <F label={t("interpreters.phone")} error={errors.phone?.message}>
              <Controller name="phone" control={control} render={({ field }) => (
                <PhoneInput value={field.value ?? ""} onChange={field.onChange} />
              )} />
            </F>
            <F label={t("interpreters.email")} error={errors.email?.message}>
              <Input type="email" {...register("email")} />
            </F>
            <F label={t("interpreters.type")} error={errors.type?.message}>
              <Controller name="type" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="certified">{t("interpreters.certified")}</SelectItem>
                    <SelectItem value="qualified">{t("interpreters.qualified")}</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </F>
            <F label={t("interpreters.pay_rate")} error={errors.pay_rate?.message}>
              <Input type="number" step="0.01" min={0} {...register("pay_rate")} />
            </F>
            <F label={t("interpreters.payment_method")} error={errors.payment_method?.message}>
              <Input {...register("payment_method")} />
            </F>
            <F label={t("interpreters.address")} error={errors.address?.message}>
              <Input {...register("address")} />
            </F>
            <F label={t("interpreters.emergency_name")} error={errors.emergency_contact_name?.message}>
              <Input {...register("emergency_contact_name")} />
            </F>
            <F label={t("interpreters.emergency_phone")} error={errors.emergency_contact_phone?.message}>
              <Controller name="emergency_contact_phone" control={control} render={({ field }) => (
                <PhoneInput value={field.value ?? ""} onChange={field.onChange} />
              )} />
            </F>

            <div className="col-span-full space-y-2">
              <Label>{t("interpreters.languages")}</Label>
              {errors.languages && <p className="text-sm text-destructive">{errors.languages.message}</p>}
              <div className="flex flex-wrap gap-2">
                {langs.filter((l) => l.active).map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => toggleLanguage(lang.code)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      selectedLangs.includes(lang.code)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-accent"
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>

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

function F({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

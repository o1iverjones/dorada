import { useState } from "react";
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
import { X } from "lucide-react";

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  type: z.enum(["qualified", "certified", "qualified_and_certified"]),
  languages: z.array(z.string()).min(1),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  pay_rate: z.coerce.number().optional(),
  pay_rate_certified: z.coerce.number().optional(),
  payment_method: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  preferred_cities: z.array(z.string()).optional(),
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
    defaultValues: { type: "qualified", languages: [], preferred_cities: [] },
  });

  const selectedLangs = watch("languages") ?? [];
  const preferredCities = watch("preferred_cities") ?? [];
  const watchedType = watch("type");
  const isCertifiedType = watchedType === "certified" || watchedType === "qualified_and_certified";
  const [cityInput, setCityInput] = useState("");

  function addCity() {
    const city = cityInput.trim();
    if (!city || preferredCities.includes(city)) return;
    setValue("preferred_cities", [...preferredCities, city]);
    setCityInput("");
  }

  function removeCity(city: string) {
    setValue("preferred_cities", preferredCities.filter((c) => c !== city));
  }

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
        email: rest.email || undefined,
        address_line1: rest.address_line1 || undefined,
        address_line2: rest.address_line2 || undefined,
        city: rest.city || undefined,
        state: rest.state || undefined,
        zip_code: rest.zip_code || undefined,
        preferred_cities: rest.preferred_cities ?? [],
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
                    <SelectItem value="qualified">{t("interpreters.qualified")}</SelectItem>
                    <SelectItem value="certified">{t("interpreters.certified")}</SelectItem>
                    <SelectItem value="qualified_and_certified">{t("interpreters.qualified_and_certified")}</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </F>
            <F label={t("interpreters.pay_rate_qualified")} error={errors.pay_rate?.message}>
              <Input type="number" step="0.01" min={0} {...register("pay_rate")} />
            </F>
            <F label={t("interpreters.pay_rate_certified")} error={errors.pay_rate_certified?.message}>
              <Input
                type="number"
                step="0.01"
                min={0}
                disabled={!isCertifiedType}
                className={!isCertifiedType ? "opacity-40 cursor-not-allowed" : ""}
                {...register("pay_rate_certified")}
              />
            </F>
            <F label={t("interpreters.payment_method")} error={errors.payment_method?.message}>
              <Input {...register("payment_method")} />
            </F>
            <F label={t("interpreters.address_line1")} error={errors.address_line1?.message}>
              <Input {...register("address_line1")} placeholder="e.g. 123 Main St" />
            </F>
            <F label={`${t("interpreters.address_line2")} (${t("common.optional")})`} error={errors.address_line2?.message}>
              <Input {...register("address_line2")} placeholder="e.g. Apt 4B" />
            </F>
            <F label={t("interpreters.city")} error={errors.city?.message}>
              <Input {...register("city")} placeholder="e.g. Los Angeles" />
            </F>
            <F label={t("interpreters.state")} error={errors.state?.message}>
              <Input {...register("state")} placeholder="e.g. CA" />
            </F>
            <F label={t("interpreters.zip_code")} error={errors.zip_code?.message}>
              <Input {...register("zip_code")} placeholder="e.g. 90210" />
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
              <Label>{t("interpreters.preferred_cities")}</Label>
              <div className="flex gap-2">
                <Input
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder={t("interpreters.preferred_cities_placeholder")}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCity(); } }}
                />
                <Button type="button" variant="outline" onClick={addCity}>{t("common.add")}</Button>
              </div>
              {preferredCities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {preferredCities.map((city) => (
                    <span key={city} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                      {city}
                      <button type="button" onClick={() => removeCity(city)} className="ml-1 text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

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

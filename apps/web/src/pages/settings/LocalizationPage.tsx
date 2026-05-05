import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useLocaleStrings } from "../../hooks/useSettings.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { toast } from "../../hooks/use-toast.js";
import { Save } from "lucide-react";

const LOCALES = ["en", "es"];

export function LocalizationPage() {
  const { t, i18n } = useTranslation();
  const [locale, setLocale] = useState("en");
  const qc = useQueryClient();
  const { data, isLoading } = useLocaleStrings(locale);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (body: unknown) => api.put(`/settings/locale-strings/${locale}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locale-strings", locale] }); },
  });

  async function handleSave() {
    try {
      await save.mutateAsync({ strings: overrides });
      toast({ title: t("common.saved") });
      setOverrides({});
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const strings = (data?.data ?? []) as Array<{ key: string; value: string; original: string }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.localization_title")}
        actions={
          Object.keys(overrides).length > 0 ? (
            <Button onClick={handleSave} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" /> {t("common.save_changes")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-2">
        {LOCALES.map((l) => (
          <Button key={l} variant={locale === l ? "default" : "outline"} size="sm" onClick={() => setLocale(l)}>
            {l.toUpperCase()}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader><CardTitle>{t("settings.locale_strings", { locale: locale.toUpperCase() })}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {strings.map((s) => (
                <div key={s.key} className="grid grid-cols-[1fr_2fr] gap-4 items-start">
                  <div>
                    <p className="text-sm font-mono text-muted-foreground">{s.key}</p>
                    <p className="text-xs text-muted-foreground">{s.original}</p>
                  </div>
                  <Input
                    value={overrides[s.key] ?? s.value}
                    onChange={(e) => setOverrides(prev => ({ ...prev, [s.key]: e.target.value }))}
                    className={overrides[s.key] ? "border-primary" : ""}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

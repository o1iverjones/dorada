import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card.js";
import { toast } from "../../hooks/use-toast.js";

const schema = z.object({ totp_code: z.string().length(6) });
type FormData = z.infer<typeof schema>;

export function MfaSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    api.post<{ qr_code_data_url: string }>("/auth/admin/mfa/setup")
      .then((r) => setQrCode(r.qr_code_data_url))
      .catch(() => toast({ title: t("auth.mfa_setup_failed"), variant: "destructive" }));
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      await api.post("/auth/admin/mfa/confirm", data);
      toast({ title: t("auth.mfa_setup_success") });
      navigate("/dashboard");
    } catch {
      toast({ title: t("auth.mfa_confirm_failed"), variant: "destructive" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("auth.setup_2fa_title")}</CardTitle>
          <CardDescription>{t("auth.setup_2fa_description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrCode && (
            <div className="flex justify-center">
              <img src={qrCode} alt="QR code" className="h-48 w-48 rounded border" />
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totp_code">{t("auth.authenticator_code")}</Label>
              <Input id="totp_code" maxLength={6} inputMode="numeric" {...register("totp_code")} />
              {errors.totp_code && <p className="text-sm text-destructive">{errors.totp_code.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || !qrCode}>
              {isSubmitting ? t("common.loading") : t("auth.confirm_and_enable")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

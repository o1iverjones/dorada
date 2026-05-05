import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, setTokens } from "../../lib/api.js";
import { useAuthStore } from "../../store/auth.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card.js";
import { toast } from "../../hooks/use-toast.js";

const schema = z.object({ totp_code: z.string().length(6) });
type FormData = z.infer<typeof schema>;

export function MfaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mfaToken, setUser } = useAuthStore();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    if (!mfaToken) { navigate("/login"); return; }
    try {
      const res = await api.post<{
        access_token: string;
        refresh_token: string;
        user: { id: string; name: string; email: string; role: string; permissions: string[]; organization_id: string };
      }>("/auth/admin/mfa/verify", { ...data, mfa_token: mfaToken });
      setTokens(res.access_token, res.refresh_token);
      setUser(res.user);
      navigate("/dashboard");
    } catch {
      toast({ title: t("auth.mfa_failed"), variant: "destructive" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("auth.two_factor_title")}</CardTitle>
          <CardDescription>{t("auth.two_factor_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totp_code">{t("auth.authenticator_code")}</Label>
              <Input id="totp_code" maxLength={6} inputMode="numeric" {...register("totp_code")} />
              {errors.totp_code && <p className="text-sm text-destructive">{errors.totp_code.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("common.loading") : t("auth.verify")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, MailCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card.js";

const schema = z.object({
  email: z.string().email(),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      await api.post("/auth/admin/password/reset-request", data);
    } catch {
      // Intentionally ignore errors — we always show the same confirmation
      // to prevent account enumeration.
    }
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <img src="/fruta-dorada-illustrated3.png" alt="Dorada" className="h-16 rounded-full object-contain" style={{ width: "3rem" }} />
          </div>
          <CardTitle className="text-2xl">{t("auth.resetPassword")}</CardTitle>
          <CardDescription>
            {submitted ? t("auth.reset_email_sent_description") : t("auth.forgot_password_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 p-6 text-center">
                <MailCheck className="h-10 w-10 text-primary" />
                <p className="text-sm text-muted-foreground">{t("auth.reset_email_sent_hint")}</p>
              </div>
              <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
                <ArrowLeft size={16} /> {t("auth.back_to_login")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" type="email" autoFocus {...register("email")} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t("common.loading") : t("auth.send_reset_link")}
              </Button>
              <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
                <ArrowLeft size={16} /> {t("auth.back_to_login")}
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

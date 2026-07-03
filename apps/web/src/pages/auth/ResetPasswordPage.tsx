import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { api } from "../../lib/api.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card.js";
import { toast } from "../../hooks/use-toast.js";

const schema = z
  .object({
    new_password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Must include uppercase, lowercase, and a number"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      await api.post("/auth/admin/password/reset-confirm", {
        reset_token: token,
        new_password: data.new_password,
      });
      toast({ title: t("auth.reset_success") });
      navigate("/login");
    } catch {
      toast({ title: t("auth.reset_failed"), variant: "destructive" });
    }
  }

  // No token in the URL — the link is malformed or was opened directly.
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t("auth.reset_link_invalid_title")}</CardTitle>
            <CardDescription>{t("auth.reset_link_invalid_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/forgot-password" className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
              <ArrowLeft size={16} /> {t("auth.request_new_link")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <img src="/fruta-dorada-illustrated3.png" alt="Dorada" className="h-16 rounded-full object-contain" style={{ width: "3rem" }} />
          </div>
          <CardTitle className="text-2xl">{t("auth.resetPassword")}</CardTitle>
          <CardDescription>{t("auth.reset_password_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">{t("auth.newPassword")}</Label>
              <div className="relative">
                <Input id="new_password" type={showPassword ? "text" : "password"} autoFocus {...register("new_password")} className="pr-10" />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.new_password && <p className="text-sm text-destructive">{errors.new_password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">{t("auth.confirmPassword")}</Label>
              <Input id="confirm_password" type={showPassword ? "text" : "password"} {...register("confirm_password")} />
              {errors.confirm_password && <p className="text-sm text-destructive">{errors.confirm_password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("common.loading") : t("auth.resetPassword")}
            </Button>
            <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
              <ArrowLeft size={16} /> {t("auth.back_to_login")}
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

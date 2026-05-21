import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { api, setTokens } from "../../lib/api.js";
import { useAuthStore, type AdminUser } from "../../store/auth.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card.js";
import { toast } from "../../hooks/use-toast.js";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setMfaToken = useAuthStore((s) => s.setMfaToken);

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("dorada_remembered_email"));

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const saved = localStorage.getItem("dorada_remembered_email");
    if (saved) setValue("email", saved);
  }, [setValue]);

  async function onSubmit(data: FormData) {
    try {
      const res = await api.post<
        { mfa_token: string } | { access_token: string; refresh_token: string; admin: { id: string; name: string; email: string; role: object; permissions: string[] } }
      >("/auth/admin/login", data);

      if (rememberMe) {
        localStorage.setItem("dorada_remembered_email", data.email);
      } else {
        localStorage.removeItem("dorada_remembered_email");
      }

      if ("mfa_token" in res) {
        setMfaToken(res.mfa_token);
        navigate("/mfa");
      } else {
        setTokens(res.access_token, res.refresh_token);
        useAuthStore.getState().setUser(res.admin as AdminUser);
        navigate("/");
      }
    } catch (err) {
      toast({ title: t("auth.login_failed"), variant: "destructive" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <img src="/dorada-logo-trans2.png" alt="Dorada" className="h-16 w-16 rounded-full object-cover" />
          </div>
          <CardTitle className="text-3xl">Dorada</CardTitle>
          <CardDescription>{t("auth.sign_in_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} {...register("password")} className="pr-10" />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              <Label htmlFor="remember-me" className="cursor-pointer font-normal text-muted-foreground">
                {t("auth.remember_me")}
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("common.loading") : t("auth.sign_in")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

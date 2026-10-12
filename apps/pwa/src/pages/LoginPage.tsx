import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, setTokens } from "../lib/api";
import { useAuthStore } from "../store/auth";

type Step = "email" | "otp";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setInterpreter = useAuthStore((s) => s.setInterpreter);
  const interpreter = useAuthStore((s) => s.interpreter);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(() => localStorage.getItem("dorada_saved_email") ?? "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (interpreter) navigate("/appointments", { replace: true });
  }, [interpreter, navigate]);

  async function requestOtp() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/interpreter/otp/request", { email: trimmed });
      localStorage.setItem("dorada_saved_email", trimmed);
      setEmail(trimmed);
      setStep("otp");
    } catch {
      setError(t("auth.otp_failed"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otp.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post<{
        access_token: string;
        refresh_token: string;
        interpreter: { id: string; name: string; phone: string; organization_id: string };
      }>("/auth/interpreter/otp/verify", { email: email.trim().toLowerCase(), otp: otp.trim() });
      setTokens(res.access_token, res.refresh_token);
      setInterpreter(res.interpreter);
      navigate("/appointments", { replace: true });
    } catch {
      setError(t("auth.otp_invalid"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-forest flex items-center justify-center text-white font-bold text-xl">D</div>
          <h1 className="text-3xl font-bold text-forest">Dorada</h1>
        </div>
        <p className="text-center text-[var(--color-text-muted)] mb-8">
          {step === "email" ? t("auth.enter_email") : t("auth.enter_otp")}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={(e) => { e.preventDefault(); requestOtp(); }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.email_placeholder")}
              autoFocus
              autoComplete="email"
              className="w-full bg-surface border border-[var(--color-border)] rounded-lg px-4 py-3.5 text-base mb-4 outline-none focus:border-forest focus:ring-1 focus:ring-forest"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-forest text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-60 active:opacity-80 transition-opacity"
            >
              {loading ? t("common.loading") : t("auth.send_code")}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); verifyOtp(); }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoFocus
              autoComplete="one-time-code"
              className="w-full bg-surface border border-[var(--color-border)] rounded-lg px-4 py-3.5 text-center text-2xl tracking-[0.3em] font-mono mb-4 outline-none focus:border-forest focus:ring-1 focus:ring-forest"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-forest text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-60 active:opacity-80 transition-opacity"
            >
              {loading ? t("common.loading") : t("auth.verify")}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); setError(""); }}
              className="w-full mt-4 text-forest text-sm font-medium"
            >
              {t("common.back")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

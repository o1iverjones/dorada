import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { api, setTokens } from "../src/lib/api.js";
import { useAuthStore } from "../src/store/auth.js";
import { registerForPushNotifications, syncFcmToken } from "../src/lib/notifications.js";

type Step = "phone" | "otp";

export default function LoginScreen() {
  const { t } = useTranslation();
  const setInterpreter = useAuthStore((s) => s.setInterpreter);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      await api.post("/auth/interpreter/request-otp", { phone: phone.trim() });
      setStep("otp");
    } catch {
      Alert.alert(t("auth.error"), t("auth.otp_failed"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const res = await api.post<{
        access_token: string;
        refresh_token: string;
        interpreter: { id: string; name: string; phone: string; organization_id: string };
      }>("/auth/interpreter/verify-otp", { phone: phone.trim(), otp: otp.trim() });

      await setTokens(res.access_token, res.refresh_token);
      setInterpreter(res.interpreter);

      const fcmToken = await registerForPushNotifications();
      if (fcmToken) await syncFcmToken(fcmToken).catch(() => {});

      router.replace("/(tabs)/appointments");
    } catch {
      Alert.alert(t("auth.error"), t("auth.otp_invalid"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.logo}>Pulpito</Text>
        <Text style={styles.subtitle}>
          {step === "phone" ? t("auth.enter_phone") : t("auth.enter_otp")}
        </Text>

        {step === "phone" ? (
          <>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t("auth.phone_placeholder")}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={requestOtp} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? t("common.loading") : t("auth.send_code")}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={verifyOtp} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? t("common.loading") : t("auth.verify")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButton} onPress={() => setStep("phone")}>
              <Text style={styles.backText}>{t("common.back")}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  logo: { fontSize: 36, fontWeight: "bold", color: "#3b82f6", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#64748b", textAlign: "center", marginBottom: 32 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 16 },
  button: { backgroundColor: "#3b82f6", borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  backButton: { marginTop: 16, alignItems: "center" },
  backText: { color: "#3b82f6", fontSize: 14 },
});

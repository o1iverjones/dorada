import { useState, useEffect } from "react";
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { C } from "../src/theme";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import * as SecureStore from "expo-secure-store";
import { api, setTokens } from "../src/lib/api";
import { useAuthStore } from "../src/store/auth";
import { registerForPushNotifications, syncFcmToken } from "../src/lib/notifications";

const SAVED_PHONE_KEY = "dorada_saved_phone";

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

type Step = "phone" | "otp";

export default function LoginScreen() {
  const { t } = useTranslation();
  const setInterpreter = useAuthStore((s) => s.setInterpreter);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(SAVED_PHONE_KEY).then((saved) => {
      if (saved) setPhone(saved);
    });
  }, []);

  async function requestOtp() {
    if (!phone.trim()) return;
    const normalized = normalizePhone(phone);
    setLoading(true);
    try {
      await api.post("/auth/interpreter/otp/request", { phone: normalized });
      await SecureStore.setItemAsync(SAVED_PHONE_KEY, normalized);
      setPhone(normalized);
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
      }>("/auth/interpreter/otp/verify", { phone: normalizePhone(phone), otp: otp.trim() });

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
        <View style={styles.logoRow}>
          <Image source={require("../assets/logo.jpeg")} style={styles.logoImage} />
          <Text style={styles.logo}>Dorada</Text>
        </View>
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
  container: { flex: 1, backgroundColor: C.background },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 },
  logoImage: { width: 48, height: 48, borderRadius: 24 },
  logo: { fontSize: 36, fontWeight: "bold", color: C.primary },
  subtitle: { fontSize: 16, color: C.textMuted, textAlign: "center", marginBottom: 32 },
  input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 16, color: C.text },
  button: { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  backButton: { marginTop: 16, alignItems: "center" },
  backText: { color: C.primary, fontSize: 14 },
});

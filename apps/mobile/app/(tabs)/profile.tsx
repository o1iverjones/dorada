import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, clearTokens } from "../../src/lib/api";
import { useAuthStore } from "../../src/store/auth";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { interpreter, logout } = useAuthStore();

  const { data } = useQuery({
    queryKey: ["interpreter-profile"],
    queryFn: () => api.get("/interpreters/me"),
  });

  const profile = data as Record<string, unknown> | undefined;

  function handleLogout() {
    Alert.alert(t("account.logout_confirm_title"), t("account.logout_confirm_body"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("nav.logout"),
        style: "destructive",
        onPress: async () => {
          await clearTokens();
          logout();
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{interpreter?.name?.slice(0, 2).toUpperCase() ?? "??"}</Text>
        </View>
        <Text style={styles.name}>{interpreter?.name ?? "—"}</Text>
        <Text style={styles.phone}>{interpreter?.phone ?? "—"}</Text>
      </View>

      {profile && (
        <View style={styles.section}>
          <Row label={t("interpreters.type")} value={(profile.type as string) ?? "—"} />
          <Row label={t("interpreters.languages")} value={((profile.languages as string[]) ?? []).join(", ")} />
          <Row label={t("interpreters.email")} value={(profile.email as string) ?? "—"} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("account.notification_preference")}</Text>
        <Text style={styles.sectionHint}>{t("account.follow_up_channel_hint")}</Text>
        <View style={styles.channelRow}>
          {(["push", "sms"] as const).map((ch) => (
            <TouchableOpacity
              key={ch}
              style={[styles.channelBtn, profile?.follow_up_channel === ch && styles.channelBtnActive]}
              onPress={() => api.patch("/interpreters/me", { follow_up_channel: ch })}
            >
              <Ionicons
                name={ch === "push" ? "notifications-outline" : "chatbubble-outline"}
                size={18}
                color={profile?.follow_up_channel === ch ? "#fff" : "#64748b"}
              />
              <Text style={[styles.channelBtnText, profile?.follow_up_channel === ch && styles.channelBtnActiveText]}>
                {ch === "push" ? "Push" : "SMS"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#dc2626" />
        <Text style={styles.logoutText}>{t("nav.logout")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 16 },
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#3b82f6", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: "700", color: "#fff" },
  name: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  phone: { fontSize: 14, color: "#64748b", marginTop: 2 },
  section: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#0f172a", marginBottom: 4 },
  sectionHint: { fontSize: 12, color: "#94a3b8", marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  rowLabel: { fontSize: 14, color: "#64748b" },
  rowValue: { fontSize: 14, color: "#0f172a", fontWeight: "500", flex: 1, textAlign: "right" },
  channelRow: { flexDirection: "row", gap: 10 },
  channelBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" },
  channelBtnActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  channelBtnText: { color: "#64748b", fontWeight: "500" },
  channelBtnActiveText: { color: "#fff" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: "#fecaca" },
  logoutText: { color: "#dc2626", fontWeight: "600", fontSize: 15 },
});

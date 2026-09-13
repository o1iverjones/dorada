import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, clearTokens } from "../../src/lib/api";
import { useAuthStore } from "../../src/store/auth";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../src/theme";

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
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: 16, gap: 16 },
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: "700", color: "#fff" },
  name: { fontSize: 20, fontWeight: "700", color: C.text },
  phone: { fontSize: 14, color: C.textMuted, marginTop: 2 },
  section: { backgroundColor: C.surface, borderRadius: 12, padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  rowLabel: { fontSize: 14, color: C.textMuted },
  rowValue: { fontSize: 14, color: C.text, fontWeight: "500", flex: 1, textAlign: "right" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.surface, borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: C.dangerBorder },
  logoutText: { color: C.danger, fontWeight: "600", fontSize: 15 },
});

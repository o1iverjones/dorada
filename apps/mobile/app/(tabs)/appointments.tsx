import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMyAppointments, useAppointmentOffers, useConfirmOffer, useDeclineOffer } from "../../src/hooks/useAppointments.js";
import { Ionicons } from "@expo/vector-icons";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#16a34a",
  pending_offer: "#d97706",
  in_progress: "#2563eb",
  completed: "#64748b",
  cancelled: "#dc2626",
};

export default function AppointmentsScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"upcoming" | "offers">("upcoming");

  const { data: appts, isLoading: apptLoading, refetch: refetchAppts } = useMyAppointments({ status: "confirmed,in_progress", limit: "30" });
  const { data: offers, isLoading: offersLoading, refetch: refetchOffers } = useAppointmentOffers();

  const upcoming = (appts?.data ?? []) as Array<Record<string, unknown>>;
  const pendingOffers = (offers?.data ?? []) as Array<Record<string, unknown>>;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "upcoming" && styles.activeTab]}
          onPress={() => setTab("upcoming")}
        >
          <Text style={[styles.tabText, tab === "upcoming" && styles.activeTabText]}>{t("appointments.upcoming")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "offers" && styles.activeTab]}
          onPress={() => setTab("offers")}
        >
          <Text style={[styles.tabText, tab === "offers" && styles.activeTabText]}>
            {t("appointments.offers")}
            {pendingOffers.length > 0 && (
              <Text style={styles.badge}> {pendingOffers.length}</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "upcoming" ? (
        <FlatList
          data={upcoming}
          keyExtractor={(item) => item.id as string}
          refreshControl={<RefreshControl refreshing={apptLoading} onRefresh={refetchAppts} />}
          ListEmptyComponent={<Text style={styles.empty}>{t("appointments.no_upcoming")}</Text>}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/appointment/${item.id}`)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>{new Date(item.date_time as string).toLocaleDateString()}</Text>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status as string] ?? "#64748b" }]} />
              </View>
              <Text style={styles.cardTitle}>{new Date(item.date_time as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
              <Text style={styles.cardSubtitle}>{item.clinic_name as string}</Text>
              <Text style={styles.cardLang}>{item.language as string}</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={pendingOffers}
          keyExtractor={(item) => item.offer_id as string ?? item.id as string}
          refreshControl={<RefreshControl refreshing={offersLoading} onRefresh={refetchOffers} />}
          ListEmptyComponent={<Text style={styles.empty}>{t("appointments.no_offers")}</Text>}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <OfferCard offer={item} />}
        />
      )}
    </View>
  );
}

function OfferCard({ offer }: { offer: Record<string, unknown> }) {
  const { t } = useTranslation();
  const confirm = useConfirmOffer(offer.id as string, offer.offer_id as string);
  const decline = useDeclineOffer(offer.id as string, offer.offer_id as string);

  async function handleConfirm() {
    try {
      await confirm.mutateAsync(undefined);
    } catch (err) {
      Alert.alert(t("common.error"), t("appointments.confirm_failed"));
    }
  }

  async function handleDecline() {
    try {
      await decline.mutateAsync(undefined);
    } catch {
      Alert.alert(t("common.error"));
    }
  }

  return (
    <View style={styles.offerCard}>
      <Text style={styles.cardDate}>{new Date(offer.date_time as string).toLocaleString()}</Text>
      <Text style={styles.cardTitle}>{offer.clinic_name as string}</Text>
      <Text style={styles.cardSubtitle}>{offer.language as string} · {offer.interpreter_type_required as string}</Text>
      <View style={styles.offerActions}>
        <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={handleConfirm} disabled={confirm.isPending}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>{t("appointments.confirm")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={handleDecline} disabled={decline.isPending}>
          <Ionicons name="close" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>{t("appointments.decline")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  activeTab: { borderBottomWidth: 2, borderBottomColor: "#3b82f6" },
  tabText: { fontSize: 14, color: "#64748b", fontWeight: "500" },
  activeTabText: { color: "#3b82f6" },
  badge: { color: "#ef4444", fontWeight: "700" },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  offerCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#fbbf24" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardDate: { fontSize: 12, color: "#64748b" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: "#64748b" },
  cardLang: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 48, fontSize: 15 },
  offerActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 8, gap: 6 },
  confirmBtn: { backgroundColor: "#16a34a" },
  declineBtn: { backgroundColor: "#dc2626" },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});

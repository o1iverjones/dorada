import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMyAppointments, useAppointmentOffers, useConfirmOffer, useDeclineOffer } from "../../src/hooks/useAppointments";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../src/theme";

const STATUS_COLORS: Record<string, string> = {
  confirmed: C.success,
  pending_offer: C.warning,
  in_progress: C.inProgress,
  completed: C.completed,
  cancelled: C.danger,
};

export default function AppointmentsScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"upcoming" | "offers" | "history">("upcoming");

  const { data: appts, isLoading: apptLoading, refetch: refetchAppts } = useMyAppointments({ status: "confirmed,in_progress", limit: "30" });
  const { data: offers, isLoading: offersLoading, refetch: refetchOffers } = useAppointmentOffers();
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useMyAppointments({ status: "completed", limit: "50" });

  const upcoming = (appts?.data ?? []) as Array<Record<string, unknown>>;
  const pendingOffers = (offers?.data ?? []) as Array<Record<string, unknown>>;
  const history = (historyData?.data ?? []) as Array<Record<string, unknown>>;

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
        <TouchableOpacity
          style={[styles.tab, tab === "history" && styles.activeTab]}
          onPress={() => setTab("history")}
        >
          <Text style={[styles.tabText, tab === "history" && styles.activeTabText]}>{t("appointments.history")}</Text>
        </TouchableOpacity>
      </View>

      {tab === "upcoming" && (
        <FlatList
          data={upcoming}
          keyExtractor={(item) => item.id as string}
          refreshControl={<RefreshControl refreshing={apptLoading} onRefresh={refetchAppts} />}
          ListEmptyComponent={<Text style={styles.empty}>{t("appointments.no_upcoming")}</Text>}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <AppointmentCard item={item} />}
        />
      )}
      {tab === "offers" && (
        <FlatList
          data={pendingOffers}
          keyExtractor={(item) => item.offer_id as string ?? item.id as string}
          refreshControl={<RefreshControl refreshing={offersLoading} onRefresh={refetchOffers} />}
          ListEmptyComponent={<Text style={styles.empty}>{t("appointments.no_offers")}</Text>}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <OfferCard offer={item} />}
        />
      )}
      {tab === "history" && (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id as string}
          refreshControl={<RefreshControl refreshing={historyLoading} onRefresh={refetchHistory} />}
          ListEmptyComponent={<Text style={styles.empty}>{t("appointments.no_history")}</Text>}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <AppointmentCard item={item} />}
        />
      )}
    </View>
  );
}

function AppointmentCard({ item }: { item: Record<string, unknown> }) {
  const clinic = item.clinic as Record<string, unknown> | null;
  const patient = item.patient as Record<string, unknown> | null;
  const dt = new Date(item.date_time as string);
  const notes = (clinic?.interpreter_notes as Array<{ id: string; type: string }>) ?? [];
  const noteTypes = [...new Set(notes.map((n) => n.type))];
  return (
    <TouchableOpacity style={styles.card} onPress={() => { const id = item.id as string; if (id) router.navigate(`/appointment/${id}`); }}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status as string] ?? C.completed }]} />
        <Text style={styles.cardDate}>
          {dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
        </Text>
        <Text style={styles.cardTime}>
          {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
        {noteTypes.length > 0 && (
          <View style={styles.noteIcons}>
            {noteTypes.map((type) => (
              <Ionicons
                key={type}
                name={type === "important" ? "alert-circle" : type === "notice" ? "warning-outline" : "information-circle-outline"}
                size={22}
                color={type === "important" ? "#b91c1c" : type === "notice" ? C.warning : "#1e40af"}
              />
            ))}
          </View>
        )}
      </View>
      <Text style={styles.cardPatient}>{patient?.name as string ?? "—"}</Text>
      <Text style={styles.cardClinic}>{clinic?.name as string ?? "—"}</Text>
      <Text style={styles.cardLang}>{item.language as string}</Text>
      <Ionicons name="chevron-forward" size={16} color={C.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );
}

function OfferCard({ offer }: { offer: Record<string, unknown> }) {
  const { t } = useTranslation();
  const confirm = useConfirmOffer(offer.id as string, offer.offer_id as string);
  const decline = useDeclineOffer(offer.id as string, offer.offer_id as string);
  async function handleConfirm() {
    try {
      await confirm.mutateAsync(undefined);
    } catch {
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
      <Text style={styles.cardPatient}>{offer.clinic_name as string}</Text>
      <Text style={styles.cardClinic}>{offer.language as string} · {offer.interpreter_type_required as string}</Text>
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
  container: { flex: 1, backgroundColor: C.background },
  tabs: { flexDirection: "row", backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  activeTab: { borderBottomWidth: 2, borderBottomColor: C.primary },
  tabText: { fontSize: 14, color: C.textMuted, fontWeight: "500" },
  activeTabText: { color: C.primary },
  badge: { color: C.danger, fontWeight: "700" },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: C.surface, borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  offerCard: { backgroundColor: C.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.warningBorder },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardDate: { fontSize: 13, fontWeight: "600", color: C.text },
  cardTime: { fontSize: 13, color: C.textMuted },
  noteIcons: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto", marginRight: 24 },
  cardPatient: { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 2 },
  cardClinic: { fontSize: 14, color: C.textMuted, marginBottom: 2 },
  cardLang: { fontSize: 12, color: C.textSubtle },
  chevron: { position: "absolute", right: 16, bottom: 16 },
  empty: { textAlign: "center", color: C.textSubtle, marginTop: 48, fontSize: 15 },
  offerActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 8, gap: 6 },
  confirmBtn: { backgroundColor: C.success },
  declineBtn: { backgroundColor: C.danger },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});

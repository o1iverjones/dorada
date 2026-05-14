import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../../src/lib/api";

type InvoiceAppointment = {
  id: string;
  date_time: string;
  po_number: string | null;
  patient: { id: string; name: string };
};

type Invoice = {
  id: string;
  status: "submitted" | "approved";
  amount: number;
  billable_minutes: number;
  pay_rate: number;
  submitted_at: string;
  appointment?: InvoiceAppointment;
};

type EarningsSummary = {
  total_earnings: number;
  approved_count: number;
  submitted_count: number;
  period_label: string;
};

type EarningsResponse = {
  summary: EarningsSummary;
  data: Invoice[];
};

type PeriodKey = "this_month" | "ytd" | "all_time" | "custom";

interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

function toISO(mmddyyyy: string): string | null {
  const parts = mmddyyyy.replace(/\D/g, "/").split("/");
  if (parts.length !== 3) return null;
  const [m, d, y] = parts;
  if (!m || !d || !y || y.length !== 4) return null;
  const date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  if (isNaN(date.getTime())) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function formatDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y}`;
}

function getPeriodDates(period: PeriodKey, custom: DateRange): { date_from?: string; date_to?: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (period) {
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { date_from: start.toISOString().slice(0, 10), date_to: today };
    }
    case "ytd": {
      return { date_from: `${now.getFullYear()}-01-01`, date_to: today };
    }
    case "all_time":
      return {};
    case "custom":
      return {
        ...(custom.from ? { date_from: custom.from } : {}),
        ...(custom.to ? { date_to: custom.to } : {}),
      };
  }
}

export default function EarningsScreen() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [custom, setCustom] = useState<DateRange>({ from: "", to: "" });
  const [showDateModal, setShowDateModal] = useState(false);
  const [response, setResponse] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const dates = getPeriodDates(period, custom);
      const qs = new URLSearchParams(dates as Record<string, string>).toString();
      const data = await api.get<EarningsResponse>(`/invoices/me${qs ? `?${qs}` : ""}`);
      setResponse(data);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, custom]);

  useEffect(() => { load(); }, [load]);

  const summary = response?.summary;
  const invoices = response?.data ?? [];

  const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: "this_month", label: "This Month" },
    { key: "ytd", label: "Year to Date" },
    { key: "all_time", label: "All Time" },
    { key: "custom", label: "Date Range" },
  ];

  function handlePeriodPress(key: PeriodKey) {
    if (key === "custom") {
      setShowDateModal(true);
    } else {
      setPeriod(key);
    }
  }

  // Custom date range label shown under the chips
  const customLabel =
    period === "custom" && (custom.from || custom.to)
      ? [custom.from && `From ${formatDisplay(custom.from)}`, custom.to && `To ${formatDisplay(custom.to)}`]
          .filter(Boolean)
          .join("  ·  ")
      : null;

  return (
    <>
      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListHeaderComponent={
          <View>
            {/* Period filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {PERIODS.map(({ key, label }) => {
                const isActive = period === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handlePeriodPress(key)}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Custom range label */}
            {customLabel ? (
              <TouchableOpacity onPress={() => setShowDateModal(true)} style={styles.customLabelRow}>
                <Text style={styles.customLabelText}>{customLabel}</Text>
                <Text style={styles.customLabelEdit}>Edit</Text>
              </TouchableOpacity>
            ) : null}

            {/* Summary card */}
            {loading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#0e402d" />
              </View>
            ) : (
              <View style={styles.summaryCard}>
                <Text style={styles.periodLabel}>{summary?.period_label ?? "—"}</Text>
                <Text style={styles.totalEarnings}>${(summary?.total_earnings ?? 0).toFixed(2)}</Text>
                <Text style={styles.summarySubLabel}>{t("invoices.total_earnings")}</Text>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{summary?.approved_count ?? 0}</Text>
                    <Text style={styles.statLabel}>{t("invoices.approved_count")}</Text>
                  </View>
                  <View style={[styles.statItem, styles.statDivider]}>
                    <Text style={styles.statValue}>{summary?.submitted_count ?? 0}</Text>
                    <Text style={styles.statLabel}>{t("invoices.submitted_count")}</Text>
                  </View>
                </View>
              </View>
            )}

            {!loading && invoices.length > 0 && (
              <Text style={styles.sectionTitle}>{t("invoices.earnings")}</Text>
            )}
          </View>
        }
        renderItem={({ item }) => <InvoiceRow invoice={item} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t("invoices.empty")}</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
      />

      <DateRangeModal
        visible={showDateModal}
        initial={custom}
        onClose={() => setShowDateModal(false)}
        onApply={(range) => {
          setCustom(range);
          setPeriod("custom");
          setShowDateModal(false);
        }}
      />
    </>
  );
}

// ─── Date Range Modal ─────────────────────────────────────────────────────────

function DateRangeModal({
  visible,
  initial,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: DateRange;
  onClose: () => void;
  onApply: (range: DateRange) => void;
}) {
  const [fromInput, setFromInput] = useState(initial.from ? formatDisplay(initial.from) : "");
  const [toInput, setToInput] = useState(initial.to ? formatDisplay(initial.to) : "");

  // Reset inputs when modal opens
  useEffect(() => {
    if (visible) {
      setFromInput(initial.from ? formatDisplay(initial.from) : "");
      setToInput(initial.to ? formatDisplay(initial.to) : "");
    }
  }, [visible, initial.from, initial.to]);

  function applyQuickRange(months: number | null) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (months === null) {
      setFromInput("");
      setToInput("");
      return;
    }
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    setFromInput(formatDisplay(start.toISOString().slice(0, 10)));
    setToInput(formatDisplay(today));
  }

  function handleApply() {
    const from = fromInput.trim() ? toISO(fromInput.trim()) : null;
    const to = toInput.trim() ? toISO(toInput.trim()) : null;

    if ((fromInput.trim() && !from) || (toInput.trim() && !to)) {
      Alert.alert("Invalid date", "Please enter dates in MM/DD/YYYY format.");
      return;
    }
    if (from && to && new Date(from) > new Date(to)) {
      Alert.alert("Invalid range", "Start date must be before end date.");
      return;
    }
    onApply({ from: from ?? "", to: to ?? "" });
  }

  const QUICK = [
    { label: "Last 30 days", months: 1 },
    { label: "Last 3 months", months: 3 },
    { label: "Last 6 months", months: 6 },
    { label: "Last 12 months", months: 12 },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={modal.container}>
          {/* Header */}
          <View style={modal.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={modal.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={modal.title}>Date Range</Text>
            <TouchableOpacity onPress={handleApply}>
              <Text style={modal.apply}>Apply</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={modal.body}>
            {/* Quick ranges */}
            <Text style={modal.sectionLabel}>Quick Select</Text>
            <View style={modal.quickGrid}>
              {QUICK.map(({ label, months }) => (
                <TouchableOpacity
                  key={label}
                  style={modal.quickChip}
                  onPress={() => applyQuickRange(months)}
                >
                  <Text style={modal.quickChipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Divider */}
            <View style={modal.divider} />

            {/* Manual inputs */}
            <Text style={modal.sectionLabel}>Custom Range</Text>

            <View style={modal.inputGroup}>
              <Text style={modal.inputLabel}>From (MM/DD/YYYY)</Text>
              <TextInput
                style={modal.input}
                value={fromInput}
                onChangeText={setFromInput}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="#aaa"
                keyboardType="numbers-and-punctuation"
                returnKeyType="next"
                maxLength={10}
              />
            </View>

            <View style={modal.inputGroup}>
              <Text style={modal.inputLabel}>To (MM/DD/YYYY)</Text>
              <TextInput
                style={modal.input}
                value={toInput}
                onChangeText={setToInput}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="#aaa"
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                onSubmitEditing={handleApply}
                maxLength={10}
              />
            </View>

            <TouchableOpacity style={modal.clearBtn} onPress={() => { setFromInput(""); setToInput(""); }}>
              <Text style={modal.clearBtnText}>Clear dates</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Invoice Row ──────────────────────────────────────────────────────────────

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const appt = invoice.appointment;
  const date = appt?.date_time ? new Date(appt.date_time) : null;
  const dateStr = date
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " · " +
      date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.patientName}>{appt?.patient.name ?? "—"}</Text>
        <Text style={styles.rowMeta}>{dateStr}</Text>
        <View style={styles.rowDetails}>
          {appt?.po_number ? <Text style={styles.rowDetail}>PO: {appt.po_number}</Text> : null}
          <Text style={styles.rowDetail}>{invoice.billable_minutes} min</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.amount}>${invoice.amount.toFixed(2)}</Text>
        <StatusPill status={invoice.status} />
      </View>
    </View>
  );
}

function StatusPill({ status }: { status: "submitted" | "approved" }) {
  const { t } = useTranslation();
  const isApproved = status === "approved";
  return (
    <View style={[styles.pill, isApproved ? styles.pillApproved : styles.pillSubmitted]}>
      <Text style={[styles.pillText, isApproved ? styles.pillTextApproved : styles.pillTextSubmitted]}>
        {isApproved ? t("invoices.status_approved") : t("invoices.status_submitted")}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { paddingBottom: 24 },

  chipRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#0e402d", borderColor: "#0e402d" },
  chipText: { fontSize: 13, fontWeight: "500", color: "#374151" },
  chipTextActive: { color: "#fff" },

  customLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  customLabelText: { fontSize: 13, color: "#166534", fontWeight: "500" },
  customLabelEdit: { fontSize: 13, color: "#0e402d", fontWeight: "600" },

  loadingCard: {
    margin: 16,
    height: 180,
    borderRadius: 16,
    backgroundColor: "#0e402d",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    backgroundColor: "#0e402d",
    margin: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  periodLabel: { color: "#a7f3d0", fontSize: 13, fontWeight: "500", marginBottom: 8 },
  totalEarnings: { color: "#fff", fontSize: 40, fontWeight: "700", letterSpacing: -1 },
  summarySubLabel: { color: "#a7f3d0", fontSize: 13, marginBottom: 20 },
  statsRow: {
    flexDirection: "row",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: 16,
  },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.2)" },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "700" },
  statLabel: { color: "#a7f3d0", fontSize: 12, marginTop: 2, textAlign: "center" },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  rowLeft: { flex: 1, marginRight: 12 },
  patientName: { fontSize: 15, fontWeight: "600", color: "#111", marginBottom: 3 },
  rowMeta: { fontSize: 12, color: "#666", marginBottom: 4 },
  rowDetails: { flexDirection: "row", gap: 10 },
  rowDetail: { fontSize: 12, color: "#888" },
  rowRight: { alignItems: "flex-end", gap: 6 },
  amount: { fontSize: 17, fontWeight: "700", color: "#0e402d" },
  pill: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  pillApproved: { backgroundColor: "#dcfce7" },
  pillSubmitted: { backgroundColor: "#fff7ed" },
  pillText: { fontSize: 11, fontWeight: "600" },
  pillTextApproved: { color: "#166534" },
  pillTextSubmitted: { color: "#c2410c" },
  emptyText: { color: "#999", fontSize: 14 },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  cancel: { fontSize: 16, color: "#6b7280" },
  title: { fontSize: 17, fontWeight: "700", color: "#111" },
  apply: { fontSize: 16, fontWeight: "700", color: "#0e402d" },
  body: { padding: 20, gap: 0 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  quickChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  quickChipText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#111",
  },
  clearBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  clearBtnText: { fontSize: 14, color: "#9ca3af" },
});

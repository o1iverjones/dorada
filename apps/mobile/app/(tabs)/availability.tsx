import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar } from "react-native-calendars";
import { api } from "../../src/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../src/theme";

interface Block {
  id: string;
  from: string;
  to: string;
  reason?: string;
}

type MarkedDates = Record<string, {
  startingDay?: boolean;
  endingDay?: boolean;
  color?: string;
  textColor?: string;
  marked?: boolean;
}>;

function buildMarkedDates(start: string, end: string): MarkedDates {
  const marked: MarkedDates = {};
  if (!start) return marked;

  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : startMs;
  const current = new Date(startMs);

  while (current.getTime() <= endMs) {
    const key = current.toISOString().split("T")[0];
    const isStart = key === start;
    const isEnd = key === (end || start);
    marked[key] = {
      color: C.primary,
      textColor: "#fff",
      startingDay: isStart,
      endingDay: isEnd,
    };
    current.setDate(current.getDate() + 1);
  }

  return marked;
}

export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["availability-blocks"],
    queryFn: () => api.get<{ data: Block[] }>("/interpreters/me/availability"),
  });

  const create = useMutation({
    mutationFn: (body: unknown) => api.post("/interpreters/me/availability", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability-blocks"] });
      setPickerVisible(false);
      setStartDate("");
      setEndDate("");
      setNote("");
    },
  });

  const remove = useMutation({
    mutationFn: (blockId: string) => api.delete(`/interpreters/me/availability/${blockId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability-blocks"] }),
  });

  function handleDayPress(day: { dateString: string }) {
    if (selecting === "start") {
      setStartDate(day.dateString);
      setEndDate("");
      setSelecting("end");
    } else {
      if (day.dateString < startDate) {
        setStartDate(day.dateString);
        setEndDate("");
        setSelecting("end");
      } else {
        setEndDate(day.dateString);
      }
    }
  }

  function confirmDelete(blockId: string) {
    Alert.alert(t("availability.delete_confirm"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => remove.mutate(blockId) },
    ]);
  }

  function handleSave() {
    const end = endDate || startDate;
    create.mutate({
      from: `${startDate}T00:00:00.000Z`,
      to: `${end}T23:59:59.000Z`,
      reason: note || undefined,
    });
  }

  const blocks = data?.data ?? [];
  const markedDates = buildMarkedDates(startDate, endDate);

  const today = new Date().toISOString().split("T")[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{t("availability.unavailable_blocks")}</Text>
        <TouchableOpacity onPress={() => setPickerVisible(true)}>
          <Ionicons name="add-circle-outline" size={28} color={C.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={blocks}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refetch}
        ListEmptyComponent={<Text style={styles.empty}>{t("availability.no_blocks")}</Text>}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.block}>
            <View style={styles.blockInfo}>
              <Text style={styles.blockDate}>
                {new Date(item.from).toLocaleDateString()} — {new Date(item.to).toLocaleDateString()}
              </Text>
              {item.reason && <Text style={styles.blockNote}>{item.reason}</Text>}
            </View>
            <TouchableOpacity onPress={() => confirmDelete(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("availability.select_dates")}</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Ionicons name="close" size={24} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.selectionHint}>
            <SelectionChip
              label={t("availability.start_date")}
              value={startDate}
              active={selecting === "start"}
              onPress={() => setSelecting("start")}
            />
            <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
            <SelectionChip
              label={t("availability.end_date")}
              value={endDate || (startDate ? startDate : "")}
              active={selecting === "end"}
              onPress={() => startDate && setSelecting("end")}
            />
          </View>

          <Calendar
            markingType="period"
            markedDates={markedDates}
            onDayPress={handleDayPress}
            minDate={today}
            theme={{
              todayTextColor: C.primary,
              arrowColor: C.primary,
              selectedDayBackgroundColor: C.primary,
            }}
          />

          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>{t("availability.note")}</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder={t("common.optional")}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, !startDate && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!startDate || create.isPending}
          >
            <Text style={styles.saveBtnText}>{t("common.save")}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function SelectionChip({ label, value, active, onPress }: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, active && styles.chipValueActive]}>
        {value || "—"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  headerText: { fontSize: 16, fontWeight: "600", color: C.text },
  list: { padding: 16, gap: 10 },
  block: { backgroundColor: C.surface, borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  blockInfo: { flex: 1 },
  blockDate: { fontSize: 14, fontWeight: "600", color: C.text },
  blockNote: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  empty: { textAlign: "center", color: C.textSubtle, marginTop: 48 },
  modal: { flex: 1, backgroundColor: C.background },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontWeight: "700", color: C.text },
  selectionHint: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  chip: { flex: 1, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, padding: 10, backgroundColor: C.background },
  chipActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  chipLabel: { fontSize: 11, color: C.textMuted, marginBottom: 2 },
  chipValue: { fontSize: 14, fontWeight: "600", color: C.text },
  chipValueActive: { color: C.primary },
  noteSection: { padding: 16 },
  noteLabel: { fontSize: 13, color: C.textMuted, marginBottom: 6 },
  noteInput: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text },
  saveBtn: { marginHorizontal: 16, marginTop: 8, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: C.primaryDisabled },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

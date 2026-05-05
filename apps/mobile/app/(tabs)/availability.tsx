import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../src/lib/api.js";
import { Ionicons } from "@expo/vector-icons";

interface Block {
  id: string;
  start_date: string;
  end_date: string;
  note?: string;
}

export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ start_date: "", end_date: "", note: "" });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["availability-blocks"],
    queryFn: () => api.get<{ data: Block[] }>("/interpreters/me/availability"),
  });

  const create = useMutation({
    mutationFn: (body: unknown) => api.post("/interpreters/me/availability", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["availability-blocks"] }); setAdding(false); },
  });

  const remove = useMutation({
    mutationFn: (blockId: string) => api.delete(`/interpreters/me/availability/${blockId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability-blocks"] }),
  });

  function confirmDelete(blockId: string) {
    Alert.alert(t("availability.delete_confirm"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => remove.mutate(blockId) },
    ]);
  }

  const blocks = data?.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{t("availability.unavailable_blocks")}</Text>
        <TouchableOpacity onPress={() => setAdding(!adding)}>
          <Ionicons name={adding ? "close" : "add-circle-outline"} size={28} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {adding && (
        <View style={styles.form}>
          <Text style={styles.label}>{t("availability.start_date")}</Text>
          <TextInput style={styles.input} value={form.start_date} onChangeText={(v) => setForm(s => ({ ...s, start_date: v }))} placeholder="YYYY-MM-DD" />
          <Text style={styles.label}>{t("availability.end_date")}</Text>
          <TextInput style={styles.input} value={form.end_date} onChangeText={(v) => setForm(s => ({ ...s, end_date: v }))} placeholder="YYYY-MM-DD" />
          <Text style={styles.label}>{t("availability.note")}</Text>
          <TextInput style={styles.input} value={form.note} onChangeText={(v) => setForm(s => ({ ...s, note: v }))} placeholder={t("common.optional")} />
          <TouchableOpacity style={styles.saveBtn} onPress={() => create.mutate(form)} disabled={create.isPending || !form.start_date}>
            <Text style={styles.saveBtnText}>{t("common.save")}</Text>
          </TouchableOpacity>
        </View>
      )}

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
              <Text style={styles.blockDate}>{item.start_date} — {item.end_date}</Text>
              {item.note && <Text style={styles.blockNote}>{item.note}</Text>}
            </View>
            <TouchableOpacity onPress={() => confirmDelete(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

import { TextInput } from "react-native";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerText: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  form: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  label: { fontSize: 13, color: "#64748b", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  saveBtn: { backgroundColor: "#3b82f6", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "600" },
  list: { padding: 16, gap: 10 },
  block: { backgroundColor: "#fff", borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  blockInfo: { flex: 1 },
  blockDate: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  blockNote: { fontSize: 13, color: "#64748b", marginTop: 2 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 48 },
});

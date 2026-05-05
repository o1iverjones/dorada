import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../src/lib/api.js";
import { useClockIn, useClockOut, useAddShiftNotes, useSubmitFollowUp } from "../../src/hooks/useAppointments.js";
import { Ionicons } from "@expo/vector-icons";

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUp, setFollowUp] = useState({
    has_follow_up: false,
    same_physician: false,
    same_clinic: false,
    date_time: "",
    notes: "",
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["appointment", id],
    queryFn: () => api.get(`/appointments/${id}`),
  });

  const clockIn = useClockIn(id!);
  const clockOut = useClockOut(id!);
  const addNotes = useAddShiftNotes(id!);
  const submitFollowUp = useSubmitFollowUp(id!);

  if (isLoading) return <View style={styles.center}><Text>{t("common.loading")}</Text></View>;
  if (!data) return <View style={styles.center}><Text>{t("common.not_found")}</Text></View>;

  const appt = data as Record<string, unknown>;

  async function handleClockIn() {
    try { await clockIn.mutateAsync(undefined); refetch(); }
    catch { Alert.alert(t("common.error")); }
  }

  async function handleClockOut() {
    try {
      await clockOut.mutateAsync(undefined);
      refetch();
      setShowFollowUp(true);
    } catch { Alert.alert(t("common.error")); }
  }

  async function handleSaveNotes() {
    try { await addNotes.mutateAsync({ notes }); setShowNotes(false); }
    catch { Alert.alert(t("common.error")); }
  }

  async function handleSubmitFollowUp() {
    try {
      await submitFollowUp.mutateAsync(followUp.has_follow_up ? followUp : { has_follow_up: false });
      setShowFollowUp(false);
    } catch { Alert.alert(t("common.error")); }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.label}>{t("appointments.status")}</Text>
        <Text style={styles.value}>{String(appt.status).replace(/_/g, " ")}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>{t("appointments.date_time")}</Text>
        <Text style={styles.value}>{new Date(appt.date_time as string).toLocaleString()}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>{t("appointments.patient")}</Text>
        <Text style={styles.value}>{(appt.patient as Record<string, unknown>)?.name as string ?? "—"}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>{t("appointments.clinic")}</Text>
        <Text style={styles.value}>{(appt.clinic as Record<string, unknown>)?.name as string ?? "—"}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>{t("appointments.language")}</Text>
        <Text style={styles.value}>{appt.language as string}</Text>
      </View>

      {appt.status === "confirmed" && (
        <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={handleClockIn} disabled={clockIn.isPending}>
          <Ionicons name="enter-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>{t("appointments.clock_in")}</Text>
        </TouchableOpacity>
      )}

      {appt.status === "in_progress" && (
        <>
          {appt.clock_in_time && (
            <View style={styles.section}>
              <Text style={styles.label}>{t("appointments.clocked_in_at")}</Text>
              <Text style={styles.value}>{new Date(appt.clock_in_time as string).toLocaleTimeString()}</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.btn, styles.dangerBtn]} onPress={handleClockOut} disabled={clockOut.isPending}>
            <Ionicons name="exit-outline" size={20} color="#fff" />
            <Text style={styles.btnText}>{t("appointments.clock_out")}</Text>
          </TouchableOpacity>
        </>
      )}

      {(appt.status === "completed" || appt.status === "in_progress") && (
        <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={() => setShowNotes(!showNotes)}>
          <Ionicons name="create-outline" size={20} color="#3b82f6" />
          <Text style={[styles.btnText, { color: "#3b82f6" }]}>{t("appointments.add_notes")}</Text>
        </TouchableOpacity>
      )}

      {showNotes && (
        <View style={styles.notesBox}>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholder={t("appointments.notes_placeholder")}
          />
          <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={handleSaveNotes}>
            <Text style={styles.btnText}>{t("common.save")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showFollowUp && (
        <View style={styles.followUpBox}>
          <Text style={styles.followUpTitle}>{t("follow_up.question")}</Text>
          <View style={styles.radioRow}>
            <TouchableOpacity style={[styles.radioBtn, followUp.has_follow_up && styles.radioBtnActive]} onPress={() => setFollowUp(s => ({ ...s, has_follow_up: true }))}>
              <Text style={followUp.has_follow_up ? styles.radioBtnActiveText : styles.radioBtnText}>{t("common.yes")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.radioBtn, !followUp.has_follow_up && styles.radioBtnActive]} onPress={() => setFollowUp(s => ({ ...s, has_follow_up: false }))}>
              <Text style={!followUp.has_follow_up ? styles.radioBtnActiveText : styles.radioBtnText}>{t("common.no")}</Text>
            </TouchableOpacity>
          </View>

          {followUp.has_follow_up && (
            <>
              <Text style={styles.followUpLabel}>{t("follow_up.same_physician")}</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity style={[styles.radioBtn, followUp.same_physician && styles.radioBtnActive]} onPress={() => setFollowUp(s => ({ ...s, same_physician: true }))}>
                  <Text style={followUp.same_physician ? styles.radioBtnActiveText : styles.radioBtnText}>{t("common.yes")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioBtn, !followUp.same_physician && styles.radioBtnActive]} onPress={() => setFollowUp(s => ({ ...s, same_physician: false }))}>
                  <Text style={!followUp.same_physician ? styles.radioBtnActiveText : styles.radioBtnText}>{t("common.no")}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.followUpLabel}>{t("follow_up.same_clinic")}</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity style={[styles.radioBtn, followUp.same_clinic && styles.radioBtnActive]} onPress={() => setFollowUp(s => ({ ...s, same_clinic: true }))}>
                  <Text style={followUp.same_clinic ? styles.radioBtnActiveText : styles.radioBtnText}>{t("common.yes")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.radioBtn, !followUp.same_clinic && styles.radioBtnActive]} onPress={() => setFollowUp(s => ({ ...s, same_clinic: false }))}>
                  <Text style={!followUp.same_clinic ? styles.radioBtnActiveText : styles.radioBtnText}>{t("common.no")}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.followUpLabel}>{t("follow_up.date_time")}</Text>
              <TextInput
                style={styles.notesInput}
                value={followUp.date_time}
                onChangeText={(v) => setFollowUp(s => ({ ...s, date_time: v }))}
                placeholder={t("follow_up.date_time_placeholder")}
              />
            </>
          )}

          <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={handleSubmitFollowUp}>
            <Text style={styles.btnText}>{t("common.submit")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { backgroundColor: "#fff", borderRadius: 8, padding: 14, marginBottom: 8 },
  label: { fontSize: 12, color: "#64748b", marginBottom: 2 },
  value: { fontSize: 15, color: "#0f172a", fontWeight: "500" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 10, gap: 8, marginTop: 8 },
  primaryBtn: { backgroundColor: "#3b82f6" },
  dangerBtn: { backgroundColor: "#dc2626" },
  secondaryBtn: { backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  notesBox: { backgroundColor: "#fff", borderRadius: 8, padding: 14, marginTop: 8, gap: 8 },
  notesInput: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: "top" },
  followUpBox: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: "#bfdbfe" },
  followUpTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginBottom: 12 },
  followUpLabel: { fontSize: 14, color: "#64748b", marginTop: 10, marginBottom: 6 },
  radioRow: { flexDirection: "row", gap: 10 },
  radioBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center" },
  radioBtnActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  radioBtnText: { color: "#64748b", fontWeight: "500" },
  radioBtnActiveText: { color: "#fff", fontWeight: "600" },
});

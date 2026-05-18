import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Linking, useWindowDimensions, Image, ActivityIndicator } from "react-native";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WebView: any = (() => { try { return require("react-native-webview").default; } catch { return null; } })();
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar } from "react-native-calendars";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { api } from "../../src/lib/api";
import { useClockIn, useClockOut, usePatientArrived, useAddShiftNotes, useSubmitFollowUp, useUploadAppointmentMedia } from "../../src/hooks/useAppointments";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../src/theme";

const API_BASE_URL: string = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "https://api.dorada.com/api/v1";
// Strip /api/v1 to get the server root (for serving static uploads)
const SERVER_ROOT = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

function pad(n: number) { return String(n).padStart(2, "0"); }

function formatPickerDate(d: Date) {
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function DateTimePickerModal({ value, onChange, onClose }: {
  value: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(value.toISOString().slice(0, 10));
  const [hour, setHour] = useState(value.getHours());
  const [minute, setMinute] = useState(Math.floor(value.getMinutes() / 5) * 5);

  function confirm() {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const result = new Date(y, m - 1, d, hour, minute);
    onChange(result);
    onClose();
  }

  return (
    <Modal transparent animationType="slide">
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <Text style={pickerStyles.title}>Select date & time</Text>
          <Calendar
            minDate={todayStr}
            selected={selectedDate}
            markedDates={{ [selectedDate]: { selected: true, selectedColor: C.primary } }}
            onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
            theme={{ todayTextColor: C.primary, arrowColor: C.primary }}
          />
          <View style={pickerStyles.timeRow}>
            <Text style={pickerStyles.timeLabel}>Time</Text>
            <View style={pickerStyles.spinnerGroup}>
              <TouchableOpacity onPress={() => setHour(h => (h + 23) % 24)} style={pickerStyles.spinBtn}>
                <Ionicons name="chevron-up" size={18} color={C.primary} />
              </TouchableOpacity>
              <Text style={pickerStyles.spinValue}>{pad(hour)}</Text>
              <TouchableOpacity onPress={() => setHour(h => (h + 1) % 24)} style={pickerStyles.spinBtn}>
                <Ionicons name="chevron-down" size={18} color={C.primary} />
              </TouchableOpacity>
            </View>
            <Text style={pickerStyles.colon}>:</Text>
            <View style={pickerStyles.spinnerGroup}>
              <TouchableOpacity onPress={() => setMinute(m => (m + 55) % 60)} style={pickerStyles.spinBtn}>
                <Ionicons name="chevron-up" size={18} color={C.primary} />
              </TouchableOpacity>
              <Text style={pickerStyles.spinValue}>{pad(minute)}</Text>
              <TouchableOpacity onPress={() => setMinute(m => (m + 5) % 60)} style={pickerStyles.spinBtn}>
                <Ionicons name="chevron-down" size={18} color={C.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={pickerStyles.btnRow}>
            <TouchableOpacity onPress={onClose} style={pickerStyles.cancelBtn}>
              <Text style={pickerStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirm} style={pickerStyles.confirmBtn}>
              <Text style={pickerStyles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpSent, setFollowUpSent] = useState(false);
  const [followUp, setFollowUp] = useState({
    has_follow_up: true,
    same_physician: true,
    same_clinic: true,
    follow_up_datetime: "",
    notes: "",
  });
  const [pickerDate, setPickerDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["appointment", id],
    queryFn: () => api.get(`/appointments/me/${id}`),
  });

  const clockIn = useClockIn(id!);
  const clockOut = useClockOut(id!);
  const patientArrived = usePatientArrived(id!);
  const addNotes = useAddShiftNotes(id!);
  const submitFollowUp = useSubmitFollowUp(id!);
  const uploadMedia = useUploadAppointmentMedia(id!);

  useEffect(() => {
    if (!data) return;
    const apptData = data as Record<string, unknown>;
    const date = new Date(apptData.date_time as string);
    const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const clinicName = (apptData.clinic as Record<string, unknown> | null)?.name as string | undefined;
    navigation.setOptions({ title: clinicName ? `${clinicName} · ${dateStr} ${timeStr}` : `${dateStr} ${timeStr}` });
  }, [data, navigation]);

  if (isLoading) return <View style={styles.center}><Text>{t("common.loading")}</Text></View>;
  if (!data) return <View style={styles.center}><Text>{t("common.not_found")}</Text></View>;

  const appt = data as Record<string, unknown>;
  const clinic = appt.clinic as Record<string, unknown> | null;
  const interpreterNotes = (clinic?.interpreter_notes as Array<{ id: string; content: string; type: string }>) ?? [];

  async function handleClockIn() {
    try {
      // Request location permission and capture coords (best-effort — clock-in proceeds regardless)
      let coords: { lat: number; lng: number } | undefined;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch {
          // GPS unavailable — continue without coords
        }
      }
      await clockIn.mutateAsync(coords);
      refetch();
    } catch {
      Alert.alert(t("common.error"));
    }
  }

  async function handlePatientArrived() {
    try { await patientArrived.mutateAsync(); refetch(); }
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
    try {
      await addNotes.mutateAsync({ notes });
      setShowNotes(false);
      setNotes("");
      setNotesSaved(true);
    } catch { Alert.alert(t("common.error")); }
  }

  async function handleUploadPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.error"), t("appointments.photo_permission_denied"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    const name = asset.fileName ?? uri.split("/").pop() ?? "photo.jpg";
    const mimeType = asset.mimeType ?? "image/jpeg";
    try {
      await uploadMedia.mutateAsync({ uri, name, mimeType });
      refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("common.error");
      Alert.alert(t("common.error"), msg);
    }
  }

  async function handleSubmitFollowUp() {
    try {
      await submitFollowUp.mutateAsync(followUp.has_follow_up ? followUp : { has_follow_up: false });
      setShowFollowUp(false);
      setFollowUpSent(true);
    } catch { Alert.alert(t("common.error")); }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {(() => {
        const invoice = appt.invoice as { status: string; amount: number } | null | undefined;
        if (!invoice) return null;
        const approved = invoice.status === "approved";
        return (
          <View style={approved ? styles.invoiceBannerApproved : styles.invoiceBannerSubmitted}>
            <Ionicons name={approved ? "checkmark-circle" : "receipt-outline"} size={20} color={approved ? "#166534" : "#92400e"} />
            <View style={styles.invoiceBannerText}>
              <Text style={[styles.invoiceBannerTitle, { color: approved ? "#166534" : "#92400e" }]}>
                {approved ? t("invoices.status_approved") : t("invoices.invoice_submitted")}
              </Text>
              <Text style={[styles.invoiceBannerAmount, { color: approved ? "#166534" : "#92400e" }]}>
                ${Number(invoice.amount).toFixed(2)}
              </Text>
            </View>
          </View>
        );
      })()}
      <View style={styles.section}>
        <Text style={styles.label}>{t("appointments.patient")}</Text>
        <Text style={styles.value}>{(appt.patient as Record<string, unknown>)?.name as string ?? "—"}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>{t("appointments.date_time")}</Text>
        <Text style={styles.value}>{new Date(appt.date_time as string).toLocaleString()}</Text>
      </View>
      {appt.status === "completed" && (appt.clock_in_time || appt.clock_out_time) && (
        <View style={styles.clockRow}>
          <Ionicons name="time-outline" size={16} color={C.textMuted} />
          <View style={styles.clockTimes}>
            {appt.clock_in_time && (
              <Text style={styles.clockText}>
                {t("appointments.clock_in")}: <Text style={styles.clockValue}>{new Date(appt.clock_in_time as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
              </Text>
            )}
            {appt.clock_out_time && (
              <Text style={styles.clockText}>
                {t("appointments.clock_out")}: <Text style={styles.clockValue}>{new Date(appt.clock_out_time as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
              </Text>
            )}
          </View>
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.label}>{t("appointments.status")}</Text>
        <Text style={styles.value}>{String(appt.status).replace(/_/g, " ")}</Text>
      </View>
      <LocationCard
        name={clinic?.name as string | null}
        address={clinic?.address as string | null}
        parking={clinic?.parking as string | null}
      />
      {(appt.insurance_agency as Record<string, unknown> | null)?.name && (
        <View style={styles.section}>
          <Text style={styles.label}>{t("appointments.insurance_agency")}</Text>
          <Text style={styles.value}>{(appt.insurance_agency as Record<string, unknown>).name as string}</Text>
        </View>
      )}

      {interpreterNotes.length > 0 && (
        <View style={styles.notesSection}>
          {interpreterNotes.map((note) => (
            <View key={note.id} style={[styles.noteCard, note.type === "important" ? styles.noteImportant : note.type === "notice" ? styles.noteNotice : styles.noteInfo]}>
              <View style={styles.noteHeader}>
                <Ionicons
                  name={note.type === "important" ? "alert-circle" : note.type === "notice" ? "warning-outline" : "information-circle-outline"}
                  size={16}
                  color={note.type === "important" ? "#b91c1c" : note.type === "notice" ? "#92400e" : "#1e40af"}
                />
                <Text style={[styles.noteType, note.type === "important" ? styles.noteTypeImportant : note.type === "notice" ? styles.noteTypeNotice : styles.noteTypeInfo]}>
                  {note.type === "important" ? "Important" : note.type === "notice" ? "Notice" : "Info"}
                </Text>
              </View>
              <Text style={[styles.noteContent, note.type === "important" ? styles.noteContentImportant : note.type === "notice" ? styles.noteContentNotice : styles.noteContentInfo]}>
                {note.content}
              </Text>
            </View>
          ))}
        </View>
      )}

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
          {appt.patient_arrived_at ? (
            <View style={styles.arrivedBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={styles.arrivedText}>
                {t("appointments.patient_arrived_at", { time: new Date(appt.patient_arrived_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={[styles.btn, styles.successBtn]} onPress={handlePatientArrived} disabled={patientArrived.isPending}>
              <Ionicons name="person-add-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>{t("appointments.patient_arrived")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btn, styles.dangerBtn]} onPress={handleClockOut} disabled={clockOut.isPending}>
            <Ionicons name="exit-outline" size={20} color="#fff" />
            <Text style={styles.btnText}>{t("appointments.clock_out")}</Text>
          </TouchableOpacity>
        </>
      )}

      {(appt.status === "completed" || appt.status === "in_progress") && (
        <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={() => setShowNotes(!showNotes)}>
          <Ionicons name="create-outline" size={20} color={C.primary} />
          <Text style={[styles.btnText, { color: C.primary }]}>{t("appointments.add_notes")}</Text>
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
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={C.primary} />
                <Text style={styles.dateBtnText}>
                  {followUp.follow_up_datetime
                    ? formatPickerDate(new Date(followUp.follow_up_datetime))
                    : t("follow_up.select_date_time")}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={handleSubmitFollowUp} disabled={submitFollowUp.isPending}>
            <Text style={styles.btnText}>{t("common.submit")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {notesSaved && (
        <View style={styles.confirmBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
          <Text style={styles.confirmText}>{t("appointments.notes_saved")}</Text>
        </View>
      )}

      {followUpSent && (
        <View style={styles.confirmBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
          <Text style={styles.confirmText}>{t("appointments.follow_up_sent")}</Text>
        </View>
      )}

      {/* Media / Photo upload section */}
      {(appt.status === "in_progress" || appt.status === "completed") && (() => {
        type MediaItem = { id: string; public_url: string; filename: string; mime_type: string };
        const mediaList = (appt.media as MediaItem[] | undefined) ?? [];
        return (
          <View style={styles.mediaSection}>
            <View style={styles.mediaSectionHeader}>
              <Ionicons name="images-outline" size={16} color={C.primary} />
              <Text style={styles.mediaSectionTitle}>{t("appointments.photos")}</Text>
            </View>

            {mediaList.length > 0 && (
              <View style={styles.mediaGrid}>
                {mediaList.map((item) => {
                  const fullUrl = item.public_url.startsWith("http")
                    ? item.public_url
                    : `${SERVER_ROOT}${item.public_url}`;
                  return (
                    <Image
                      key={item.id}
                      source={{ uri: fullUrl }}
                      style={styles.mediaThumbnail}
                      resizeMode="cover"
                    />
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, styles.secondaryBtn, uploadMedia.isPending && styles.btnDisabled]}
              onPress={handleUploadPhoto}
              disabled={uploadMedia.isPending}
            >
              {uploadMedia.isPending
                ? <ActivityIndicator size="small" color={C.primary} />
                : <Ionicons name="camera-outline" size={20} color={C.primary} />
              }
              <Text style={[styles.btnText, { color: C.primary }]}>
                {uploadMedia.isPending ? t("common.uploading") : t("appointments.upload_photo")}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {showPicker && (
        <DateTimePickerModal
          value={pickerDate}
          onChange={(d) => {
            setPickerDate(d);
            setFollowUp(s => ({ ...s, follow_up_datetime: d.toISOString() }));
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LocationCard({ name, address, parking }: { name: string | null; address: string | null; parking: string | null }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const mapHeight = 180;

  const embedUrl = address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&zoom=15`
    : null;

  function openMaps() {
    if (!address) return;
    const query = encodeURIComponent(address);
    const url = Platform.OS === "ios"
      ? `maps:0,0?q=${query}`
      : `geo:0,0?q=${query}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
    );
  }

  return (
    <View style={locStyles.card}>
      <View style={locStyles.header}>
        <Ionicons name="location-outline" size={16} color={C.primary} />
        <Text style={locStyles.title}>{t("appointments.location")}</Text>
        {address && (
          <TouchableOpacity onPress={openMaps} style={locStyles.mapsBtn}>
            <Ionicons name="navigate-outline" size={14} color={C.primary} />
            <Text style={locStyles.mapsBtnText}>{t("appointments.open_maps")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {embedUrl && WebView ? (
        <TouchableOpacity onPress={openMaps} activeOpacity={0.95} style={[locStyles.mapContainer, { height: mapHeight, width: width - 64 }]}>
          <WebView
            source={{ uri: embedUrl }}
            style={locStyles.map}
            scrollEnabled={false}
            pointerEvents="none"
          />
        </TouchableOpacity>
      ) : address ? (
        <TouchableOpacity onPress={openMaps} activeOpacity={0.8} style={[locStyles.mapPlaceholder, { height: mapHeight }]}>
          <Ionicons name="map-outline" size={32} color={C.primary} />
          <Text style={[locStyles.muted, { color: C.primary, fontWeight: "600" }]}>{t("appointments.open_maps")}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[locStyles.mapPlaceholder, { height: mapHeight }]}>
          <Ionicons name="map-outline" size={32} color={C.textMuted} />
          <Text style={locStyles.muted}>{t("appointments.no_address")}</Text>
        </View>
      )}

      <Text style={locStyles.name}>{name ?? "—"}</Text>

      {address && (
        <TouchableOpacity onPress={openMaps} activeOpacity={0.7}>
          <Text style={locStyles.address}>{address}</Text>
        </TouchableOpacity>
      )}

      {parking && (
        <View style={locStyles.parkingRow}>
          <Ionicons name="car-outline" size={14} color={C.textMuted} />
          <Text style={locStyles.parkingText}>{parking}</Text>
        </View>
      )}
    </View>
  );
}

const locStyles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 10, padding: 14, marginBottom: 8, gap: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  title: { flex: 1, fontSize: 12, fontWeight: "600", color: C.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  mapsBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  mapsBtnText: { fontSize: 12, color: C.primary, fontWeight: "600" },
  mapContainer: { borderRadius: 8, overflow: "hidden", marginBottom: 10 },
  map: { flex: 1 },
  mapPlaceholder: { borderRadius: 8, backgroundColor: C.border, alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: "600", color: C.text },
  address: { fontSize: 14, color: C.textMuted, lineHeight: 20, marginTop: 2 },
  muted: { fontSize: 13, color: C.textMuted },
  parkingRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.border },
  parkingText: { flex: 1, fontSize: 13, color: C.textMuted, lineHeight: 18 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: 16, gap: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { backgroundColor: C.surface, borderRadius: 8, padding: 14, marginBottom: 8 },
  label: { fontSize: 12, color: C.textMuted, marginBottom: 2 },
  value: { fontSize: 15, color: C.text, fontWeight: "500" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 10, gap: 8, marginTop: 8 },
  primaryBtn: { backgroundColor: C.primary },
  dangerBtn: { backgroundColor: C.danger },
  successBtn: { backgroundColor: C.success },
  secondaryBtn: { backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.borderStrong },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  invoiceBannerSubmitted: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fcd34d", borderRadius: 10, padding: 14, marginBottom: 8 },
  invoiceBannerApproved: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#dcfce7", borderWidth: 1, borderColor: "#86efac", borderRadius: 10, padding: 14, marginBottom: 8 },
  invoiceBannerText: { flex: 1 },
  invoiceBannerTitle: { fontSize: 14, fontWeight: "700" },
  invoiceBannerAmount: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  clockRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.surface, borderRadius: 8, padding: 14, marginBottom: 8 },
  clockTimes: { flex: 1, gap: 4 },
  clockText: { fontSize: 13, color: C.textMuted },
  clockValue: { color: C.text, fontWeight: "600" },
  arrivedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.successBg, borderWidth: 1, borderColor: C.successBorder, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginTop: 8 },
  arrivedText: { color: C.success, fontSize: 14, fontWeight: "600" },
  confirmBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.successBg, borderWidth: 1, borderColor: C.successBorder, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginTop: 12 },
  confirmText: { color: C.success, fontSize: 14, fontWeight: "600" },
  notesSection: { gap: 8, marginBottom: 4 },
  noteCard: { borderRadius: 10, padding: 12, borderLeftWidth: 4, gap: 4 },
  noteImportant: { backgroundColor: "#fef2f2", borderLeftColor: "#ef4444" },
  noteNotice: { backgroundColor: "#fffbeb", borderLeftColor: "#f59e0b" },
  noteInfo: { backgroundColor: "#eff6ff", borderLeftColor: "#3b82f6" },
  noteHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  noteType: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  noteTypeImportant: { color: "#b91c1c" },
  noteTypeNotice: { color: "#92400e" },
  noteTypeInfo: { color: "#1e40af" },
  noteContent: { fontSize: 14, lineHeight: 20 },
  noteContentImportant: { color: "#7f1d1d" },
  noteContentNotice: { color: "#78350f" },
  noteContentInfo: { color: "#1e3a8a" },
  notesBox: { backgroundColor: C.surface, borderRadius: 8, padding: 14, marginTop: 8, gap: 8 },
  notesInput: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: "top", color: C.text },
  btnDisabled: { opacity: 0.6 },
  mediaSection: { backgroundColor: C.surface, borderRadius: 10, padding: 14, marginTop: 8, gap: 10 },
  mediaSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  mediaSectionTitle: { fontSize: 12, fontWeight: "600", color: C.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mediaThumbnail: { width: 90, height: 90, borderRadius: 8, backgroundColor: C.border },
  followUpBox: { backgroundColor: C.surface, borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: C.borderStrong },
  followUpTitle: { fontSize: 16, fontWeight: "600", color: C.text, marginBottom: 12 },
  followUpLabel: { fontSize: 14, color: C.textMuted, marginTop: 10, marginBottom: 6 },
  radioRow: { flexDirection: "row", gap: 10 },
  radioBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  radioBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  radioBtnText: { color: C.textMuted, fontWeight: "500" },
  radioBtnActiveText: { color: "#fff", fontWeight: "600" },
  dateBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: C.primaryLight, marginTop: 4 },
  dateBtnText: { color: C.primary, fontSize: 14, fontWeight: "500" },
});

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  title: { fontSize: 16, fontWeight: "600", color: C.text, textAlign: "center", paddingTop: 20, paddingBottom: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  timeLabel: { fontSize: 14, color: C.textMuted, marginRight: 8 },
  spinnerGroup: { alignItems: "center", gap: 4 },
  spinBtn: { padding: 6 },
  spinValue: { fontSize: 28, fontWeight: "700", color: C.text, minWidth: 44, textAlign: "center" },
  colon: { fontSize: 28, fontWeight: "700", color: C.text, marginBottom: 4 },
  btnRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  cancelText: { fontSize: 15, color: C.textMuted, fontWeight: "600" },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: C.primary, alignItems: "center" },
  confirmText: { fontSize: 15, color: "#fff", fontWeight: "600" },
});

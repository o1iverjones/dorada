import { useEffect } from "react";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/store/auth";
import { useMessagesStore } from "../../src/store/messages";
import { registerForPushNotifications, syncFcmToken } from "../../src/lib/notifications";

function HeaderLogo() {
  return (
    <Image
      source={require("../../assets/logo.jpeg")}
      style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12 }}
    />
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const hasUnread = useMessagesStore((s) => s.hasUnread);
  const setHasUnread = useMessagesStore((s) => s.setHasUnread);
  const { interpreter } = useAuthStore();

  // Sync FCM token on every app launch so it stays current
  useEffect(() => {
    if (!interpreter?.id) return;
    registerForPushNotifications()
      .then((token) => { if (token) return syncFcmToken(token); })
      .catch(() => {});
  }, [interpreter?.id]);

  // Poll conversations every 5 seconds to keep the unread dot up to date
  useEffect(() => {
    if (!interpreter?.id) return;
    const check = async () => {
      try {
        const res = await api.get<{ data: Array<{ unread_count: number }> }>("/messages/conversations");
        const total = res.data.reduce((sum, c) => sum + c.unread_count, 0);
        setHasUnread(total > 0);
      } catch {}
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [interpreter?.id, setHasUnread]);

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#0e402d", headerShown: true, headerStyle: { backgroundColor: "#0e402d" }, headerTintColor: "#ffffff", headerTitleStyle: { fontWeight: "700" }, headerRight: () => <HeaderLogo /> }}>
      <Tabs.Screen
        name="appointments"
        options={{
          title: t("nav.appointments"),
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          title: t("nav.availability"),
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("nav.messages"),
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubble-outline" size={size} color={color} />
              {hasUnread && (
                <View style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: "#f97316" }} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: t("invoices.earnings"),
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

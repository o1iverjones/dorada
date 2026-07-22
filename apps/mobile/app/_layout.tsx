import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Image } from "react-native";
import * as Notifications from "expo-notifications";
import { queryClient } from "../src/lib/queryClient";
import "../src/lib/i18n";

function HeaderLogo() {
  return (
    <Image
      source={require("../assets/logo.jpeg")}
      style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12 }}
    />
  );
}

export default function RootLayout() {
  useEffect(() => {
    function handleNotificationTap(data: Record<string, string>) {
      switch (data.type) {
        case "message":
          router.navigate("/(tabs)/messages");
          break;
        case "offer":
          router.navigate("/(tabs)/appointments");
          break;
        case "appointment_reminder":
        case "follow_up_prompt":
          if (data.appointment_id || data.appointmentId) {
            router.navigate(`/appointment/${data.appointment_id ?? data.appointmentId}`);
          } else {
            router.navigate("/(tabs)/appointments");
          }
          break;
      }
    }

    // Handle taps while app is running (background → foreground)
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | null;
      if (data?.type) handleNotificationTap(data);
    });

    // Handle cold start: the tap that launched the app fires before the
    // listener registers, so check for a queued response.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, string> | null;
      if (data?.type) handleNotificationTap(data);
    });

    return () => sub.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="appointment/[id]"
          options={{
            headerShown: true,
            title: "Appointment",
            headerStyle: { backgroundColor: "#0e402d" },
            headerTintColor: "#ffffff",
            headerTitleStyle: { fontWeight: "700" },
            // @ts-ignore — headerTitleContainerStyle is valid at runtime but missing from types
            headerTitleContainerStyle: { maxWidth: "75%" },
            headerRight: () => <HeaderLogo />,
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}

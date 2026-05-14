import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Image } from "react-native";
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
            headerTitleContainerStyle: { maxWidth: "75%" },
            headerRight: () => <HeaderLogo />,
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}

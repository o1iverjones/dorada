import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuthStore } from "../src/store/auth";
import { C } from "../src/theme";

export default function Index() {
  const interpreter = useAuthStore((s) => s.interpreter);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.background }}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return <Redirect href={interpreter ? "/(tabs)/appointments" : "/login"} />;
}

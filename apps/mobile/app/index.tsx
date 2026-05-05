import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/auth";

export default function Index() {
  const interpreter = useAuthStore((s) => s.interpreter);
  return <Redirect href={interpreter ? "/(tabs)/appointments" : "/login"} />;
}

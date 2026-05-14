import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import en from "@pulpito/i18n/locales/en.json";
import es from "@pulpito/i18n/locales/es.json";

const deviceLocale = getLocales()[0]?.languageCode ?? "en";

i18next.use(initReactI18next).init({
  lng: deviceLocale,
  fallbackLng: "en",
  compatibilityJSON: "v3",
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  interpolation: { escapeValue: false },
});

export default i18next;
